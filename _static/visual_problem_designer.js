(function () {
  "use strict";

  function defineBlocks() {
    if (Blockly.Blocks.pde_residual) return;
    Blockly.defineBlocksWithJsonArray([
      {
        type: "pde_residual",
        message0: "PDE 残差  %1  = 0",
        args0: [{ type: "input_value", name: "EXPR", check: "PDEExpression" }],
        colour: "#1f6d9b",
        tooltip: "把完整控制方程写成 residual = 0。",
        helpUrl: "",
      },
      {
        type: "pde_derivative",
        message0: "%1",
        args0: [
          {
            type: "field_dropdown",
            name: "KIND",
            options: [
              ["∂u/∂x", "UX"],
              ["∂u/∂y", "UY"],
              ["∂u/∂t", "UT"],
              ["∂²u/∂x²", "UXX"],
              ["∂²u/∂y²", "UYY"],
              ["∂²u/∂x∂y", "UXY"],
            ],
          },
        ],
        output: "PDEExpression",
        colour: "#7b4ab5",
        tooltip: "OpenPINN 自动微分项。",
        helpUrl: "",
      },
      {
        type: "pde_field",
        message0: "预测场 u",
        output: "PDEExpression",
        colour: "#7b4ab5",
        tooltip: "神经网络预测的标量场 u。",
        helpUrl: "",
      },
      {
        type: "pde_symbol",
        message0: "%1",
        args0: [
          {
            type: "field_dropdown",
            name: "NAME",
            options: [
              ["坐标 x", "X"],
              ["坐标 y", "Y"],
              ["时间 t", "T"],
              ["圆周率 π", "PI"],
            ],
          },
        ],
        output: "PDEExpression",
        colour: "#287a55",
        tooltip: "坐标或圆周率。",
        helpUrl: "",
      },
      {
        type: "pde_number",
        message0: "数值 %1",
        args0: [{ type: "field_number", name: "VALUE", value: 1 }],
        output: "PDEExpression",
        colour: "#287a55",
        tooltip: "方程中的数值常数。",
        helpUrl: "",
      },
      {
        type: "pde_binary",
        message0: "%1 %2 %3",
        args0: [
          { type: "input_value", name: "LEFT", check: "PDEExpression" },
          {
            type: "field_dropdown",
            name: "OP",
            options: [
              ["+", "ADD"],
              ["−", "SUB"],
              ["×", "MUL"],
              ["÷", "DIV"],
              ["幂", "POW"],
            ],
          },
          { type: "input_value", name: "RIGHT", check: "PDEExpression" },
        ],
        inputsInline: true,
        output: "PDEExpression",
        colour: "#b36a19",
        tooltip: "二元数学运算。",
        helpUrl: "",
      },
      {
        type: "pde_negative",
        message0: "负号 − %1",
        args0: [{ type: "input_value", name: "VALUE", check: "PDEExpression" }],
        output: "PDEExpression",
        colour: "#b36a19",
        tooltip: "取相反数。",
        helpUrl: "",
      },
      {
        type: "pde_function",
        message0: "%1 ( %2 )",
        args0: [
          {
            type: "field_dropdown",
            name: "FUNCTION",
            options: [
              ["sin", "SIN"],
              ["cos", "COS"],
              ["exp", "EXP"],
              ["tanh", "TANH"],
            ],
          },
          { type: "input_value", name: "VALUE", check: "PDEExpression" },
        ],
        inputsInline: true,
        output: "PDEExpression",
        colour: "#b36a19",
        tooltip: "常用逐点函数。",
        helpUrl: "",
      },
    ]);
  }

  function unique(items) {
    return items.filter(function (item, index) {
      return items.indexOf(item) === index;
    });
  }

  function combineUses() {
    var result = [];
    Array.prototype.slice.call(arguments).forEach(function (items) {
      result = result.concat(items || []);
    });
    return unique(result);
  }

  function compileExpression(block, context) {
    if (!block) throw new Error("方程积木存在未连接的输入。请把每个空槽补完整。");
    var type = block.type;
    if (type === "pde_number") {
      var value = Number(block.getFieldValue("VALUE"));
      if (!Number.isFinite(value)) throw new Error("数值积木必须填写有限数字。");
      return { code: String(value), latex: String(value), uses: [] };
    }
    if (type === "pde_field") {
      return { code: "u", latex: "u", uses: ["u"] };
    }
    if (type === "pde_symbol") {
      var symbol = block.getFieldValue("NAME");
      if (symbol === "X") {
        return { code: "x[:, 0:1]", latex: "x", uses: ["x"] };
      }
      if (symbol === "Y") {
        if (context.spaceDim !== 2) throw new Error("一维问题不能使用 y 坐标。");
        return { code: "x[:, 1:2]", latex: "y", uses: ["y"] };
      }
      if (symbol === "T") {
        if (context.kind !== "dynamic") throw new Error("静态问题不能使用时间 t。");
        var timeIndex = context.spaceDim;
        return {
          code: "x[:, " + timeIndex + ":" + (timeIndex + 1) + "]",
          latex: "t",
          uses: ["t"],
        };
      }
      return { code: "torch.pi", latex: "\\pi", uses: ["pi"] };
    }
    if (type === "pde_derivative") {
      var derivative = block.getFieldValue("KIND");
      if ((derivative === "UY" || derivative === "UYY" || derivative === "UXY") && context.spaceDim !== 2) {
        throw new Error("一维问题不能使用 y 方向导数。");
      }
      if (derivative === "UT" && context.kind !== "dynamic") {
        throw new Error("静态问题不能使用时间导数 ∂u/∂t。");
      }
      var derivatives = {
        UX: { code: "op.grad(u, x)[:, 0:1]", latex: "\\frac{\\partial u}{\\partial x}", uses: ["ux"] },
        UY: { code: "op.grad(u, x)[:, 1:2]", latex: "\\frac{\\partial u}{\\partial y}", uses: ["uy"] },
        UT: {
          code: "op.grad(u, x)[:, " + context.spaceDim + ":" + (context.spaceDim + 1) + "]",
          latex: "\\frac{\\partial u}{\\partial t}",
          uses: ["ut"],
        },
        UXX: { code: "op.hessian(u, x, i=0, j=0)", latex: "\\frac{\\partial^2 u}{\\partial x^2}", uses: ["uxx"] },
        UYY: { code: "op.hessian(u, x, i=1, j=1)", latex: "\\frac{\\partial^2 u}{\\partial y^2}", uses: ["uyy"] },
        UXY: { code: "op.hessian(u, x, i=0, j=1)", latex: "\\frac{\\partial^2 u}{\\partial x\\partial y}", uses: ["uxy"] },
      };
      return derivatives[derivative];
    }
    if (type === "pde_negative") {
      var negativeValue = compileExpression(block.getInputTargetBlock("VALUE"), context);
      return {
        code: "(-(" + negativeValue.code + "))",
        latex: "-\\left(" + negativeValue.latex + "\\right)",
        uses: negativeValue.uses,
      };
    }
    if (type === "pde_function") {
      var functionValue = compileExpression(block.getInputTargetBlock("VALUE"), context);
      var functionName = block.getFieldValue("FUNCTION");
      var names = {
        SIN: ["torch.sin", "\\sin"],
        COS: ["torch.cos", "\\cos"],
        EXP: ["torch.exp", "\\exp"],
        TANH: ["torch.tanh", "\\tanh"],
      };
      return {
        code: names[functionName][0] + "(" + functionValue.code + ")",
        latex: names[functionName][1] + "\\left(" + functionValue.latex + "\\right)",
        uses: functionValue.uses,
      };
    }
    if (type === "pde_binary") {
      var left = compileExpression(block.getInputTargetBlock("LEFT"), context);
      var right = compileExpression(block.getInputTargetBlock("RIGHT"), context);
      var operation = block.getFieldValue("OP");
      var code;
      var latex;
      if (operation === "ADD") {
        code = "(" + left.code + " + " + right.code + ")";
        latex = "\\left(" + left.latex + " + " + right.latex + "\\right)";
      } else if (operation === "SUB") {
        code = "(" + left.code + " - " + right.code + ")";
        latex = "\\left(" + left.latex + " - " + right.latex + "\\right)";
      } else if (operation === "MUL") {
        code = "(" + left.code + " * " + right.code + ")";
        latex = "\\left(" + left.latex + "\\," + right.latex + "\\right)";
      } else if (operation === "DIV") {
        code = "(" + left.code + " / " + right.code + ")";
        latex = "\\frac{" + left.latex + "}{" + right.latex + "}";
      } else {
        code = "(" + left.code + " ** " + right.code + ")";
        latex = "\\left(" + left.latex + "\\right)^{" + right.latex + "}";
      }
      return { code: code, latex: latex, uses: combineUses(left.uses, right.uses) };
    }
    throw new Error("发现暂不支持的积木：" + type);
  }

  function newBlock(workspace, type, fields) {
    var block = workspace.newBlock(type);
    Object.keys(fields || {}).forEach(function (name) {
      block.setFieldValue(String(fields[name]), name);
    });
    block.initSvg();
    block.render();
    return block;
  }

  function connect(parent, inputName, child) {
    parent.getInput(inputName).connection.connect(child.outputConnection);
    return parent;
  }

  function numberBlock(workspace, value) {
    return newBlock(workspace, "pde_number", { VALUE: value });
  }

  function symbolBlock(workspace, name) {
    return newBlock(workspace, "pde_symbol", { NAME: name });
  }

  function derivativeBlock(workspace, kind) {
    return newBlock(workspace, "pde_derivative", { KIND: kind });
  }

  function binaryBlock(workspace, operation, left, right) {
    var block = newBlock(workspace, "pde_binary", { OP: operation });
    connect(block, "LEFT", left);
    connect(block, "RIGHT", right);
    return block;
  }

  function negativeBlock(workspace, value) {
    var block = newBlock(workspace, "pde_negative");
    connect(block, "VALUE", value);
    return block;
  }

  function functionBlock(workspace, name, value) {
    var block = newBlock(workspace, "pde_function", { FUNCTION: name });
    connect(block, "VALUE", value);
    return block;
  }

  function defaultStaticSource(workspace, spaceDim) {
    var piTimesX = binaryBlock(workspace, "MUL", symbolBlock(workspace, "PI"), symbolBlock(workspace, "X"));
    var sineX = functionBlock(workspace, "SIN", piTimesX);
    var piSquared = binaryBlock(workspace, "POW", symbolBlock(workspace, "PI"), numberBlock(workspace, 2));
    var source = binaryBlock(workspace, "MUL", piSquared, sineX);
    var laplacian = derivativeBlock(workspace, "UXX");
    if (spaceDim === 2) {
      var piTimesY = binaryBlock(workspace, "MUL", symbolBlock(workspace, "PI"), symbolBlock(workspace, "Y"));
      var sineY = functionBlock(workspace, "SIN", piTimesY);
      source = binaryBlock(
        workspace,
        "MUL",
        binaryBlock(workspace, "MUL", numberBlock(workspace, 2), piSquared),
        binaryBlock(workspace, "MUL", sineX, sineY)
      );
      laplacian = binaryBlock(workspace, "ADD", laplacian, derivativeBlock(workspace, "UYY"));
    }
    return binaryBlock(workspace, "SUB", negativeBlock(workspace, laplacian), source);
  }

  function defaultDynamicSource(workspace, spaceDim) {
    var laplacian = derivativeBlock(workspace, "UXX");
    if (spaceDim === 2) {
      laplacian = binaryBlock(workspace, "ADD", laplacian, derivativeBlock(workspace, "UYY"));
    }
    return binaryBlock(workspace, "SUB", derivativeBlock(workspace, "UT"), laplacian);
  }

  function resetEquation(workspace, kind, spaceDim) {
    workspace.clear();
    var root = newBlock(workspace, "pde_residual");
    var expression = kind === "dynamic"
      ? defaultDynamicSource(workspace, spaceDim)
      : defaultStaticSource(workspace, spaceDim);
    connect(root, "EXPR", expression);
    root.moveBy(32, 45);
    workspace.cleanUp();
  }

  function nonlinearHeatSource(workspace) {
    var diffusion = binaryBlock(
      workspace,
      "MUL",
      numberBlock(workspace, 0.1),
      derivativeBlock(workspace, "UXX")
    );
    var timeMinusDiffusion = binaryBlock(
      workspace,
      "SUB",
      derivativeBlock(workspace, "UT"),
      diffusion
    );
    var cubic = binaryBlock(
      workspace,
      "POW",
      newBlock(workspace, "pde_field"),
      numberBlock(workspace, 3)
    );
    return binaryBlock(workspace, "ADD", timeMinusDiffusion, cubic);
  }

  function pythonFloat(value) {
    return Number.isInteger(value) ? value.toFixed(1) : String(value);
  }

  function safeFileName(value) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : "my_visual_pde";
  }

  function generateCode(settings, compiled) {
    var spatialDomain;
    if (settings.spaceDim === 1) {
      spatialDomain = "op.Interval(" + pythonFloat(settings.xMin) + ", " + pythonFloat(settings.xMax) + ")";
    } else {
      spatialDomain = [
        "op.RectangleWithCircularHoles(",
        "    lower=(" + pythonFloat(settings.xMin) + ", " + pythonFloat(settings.yMin) + "),",
        "    upper=(" + pythonFloat(settings.xMax) + ", " + pythonFloat(settings.yMax) + "),",
        "    holes=(),",
        ")",
      ].join("\n");
    }
    var domainCode = spatialDomain;
    if (settings.kind === "dynamic") {
      if (settings.spaceDim === 1) {
        domainCode = "op.SpaceTimeDomain(" + spatialDomain + ", " + pythonFloat(settings.tMin) + ", " + pythonFloat(settings.tMax) + ")";
      } else {
        domainCode = [
          "op.SpaceTimeDomain(",
          "    " + spatialDomain.replace(/\n/g, "\n    ") + ",",
          "    " + pythonFloat(settings.tMin) + ",",
          "    " + pythonFloat(settings.tMax) + ",",
          ")",
        ].join("\n");
      }
    }

    var conditionLines = [
      "        op.DirichletBC(" + pythonFloat(settings.boundaryValue) + ", name=\"boundary\"),",
    ];
    if (settings.kind === "dynamic") {
      var initialExpression = "points.new_zeros((points.shape[0], 1))";
      if (settings.initialPreset === "sine") {
        initialExpression = "torch.sin(torch.pi * points[:, 0:1])";
        if (settings.spaceDim === 2) {
          initialExpression += " * torch.sin(torch.pi * points[:, 1:2])";
        }
      }
      conditionLines.push(
        "        op.InitialCondition(",
        "            lambda points: " + initialExpression + ",",
        "            name=\"initial\",",
        "        ),"
      );
    }

    return [
      "from pathlib import Path",
      "",
      "import openpinn as op",
      "import torch",
      "",
      "# ① 可视化设计器生成的区域",
      "DOMAIN = " + domainCode,
      "",
      "# ② 可视化积木生成的 PDE 残差；OpenPINN 按 residual = 0 训练",
      "def equation(x, u):",
      "    return " + compiled.code,
      "",
      "# ③ 边界、初值和问题名称",
      "PROBLEM = op.PDEProblem(",
      "    DOMAIN,",
      "    equation,",
      "    [",
    ].concat(conditionLines).concat([
      "    ],",
      "    name=" + JSON.stringify(settings.problemName) + ",",
      "    metadata={",
      "        \"kind\": \"custom_" + settings.kind + "\",",
      "        \"residual_names\": (\"pde\",),",
      "    },",
      ")",
      "",
      "# ④ 网络和短跑设置；链路通过后再提高 STEPS",
      "STEPS = " + settings.steps,
      "MODEL = {",
      "    \"hidden_layers\": [" + settings.hiddenLayers.join(", ") + "],",
      "    \"activation\": " + JSON.stringify(settings.activation) + ",",
      "}",
      "PROJECT_ROOT = Path(__file__).resolve().parents[1]",
      "",
      "result = op.solve(",
      "    PROBLEM,",
      "    method=\"baseline\",",
      "    variant=\"plain_pinn\",",
      "    model=MODEL,",
      "    steps=STEPS,",
      "    training={\"log_every\": max(1, STEPS // 5)},",
      "    output_root=PROJECT_ROOT / \"runs\",",
      ")",
      "",
      "print(\"训练完成\")",
      "print(\"结果目录：\", result.output_dir)",
      "# 短跑通过后，可在网页方法配置器中选择其他方法及其超参数。",
      "",
    ]).join("\n");
  }

  function drawDomain(svg, settings) {
    var labelStyle = 'font-family="Arial, sans-serif" font-size="15" fill="#365a70"';
    var titleStyle = 'font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#17364f"';
    var content = [
      '<rect x="0" y="0" width="640" height="330" rx="12" fill="#fbfdfe"/>',
      '<text x="22" y="30" ' + titleStyle + '>计算区域与条件</text>',
    ];
    if (settings.spaceDim === 1 && settings.kind === "static") {
      content.push('<line x1="75" y1="165" x2="565" y2="165" stroke="#276f9e" stroke-width="5"/>');
      for (var i = 1; i < 12; i += 1) {
        var x = 75 + (490 * i) / 12;
        content.push('<circle cx="' + x + '" cy="165" r="4" fill="#75a9c8"/>');
      }
      content.push('<circle cx="75" cy="165" r="10" fill="#fff" stroke="#d07720" stroke-width="4"/>');
      content.push('<circle cx="565" cy="165" r="10" fill="#fff" stroke="#d07720" stroke-width="4"/>');
      content.push('<text x="58" y="205" ' + labelStyle + '>' + settings.xMin + '</text>');
      content.push('<text x="548" y="205" ' + labelStyle + '>' + settings.xMax + '</text>');
      content.push('<text x="205" y="116" ' + labelStyle + '>内部训练点</text>');
      content.push('<text x="188" y="250" ' + labelStyle + '>橙色端点：u = ' + settings.boundaryValue + '</text>');
    } else if (settings.spaceDim === 1) {
      content.push('<rect x="95" y="50" width="450" height="230" fill="#edf6fb" stroke="#9bbdce" stroke-width="2"/>');
      for (var xi = 0; xi < 9; xi += 1) {
        for (var ti = 0; ti < 5; ti += 1) {
          content.push('<circle cx="' + (120 + xi * 50) + '" cy="' + (75 + ti * 45) + '" r="3" fill="#75a9c8"/>');
        }
      }
      content.push('<line x1="95" y1="50" x2="95" y2="280" stroke="#d07720" stroke-width="5"/>');
      content.push('<line x1="545" y1="50" x2="545" y2="280" stroke="#d07720" stroke-width="5"/>');
      content.push('<line x1="95" y1="280" x2="545" y2="280" stroke="#2c7650" stroke-width="5"/>');
      content.push('<text x="298" y="314" ' + labelStyle + '>x</text>');
      content.push('<text x="66" y="170" ' + labelStyle + '>t</text>');
      content.push('<text x="205" y="42" ' + labelStyle + '>橙色：空间边界</text>');
      content.push('<text x="205" y="270" ' + labelStyle + '>绿色：初始条件</text>');
    } else {
      content.push('<rect x="95" y="52" width="430" height="230" fill="#edf6fb" stroke="#d07720" stroke-width="5"/>');
      for (var row = 0; row < 6; row += 1) {
        for (var column = 0; column < 10; column += 1) {
          content.push('<circle cx="' + (120 + column * 42) + '" cy="' + (75 + row * 36) + '" r="3" fill="#75a9c8"/>');
        }
      }
      content.push('<text x="292" y="316" ' + labelStyle + '>x ∈ [' + settings.xMin + ', ' + settings.xMax + ']</text>');
      content.push('<text transform="translate(35 220) rotate(-90)" ' + labelStyle + '>y ∈ [' + settings.yMin + ', ' + settings.yMax + ']</text>');
      content.push('<text x="170" y="43" ' + labelStyle + '>橙色外框：u = ' + settings.boundaryValue + '</text>');
      if (settings.kind === "dynamic") {
        content.push('<line x1="568" y1="270" x2="568" y2="85" stroke="#2c7650" stroke-width="4"/>');
        content.push('<path d="M568 70 L558 90 L578 90 Z" fill="#2c7650"/>');
        content.push('<text x="582" y="176" ' + labelStyle + '>t</text>');
        content.push('<text x="440" y="304" ' + labelStyle + '>另含初始条件</text>');
      }
    }
    svg.innerHTML = content.join("");
  }

  function startVisualDesigner(root) {
    var query = function (role) { return root.querySelector('[data-role="' + role + '"]'); };
    var nameInput = query("problem-name");
    var kindSelect = query("problem-kind");
    var dimensionSelect = query("space-dim");
    var formula = query("formula");
    var validation = query("validation");
    var codeNode = query("code");
    var codeStatus = query("code-status");
    var message = query("message");
    var svg = query("domain-preview");
    var latestCode = "";

    defineBlocks();
    var workspace = Blockly.inject(query("workspace"), {
      toolbox: query("toolbox"),
      media: "_static/vendor/blockly/media/",
      renderer: "zelos",
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.82, minScale: 0.45, maxScale: 1.4 },
      grid: { spacing: 22, length: 3, colour: "#d7e3ea", snap: true },
    });

    function readNumber(role) {
      return Number(query(role).value);
    }

    function readSettings() {
      var layerText = query("hidden-layers").value.trim();
      var layers = layerText.split(",").map(function (item) { return Number(item.trim()); });
      return {
        problemName: nameInput.value.trim(),
        kind: kindSelect.value,
        spaceDim: Number(dimensionSelect.value),
        xMin: readNumber("x-min"),
        xMax: readNumber("x-max"),
        yMin: readNumber("y-min"),
        yMax: readNumber("y-max"),
        tMin: readNumber("t-min"),
        tMax: readNumber("t-max"),
        boundaryValue: readNumber("boundary-value"),
        initialPreset: query("initial-preset").value,
        hiddenLayers: layers,
        activation: query("activation").value,
        steps: Number(query("steps").value),
      };
    }

    function settingsErrors(settings) {
      var errors = [];
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(settings.problemName)) {
        errors.push("问题名称只能使用英文字母、数字和下划线，且不能以数字开头。");
      }
      if (!Number.isFinite(settings.xMin) || !Number.isFinite(settings.xMax) || settings.xMax <= settings.xMin) {
        errors.push("x 上限必须大于 x 下限。");
      }
      if (settings.spaceDim === 2 && (!Number.isFinite(settings.yMin) || !Number.isFinite(settings.yMax) || settings.yMax <= settings.yMin)) {
        errors.push("二维问题的 y 上限必须大于 y 下限。");
      }
      if (settings.kind === "dynamic" && (!Number.isFinite(settings.tMin) || !Number.isFinite(settings.tMax) || settings.tMax <= settings.tMin)) {
        errors.push("动态问题的 t 上限必须大于 t 下限。");
      }
      if (!Number.isFinite(settings.boundaryValue)) errors.push("边界值必须是有限数字。");
      if (!settings.hiddenLayers.length || settings.hiddenLayers.some(function (width) { return !Number.isInteger(width) || width <= 0; })) {
        errors.push("隐藏层请填写逗号分隔的正整数，例如 32, 32, 32。");
      }
      if (!Number.isInteger(settings.steps) || settings.steps <= 0) errors.push("短跑步数必须是正整数。");
      return errors;
    }

    function compileWorkspace(settings) {
      var roots = workspace.getTopBlocks(true).filter(function (block) { return block.type === "pde_residual"; });
      if (roots.length !== 1) throw new Error("工作区必须有且只能有一个“PDE 残差 = 0”积木。");
      var detached = workspace.getTopBlocks(true).filter(function (block) { return block.type !== "pde_residual"; });
      if (detached.length) throw new Error("有 " + detached.length + " 组积木尚未接入 PDE 残差。");
      return compileExpression(roots[0].getInputTargetBlock("EXPR"), settings);
    }

    function renderValidation(errors) {
      validation.innerHTML = "";
      var items = errors.length ? errors : ["区域、方程积木和网络参数结构检查通过。"];
      items.forEach(function (text) {
        var row = document.createElement("div");
        row.className = "visual-validation-item " + (errors.length ? "is-error" : "is-ok");
        var icon = document.createElement("b");
        icon.textContent = errors.length ? "!" : "✓";
        var label = document.createElement("span");
        label.textContent = text;
        row.appendChild(icon);
        row.appendChild(label);
        validation.appendChild(row);
      });
    }

    function render() {
      var settings = readSettings();
      var errors = settingsErrors(settings);
      var compiled = null;
      try {
        compiled = compileWorkspace(settings);
      } catch (error) {
        errors.push(error.message);
      }
      drawDomain(svg, settings);
      if (compiled) {
        katex.render(compiled.latex + " = 0", formula, { throwOnError: false, displayMode: true, strict: "warn" });
      } else {
        formula.textContent = "请连接完整的 PDE 残差积木";
      }
      renderValidation(errors);
      if (errors.length || !compiled) {
        latestCode = "";
        codeNode.textContent = "# 完成右侧橙色提示后，这里会自动生成 Python 代码。";
        codeStatus.textContent = "尚有 " + errors.length + " 项需要修改";
        codeStatus.classList.remove("is-ready");
        return;
      }
      latestCode = generateCode(settings, compiled);
      codeNode.textContent = latestCode;
      codeStatus.textContent = "结构检查通过，可以复制或下载";
      codeStatus.classList.add("is-ready");
    }

    function toggleFields() {
      var isTwoDimensional = dimensionSelect.value === "2";
      var isDynamic = kindSelect.value === "dynamic";
      root.querySelectorAll('[data-role="y-field"]').forEach(function (field) { field.hidden = !isTwoDimensional; });
      root.querySelectorAll('[data-role="time-field"], [data-role="initial-field"]').forEach(function (field) { field.hidden = !isDynamic; });
    }

    function resetForStructure() {
      toggleFields();
      resetEquation(workspace, kindSelect.value, Number(dimensionSelect.value));
      message.textContent = "已按当前维度和问题类型放入一个可运行的示例方程。";
      render();
    }

    function loadNonlinearHeatExample() {
      nameInput.value = "nonlinear_heat_1d";
      kindSelect.value = "dynamic";
      dimensionSelect.value = "1";
      query("x-min").value = "-1";
      query("x-max").value = "1";
      query("t-min").value = "0";
      query("t-max").value = "1";
      query("boundary-value").value = "0";
      query("initial-preset").value = "sine";
      toggleFields();
      workspace.clear();
      var rootBlock = newBlock(workspace, "pde_residual");
      connect(rootBlock, "EXPR", nonlinearHeatSource(workspace));
      rootBlock.moveBy(32, 45);
      workspace.cleanUp();
      message.textContent = "已加载新模型：u_t - 0.1u_xx + u^3 = 0。";
      render();
    }

    function copyCode() {
      if (!latestCode) {
        message.textContent = "请先完成橙色检查项。";
        return;
      }
      function copied() { message.textContent = "代码已复制，可粘贴到 examples/ 下的新 .py 文件。"; }
      function copyWithSelection() {
        var area = document.createElement("textarea");
        area.value = latestCode;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) copied();
        else message.textContent = "复制未成功，请手动选择代码复制或下载 .py 文件。";
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(latestCode).then(copied).catch(copyWithSelection);
        return;
      }
      copyWithSelection();
    }

    function downloadCode() {
      if (!latestCode) {
        message.textContent = "请先完成橙色检查项。";
        return;
      }
      var blob = new Blob([latestCode], { type: "text/x-python;charset=utf-8" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = safeFileName(nameInput.value.trim()) + ".py";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      message.textContent = "已生成 " + link.download + "。";
    }

    workspace.addChangeListener(function (event) {
      if (event.type === Blockly.Events.VIEWPORT_CHANGE || event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      window.requestAnimationFrame(render);
    });
    root.querySelectorAll("input, select").forEach(function (control) {
      control.addEventListener("input", render);
      control.addEventListener("change", render);
    });
    kindSelect.addEventListener("change", resetForStructure);
    dimensionSelect.addEventListener("change", resetForStructure);
    query("reset-equation").addEventListener("click", resetForStructure);
    query("load-nonlinear-heat").addEventListener("click", loadNonlinearHeatExample);
    query("center-blocks").addEventListener("click", function () { workspace.zoomToFit(); });
    query("copy-code").addEventListener("click", copyCode);
    query("download-code").addEventListener("click", downloadCode);
    window.addEventListener("resize", function () { Blockly.svgResize(workspace); });

    toggleFields();
    resetEquation(workspace, kindSelect.value, Number(dimensionSelect.value));
    window.setTimeout(function () {
      Blockly.svgResize(workspace);
      workspace.zoomToFit();
      render();
    }, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-openpinn-visual-designer]").forEach(function (root) {
      if (typeof Blockly === "undefined" || typeof katex === "undefined") {
        root.innerHTML = '<div class="admonition error"><p>可视化依赖未能加载，请重新构建文档。</p></div>';
        return;
      }
      startVisualDesigner(root);
    });
  });
})();
