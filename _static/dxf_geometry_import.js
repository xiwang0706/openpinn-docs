(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OpenPINNDxfImport = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function numeric(value, label) {
    if (value === undefined || String(value).trim() === "") throw new Error(label + " 缺少数值。");
    var result = Number(value);
    if (!Number.isFinite(result)) throw new Error(label + " 不是有效数值。");
    return result;
  }

  function field(entity, code, fallback) {
    for (var index = 0; index < entity.length; index += 1) {
      if (entity[index].code === code) return entity[index].value;
    }
    return fallback;
  }

  function checkPlanar(entity, label) {
    if (numeric(field(entity, 30, "0"), label + " z") !== 0 ||
        numeric(field(entity, 38, "0"), label + " 高程") !== 0 ||
        numeric(field(entity, 210, "0"), label + " 法向 x") !== 0 ||
        numeric(field(entity, 220, "0"), label + " 法向 y") !== 0 ||
        numeric(field(entity, 230, "1"), label + " 法向 z") !== 1) {
      throw new Error(label + " 含三维坐标或非默认法向；请导出二维平面 DXF。");
    }
  }

  function arcPoints(start, end, bulge) {
    if (Math.abs(bulge) < 1e-12) return [];
    var dx = end[0] - start[0];
    var dy = end[1] - start[1];
    var chord = Math.hypot(dx, dy);
    if (chord < 1e-12) throw new Error("DXF 圆弧端点重合。");
    var sweep = 4 * Math.atan(bulge);
    var offset = chord * (1 - bulge * bulge) / (4 * bulge);
    var cx = (start[0] + end[0]) / 2 - dy * offset / chord;
    var cy = (start[1] + end[1]) / 2 + dx * offset / chord;
    var radius = Math.hypot(start[0] - cx, start[1] - cy);
    var angle = Math.atan2(start[1] - cy, start[0] - cx);
    var count = Math.min(256, Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36))));
    var points = [];
    for (var step = 1; step < count; step += 1) {
      var position = angle + sweep * step / count;
      points.push([cx + radius * Math.cos(position), cy + radius * Math.sin(position)]);
    }
    return points;
  }

  function cleanRing(vertices, bulges, closed, label) {
    if (!closed) throw new Error(label + " 是开放轮廓；请在 COMSOL/CAD 中闭合后重新导出。");
    if (vertices.length > 4096) throw new Error(label + " 超过 4096 个顶点，请简化几何。");
    if (vertices.length > 1 && Math.hypot(
      vertices[0][0] - vertices[vertices.length - 1][0],
      vertices[0][1] - vertices[vertices.length - 1][1]
    ) < 1e-9) vertices.pop();
    if (vertices.length < 3) throw new Error(label + " 至少需要 3 个不同顶点。");
    var ring = [];
    for (var index = 0; index < vertices.length; index += 1) {
      var next = (index + 1) % vertices.length;
      ring.push(vertices[index]);
      Array.prototype.push.apply(ring, arcPoints(vertices[index], vertices[next], bulges[index] || 0));
      if (ring.length > 4096) throw new Error(label + " 的曲线离散后超过 4096 个顶点。");
    }
    return ring;
  }

  function openPath(vertices, bulges, label) {
    if (vertices.length < 2) throw new Error(label + " 至少需要两个端点。");
    if (vertices.length > 4096) throw new Error(label + " 超过 4096 个顶点，请简化几何。");
    var path = [];
    for (var index = 0; index < vertices.length - 1; index += 1) {
      path.push(vertices[index]);
      Array.prototype.push.apply(path, arcPoints(vertices[index], vertices[index + 1], bulges[index] || 0));
      if (path.length > 4096) throw new Error(label + " 的曲线离散后超过 4096 个顶点。");
    }
    path.push(vertices[vertices.length - 1]);
    return path;
  }

  function lightPolyline(entity) {
    checkPlanar(entity, "LWPOLYLINE");
    var vertices = [];
    var bulges = [];
    entity.forEach(function (pair) {
      if (pair.code === 10) {
        vertices.push([numeric(pair.value, "顶点 x"), null]);
        bulges.push(0);
      } else if (pair.code === 20) {
        if (!vertices.length || vertices[vertices.length - 1][1] !== null) {
          throw new Error("DXF LWPOLYLINE 的 x/y 顶点顺序不正确。");
        }
        vertices[vertices.length - 1][1] = numeric(pair.value, "顶点 y");
      } else if (pair.code === 42) {
        if (!vertices.length) throw new Error("DXF bulge 缺少对应顶点。");
        bulges[bulges.length - 1] = numeric(pair.value, "圆弧 bulge");
      }
    });
    if (vertices.some(function (point) { return point[1] === null; })) {
      throw new Error("DXF LWPOLYLINE 缺少 y 坐标。");
    }
    var flags = numeric(field(entity, 70, "0"), "多段线标志");
    return { points: Boolean(flags & 1)
      ? cleanRing(vertices, bulges, true, "LWPOLYLINE")
      : openPath(vertices, bulges, "LWPOLYLINE"), closed: Boolean(flags & 1) };
  }

  function linePath(entity) {
    checkPlanar(entity, "LINE");
    if (numeric(field(entity, 31, "0"), "LINE 终点 z") !== 0) {
      throw new Error("LINE 含三维终点；请导出二维平面 DXF。");
    }
    var start = [numeric(field(entity, 10), "LINE 起点 x"), numeric(field(entity, 20), "LINE 起点 y")];
    var end = [numeric(field(entity, 11), "LINE 终点 x"), numeric(field(entity, 21), "LINE 终点 y")];
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 1e-12) {
      throw new Error("DXF LINE 长度为 0。");
    }
    return [start, end];
  }

  function arcPath(entity) {
    checkPlanar(entity, "ARC");
    var cx = numeric(field(entity, 10), "ARC 圆心 x");
    var cy = numeric(field(entity, 20), "ARC 圆心 y");
    var radius = numeric(field(entity, 40), "ARC 半径");
    if (radius <= 0) throw new Error("ARC 半径必须大于 0。");
    var start = numeric(field(entity, 50), "ARC 起始角") * Math.PI / 180;
    var end = numeric(field(entity, 51), "ARC 终止角") * Math.PI / 180;
    while (end <= start) end += 2 * Math.PI;
    if (end - start >= 2 * Math.PI - 1e-10) {
      throw new Error("完整圆请导出为 CIRCLE 实体。");
    }
    var count = Math.max(2, Math.ceil((end - start) / (Math.PI / 72)));
    var points = [];
    for (var index = 0; index <= count; index += 1) {
      var angle = start + (end - start) * index / count;
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    return points;
  }

  function splineShape(entity) {
    checkPlanar(entity, "SPLINE");
    var controls = [];
    var knots = [];
    var weights = [];
    entity.forEach(function (pair) {
      if (pair.code === 10) controls.push([numeric(pair.value, "SPLINE 控制点 x"), null]);
      else if (pair.code === 20) {
        if (!controls.length || controls[controls.length - 1][1] !== null) {
          throw new Error("SPLINE 控制点 x/y 顺序无效。");
        }
        controls[controls.length - 1][1] = numeric(pair.value, "SPLINE 控制点 y");
      } else if (pair.code === 40) knots.push(numeric(pair.value, "SPLINE 节点"));
      else if (pair.code === 41) weights.push(numeric(pair.value, "SPLINE 权重"));
      else if ((pair.code === 30 || pair.code === 31) && numeric(pair.value, "SPLINE z") !== 0) {
        throw new Error("SPLINE 含三维控制点；请导出二维平面 DXF。");
      }
    });
    if (controls.some(function (point) { return point[1] === null; })) {
      throw new Error("SPLINE 控制点缺少 y 坐标。");
    }
    var degree = numeric(field(entity, 71), "SPLINE 次数");
    var flags = numeric(field(entity, 70, "0"), "SPLINE 标志");
    if (!Number.isInteger(degree) || degree < 1 || degree > 7 ||
        controls.length < degree + 1 || controls.length > 256 ||
        knots.length !== controls.length + degree + 1 ||
        (weights.length && weights.length !== controls.length)) {
      throw new Error("SPLINE 缺少完整的控制点/节点/权重；请导出为二维多段线。");
    }
    if (knots.some(function (value, index) { return index > 0 && value < knots[index - 1]; }) ||
        weights.some(function (value) { return value <= 0; })) {
      throw new Error("SPLINE 节点必须递增，权重必须为正。");
    }
    var lower = knots[degree];
    var upper = knots[controls.length];
    if (upper <= lower) throw new Error("SPLINE 参数区间长度为 0。");
    function pointAt(parameter) {
      var last = controls.length - 1;
      var span = last;
      if (parameter < upper) {
        for (var index = degree; index <= last; index += 1) {
          if (knots[index] <= parameter && parameter < knots[index + 1]) { span = index; break; }
        }
      }
      var work = [];
      for (var j = 0; j <= degree; j += 1) {
        var controlIndex = span - degree + j;
        var weight = weights.length ? weights[controlIndex] : 1;
        work.push([controls[controlIndex][0] * weight, controls[controlIndex][1] * weight, weight]);
      }
      for (var level = 1; level <= degree; level += 1) {
        for (var column = degree; column >= level; column -= 1) {
          var knotIndex = span - degree + column;
          var denominator = knots[knotIndex + degree - level + 1] - knots[knotIndex];
          var alpha = denominator === 0 ? 0 : (parameter - knots[knotIndex]) / denominator;
          work[column] = work[column].map(function (value, coordinate) {
            return (1 - alpha) * work[column - 1][coordinate] + alpha * value;
          });
        }
      }
      return [work[degree][0] / work[degree][2], work[degree][1] / work[degree][2]];
    }
    var closed = Boolean(flags & 1);
    var sampleCount = Math.max(64, Math.min(4096, controls.length * 16));
    var points = [];
    for (var sample = 0; sample <= sampleCount; sample += 1) {
      points.push(pointAt(lower + (upper - lower) * sample / sampleCount));
    }
    if (closed) {
      var gap = Math.hypot(points[0][0] - points[points.length - 1][0],
        points[0][1] - points[points.length - 1][1]);
      if (gap > 1e-6 * Math.max(1, Math.abs(points[0][0]), Math.abs(points[0][1]))) {
        throw new Error("SPLINE 标记为闭合，但首尾坐标不一致；请检查导出文件。");
      }
      points.pop();
    }
    return { points: points, closed: closed };
  }

  function roundShape(entity, ellipse) {
    checkPlanar(entity, ellipse ? "ELLIPSE" : "CIRCLE");
    var cx = numeric(field(entity, 10), "圆心 x");
    var cy = numeric(field(entity, 20), "圆心 y");
    var majorX, majorY, minorX, minorY;
    var start = 0;
    var finish = 2 * Math.PI;
    if (ellipse) {
      majorX = numeric(field(entity, 11), "长轴 x");
      majorY = numeric(field(entity, 21), "长轴 y");
      var ratio = numeric(field(entity, 40), "短长轴比");
      if (ratio <= 0 || ratio > 1) throw new Error("DXF 椭圆短长轴比须在 (0, 1] 内。");
      minorX = -majorY * ratio;
      minorY = majorX * ratio;
      start = numeric(field(entity, 41, "0"), "椭圆起始参数");
      finish = numeric(field(entity, 42, String(2 * Math.PI)), "椭圆终止参数");
      while (finish <= start) finish += 2 * Math.PI;
      if (finish - start > 2 * Math.PI + 1e-5) throw new Error("DXF ELLIPSE 参数跨度无效。");
    } else {
      majorX = numeric(field(entity, 40), "圆半径");
      majorY = 0;
      minorX = 0;
      minorY = majorX;
    }
    if (Math.hypot(majorX, majorY) <= 0) throw new Error("DXF 圆/椭圆尺寸必须大于 0。");
    var closed = Math.abs(finish - start - 2 * Math.PI) <= 1e-5;
    var count = Math.max(2, Math.ceil(128 * (finish - start) / (2 * Math.PI)));
    var points = [];
    for (var index = 0; index < count + (closed ? 0 : 1); index += 1) {
      var angle = start + (finish - start) * index / count;
      points.push([
        cx + majorX * Math.cos(angle) + minorX * Math.sin(angle),
        cy + majorY * Math.cos(angle) + minorY * Math.sin(angle),
      ]);
    }
    return { points: points, closed: closed };
  }

  function area(ring) {
    var result = 0;
    for (var index = 0; index < ring.length; index += 1) {
      var next = ring[(index + 1) % ring.length];
      result += ring[index][0] * next[1] - next[0] * ring[index][1];
    }
    return result / 2;
  }

  function inside(point, ring) {
    var result = false;
    for (var index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      var a = ring[index], b = ring[previous];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) result = !result;
    }
    return result;
  }

  function ringKey(ring) {
    return ring.map(function (point) {
      return point.map(function (value) { return value.toPrecision(12); }).join(",");
    }).sort().join(";");
  }

  function circularRing(ring) {
    if (ring.length < 24) return null;
    var xs = ring.map(function (point) { return point[0]; });
    var ys = ring.map(function (point) { return point[1]; });
    var left = Math.min.apply(null, xs), right = Math.max.apply(null, xs);
    var bottom = Math.min.apply(null, ys), top = Math.max.apply(null, ys);
    var radiusX = (right - left) / 2, radiusY = (top - bottom) / 2;
    if (radiusX <= 0 || Math.abs(radiusX - radiusY) > 0.005 * Math.max(radiusX, radiusY)) return null;
    var first = ring[0], second = ring[Math.floor(ring.length / 3)];
    var third = ring[Math.floor(2 * ring.length / 3)];
    var determinant = 2 * (first[0] * (second[1] - third[1]) +
      second[0] * (third[1] - first[1]) + third[0] * (first[1] - second[1]));
    if (Math.abs(determinant) < 1e-12 * Math.max(1, radiusX * radiusY)) return null;
    var squared = [first, second, third].map(function (point) {
      return point[0] * point[0] + point[1] * point[1];
    });
    var center = [
      (squared[0] * (second[1] - third[1]) + squared[1] * (third[1] - first[1]) +
        squared[2] * (first[1] - second[1])) / determinant,
      (squared[0] * (third[0] - second[0]) + squared[1] * (first[0] - third[0]) +
        squared[2] * (second[0] - first[0])) / determinant,
    ];
    var radius = Math.hypot(first[0] - center[0], first[1] - center[1]);
    if (ring.some(function (point) {
      return Math.abs(Math.hypot(point[0] - center[0], point[1] - center[1]) - radius) >
        radius * 0.003;
    })) return null;
    return { center: center.map(function (value) { return Number(value.toPrecision(12)); }),
      radius: Number(radius.toPrecision(12)), segments: ring.length };
  }

  function assemblePaths(paths, rings) {
    if (!paths.length) return 0;
    if (paths.length > 4096) throw new Error("DXF 开放线段过多，请简化图纸。");
    var all = paths.reduce(function (accumulator, path) { return accumulator.concat(path); }, []);
    var xs = all.map(function (point) { return point[0]; });
    var ys = all.map(function (point) { return point[1]; });
    var span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs),
      Math.max.apply(null, ys) - Math.min.apply(null, ys));
    var tolerance = Math.max(1e-9, span * 1e-7);
    var nodes = [];
    function nodeFor(point) {
      for (var index = 0; index < nodes.length; index += 1) {
        if (Math.hypot(point[0] - nodes[index].point[0], point[1] - nodes[index].point[1]) <= tolerance) {
          return index;
        }
      }
      nodes.push({ point: point, edges: [] });
      return nodes.length - 1;
    }
    var edges = paths.map(function (points, index) {
      var start = nodeFor(points[0]);
      var end = nodeFor(points[points.length - 1]);
      nodes[start].edges.push(index);
      nodes[end].edges.push(index);
      return { points: points, start: start, end: end, used: false };
    });
    nodes.forEach(function (node) {
      if (node.edges.length !== 2) {
        throw new Error("DXF 线段在 (" + node.point.map(function (number) { return number.toPrecision(6); }).join(", ") +
          ") 处有 " + node.edges.length + " 个连接端；需要无缺口、无分叉的闭合边界。");
      }
    });
    edges.forEach(function (edge) {
      if (edge.used) return;
      var firstNode = edge.start;
      var currentNode = firstNode;
      var ring = [];
      for (var step = 0; step <= edges.length; step += 1) {
        var edgeIndex = nodes[currentNode].edges.find(function (candidate) { return !edges[candidate].used; });
        if (edgeIndex === undefined) throw new Error("DXF 线段未能拼合为闭合轮廓。");
        var next = edges[edgeIndex];
        next.used = true;
        var oriented = next.start === currentNode ? next.points : next.points.slice().reverse();
        if (ring.length) oriented = oriented.slice(1);
        Array.prototype.push.apply(ring, oriented);
        currentNode = next.start === currentNode ? next.end : next.start;
        if (currentNode === firstNode) break;
      }
      if (currentNode !== firstNode) throw new Error("DXF 线段未能拼合为闭合轮廓。");
      ring[ring.length - 1] = nodes[firstNode].point;
      rings.push(cleanRing(ring, [], true, "拼合后的 DXF 轮廓"));
    });
    return tolerance;
  }

  function parseDetailed(text, options) {
    if (typeof text !== "string" || !text.trim()) throw new Error("DXF 文件为空。");
    var scale = options && options.unitScale !== undefined ? numeric(options.unitScale, "坐标换算系数") : 1;
    if (scale <= 0) throw new Error("坐标换算系数必须是正数。");
    var lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    if (lines.length % 2 !== 0) throw new Error("DXF 组码/数值行不成对；请导出 ASCII DXF。");
    var pairs = [];
    for (var line = 0; line < lines.length; line += 2) {
      var code = Number(lines[line].trim());
      if (!Number.isInteger(code)) throw new Error("DXF 第 " + (line + 1) + " 行组码无效；请导出 ASCII DXF。");
      pairs.push({ code: code, value: lines[line + 1].trim() });
    }
    var inEntities = false;
    var entitiesFound = false;
    var rings = [];
    var paths = [];
    var legacy = null;
    var unitsCode = null;
    for (var headerIndex = 0; headerIndex < pairs.length - 1; headerIndex += 1) {
      if (pairs[headerIndex].code === 9 && pairs[headerIndex].value.toUpperCase() === "$INSUNITS" &&
          pairs[headerIndex + 1].code === 70) {
        unitsCode = Number(pairs[headerIndex + 1].value);
        break;
      }
    }
    for (var index = 0; index < pairs.length;) {
      var pair = pairs[index];
      if (pair.code !== 0) { index += 1; continue; }
      var end = index + 1;
      while (end < pairs.length && pairs[end].code !== 0) end += 1;
      var entity = pairs.slice(index + 1, end);
      var type = pair.value.toUpperCase();
      if (type === "SECTION") {
        inEntities = field(entity, 2, "").toUpperCase() === "ENTITIES";
        if (inEntities) entitiesFound = true;
      } else if (type === "ENDSEC") {
        inEntities = false;
      } else if (inEntities) {
        if (type === "LWPOLYLINE") {
          var light = lightPolyline(entity);
          (light.closed ? rings : paths).push(light.points);
        }
        else if (type === "CIRCLE" || type === "ELLIPSE") {
          var round = roundShape(entity, type === "ELLIPSE");
          (round.closed ? rings : paths).push(round.points);
        }
        else if (type === "LINE") paths.push(linePath(entity));
        else if (type === "ARC") paths.push(arcPath(entity));
        else if (type === "SPLINE") {
          var spline = splineShape(entity);
          (spline.closed ? rings : paths).push(spline.points);
        }
        else if (type === "POLYLINE") {
          if (legacy) throw new Error("DXF POLYLINE 缺少 SEQEND。");
          var flags = numeric(field(entity, 70, "0"), "POLYLINE 标志");
          if (flags & (8 | 16 | 64)) throw new Error("不支持 3D POLYLINE 或网格；请导出二维轮廓。");
          legacy = { vertices: [], bulges: [], closed: Boolean(flags & 1) };
        } else if (type === "VERTEX") {
          if (!legacy) throw new Error("DXF VERTEX 缺少 POLYLINE。");
          checkPlanar(entity, "VERTEX");
          legacy.vertices.push([numeric(field(entity, 10), "顶点 x"), numeric(field(entity, 20), "顶点 y")]);
          legacy.bulges.push(numeric(field(entity, 42, "0"), "圆弧 bulge"));
        } else if (type === "SEQEND") {
          if (!legacy) throw new Error("DXF SEQEND 缺少 POLYLINE。");
          (legacy.closed ? rings : paths).push(legacy.closed
            ? cleanRing(legacy.vertices, legacy.bulges, true, "POLYLINE")
            : openPath(legacy.vertices, legacy.bulges, "POLYLINE"));
          legacy = null;
        } else if (["INSERT", "HATCH", "3DFACE", "SOLID", "REGION"].indexOf(type) !== -1) {
          throw new Error("DXF 含 " + type + " 实体；请转换为二维闭合多段线后导出。");
        }
      }
      index = end;
    }
    if (legacy) throw new Error("DXF POLYLINE 缺少 SEQEND。");
    if (!entitiesFound) throw new Error("未找到 DXF ENTITIES 段；请导出 ASCII DXF。");
    var joinTolerance = assemblePaths(paths, rings);
    var unique = [];
    var keys = {};
    rings.forEach(function (ring) {
      var key = ringKey(ring);
      if (!keys[key]) { keys[key] = true; unique.push(ring); }
    });
    if (!unique.length) throw new Error("未找到闭合二维轮廓。");
    unique.sort(function (left, right) { return Math.abs(area(right)) - Math.abs(area(left)); });
    var outer = unique[0];
    var holes = unique.slice(1);
    if (holes.some(function (hole) { return !inside(hole[0], outer); })) {
      throw new Error("文件包含多个互不相连的区域；当前仅支持一条外轮廓及内部孔洞。");
    }
    function scaled(ring) {
      return ring.map(function (point) { return [point[0] * scale, point[1] * scale]; });
    }
    return { outer: scaled(outer), holes: holes.map(scaled),
      circularHoles: holes.map(function (hole) {
        var circle = circularRing(hole);
        return circle ? { center: circle.center.map(function (value) { return value * scale; }),
          radius: circle.radius * scale, segments: circle.segments } : null;
      }), unitsCode: unitsCode,
      unitScale: scale, stitchedEntityCount: paths.length, joinTolerance: joinTolerance * scale };
  }

  function parse(text) {
    var result = parseDetailed(text);
    return [result.outer, result.holes];
  }

  return { parse: parse, parseDetailed: parseDetailed, circularRing: circularRing };
});
