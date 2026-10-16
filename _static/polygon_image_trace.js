(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OpenPINNImageTrace = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function signedArea(ring) {
    var area = 0;
    for (var index = 0; index < ring.length; index += 1) {
      var next = ring[(index + 1) % ring.length];
      area += ring[index][0] * next[1] - next[0] * ring[index][1];
    }
    return area / 2;
  }

  function pointInRing(point, ring) {
    var inside = false;
    for (var index = 0; index < ring.length; index += 1) {
      var start = ring[index];
      var end = ring[(index + 1) % ring.length];
      if ((start[1] > point[1]) !== (end[1] > point[1])) {
        var crossing = start[0] + (point[1] - start[1]) *
          (end[0] - start[0]) / (end[1] - start[1]);
        if (point[0] < crossing) inside = !inside;
      }
    }
    return inside;
  }

  function removeCollinear(ring) {
    var current = ring.slice();
    var changed = true;
    while (changed && current.length > 3) {
      changed = false;
      var next = [];
      for (var index = 0; index < current.length; index += 1) {
        var previous = current[(index + current.length - 1) % current.length];
        var point = current[index];
        var following = current[(index + 1) % current.length];
        var cross = (point[0] - previous[0]) * (following[1] - point[1]) -
          (point[1] - previous[1]) * (following[0] - point[0]);
        if (Math.abs(cross) <= 1e-12) {
          changed = true;
        } else {
          next.push(point);
        }
      }
      if (next.length >= 3) current = next;
    }
    return current;
  }

  function lineDistance(point, start, end) {
    var dx = end[0] - start[0];
    var dy = end[1] - start[1];
    var denominator = dx * dx + dy * dy;
    if (!denominator) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    var projection = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator;
    projection = Math.max(0, Math.min(1, projection));
    return Math.hypot(
      point[0] - (start[0] + projection * dx),
      point[1] - (start[1] + projection * dy)
    );
  }

  function simplifyOpen(points, tolerance) {
    if (points.length <= 2) return points.slice();
    var largest = 0;
    var split = 0;
    for (var index = 1; index < points.length - 1; index += 1) {
      var distance = lineDistance(points[index], points[0], points[points.length - 1]);
      if (distance > largest) {
        largest = distance;
        split = index;
      }
    }
    if (largest <= tolerance) return [points[0], points[points.length - 1]];
    var left = simplifyOpen(points.slice(0, split + 1), tolerance);
    var right = simplifyOpen(points.slice(split), tolerance);
    return left.slice(0, -1).concat(right);
  }

  function simplifyClosed(ring, tolerance) {
    var clean = removeCollinear(ring);
    if (clean.length <= 4 || tolerance <= 0) return clean;
    var split = 1;
    var largest = 0;
    for (var index = 1; index < clean.length; index += 1) {
      var distance = Math.hypot(
        clean[index][0] - clean[0][0],
        clean[index][1] - clean[0][1]
      );
      if (distance > largest) {
        largest = distance;
        split = index;
      }
    }
    var first = simplifyOpen(clean.slice(0, split + 1), tolerance);
    var second = simplifyOpen(clean.slice(split).concat([clean[0]]), tolerance);
    var combined = first.slice(0, -1).concat(second.slice(0, -1));
    return combined.length >= 3 ? removeCollinear(combined) : clean;
  }

  function curveEvidence(ring) {
    if (!Array.isArray(ring) || ring.length < 6) {
      return { detected: false, curvedCount: 0, sharpCount: 0, longestRun: 0, confidence: 0 };
    }
    var flags = [];
    var curvedCount = 0;
    var sharpCount = 0;
    for (var index = 0; index < ring.length; index += 1) {
      var previous = ring[(index + ring.length - 1) % ring.length];
      var point = ring[index];
      var following = ring[(index + 1) % ring.length];
      var ax = point[0] - previous[0];
      var ay = point[1] - previous[1];
      var bx = following[0] - point[0];
      var by = following[1] - point[1];
      var turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) * 180 / Math.PI;
      var curved = turn >= 1 && turn <= 55;
      flags.push(curved);
      if (curved) curvedCount += 1;
      if (turn >= 60) sharpCount += 1;
    }
    var longestRun = 0;
    var currentRun = 0;
    for (var pass = 0; pass < flags.length * 2; pass += 1) {
      if (flags[pass % flags.length]) {
        currentRun += 1;
        longestRun = Math.max(longestRun, Math.min(currentRun, flags.length));
      } else {
        currentRun = 0;
      }
    }
    var fraction = curvedCount / ring.length;
    var detected = curvedCount >= 4 && longestRun >= 3 && curvedCount >= sharpCount;
    return {
      detected: detected,
      curvedCount: curvedCount,
      sharpCount: sharpCount,
      longestRun: longestRun,
      confidence: detected ? Math.min(0.99, 0.65 + 0.35 * fraction) : 0,
    };
  }

  function largestComponent(mask, width, height) {
    var visited = new Uint8Array(mask.length);
    var queue = new Int32Array(mask.length);
    var best = [];
    for (var origin = 0; origin < mask.length; origin += 1) {
      if (!mask[origin] || visited[origin]) continue;
      var head = 0;
      var tail = 0;
      var component = [];
      queue[tail++] = origin;
      visited[origin] = 1;
      while (head < tail) {
        var current = queue[head++];
        component.push(current);
        var x = current % width;
        var y = Math.floor(current / width);
        var neighbours = [
          x > 0 ? current - 1 : -1,
          x + 1 < width ? current + 1 : -1,
          y > 0 ? current - width : -1,
          y + 1 < height ? current + width : -1,
        ];
        neighbours.forEach(function (next) {
          if (next >= 0 && mask[next] && !visited[next]) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        });
      }
      if (component.length > best.length) best = component;
    }
    if (best.length < 4) throw new Error("图片中没有识别到足够大的连通色块。");
    var selected = new Uint8Array(mask.length);
    best.forEach(function (index) { selected[index] = 1; });
    return { mask: selected, count: best.length };
  }

  function boundaryLoops(mask, width, height) {
    var edges = [];
    var outgoing = new Map();
    function key(point) { return point[0] + "," + point[1]; }
    function inside(x, y) {
      return x >= 0 && x < width && y >= 0 && y < height && Boolean(mask[y * width + x]);
    }
    function add(start, end) {
      var index = edges.length;
      edges.push({ start: start, end: end });
      var startKey = key(start);
      if (!outgoing.has(startKey)) outgoing.set(startKey, []);
      outgoing.get(startKey).push(index);
    }
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        if (!inside(x, y)) continue;
        var top = height - y;
        var bottom = top - 1;
        if (!inside(x, y - 1)) add([x + 1, top], [x, top]);
        if (!inside(x + 1, y)) add([x + 1, bottom], [x + 1, top]);
        if (!inside(x, y + 1)) add([x, bottom], [x + 1, bottom]);
        if (!inside(x - 1, y)) add([x, top], [x, bottom]);
      }
    }
    var unused = new Uint8Array(edges.length);
    unused.fill(1);
    function chooseNext(edge, candidates) {
      var vx = edge.end[0] - edge.start[0];
      var vy = edge.end[1] - edge.start[1];
      var best = candidates[0];
      var bestTurn = -Infinity;
      candidates.forEach(function (candidateIndex) {
        var candidate = edges[candidateIndex];
        var wx = candidate.end[0] - candidate.start[0];
        var wy = candidate.end[1] - candidate.start[1];
        var turn = Math.atan2(vx * wy - vy * wx, vx * wx + vy * wy);
        if (turn > bestTurn) {
          bestTurn = turn;
          best = candidateIndex;
        }
      });
      return best;
    }
    var loops = [];
    for (var origin = 0; origin < edges.length; origin += 1) {
      if (!unused[origin]) continue;
      var loop = [];
      var currentIndex = origin;
      var originKey = key(edges[origin].start);
      for (var guard = 0; guard <= edges.length; guard += 1) {
        if (!unused[currentIndex]) break;
        var edge = edges[currentIndex];
        unused[currentIndex] = 0;
        loop.push(edge.start);
        var endKey = key(edge.end);
        if (endKey === originKey) break;
        var candidates = (outgoing.get(endKey) || []).filter(function (index) {
          return unused[index];
        });
        if (!candidates.length) throw new Error("图片轮廓断裂，请使用填充且封闭的高对比色块。");
        currentIndex = candidates.length === 1 ? candidates[0] : chooseNext(edge, candidates);
      }
      if (loop.length >= 3) loops.push(loop);
    }
    return loops;
  }

  function resolveForeground(rgba, width, height, threshold, requested) {
    if (requested === "dark" || requested === "light") return requested;
    var total = 0;
    var count = 0;
    function addPixel(x, y) {
      var index = 4 * (y * width + x);
      if (rgba[index + 3] < 16) return;
      total += 0.2126 * rgba[index] + 0.7152 * rgba[index + 1] + 0.0722 * rgba[index + 2];
      count += 1;
    }
    for (var x = 0; x < width; x += 1) {
      addPixel(x, 0);
      if (height > 1) addPixel(x, height - 1);
    }
    for (var y = 1; y < height - 1; y += 1) {
      addPixel(0, y);
      if (width > 1) addPixel(width - 1, y);
    }
    var background = count ? total / count : 255;
    return background >= threshold ? "dark" : "light";
  }

  function automaticSegmentation(rgba, width, height) {
    // Estimate background from the border and the dominant contrasting fill
    // from a coarse RGB histogram. RGB distance also handles colours with
    // similar luminance, while including dark outlines around a lighter fill.
    var borderRed = [];
    var borderGreen = [];
    var borderBlue = [];
    var borderSamples = 0;
    function borderPixel(x, y) {
      var offset = 4 * (y * width + x);
      borderSamples += 1;
      if (rgba[offset + 3] < 16) return;
      borderRed.push(rgba[offset]);
      borderGreen.push(rgba[offset + 1]);
      borderBlue.push(rgba[offset + 2]);
    }
    for (var x = 0; x < width; x += 1) {
      borderPixel(x, 0);
      borderPixel(x, height - 1);
    }
    for (var y = 1; y < height - 1; y += 1) {
      borderPixel(0, y);
      borderPixel(width - 1, y);
    }
    if (borderRed.length < 0.2 * borderSamples) {
      return { foreground: "dark", threshold: 16, segmentation: "alpha" };
    }
    function median(values) {
      values.sort(function (a, b) { return a - b; });
      return values[Math.floor(values.length / 2)];
    }
    var background = [median(borderRed), median(borderGreen), median(borderBlue)];
    var counts = new Int32Array(4096);
    var sumsRed = new Float64Array(4096);
    var sumsGreen = new Float64Array(4096);
    var sumsBlue = new Float64Array(4096);
    var opaqueCount = 0;
    for (var pixel = 0; pixel < width * height; pixel += 1) {
      var offset = pixel * 4;
      if (rgba[offset + 3] < 16) continue;
      var red = rgba[offset];
      var green = rgba[offset + 1];
      var blue = rgba[offset + 2];
      var bin = (red >> 4) * 256 + (green >> 4) * 16 + (blue >> 4);
      counts[bin] += 1;
      sumsRed[bin] += red;
      sumsGreen[bin] += green;
      sumsBlue[bin] += blue;
      opaqueCount += 1;
    }
    var bestBin = -1;
    for (var index = 0; index < counts.length; index += 1) {
      if (!counts[index]) continue;
      var center = [
        sumsRed[index] / counts[index],
        sumsGreen[index] / counts[index],
        sumsBlue[index] / counts[index],
      ];
      if (Math.hypot(
        center[0] - background[0], center[1] - background[1], center[2] - background[2]
      ) < 24) continue;
      if (bestBin < 0 || counts[index] > counts[bestBin]) bestBin = index;
    }
    if (bestBin < 0 || counts[bestBin] < Math.max(4, opaqueCount * 0.001)) {
      throw new Error("自动分色无法区分背景与填充区域；请切换手动阈值或使用高对比填充图。");
    }
    var subject = [
      sumsRed[bestBin] / counts[bestBin],
      sumsGreen[bestBin] / counts[bestBin],
      sumsBlue[bestBin] / counts[bestBin],
    ];
    function luminance(color) {
      return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
    }
    return {
      foreground: luminance(subject) < luminance(background) ? "dark" : "light",
      threshold: Math.max(1, Math.min(254, (luminance(background) + luminance(subject)) / 2)),
      segmentation: "color",
      background: background,
      colorDistance: Math.hypot(
        subject[0] - background[0], subject[1] - background[1], subject[2] - background[2]
      ) / 2,
    };
  }

  function analyticShapeCandidates(mask, width, height, bounds) {
    var xMinimum = width;
    var xMaximum = -1;
    var yMinimum = height;
    var yMaximum = -1;
    var foregroundCount = 0;
    for (var index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      foregroundCount += 1;
      var x = index % width;
      var y = Math.floor(index / width);
      xMinimum = Math.min(xMinimum, x);
      xMaximum = Math.max(xMaximum, x);
      yMinimum = Math.min(yMinimum, y);
      yMaximum = Math.max(yMaximum, y);
    }
    if (!foregroundCount) return null;
    var boxWidth = xMaximum - xMinimum + 1;
    var boxHeight = yMaximum - yMinimum + 1;
    var centerX = (xMinimum + xMaximum + 1) / 2;
    var centerY = (yMinimum + yMaximum + 1) / 2;
    var halfWidth = boxWidth / 2;
    var halfHeight = boxHeight / 2;
    var maximumRadius = Math.min(halfWidth, halfHeight);

    function roundedScore(radius) {
      var innerX = halfWidth - radius;
      var innerY = halfHeight - radius;
      var intersection = 0;
      var idealCount = 0;
      for (var y = yMinimum; y <= yMaximum; y += 1) {
        for (var x = xMinimum; x <= xMaximum; x += 1) {
          var qx = Math.abs(x + 0.5 - centerX) - innerX;
          var qy = Math.abs(y + 0.5 - centerY) - innerY;
          var outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
          var inside = Math.min(Math.max(qx, qy), 0);
          var ideal = outside + inside <= radius;
          if (!ideal) continue;
          idealCount += 1;
          if (mask[y * width + x]) intersection += 1;
        }
      }
      var union = foregroundCount + idealCount - intersection;
      return union ? intersection / union : 0;
    }

    var coarseSteps = 24;
    var coarseStep = maximumRadius / coarseSteps;
    var bestRadius = 0;
    var bestScore = roundedScore(0);
    for (var coarse = 1; coarse <= coarseSteps; coarse += 1) {
      var candidateRadius = coarse * coarseStep;
      var candidateScore = roundedScore(candidateRadius);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestRadius = candidateRadius;
      }
    }
    var refineMinimum = Math.max(0, bestRadius - coarseStep);
    var refineMaximum = Math.min(maximumRadius, bestRadius + coarseStep);
    for (var refine = 0; refine <= 20; refine += 1) {
      var refinedRadius = refineMinimum + (refineMaximum - refineMinimum) * refine / 20;
      var refinedScore = roundedScore(refinedRadius);
      if (refinedScore > bestScore) {
        bestScore = refinedScore;
        bestRadius = refinedRadius;
      }
    }

    var pixelScaleX = (bounds[1] - bounds[0]) / width;
    var pixelScaleY = (bounds[3] - bounds[2]) / height;
    var isotropic = Math.abs(pixelScaleX - pixelScaleY) /
      Math.max(pixelScaleX, pixelScaleY) <= 0.02;
    function rounded(value) { return Math.round(value * 1e6) / 1e6; }
    var physicalXMinimum = bounds[0] + xMinimum * pixelScaleX;
    var physicalXMaximum = bounds[0] + (xMaximum + 1) * pixelScaleX;
    var physicalYMinimum = bounds[2] + (height - yMaximum - 1) * pixelScaleY;
    var physicalYMaximum = bounds[2] + (height - yMinimum) * pixelScaleY;
    var averageScale = 0.5 * (pixelScaleX + pixelScaleY);
    var roundedCandidate = {
      type: "rounded_rectangle",
      lower: [rounded(physicalXMinimum), rounded(physicalYMinimum)],
      upper: [rounded(physicalXMaximum), rounded(physicalYMaximum)],
      cornerRadius: rounded(bestRadius * averageScale),
      confidence: bestScore,
      isotropic: isotropic,
    };
    var circleAspectError = Math.abs(boxWidth - boxHeight) / Math.max(boxWidth, boxHeight);
    var circleRadius = 0.5 * (halfWidth + halfHeight);
    var circleIntersection = 0;
    var circleIdealCount = 0;
    for (var circleY = yMinimum; circleY <= yMaximum; circleY += 1) {
      for (var circleX = xMinimum; circleX <= xMaximum; circleX += 1) {
        var inCircle = Math.hypot(
          circleX + 0.5 - centerX,
          circleY + 0.5 - centerY
        ) <= circleRadius;
        if (!inCircle) continue;
        circleIdealCount += 1;
        if (mask[circleY * width + circleX]) circleIntersection += 1;
      }
    }
    var circleUnion = foregroundCount + circleIdealCount - circleIntersection;
    var circleScore = circleUnion ? circleIntersection / circleUnion : 0;
    var circleCandidate = {
      type: "circle",
      center: [
        rounded(bounds[0] + centerX * pixelScaleX),
        rounded(bounds[2] + (height - centerY) * pixelScaleY),
      ],
      radius: rounded(circleRadius * averageScale),
      confidence: circleScore,
      isotropic: isotropic,
      aspectError: circleAspectError,
    };
    var automatic = null;
    if (isotropic && circleAspectError <= 0.04 && circleScore >= 0.965 &&
        circleScore >= bestScore - 0.003) {
      automatic = circleCandidate;
    } else if (isotropic && bestScore >= 0.965) {
      automatic = roundedCandidate;
    }
    return {
      circle: circleCandidate,
      rounded_rectangle: roundedCandidate,
      automatic: automatic,
    };
  }

  function imageDataToPolygon(rgba, width, height, options) {
    options = options || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
      throw new Error("图片尺寸无效。");
    }
    if (!rgba || rgba.length !== width * height * 4) throw new Error("图片像素数据不完整。");
    var automatic = options.threshold === undefined || options.threshold === "auto";
    var selection = automatic ? automaticSegmentation(rgba, width, height) : null;
    var threshold = automatic ? selection.threshold : Number(options.threshold === undefined ? 128 : options.threshold);
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 254) {
      throw new Error("二值化阈值必须在 1–254 之间。");
    }
    var foreground = options.foreground === "dark" || options.foreground === "light"
      ? options.foreground
      : automatic ? selection.foreground : resolveForeground(rgba, width, height, threshold, "auto");
    var rawMask = new Uint8Array(width * height);
    for (var pixel = 0; pixel < width * height; pixel += 1) {
      var offset = pixel * 4;
      if (rgba[offset + 3] < 16) continue;
      if (automatic && options.foreground !== "dark" && options.foreground !== "light") {
        rawMask[pixel] = selection.segmentation === "alpha" ? 1 : Number(Math.hypot(
          rgba[offset] - selection.background[0],
          rgba[offset + 1] - selection.background[1],
          rgba[offset + 2] - selection.background[2]
        ) > selection.colorDistance);
      } else {
        var luminance = 0.2126 * rgba[offset] + 0.7152 * rgba[offset + 1] + 0.0722 * rgba[offset + 2];
        rawMask[pixel] = foreground === "dark" ? Number(luminance < threshold) : Number(luminance > threshold);
      }
    }
    var component = largestComponent(rawMask, width, height);
    if (component.count > width * height * 0.995) {
      throw new Error("几乎整张图都被识别为前景，请切换前景颜色或调整阈值。");
    }
    var minimumArea = Math.max(4, width * height * 0.0001);
    var loops = boundaryLoops(component.mask, width, height).filter(function (ring) {
      return Math.abs(signedArea(ring)) >= minimumArea;
    }).map(function (ring) {
      return simplifyClosed(ring, Number(options.simplifyTolerance || 2.0));
    });
    if (!loops.length) throw new Error("未能提取封闭轮廓。");
    loops.sort(function (left, right) {
      return Math.abs(signedArea(right)) - Math.abs(signedArea(left));
    });
    var outerPixels = loops[0];
    var holePixels = loops.slice(1).filter(function (ring) {
      return pointInRing(ring[0], outerPixels);
    });
    var bounds = options.bounds || [0, 1, 0, height / width];
    if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[1] <= bounds[0] || bounds[3] <= bounds[2]) {
      throw new Error("图片的物理坐标范围无效。");
    }
    function mapRing(ring) {
      return ring.map(function (point) {
        var mappedX = bounds[0] + point[0] / width * (bounds[1] - bounds[0]);
        var mappedY = bounds[2] + point[1] / height * (bounds[3] - bounds[2]);
        return [Math.round(mappedX * 1e6) / 1e6, Math.round(mappedY * 1e6) / 1e6];
      });
    }
    var analyticCandidates = analyticShapeCandidates(component.mask, width, height, bounds);
    var analyticShape = holePixels.length || !analyticCandidates
      ? null
      : analyticCandidates.automatic;
    var curveAnalysis = curveEvidence(outerPixels);
    var curveDetected = !holePixels.length && (
      Boolean(analyticShape) || curveAnalysis.detected
    );
    var mappedOuter = mapRing(outerPixels);
    var curveShape = curveDetected ? {
      type: "closed_spline",
      controlPoints: mappedOuter,
      tension: 0.2,
      confidence: analyticShape ? analyticShape.confidence : curveAnalysis.confidence,
      evidence: curveAnalysis,
    } : null;
    return {
      outer: mappedOuter,
      holes: holePixels.map(mapRing),
      foreground: foreground,
      threshold: threshold,
      segmentation: automatic ? selection.segmentation : "manual",
      colorDistance: automatic ? selection.colorDistance : null,
      foregroundPixels: component.count,
      rasterWidth: width,
      rasterHeight: height,
      analyticShape: analyticShape,
      analyticCandidates: analyticCandidates,
      curveShape: curveShape,
      curveEvidence: curveAnalysis,
    };
  }

  function cloneRings(rings) {
    return rings.map(function (ring) {
      return ring.map(function (point) { return point.slice(); });
    });
  }

  function transformRings(rings, options) {
    options = options || {};
    if (!Array.isArray(rings) || !rings.length || !rings[0].length) {
      throw new Error("轮廓不能为空。");
    }
    var angle = Number(options.angle || 0);
    var scaleX = Number(options.scaleX === undefined ? 1 : options.scaleX);
    var scaleY = Number(options.scaleY === undefined ? 1 : options.scaleY);
    var translateX = Number(options.translateX || 0);
    var translateY = Number(options.translateY || 0);
    if (![angle, scaleX, scaleY, translateX, translateY].every(Number.isFinite)) {
      throw new Error("整体变换参数必须是有限数值。");
    }
    if (scaleX === 0 || scaleY === 0) throw new Error("X/Y 缩放不能为 0。");
    var center = rings[0].reduce(function (total, point) {
      return [total[0] + point[0], total[1] + point[1]];
    }, [0, 0]).map(function (value) { return value / rings[0].length; });
    var radians = angle * Math.PI / 180;
    var cosine = Math.cos(radians);
    var sine = Math.sin(radians);
    return cloneRings(rings).map(function (ring) {
      return ring.map(function (point) {
        var localX = (point[0] - center[0]) * scaleX;
        var localY = (point[1] - center[1]) * scaleY;
        return [
          center[0] + localX * cosine - localY * sine + translateX,
          center[1] + localX * sine + localY * cosine + translateY,
        ];
      });
    });
  }

  function setEdgeLength(rings, ringIndex, vertexIndex, desired) {
    desired = Number(desired);
    if (!Number.isFinite(desired) || desired <= 0) throw new Error("边长必须大于 0。");
    var edited = cloneRings(rings);
    var ring = edited[ringIndex];
    if (!ring || !ring.length) throw new Error("边界环索引无效。");
    var current = ring[vertexIndex];
    var nextIndex = (vertexIndex + 1) % ring.length;
    var next = ring[nextIndex];
    if (!current || !next) throw new Error("顶点索引无效。");
    var dx = next[0] - current[0];
    var dy = next[1] - current[1];
    var length = Math.hypot(dx, dy);
    if (!length) throw new Error("当前边长为 0。");
    ring[nextIndex] = [current[0] + dx / length * desired, current[1] + dy / length * desired];
    return edited;
  }

  function setInteriorAngle(rings, ringIndex, vertexIndex, desired) {
    desired = Number(desired);
    if (!Number.isFinite(desired) || desired <= 0 || desired >= 360) {
      throw new Error("内角必须在 0–360° 之间。");
    }
    var edited = cloneRings(rings);
    var ring = edited[ringIndex];
    if (!ring || !ring.length) throw new Error("边界环索引无效。");
    var previous = ring[(vertexIndex + ring.length - 1) % ring.length];
    var current = ring[vertexIndex];
    var nextIndex = (vertexIndex + 1) % ring.length;
    var next = ring[nextIndex];
    if (!previous || !current || !next) throw new Error("顶点索引无效。");
    var edgeLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    var incomingAngle = Math.atan2(current[1] - previous[1], current[0] - previous[0]);
    var orientationSign = signedArea(ring) >= 0 ? 1 : -1;
    var turn = orientationSign * (180 - desired) * Math.PI / 180;
    ring[nextIndex] = [
      current[0] + edgeLength * Math.cos(incomingAngle + turn),
      current[1] + edgeLength * Math.sin(incomingAngle + turn),
    ];
    return edited;
  }

  function edgeMeasurements(ring) {
    if (!Array.isArray(ring)) throw new Error("边界环必须是坐标数组。");
    return ring.map(function (point, index) {
      var nextIndex = (index + 1) % ring.length;
      var next = ring[nextIndex];
      return {
        startIndex: index,
        endIndex: nextIndex,
        length: Math.hypot(next[0] - point[0], next[1] - point[1]),
        midpoint: [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2],
      };
    });
  }

  // PointerEvent.clientX/clientY and getBoundingClientRect() are expressed in
  // the same CSS-pixel coordinate system, including browser page zoom.  Doing
  // this conversion explicitly avoids stale getScreenCTM() values observed in
  // Safari after zooming a local documentation page.
  function clientPointToViewBox(clientX, clientY, rect, viewBox) {
    if (!rect || !viewBox || !(rect.width > 0) || !(rect.height > 0) ||
        !(viewBox.width > 0) || !(viewBox.height > 0)) {
      throw new Error("SVG 预览区尺寸无效。");
    }
    var scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
    var displayedWidth = viewBox.width * scale;
    var displayedHeight = viewBox.height * scale;
    var offsetX = rect.left + (rect.width - displayedWidth) / 2;
    var offsetY = rect.top + (rect.height - displayedHeight) / 2;
    return [
      viewBox.x + (clientX - offsetX) / scale,
      viewBox.y + (clientY - offsetY) / scale,
    ];
  }

  return {
    imageDataToPolygon: imageDataToPolygon,
    analyticShapeCandidates: analyticShapeCandidates,
    curveEvidence: curveEvidence,
    signedArea: signedArea,
    transformRings: transformRings,
    setEdgeLength: setEdgeLength,
    setInteriorAngle: setInteriorAngle,
    edgeMeasurements: edgeMeasurements,
    clientPointToViewBox: clientPointToViewBox,
  };
});
