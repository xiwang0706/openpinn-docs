(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OpenPINNPhysicsEditor = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // A data-only expression language. Never interpret input as JavaScript or Python.
  var LIMITS = Object.freeze({bytes: 1024 * 1024, specBytes: 65536, parameters: 100, source: 8192, nodes: 512, depth: 32});
  var FUNCTIONS = ["dx", "dy", "dt", "sin", "cos", "exp", "sqrt", "log"];
  var RESERVED = FUNCTIONS.concat(["x", "y", "t", "pi", "__proto__", "prototype", "constructor"]);
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function fail(message) { throw new Error(message); }
  function plain(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(label + " 必须是对象。");
    return value;
  }
  function keys(value, allowed, label) {
    Object.keys(value).forEach(function (key) {
      if (allowed.indexOf(key) < 0) fail(label + " 含不支持的字段：" + key);
    });
  }
  function identifier(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(value) || value.includes("__") || RESERVED.indexOf(value) >= 0) {
      fail(label + " 须为字母开头的英文标识符（最多 32 字符），且不能使用保留名称。");
    }
    return value;
  }
  function text(value, label, max) {
    if (typeof value !== "string" || value.length > (max || 1000)) fail(label + " 必须是长度受限的文字。");
    return value;
  }
  function finite(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(label + " 必须是有限数值。");
    return value;
  }
  function jsonData(input) {
    var source = typeof input === "string" ? input : JSON.stringify(input);
    if (typeof source !== "string") fail("缺少 JSON 数据。");
    var bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(source).length : unescape(encodeURIComponent(source)).length;
    if (bytes > LIMITS.bytes) fail("JSON 文件超过 1 MB 上限。");
    return JSON.parse(source, function (key, value) {
      if (["__proto__", "prototype", "constructor"].indexOf(key) >= 0) fail("JSON 含禁止的属性名称。");
      return value;
    });
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function contextCheck(context) {
    if (context.dimension !== 1 && context.dimension !== 2) fail("仅支持一维或二维单场模型。");
    if (context.kind !== "static" && context.kind !== "dynamic") fail("问题类型必须为 static 或 dynamic。");
  }

  function parseExpression(source, context) {
    if (typeof source !== "string" || !source.trim()) fail("请输入控制方程。");
    if (source.length > LIMITS.source) fail("公式超过 8192 字符上限。");
    var tokens = [], offset = 0, token;
    var pattern = /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|\*\*|[+\-*/(),=]/y;
    while (offset < source.length) {
      pattern.lastIndex = offset;
      token = pattern.exec(source);
      if (!token) fail("公式第 " + (offset + 1) + " 个字符不受支持。仅允许数值、符号、括号及规定运算。");
      offset = pattern.lastIndex;
      if (!/^\s/.test(token[0])) tokens.push(token[0]);
      if (tokens.length > LIMITS.nodes * 5) fail("公式过大。");
    }
    var index = 0, count = 0;
    function node(value) { count += 1; if (count > LIMITS.nodes) fail("公式节点超过 512 个。"); return value; }
    function expr(minimum, depth) {
      if (depth > LIMITS.depth) fail("公式嵌套超过 32 层。");
      var current = tokens[index++], left;
      if (current === "-" || current === "+") {
        left = expr(25, depth + 1);
        if (current === "-") left = node({type: "unary", op: "-", arg: left});
      } else if (current === "(") {
        left = expr(0, depth + 1);
        if (tokens[index++] !== ")") fail("公式括号不匹配。");
      } else if (current && /^(?:\d|\.)/.test(current)) {
        left = node({type: "number", value: finite(Number(current), "公式常数")});
      } else if (current && /^[A-Za-z]/.test(current)) {
        if (tokens[index] === "(") {
          if (FUNCTIONS.indexOf(current) < 0) fail("不支持函数：" + current);
          index += 1;
          var argument = expr(0, depth + 1);
          if (tokens[index++] !== ")") fail(current + " 只接受一个参数；请检查括号。");
          left = node({type: "call", name: current, args: [argument]});
        } else left = node({type: "symbol", name: current});
      } else fail("公式缺少数值、变量或子表达式。");
      while (index < tokens.length) {
        var op = tokens[index], precedence = {"+": 10, "-": 10, "*": 20, "/": 20, "**": 30}[op];
        if (precedence === undefined || precedence < minimum) break;
        index += 1;
        left = node({type: "binary", op: op, left: left, right: expr(precedence + (op === "**" ? 0 : 1), depth + 1)});
      }
      return left;
    }
    var result = expr(0, 0);
    if (tokens[index] === "=") {
      index += 1;
      result = node({type: "binary", op: "-", left: result, right: expr(0, 0)});
    }
    if (index !== tokens.length) fail("公式含多余内容；乘法须显式写 *，等号最多一个。");
    validateAST(result, context);
    return result;
  }

  function constant(node) {
    if (node.type === "number") return node.value;
    if (node.type === "symbol" && node.name === "pi") return Math.PI;
    if (node.type === "unary") { var c = constant(node.arg); return c === null ? null : -c; }
    if (node.type === "binary") {
      var a = constant(node.left), b = constant(node.right);
      if (a === null || b === null) return null;
      return finite({"+": function () {return a+b;}, "-": function () {return a-b;}, "*": function () {return a*b;}, "/": function () {return a/b;}, "**": function () {return a**b;}}[node.op](), "常数表达式");
    }
    if (node.type === "call") {
      var v = constant(node.args[0]);
      if (v === null) return null;
      if (["dx", "dy", "dt"].includes(node.name)) return 0;
      return finite(Math[node.name](v), "常数函数");
    }
    return null;
  }
  function validateAST(ast, context) {
    var count = 0, stack = [];
    if (context) contextCheck(context);
    var symbols = context ? [context.field || "p", "x", "pi"].concat(context.dimension === 2 ? ["y"] : []).concat(context.kind === "dynamic" ? ["t"] : []).concat((context.parameters || []).map(function (p) { return p.symbol; })) : null;
    var used = new Set();
    function visit(node, depth, timeDepth, derivativeDepth) {
      plain(node, "公式节点");
      count += 1;
      if (count > LIMITS.nodes || depth > LIMITS.depth) fail("公式超过节点或嵌套上限。");
      if (stack.indexOf(node) >= 0) fail("公式 AST 不能循环引用。");
      stack.push(node);
      if (node.type === "number") { keys(node, ["type", "value"], "常数节点"); finite(node.value, "公式常数"); }
      else if (node.type === "symbol") {
        keys(node, ["type", "name"], "符号节点");
        if (typeof node.name !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(node.name) || node.name.includes("__") || (RESERVED.includes(node.name) && !["x", "y", "t", "pi"].includes(node.name))) fail("无效公式符号。");
        if (symbols && symbols.indexOf(node.name) < 0) fail("未定义或当前维度不可用的符号：" + node.name);
        used.add(node.name);
      } else if (node.type === "unary") {
        keys(node, ["type", "op", "arg"], "一元节点");
        if (node.op !== "-") fail("仅支持一元负号。");
        visit(node.arg, depth + 1, timeDepth, derivativeDepth);
      } else if (node.type === "binary") {
        keys(node, ["type", "op", "left", "right"], "二元节点");
        if (["+", "-", "*", "/", "**"].indexOf(node.op) < 0) fail("不支持该二元运算。");
        visit(node.left, depth + 1, timeDepth, derivativeDepth); visit(node.right, depth + 1, timeDepth, derivativeDepth);
        if (node.op === "**" && (constant(node.right) === null || Math.abs(constant(node.right)) > 16)) fail("幂指数必须是绝对值不超过 16 的数值常量。");
        if (node.op === "/" && constant(node.right) === 0) fail("公式不能除以零。");
        if (node.op === "**" && constant(node.left) === 0 && constant(node.right) <= 0) fail("零的幂指数必须为正。");
      } else if (node.type === "call") {
        keys(node, ["type", "name", "args"], "函数节点");
        if (FUNCTIONS.indexOf(node.name) < 0 || !Array.isArray(node.args) || node.args.length !== 1) fail("函数必须为允许的一元函数。");
        if (context && node.name === "dy" && context.dimension !== 2) fail("一维模型不能使用 dy。");
        if (context && node.name === "dt" && context.kind !== "dynamic") fail("静态模型不能使用 dt。");
        if (node.name === "dt" && timeDepth > 0) fail("当前单场编辑器不支持二阶时间导数 dt(dt(...))。");
        var nextOrder = derivativeDepth + (["dx", "dy", "dt"].includes(node.name) ? 1 : 0);
        if (nextOrder > 2) fail("求导总阶数不能超过二阶。");
        visit(node.args[0], depth + 1, timeDepth + (node.name === "dt" ? 1 : 0), nextOrder);
      } else fail("未知 AST 节点类型。");
      constant(node); // Reject invalid constant domains before generating code.
      stack.pop();
    }
    visit(ast, 0, 0, 0);
    if (context && !used.has(context.field || "p")) fail("方程必须引用当前未知场。");
    return ast;
  }

  function unitDefinition(name, catalog) {
    var units = catalog && catalog.units;
    if (typeof name !== "string" || !units || !own(units, name)) fail("未知单位：" + String(name));
    var entry = units[name];
    if (!entry || !Number.isFinite(entry.factor) || entry.factor <= 0 || !Array.isArray(entry.dimensions) || entry.dimensions.length !== 4 || !entry.dimensions.every(Number.isFinite)) fail("单位定义无效：" + name);
    return entry;
  }
  function sameDimension(a, b) { return a.every(function (v, i) { return Math.abs(v - b[i]) < 1e-10; }); }
  function inferDimensions(ast, spec, catalog) {
    var dims = Object.create(null), zero = [0, 0, 0, 0];
    dims.pi = zero;
    dims[spec.field] = unitDefinition(spec.field_unit, catalog).dimensions;
    ["x", "y", "t"].forEach(function (name) { if (spec.coordinate_units[name]) dims[name] = unitDefinition(spec.coordinate_units[name], catalog).dimensions; });
    spec.parameters.forEach(function (p) { dims[p.symbol] = unitDefinition(p.unit, catalog).dimensions; });
    function visit(node) {
      if (constant(node) === 0) return null;
      if (node.type === "number") return node.value === 0 ? null : zero;
      if (node.type === "symbol") return dims[node.name];
      if (node.type === "unary") return visit(node.arg);
      if (node.type === "binary") {
        var a = visit(node.left), b = visit(node.right);
        if (node.op === "+" || node.op === "-") {
          if (a && b && !sameDimension(a, b)) fail("加减两侧的物理量纲不一致，请检查参数和变量单位。");
          return a || b;
        }
        if (node.op === "**") return (a || zero).map(function (v) { return v * constant(node.right); });
        return (a || zero).map(function (v, i) { return v + (node.op === "*" ? 1 : -1) * (b || zero)[i]; });
      }
      var arg = visit(node.args[0]);
      if (["dx", "dy", "dt"].indexOf(node.name) >= 0) return (arg || zero).map(function (v, i) { return v - dims[node.name[1]][i]; });
      if (node.name === "sqrt") return (arg || zero).map(function (v) { return v / 2; });
      if (arg && !sameDimension(arg, zero)) fail(node.name + " 的参数必须无量纲。");
      return zero;
    }
    return visit(ast) || zero;
  }
  function parametersCheck(parameters, catalog, allowMissing, libraryDefinitions) {
    if (!Array.isArray(parameters) || parameters.length > LIMITS.parameters) fail("参数必须为数组，且最多 100 项。");
    var ids = new Set(), symbols = new Set();
    return parameters.map(function (item) {
      plain(item, "参数");
      keys(item, ["id", "symbol", "value", "unit", "label", "description", "category", "source", "minimum", "maximum"], "参数");
      if (typeof item.id !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(item.id)) fail("参数 id 必须为字母开头的唯一标识（最多 64 字符）。");
      identifier(item.symbol, "参数符号");
      if (ids.has(item.id)) fail("参数 id 重复：" + item.id);
      if (!libraryDefinitions && symbols.has(item.symbol)) fail("参数符号重复：" + item.symbol);
      ids.add(item.id); symbols.add(item.symbol);
      unitDefinition(item.unit, catalog);
      if (!(allowMissing && item.value === null)) finite(item.value, item.symbol + " 的值");
      if (item.value !== null) finite(item.value * unitDefinition(item.unit, catalog).factor, item.symbol + " 的 SI 值");
      var result = {id: item.id, symbol: item.symbol, value: item.value, unit: item.unit};
      ["label", "description", "category", "source"].forEach(function (key) { if (own(item, key)) result[key] = text(item[key], "参数 " + key); });
      ["minimum", "maximum"].forEach(function (key) {
        if (!own(item, key)) return;
        result[key] = finite(item[key], key);
        if (item.value !== null && (key === "minimum" ? item.value < item[key] : item.value > item[key])) fail(item.symbol + " 超出 " + key + " 限制。");
      });
      if (own(item, "minimum") && own(item, "maximum") && item.minimum > item.maximum) fail("参数上下界颠倒。");
      return result;
    });
  }
  function validateSpec(input, catalog) {
    var spec = jsonData(input);
    if (unescape(encodeURIComponent(JSON.stringify(spec))).length > LIMITS.specBytes) fail("方程快照超过 64 KB 上限。");
    plain(spec, "工程物理设置");
    keys(spec, ["schema_version", "dimension", "kind", "field", "field_unit", "coordinate_units", "expression", "expression_source", "parameters"], "工程物理设置");
    if (spec.schema_version !== 1) fail("仅支持 schema_version: 1。");
    contextCheck(spec); identifier(spec.field, "场变量");
    unitDefinition(spec.field_unit, catalog);
    plain(spec.coordinate_units, "坐标单位"); keys(spec.coordinate_units, ["x", "y", "t"], "坐标单位");
    ["x"].concat(own(spec.coordinate_units, "y") || spec.dimension === 2 ? ["y"] : []).forEach(function (name) {
      if (!sameDimension(unitDefinition(spec.coordinate_units[name], catalog).dimensions, [0, 1, 0, 0])) fail(name + " 必须使用长度单位。");
    });
    if (spec.dimension === 2 && spec.coordinate_units.x !== spec.coordinate_units.y) fail("x/y 必须使用相同长度单位，以保持几何与法向一致。");
    if (own(spec.coordinate_units, "t") && !sameDimension(unitDefinition(spec.coordinate_units.t, catalog).dimensions, [0, 0, 1, 0])) fail("t 必须使用时间单位。");
    if (spec.kind === "dynamic" && !own(spec.coordinate_units, "t")) fail("动态模型缺少时间单位。");
    spec.parameters = parametersCheck(spec.parameters, catalog, false);
    spec.parameters.forEach(function (p) { if (p.symbol === spec.field) fail("参数符号不能与场变量重名。"); });
    validateAST(spec.expression, spec);
    if (own(spec, "expression_source")) {
      text(spec.expression_source, "公式文本", LIMITS.source);
      var fromSource = parseExpression(spec.expression_source, spec);
      if (toSource(fromSource) !== toSource(spec.expression)) fail("公式文本与 AST 不一致；请重新编辑或导出工程。");
    } else spec.expression_source = toSource(spec.expression);
    inferDimensions(spec.expression, spec, catalog);
    return spec;
  }
  function toSource(ast) {
    validateAST(ast);
    function walk(n) {
      if (n.type === "number") return String(n.value);
      if (n.type === "symbol") return n.name;
      if (n.type === "unary") return "(-" + walk(n.arg) + ")";
      if (n.type === "binary") return "(" + walk(n.left) + " " + n.op + " " + walk(n.right) + ")";
      return n.name + "(" + walk(n.args[0]) + ")";
    }
    return walk(ast);
  }
  function toLatex(ast) {
    validateAST(ast);
    function walk(n) {
      if (n.type === "number") return String(n.value);
      if (n.type === "symbol") return "\\mathrm{" + n.name.replace(/_/g, "\\_") + "}";
      if (n.type === "unary") return "-\\left(" + walk(n.arg) + "\\right)";
      if (n.type === "binary") {
        var a = walk(n.left), b = walk(n.right);
        if (n.op === "/") return "\\frac{" + a + "}{" + b + "}";
        if (n.op === "**") return "\\left(" + a + "\\right)^{" + b + "}";
        return "\\left(" + a + (n.op === "*" ? " \\cdot " : " " + n.op + " ") + b + "\\right)";
      }
      if (["dx", "dy", "dt"].indexOf(n.name) >= 0) return "\\frac{\\partial}{\\partial " + n.name[1] + "}\\left(" + walk(n.args[0]) + "\\right)";
      if (n.name === "sqrt") return "\\sqrt{" + walk(n.args[0]) + "}";
      return "\\" + n.name + "\\left(" + walk(n.args[0]) + "\\right)";
    }
    return walk(ast);
  }

  function validateParameterPack(input, catalog) {
    var pack = jsonData(input);
    plain(pack, "参数包"); keys(pack, ["schema_version", "parameters", "materials"], "参数包");
    if (pack.schema_version !== 1) fail("参数包仅支持 schema_version: 1。");
    var parameters = parametersCheck(pack.parameters || [], catalog, true, true);
    parameters.forEach(function (p) { if (p.value !== null) fail("参数包中的定义必须使用 value: null，具体数值放入 materials。"); });
    var definitions = new Map((catalog.parameters || []).map(function (p) { return [p.id, p]; }));
    parameters.forEach(function (p) {
      var previous = definitions.get(p.id);
      if (previous && JSON.stringify(parametersCheck([previous], catalog, true)[0]) !== JSON.stringify(p)) fail("已有参数定义冲突：" + p.id);
      definitions.set(p.id, p);
    });
    if (!Array.isArray(pack.materials || []) || (pack.materials || []).length > 100) fail("材料列表最多 100 项。");
    var materialIds = new Set();
    var materials = (pack.materials || []).map(function (material) {
      plain(material, "材料"); keys(material, ["id", "label", "description", "parameters", "source", "conditions"], "材料");
      if (typeof material.id !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(material.id) || materialIds.has(material.id)) fail("材料 id 无效或重复。");
      materialIds.add(material.id);
      text(material.label, "材料名称");
      if (own(material, "description")) text(material.description, "材料描述");
      text(material.source, "材料来源");
      if (own(material, "conditions")) text(material.conditions, "材料条件");
      if (!Array.isArray(material.parameters) || material.parameters.length > LIMITS.parameters) fail("材料参数必须为有界列表。");
      var seen = new Set();
      material.parameters.forEach(function (p) {
        plain(p, "材料值"); keys(p, ["id", "value", "unit", "source"], "材料值");
        var definition = definitions.get(p.id);
        if (!definition || seen.has(p.id)) fail("材料引用未知/重复参数：" + p.id);
        seen.add(p.id);
        if (!sameDimension(unitDefinition(p.unit, catalog).dimensions, unitDefinition(definition.unit, catalog).dimensions)) fail("材料单位量纲与定义不符。");
        finite(p.value, "材料数值"); finite(p.value * unitDefinition(p.unit, catalog).factor, "材料 SI 数值");
        if (own(p, "source")) text(p.source, "材料参数来源");
      });
      return material;
    });
    return {schema_version: 1, parameters: parameters, materials: materials};
  }

  function create(container, options) {
    options = options || {};
    if (!container || !container.ownerDocument) fail("缺少物理编辑器容器。");
    var doc = container.ownerDocument, win = doc.defaultView, catalog = clone(options.catalog || {});
    if (catalog.schema_version !== 1 || !catalog.units) fail("缺少 schema_version: 1 的物理目录。");
    var context = {dimension: options.dimension || 2, kind: options.kind || "static"};
    contextCheck(context);
    var definitions = parametersCheck(catalog.parameters || [], catalog, true, true), materials = clone(catalog.materials || []);
    var state = null, disposed = false, controls = {}, parameterInputs = [], lastResult = null, previousField = "";
    var root = doc.createElement("section"); root.className = "physics-editor"; container.appendChild(root);
    function element(tag, value, className, parent) {
      var node = doc.createElement(tag); if (value !== null && value !== undefined) node.textContent = value;
      if (className) node.className = className; if (parent) parent.appendChild(node); return node;
    }
    function field(parent, title, role, type, value) {
      var label = element("label", null, "physics-editor-field", parent); element("span", title, null, label);
      var node = element(type === "textarea" ? "textarea" : type === "select" ? "select" : "input", null, null, label);
      if (node.tagName === "INPUT") node.type = type || "text";
      node.setAttribute("data-role", "physics-" + role); node.setAttribute("aria-label", title);
      if (value !== undefined) node.value = value; controls[role] = node; return node;
    }
    function button(parent, title, role, action) {
      var node = element("button", title, null, parent); node.type = "button"; node.setAttribute("data-role", "physics-" + role);
      node.addEventListener("click", function () { try { action(); } catch (error) { showError(error); } }); controls[role] = node; return node;
    }
    function selectOptions(select, entries, previous) {
      select.replaceChildren(); entries.forEach(function (entry) { var node = element("option", entry.label, null, select); node.value = entry.value; });
      if (previous !== undefined) select.value = previous;
    }
    function unitOptions(select, dimension) {
      selectOptions(select, Object.keys(catalog.units).filter(function (name) { return !dimension || sameDimension(unitDefinition(name, catalog).dimensions, dimension); }).map(function (name) { return {value: name, label: name}; }));
    }
    element("h3", "控制方程与物理参数", null, root);
    element("p", "先选模板或输入方程，再填写下方参数。导数按钮作用于当前场变量；cx、cy 等参数是系数，不是场的导数。", "physics-editor-note", root);
    var templateRow = element("div", null, "physics-editor-toolbar", root);
    var templateSelect = field(templateRow, "物理模板（含固结系数）", "template", "select");
    selectOptions(templateSelect, [{value: "", label: "选择模板"}].concat((catalog.templates || []).map(function (t) { return {value: t.id, label: t.label + (t.is_demo && !t.label.includes("演示") ? "（演示）" : "")}; })));
    button(templateRow, "替换当前物理设置", "load-template", function () { loadTemplate(templateSelect.value); });
    element("p", "固结模板含一维 cv、二维各向同性 cv 和二维各向异性 cx/cy；先在上方设置对应维度与“含时间方程”。加载模板会替换公式、变量、参数和单位，几何、边界和初值不变；示例数值不是实测参数。", "physics-editor-note", root);
    var templateNote = element("p", "", "physics-editor-note", root); templateNote.setAttribute("data-role", "physics-template-note");
    var fieldPresetRow = element("div", null, "physics-editor-toolbar", root);
    var fieldPreset = field(fieldPresetRow, "物理场预设", "field-preset", "select");
    selectOptions(fieldPreset, [
      {value: "", label: "选择未知量"},
      {value: "p", label: "水压力场 / 超静孔压 p（Pa）"},
      {value: "h", label: "水头场 h（m）"},
      {value: "T", label: "温度场 T（K）"}
    ]);
    button(fieldPresetRow, "使用所选物理场", "use-field-preset", function () {
      var units = {p: "Pa", h: "m", T: "K"}, symbol = fieldPreset.value;
      if (!Object.prototype.hasOwnProperty.call(units, symbol)) fail("请先选择物理场。");
      if (collectParameters().some(function (parameter) { return parameter.symbol === symbol; })) fail("物理场符号与当前参数重名，请先调整参数符号。");
      controls.field.value = symbol; renameField(); fieldUnit.value = units[symbol]; notify();
      templateNote.textContent = "已设置物理场 " + symbol + "；请核对公式中各参数的量纲。若需要整套固结方程，请加载上方固结模板。";
    });
    var unitsRow = element("div", null, "physics-editor-grid", root);
    field(unitsRow, "场变量符号（改名同步公式）", "field", "text"); var fieldUnit = field(unitsRow, "场变量单位", "field-unit", "select"); unitOptions(fieldUnit);
    var lengthUnit = field(unitsRow, "空间单位（x / y 一致）", "length-unit", "select"); unitOptions(lengthUnit, [0, 1, 0, 0]);
    var timeUnit = field(unitsRow, "时间单位", "time-unit", "select"); unitOptions(timeUnit, [0, 0, 1, 0]);
    var formulaSection = element("section", null, "physics-editor-formula-section", root);
    var toolbar = element("div", null, "physics-editor-toolbar physics-editor-derivatives", formulaSection);
    var derivatives = [
      {name: "dt", axes: ["t"], description: "时间一阶导数"},
      {name: "dx", axes: ["x"], description: "x 方向一阶导数"},
      {name: "dy", axes: ["y"], description: "y 方向一阶导数"},
      {name: "dxx", axes: ["x", "x"], description: "x 方向二阶导数"},
      {name: "dyy", axes: ["y", "y"], description: "y 方向二阶导数"},
      {name: "dxy", axes: ["x", "y"], description: "x、y 混合二阶导数"}
    ];
    derivatives.forEach(function (item) {
      button(toolbar, "", "insert-" + item.name, function () {
        insert(item.axes.map(function (axis) { return "d" + axis + "("; }).join(""), ")".repeat(item.axes.length));
      });
    });
    var contextNote = element("p", "", "physics-editor-note", formulaSection); contextNote.setAttribute("data-role", "physics-context-note");
    var formula = field(formulaSection, "控制方程（左侧 = 右侧，或残差表达式）", "formula", "textarea"); formula.rows = 3; formula.spellcheck = false; formula.maxLength = LIMITS.source;
    formula.placeholder = "例如：dt(u) = cx * dx(dx(u)) + cy * dy(dy(u))";
    var insertToolbar = element("div", null, "physics-editor-toolbar", formulaSection);
    button(insertToolbar, "插入场变量", "insert-field", function () { insert(controls.field.value.trim(), ""); });
    var insertSelect = field(insertToolbar, "插入参数符号", "insert-parameter", "select");
    button(insertToolbar, "插入参数", "insert-symbol", function () { if (!insertSelect.value) fail("尚无可插入参数。"); insert(insertSelect.value, ""); });
    element("p", "点击导数按钮直接插入；选中子表达式后点击，可对选中部分求导。乘法用 *，幂用 **；支持 sin、cos、exp、sqrt、log。", "physics-editor-note", formulaSection);
    var preview = element("div", "", "physics-editor-preview", formulaSection); preview.setAttribute("data-role", "physics-latex"); preview.setAttribute("aria-label", "公式预览");
    var status = element("p", "", "physics-editor-status", formulaSection); status.setAttribute("data-role", "physics-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    element("h4", "当前方程的参数", null, root);
    element("p", "这里只需填写名称、公式符号、数值和单位。内部标识自动管理；需要共享参数包时才展开高级信息。", "physics-editor-note", root);
    var parameterTable = element("div", null, "physics-editor-parameters", root); parameterTable.setAttribute("data-role", "physics-parameters");
    var library = element("details", null, "physics-editor-custom", root); element("summary", "添加参数：常用参数库 / 自定义 / 材料组", null, library); library.setAttribute("data-role", "physics-library");
    var browser = element("div", null, "physics-editor-grid", library);
    field(browser, "搜索参数定义", "search", "search"); var category = field(browser, "参数分类", "category", "select");
    selectOptions(category, [{value: "", label: "全部分类"}].concat((catalog.categories || []).map(function (c) { return {value: c.id, label: c.label}; })).concat([{value:"custom",label:"自定义参数"}]));
    var parameterSelect = field(browser, "参数定义", "parameter-definition", "select");
    button(browser, "添加所选参数", "add-definition", function () {
      var definition = definitions.find(function (p) { return p.id === parameterSelect.value; });
      if (!definition) fail("请先选择参数定义。"); addParameter(definition);
    });
    var custom = element("details", null, "physics-editor-custom", library); element("summary", "新增自定义参数", null, custom);
    var customRow = element("div", null, "physics-editor-grid", custom);
    field(customRow, "名称", "new-label", "text"); field(customRow, "公式符号", "new-symbol", "text");
    field(customRow, "数值", "new-value", "text"); var customUnit = field(customRow, "单位", "new-unit", "select"); unitOptions(customUnit);
    var customAdvanced = element("details", null, "physics-editor-advanced", custom); element("summary", "高级信息（通常无需填写）", null, customAdvanced);
    field(customAdvanced, "内部标识 ID（留空自动生成）", "new-id", "text").placeholder = "自动生成";
    field(customAdvanced, "补充说明", "new-description", "text");
    field(customAdvanced, "数据来源", "new-source", "text");
    button(custom, "添加自定义参数", "add-custom", function () {
      var raw = controls["new-value"].value.trim();
      if (!raw) fail("请填写自定义参数数值。");
      var symbol = identifier(controls["new-symbol"].value.trim(), "参数符号");
      addParameter({id: controls["new-id"].value.trim() || nextParameterId(symbol), symbol: symbol, value: Number(raw), unit: controls["new-unit"].value,
        label: controls["new-label"].value.trim() || symbol, description: controls["new-description"].value.trim(), source: controls["new-source"].value.trim(), category: "custom"});
    });
    var materialRow = element("div", null, "physics-editor-toolbar", library);
    var materialSelect = field(materialRow, "材料参数组", "material", "select");
    button(materialRow, "追加材料参数", "add-material", function () {
      var material = materials.find(function (m) { return m.id === materialSelect.value; });
      if (!material) fail("请先选择材料参数组。");
      var additions = material.parameters.map(function (entry) {
        var definition = definitions.find(function (p) { return p.id === entry.id; });
        if (!definition) fail("材料参数定义缺失：" + entry.id);
        var copy = clone(definition), ratio = unitDefinition(definition.unit, catalog).factor / unitDefinition(entry.unit, catalog).factor;
        ["minimum", "maximum"].forEach(function (key) { if (own(copy, key)) copy[key] *= ratio; });
        return Object.assign(copy, entry);
      }), current = collectParameters();
      var checked = parametersCheck(current.concat(additions), catalog, true);
      state.parameters = checked; renderParameters(); notify();
    });
    var transfer = element("details", null, "physics-editor-custom", root); element("summary", "导入与导出：方程工程 / 参数包", null, transfer);
    var io = element("div", null, "physics-editor-toolbar", transfer);
    function fileInput(title, role, action) {
      var input = field(io, title, role, "file"); input.accept = ".json,application/json";
      input.addEventListener("change", function () {
        var file = input.files && input.files[0]; if (!file) return;
        if (file.size > LIMITS.bytes) { showError(new Error("JSON 文件超过 1 MB 上限。")); input.value = ""; return; }
        var reader = new win.FileReader();
        reader.onload = function () { if (disposed) return; try { action(String(reader.result)); } catch (error) { showError(error); } input.value = ""; };
        reader.onerror = function () { showError(new Error("无法读取 JSON 文件。")); input.value = ""; };
        reader.readAsText(file);
      });
    }
    button(io, "导出物理工程 JSON", "export-project", function () { download(exportProject(), "openpinn-physics-project.json"); });
    fileInput("导入物理工程 JSON（替换物理设置）", "import-project", importProject);
    button(io, "导出当前参数包 JSON", "export-pack", function () { download(exportParameterPack(), "openpinn-parameters.json"); });
    fileInput("导入参数定义 / 材料包（追加本地目录）", "import-pack", importParameterPack);
    element("p", "工程 JSON 保存公式、参数与单位，便于复现；不包含几何、边界或训练结果。参数包仅包含纯数据定义，本地导入不会发布到公共库；共享库更新须通过项目维护者的 GitHub 贡献流程，当前尚未配置远程仓库。", "physics-editor-note", transfer);
    var limits = element("details", null, "physics-editor-custom", root); element("summary", "单位与模型适用范围", null, limits);
    element("p", "单场模型：变量、参数及坐标按所选单位输入，残差内部换算为 SI。修改单位不自动换算界面中的数值。普通 Neumann 表示外法向导数，不自动等同 Darcy 通量。仅支持一阶时间导数；完整 Biot 位移–孔压耦合当前不可用。", "physics-editor-note", limits);

    function showError(error) { status.textContent = error.message || String(error); status.classList.add("physics-editor-error"); }
    function refreshDefinitions() {
      var query = controls.search.value.trim().toLowerCase(), selectedCategory = category.value;
      var filtered = definitions.filter(function (p) { return (!selectedCategory || p.category === selectedCategory) && [p.id, p.symbol, p.label, p.description].join(" ").toLowerCase().includes(query); });
      selectOptions(parameterSelect, filtered.length ? filtered.map(function (p) { return {value: p.id, label: (p.label || p.description || p.id) + " · " + p.symbol + " [" + p.unit + "]"}; }) : [{value: "", label: "无匹配参数"}]);
      selectOptions(materialSelect, [{value: "", label: materials.length ? "选择材料参数组" : "暂无材料组，请导入参数包"}].concat(materials.map(function (m) { return {value: m.id, label: m.label}; })));
    }
    function renderParameters() {
      parameterTable.replaceChildren(); parameterInputs = [];
      if (!state.parameters.length) element("p", "尚未添加参数。参数库中的空值需由使用者填写。", "physics-editor-note", parameterTable);
      state.parameters.forEach(function (p, index) {
        var row = element("div", null, "physics-editor-parameter", parameterTable); row.setAttribute("data-parameter-id", p.id);
        var basic = element("div", null, "physics-editor-parameter-main", row), inputs = {};
        var definition = definitions.find(function (entry) { return entry.id === p.id; }) || {};
        var advanced = element("details", null, "physics-editor-advanced", row); element("summary", "高级信息：内部标识 / 说明 / 来源", null, advanced);
        [["label", "名称"], ["symbol", "公式符号"], ["value", "数值"], ["unit", "单位"], ["id", "内部标识 ID"], ["description", "补充说明"], ["source", "数据来源"]].forEach(function (entry) {
          var name = entry[0], isBasic = ["label", "symbol", "value", "unit"].includes(name);
          var input = field(isBasic ? basic : advanced, entry[1], "parameter-" + index + "-" + name, name === "unit" ? "select" : "text");
          if (entry[0] === "unit") unitOptions(input);
          var value = p[name];
          if (value === undefined && ["label", "description", "source"].includes(name)) value = definition[name];
          if (name === "label" && !value) value = p.symbol;
          input.value = value === null || value === undefined ? "" : value;
          if (input.tagName === "INPUT") input.defaultValue = input.value;
          input.addEventListener("input", notify); input.addEventListener("change", notify); inputs[entry[0]] = input;
        });
        button(basic, "移除", "remove-" + index, function () { state.parameters = collectParameters(); state.parameters.splice(index, 1); renderParameters(); notify(); });
        element("p", "ID 用于参数包匹配，不出现在公式中；日常输入无需修改。", "physics-editor-note", advanced);
        if (p.is_demo) element("span", "演示值，非实测", "physics-editor-demo", row);
        parameterInputs.push({original: p, inputs: inputs});
      });
      refreshInsertOptions();
    }
    function collectParameters() {
      return parameterInputs.map(function (record) {
        var p = clone(record.original), fields = record.inputs;
        p.id = fields.id.value.trim(); p.symbol = fields.symbol.value.trim();
        p.value = fields.value.value.trim() === "" ? null : Number(fields.value.value);
        p.unit = fields.unit.value;
        // Keep a round-tripped spec unchanged until its optional metadata is edited.
        ["label", "description", "source"].forEach(function (name) {
          if (own(p, name) || fields[name].value !== fields[name].defaultValue) p[name] = fields[name].value;
        });
        return p;
      });
    }
    function nextParameterId(symbol) {
      var used = new Set(definitions.concat(collectParameters()).map(function (p) { return p.id; }));
      var base = "custom." + symbol, candidate = base, counter = 2;
      while (used.has(candidate)) candidate = base + "." + counter++;
      return candidate;
    }
    function refreshInsertOptions() {
      var previous = insertSelect.value;
      selectOptions(insertSelect, collectParameters().filter(function (p) { return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(p.symbol); }).map(function (p) { return {value: p.symbol, label: p.symbol + (p.label ? " · " + p.label : "")}; }));
      if (Array.from(insertSelect.options).some(function (entry) { return entry.value === previous; })) insertSelect.value = previous;
    }
    function rawSpec(override) {
      var active = override || context;
      contextCheck(active);
      var parameters = collectParameters();
      var spec = {schema_version: 1, dimension: active.dimension, kind: active.kind, field: controls.field.value.trim(), field_unit: fieldUnit.value,
        coordinate_units: {x: lengthUnit.value, y: lengthUnit.value, t: timeUnit.value}, parameters: parameters, expression_source: formula.value.trim()};
      spec.expression = parseExpression(spec.expression_source, spec);
      return spec;
    }
    function read(override) { if (disposed) fail("编辑器已销毁。"); return validateSpec(rawSpec(override ? {dimension: override.dimension, kind: override.kind} : context), catalog); }
    function notify() {
      if (disposed) return;
      refreshInsertOptions(); updateContextUI();
      try {
        var spec = read(), latex = equationLatex(spec);
        if (win.katex) win.katex.render(latex, preview, {throwOnError: false});
        else preview.textContent = latex;
        preview.setAttribute("data-latex", latex); status.textContent = "公式、参数和单位校验通过。仍需确认模型适定性与实验参数。";
        status.classList.remove("physics-editor-error"); controls["export-project"].disabled = false; controls["export-pack"].disabled = false;
        lastResult = {valid: true, spec: spec, error: null, latex: latex};
      } catch (error) {
        showError(error); preview.textContent = "修正输入后显示公式。"; preview.removeAttribute("data-latex"); controls["export-project"].disabled = true; controls["export-pack"].disabled = true;
        lastResult = {valid: false, spec: null, error: error.message, latex: ""};
      }
      if (typeof options.onChange === "function") options.onChange(lastResult);
    }
    function applySpec(spec, message) {
      state = clone(spec);
      controls.field.value = spec.field; previousField = spec.field; fieldUnit.value = spec.field_unit; lengthUnit.value = spec.coordinate_units.x; timeUnit.value = spec.coordinate_units.t || "s";
      formula.value = spec.expression_source || toSource(spec.expression); templateNote.textContent = message || "";
      renderParameters(); notify();
    }
    function addParameter(parameter) {
      var checked = parametersCheck(collectParameters().concat([clone(parameter)]), catalog, true);
      if (checked.some(function (p) { return p.symbol === controls.field.value.trim(); })) fail("参数符号不能与场变量重名。");
      state.parameters = checked; renderParameters(); notify();
    }
    function setContext(next) {
      var candidate = {dimension: next.dimension, kind: next.kind}; contextCheck(candidate);
      if (context.dimension === candidate.dimension && context.kind === candidate.kind) return;
      context = candidate; updateContextUI(); notify();
    }
    function updateContextUI() {
      var name = controls.field.value.trim() || "u";
      derivatives.forEach(function (item) {
        var node = controls["insert-" + item.name], second = item.axes.length === 2;
        var reason = item.axes.includes("y") && context.dimension !== 2 ? "请先在上方将空间维度改为“二维”" : item.axes.includes("t") && context.kind !== "dynamic" ? "请先在上方将问题类型改为“含时间方程”" : "";
        var denominator = second && item.axes[0] === item.axes[1] ? "∂" + item.axes[0] + "²" : item.axes.map(function (axis) { return "∂" + axis; }).join("");
        node.textContent = (second ? "∂²" : "∂") + name + "/" + denominator;
        node.disabled = !!reason;
        node.title = reason || item.description + "；插入 " + item.axes.map(function (axis) { return "d" + axis + "("; }).join("") + name + ")".repeat(item.axes.length);
        node.setAttribute("aria-label", item.description + "（" + name + "）" + (reason ? "；" + reason : ""));
      });
      timeUnit.disabled = context.kind !== "dynamic";
      contextNote.textContent = "当前为“" + (context.dimension === 2 ? "二维" : "一维") + " · " + (context.kind === "dynamic" ? "含时间方程" : "静态方程") + "”，场变量为 " + name + "。" +
        (context.dimension !== 2 ? "要用 y 方向导数，请在上方将空间维度改为“二维”。" : "") +
        (context.kind !== "dynamic" ? "要用时间导数，请在上方将问题类型改为“含时间方程”。" : "");
      controls["insert-field"].textContent = "插入场变量 " + name;
    }
    function equationLatex(spec) {
      // Parsing an equality creates lhs-rhs. Preserve the user's equality in the preview.
      return spec.expression_source && spec.expression_source.includes("=") ? toLatex(spec.expression.left) + " = " + toLatex(spec.expression.right) : toLatex(spec.expression) + " = 0";
    }
    function renameField() {
      var next = controls.field.value.trim();
      try {
        identifier(next, "场变量");
        if (collectParameters().some(function (p) { return p.symbol === next; })) fail("场变量不能与参数符号重名。");
        if (previousField && previousField !== next) {
          formula.value = formula.value.replace(/\b[A-Za-z][A-Za-z0-9_]*\b/g, function (token) { return token === previousField ? next : token; });
        }
        previousField = next;
      } catch (error) { /* Validation below reports the invalid name without rewriting the formula. */ }
      notify();
    }
    function loadTemplate(id) {
      var template = (catalog.templates || []).find(function (t) { return t.id === id; });
      if (!template) fail("请选择有效模板。");
      var candidate = clone(template.spec);
      if (template.expression_text) candidate.expression_source = template.expression_text;
      var checked = validateSpec(candidate, catalog);
      if (checked.dimension !== context.dimension || checked.kind !== context.kind) fail("此模板需要“" + (checked.dimension === 2 ? "二维" : "一维") + "”和“" + (checked.kind === "dynamic" ? "含时间方程" : "静态方程") + "”。请先修改上方空间维度 / 问题类型，再加载；原公式与几何未改动。");
      var note = (template.description || "") + (template.is_demo ? " 示例参数仅用于演示，不是实测数据。" : "");
      if (template.initial_value !== undefined) note += " 初值建议：" + JSON.stringify(template.initial_value) + "；请自行设置。";
      if (template.boundary_value !== undefined) note += " 边界建议：" + JSON.stringify(template.boundary_value) + "；请自行设置。";
      applySpec(checked, note); return read();
    }
    function importProject(input) {
      var checked = validateSpec(input, catalog);
      if (checked.dimension !== context.dimension || checked.kind !== context.kind) fail("工程维度 / 静动态类型与当前几何不一致，请先调整主配置器；原物理设置已保留。");
      applySpec(checked, "已导入物理工程；几何、边界和训练设置保持原值，请核对适配关系。"); return read();
    }
    function exportProject() { return JSON.stringify(read(), null, 2); }
    function importParameterPack(input) {
      var pack = validateParameterPack(input, Object.assign({}, catalog, {parameters: definitions}));
      var merged = definitions.concat(pack.parameters.filter(function (p) { return !definitions.some(function (d) { return d.id === p.id; }); }));
      parametersCheck(merged, catalog, true, true);
      var ids = new Set(materials.map(function (m) { return m.id; }));
      pack.materials.forEach(function (m) { if (ids.has(m.id)) fail("材料 id 重复：" + m.id); ids.add(m.id); });
      definitions = merged; materials = materials.concat(pack.materials); refreshDefinitions();
      status.textContent = "参数包已加入本地目录；请选择需要的参数或材料。未发布到公共库。"; status.classList.remove("physics-editor-error");
      return clone(pack);
    }
    function exportParameterPack() {
      var spec = read();
      var exported = spec.parameters.map(function (p) {
        var original = definitions.find(function (d) { return d.id === p.id; });
        if (original) {
          if (original.symbol !== p.symbol || !sameDimension(unitDefinition(original.unit, catalog).dimensions, unitDefinition(p.unit, catalog).dimensions)) fail("已修改参数定义，请换用新的唯一 id 后导出参数包。");
          return clone(original);
        }
        var definition = clone(p); definition.value = null;
        definition.label = definition.label || definition.description || definition.id;
        definition.category = definition.category || "custom";
        return definition;
      });
      return JSON.stringify(validateParameterPack({schema_version: 1, parameters: exported, materials: [{
        id: "local.current_parameters", label: "当前参数组（用户导出，来源未核实）", source: "用户配置导出；请补充真实来源和工况",
        parameters: spec.parameters.map(function (p) { return {id: p.id, value: p.value, unit: p.unit}; }),
      }]}, Object.assign({}, catalog, {parameters: definitions})), null, 2);
    }
    function insert(prefix, suffix) {
      var start = formula.selectionStart || 0, end = formula.selectionEnd || start;
      var selected = suffix ? formula.value.slice(start, end) || controls.field.value.trim() || "p" : "";
      formula.setRangeText(prefix + selected + suffix, start, end, "end"); formula.focus(); notify();
    }
    function download(source, filename) {
      if (!win.URL || !win.URL.createObjectURL) fail("浏览器不支持下载，请改用编辑器 exportProject / exportParameterPack 接口。");
      var url = win.URL.createObjectURL(new win.Blob([source], {type: "application/json;charset=utf-8"}));
      var anchor = element("a", null, null, root); anchor.href = url; anchor.download = filename; anchor.click(); anchor.remove();
      win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 0);
    }
    controls.field.addEventListener("input", notify); controls.field.addEventListener("change", renameField);
    [fieldUnit, lengthUnit, timeUnit, formula].forEach(function (node) { node.addEventListener("input", notify); node.addEventListener("change", notify); });
    controls.search.addEventListener("input", refreshDefinitions); category.addEventListener("change", refreshDefinitions);
    refreshDefinitions(); updateContextUI();
    var matching = (catalog.templates || []).find(function (t) { return t.spec && t.spec.dimension === context.dimension && t.spec.kind === context.kind; });
    if (matching) loadTemplate(matching.id);
    else {
      var coefficientUnit = Object.keys(catalog.units).find(function (unit) { return sameDimension(catalog.units[unit].dimensions, context.kind === "dynamic" ? [0, 2, -1, 0] : [0, 0, 0, 0]); });
      if (!coefficientUnit) fail("目录缺少默认示例所需系数单位。");
      var parameters = [{id: "demo_cx", symbol: "cx", value: 1, unit: coefficientUnit, description: "演示系数，非实测"}];
      if (context.dimension === 2) parameters.push({id: "demo_cy", symbol: "cy", value: 1, unit: coefficientUnit, description: "演示系数，非实测"});
      var source = (context.kind === "dynamic" ? "dt(p)" : "") + "-dx(cx*dx(p))" + (context.dimension === 2 ? "-dy(cy*dy(p))" : "") + "=0";
      var initial = {schema_version: 1, dimension: context.dimension, kind: context.kind, field: "p", field_unit: "Pa", coordinate_units: {x: "m", y: "m", t: "s"}, parameters: parameters, expression_source: source};
      initial.expression = parseExpression(source, initial); applySpec(validateSpec(initial, catalog), "默认系数为演示值，非实测；请按研究问题修改。");
    }
    return {read: read, setContext: setContext, loadTemplate: loadTemplate, importProject: importProject, exportProject: exportProject,
      importParameterPack: importParameterPack, exportParameterPack: exportParameterPack,
      getLatex: function () { return equationLatex(read()); },
      getStatus: function () { return lastResult ? clone(lastResult) : null; },
      destroy: function () { disposed = true; root.remove(); }};
  }
  return {create: create, parseExpression: parseExpression, validateAST: validateAST, validateSpec: validateSpec, validateParameterPack: validateParameterPack, toSource: toSource, toLatex: toLatex, limits: LIMITS};
});
