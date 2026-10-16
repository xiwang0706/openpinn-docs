(function () {
  "use strict";

  function pythonLiteral(value) {
    if (value === null || value === undefined) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return "[" + value.map(pythonLiteral).join(", ") + "]";
    }
    if (typeof value === "object") {
      return (
        "{" +
        Object.entries(value)
          .map(function (entry) {
            return pythonLiteral(entry[0]) + ": " + pythonLiteral(entry[1]);
          })
          .join(", ") +
        "}"
      );
    }
    throw new Error("无法生成参数值：" + String(value));
  }

  // Keep the exported physics snapshot readable without enabling code-line wrap.
  function pythonPrettyLiteral(value, depth) {
    depth = depth || 0;
    if (value === null || typeof value !== "object") return pythonLiteral(value);
    var array = Array.isArray(value), entries = array ? value.map(function (v) { return [null, v]; }) : Object.entries(value);
    if (!entries.length) return array ? "[]" : "{}";
    var indent = "    ".repeat(depth + 1);
    return (array ? "[" : "{") + "\n" + entries.map(function (entry) {
      return indent + (array ? "" : pythonLiteral(entry[0]) + ": ") + pythonPrettyLiteral(entry[1], depth + 1) + ",";
    }).join("\n") + "\n" + "    ".repeat(depth) + (array ? "]" : "}");
  }

  function startConfigurator(root, payload) {
    function isPolygonGeometry(geometry) {
      return ["polygon", "dxf"].indexOf(geometry) !== -1;
    }

    var problemSelect = root.querySelector('[data-role="problem"]');
    var stepsInput = root.querySelector('[data-role="steps"]');
    var logEveryInput = root.querySelector('[data-role="log-every"]');
    var seedInput = root.querySelector('[data-role="seed"]');
    var outputRootInput = root.querySelector('[data-role="output-root"]');
    var referenceEnableInput = root.querySelector('[data-role="reference-enable"]');
    var referenceFields = root.querySelector('[data-role="reference-fields"]');
    var referenceFileInput = root.querySelector('[data-role="reference-file"]');
    var referencePathInput = root.querySelector('[data-role="reference-path"]');
    var referenceCoordinatesInput = root.querySelector('[data-role="reference-coordinates"]');
    var referenceFixedTimeInput = root.querySelector('[data-role="reference-fixed-time"]');
    var referenceValueInput = root.querySelector('[data-role="reference-value"]');
    var referenceCoordinateScalesInput = root.querySelector('[data-role="reference-coordinate-scales"]');
    var referenceValueScaleInput = root.querySelector('[data-role="reference-value-scale"]');
    var referencePredictionScaleInput = root.querySelector('[data-role="reference-prediction-scale"]');
    var referenceFieldIndexInput = root.querySelector('[data-role="reference-field-index"]');
    var referenceStatus = root.querySelector('[data-role="reference-status"]');
    var referenceColumnsEdited = false;
    var referenceUnitsEdited = false;
    var referenceValueEdited = false;
    var methodList = root.querySelector('[data-role="method-list"]');
    var parameterList = root.querySelector('[data-role="parameter-list"]');
    var message = root.querySelector('[data-role="message"]');
    var code = root.querySelector('[data-role="code"]');
    var copyButton = root.querySelector('[data-role="copy"]');
    var downloadCodeButton = root.querySelector('[data-role="download-code"]');
    var expandCodeButton = root.querySelector('[data-role="expand-code"]');
    var codePane = root.querySelector('[data-role="code-pane"]');
    var codeDialog = root.querySelector('[data-role="code-dialog"]');
    var codeActionStatus = root.querySelector('[data-role="code-action-status"]');
    var codePlaceholder = document.createComment("code-pane-position");
    codePane.before(codePlaceholder);
    expandCodeButton.addEventListener("click", function () {
      if (codeDialog.open) { codeDialog.close(); return; }
      if (typeof codeDialog.showModal !== "function") {
        codeActionStatus.textContent = "此浏览器不支持放大窗口，请使用新版浏览器；仍可复制或下载代码。";
        return;
      }
      codeDialog.appendChild(codePane);
      codeDialog.showModal();
      document.body.classList.add("configurator-code-modal-open");
      expandCodeButton.textContent = "关闭放大（Esc）";
      expandCodeButton.focus();
    });
    codeDialog.addEventListener("close", function () {
      codePlaceholder.after(codePane);
      document.body.classList.remove("configurator-code-modal-open");
      expandCodeButton.textContent = "放大查看";
      expandCodeButton.focus();
    });
    downloadCodeButton.addEventListener("click", function () {
      if (downloadCodeButton.disabled) return;
      var name = isCustomProblem() ? customNameInput.value.trim() : problemSelect.value;
      name = name.replace(/[^A-Za-z0-9_-]/g, "_") || "openpinn_run";
      var blob = new Blob([code.textContent], { type: "text/x-python;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name + ".py";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      codeActionStatus.textContent = "已发起下载 " + name + ".py。将文件移入项目 examples/ 目录后，在项目根目录运行：macOS/Linux（已激活环境）python examples/" + name + ".py；Windows PowerShell .\\.venv\\Scripts\\python.exe examples\\" + name + ".py。目录中若已有同名文件，请先给下载文件改名，不要覆盖；改名或浏览器追加 (1) 后，需同步修改命令中的文件名。";
    });
    var customPanel = root.querySelector('[data-role="custom-problem-panel"]');
    var customNameInput = root.querySelector('[data-role="custom-name"]');
    var customKindSelect = root.querySelector('[data-role="custom-kind"]');
    var customDimensionSelect = root.querySelector('[data-role="custom-dimension"]');
    var customGeometryField = root.querySelector('[data-role="custom-geometry-field"]');
    var customGeometryTypeSelect = root.querySelector('[data-role="custom-geometry-type"]');
    var customPolygonImport = root.querySelector('[data-role="custom-polygon-import"]');
    var customPolygonFileInput = root.querySelector('[data-role="custom-polygon-file"]');
    var customDxfImport = root.querySelector('[data-role="custom-dxf-import"]');
    var customDxfFileInput = root.querySelector('[data-role="custom-dxf-file"]');
    var customDxfUnitScaleInput = root.querySelector('[data-role="custom-dxf-unit-scale"]');
    var customPolygonStatus = root.querySelector('[data-role="custom-polygon-status"]');
    var customImageOptions = root.querySelector('[data-role="custom-image-options"]');
    var customImageForegroundSelect = root.querySelector('[data-role="custom-image-foreground"]');
    var customImageThresholdModeSelect = root.querySelector('[data-role="custom-image-threshold-mode"]');
    var customImageThresholdField = root.querySelector('[data-role="custom-image-threshold-field"]');
    var customImageThresholdInput = root.querySelector('[data-role="custom-image-threshold"]');
    var customImageResolutionSelect = root.querySelector('[data-role="custom-image-resolution"]');
    var customImageShapeModeSelect = root.querySelector('[data-role="custom-image-shape-mode"]');
    var customImageSimplifyInput = root.querySelector('[data-role="custom-image-simplify"]');
    var customImageXMinInput = root.querySelector('[data-role="custom-image-x-min"]');
    var customImageXMaxInput = root.querySelector('[data-role="custom-image-x-max"]');
    var customImageYMinInput = root.querySelector('[data-role="custom-image-y-min"]');
    var customImageYMaxInput = root.querySelector('[data-role="custom-image-y-max"]');
    var customImageReprocessButton = root.querySelector('[data-role="custom-image-reprocess"]');
    var customPolygonEditor = root.querySelector('[data-role="custom-polygon-editor"]');
    var customPolygonRingSelect = root.querySelector('[data-role="custom-polygon-ring"]');
    var customPolygonVertices = root.querySelector('[data-role="custom-polygon-vertices"]');
    var customDxfCircleEditor = root.querySelector('[data-role="custom-dxf-circle-editor"]');
    var customDxfCircleXInput = root.querySelector('[data-role="custom-dxf-circle-x"]');
    var customDxfCircleYInput = root.querySelector('[data-role="custom-dxf-circle-y"]');
    var customDxfCircleRadiusInput = root.querySelector('[data-role="custom-dxf-circle-radius"]');
    var customDxfCircleDiameterInput = root.querySelector('[data-role="custom-dxf-circle-diameter"]');
    var customPolygonTableWrap = root.querySelector('.configurator-polygon-table-wrap');
    var customPolygonRotateInput = root.querySelector('[data-role="custom-polygon-rotate"]');
    var customPolygonScaleXInput = root.querySelector('[data-role="custom-polygon-scale-x"]');
    var customPolygonScaleYInput = root.querySelector('[data-role="custom-polygon-scale-y"]');
    var customPolygonTranslateXInput = root.querySelector('[data-role="custom-polygon-translate-x"]');
    var customPolygonTranslateYInput = root.querySelector('[data-role="custom-polygon-translate-y"]');
    var customPolygonTransformButton = root.querySelector('[data-role="custom-polygon-transform-apply"]');
    var customPolygonResetButton = root.querySelector('[data-role="custom-polygon-reset"]');
    var customEquationModeSelect = root.querySelector('[data-role="custom-equation-mode"]');
    var customTemplateSelect = root.querySelector('[data-role="custom-template"]');
    var customTemplateField = root.querySelector('[data-role="custom-template-field"]');
    var customFormula = root.querySelector('[data-role="custom-formula"]');
    var customPreview = root.querySelector('[data-role="custom-preview"]');
    var customPreviewNote = root.querySelector('[data-role="custom-preview-note"]');
    var customXMinInput = root.querySelector('[data-role="custom-x-min"]');
    var customXMaxInput = root.querySelector('[data-role="custom-x-max"]');
    var customYMinInput = root.querySelector('[data-role="custom-y-min"]');
    var customYMaxInput = root.querySelector('[data-role="custom-y-max"]');
    var customCircleFields = root.querySelectorAll('[data-role="custom-circle-field"]');
    var customCircleCenterXInput = root.querySelector('[data-role="custom-circle-center-x"]');
    var customCircleCenterYInput = root.querySelector('[data-role="custom-circle-center-y"]');
    var customCircleRadiusInput = root.querySelector('[data-role="custom-circle-radius"]');
    var customEllipseFields = root.querySelectorAll('[data-role="custom-ellipse-field"]');
    var customEllipseCenterXInput = root.querySelector('[data-role="custom-ellipse-center-x"]');
    var customEllipseCenterYInput = root.querySelector('[data-role="custom-ellipse-center-y"]');
    var customEllipseAxisAInput = root.querySelector('[data-role="custom-ellipse-axis-a"]');
    var customEllipseAxisBInput = root.querySelector('[data-role="custom-ellipse-axis-b"]');
    var customEllipseRotationInput = root.querySelector('[data-role="custom-ellipse-rotation"]');
    var customRoundedFields = root.querySelectorAll('[data-role="custom-rounded-field"]');
    var customCornerRadiusInput = root.querySelector('[data-role="custom-corner-radius"]');
    var customSplineFields = root.querySelectorAll('[data-role="custom-spline-field"]');
    var customSplineTensionInput = root.querySelector('[data-role="custom-spline-tension"]');
    var customCurvedNote = root.querySelector('[data-role="custom-curved-note"]');
    var customCurvedNoteDefault = customCurvedNote.textContent.trim();
    var customTMinInput = root.querySelector('[data-role="custom-t-min"]');
    var customTMaxInput = root.querySelector('[data-role="custom-t-max"]');
    var customBoundaryRows = Array.from(root.querySelectorAll('[data-role="custom-boundary-side"]'));
    var customPolygonBoundaryList = root.querySelector('[data-role="custom-polygon-boundaries"]');
    var customInitialPresetSelect = root.querySelector('[data-role="custom-initial-preset"]');
    var customInitialValueInput = root.querySelector('[data-role="custom-initial-value"]');
    var customInitialValueField = root.querySelector('[data-role="custom-initial-value-field"]');
    var customDiffusivityInput = root.querySelector('[data-role="custom-diffusivity"]');
    var customReactionInput = root.querySelector('[data-role="custom-reaction"]');
    var customWaveNumberInput = root.querySelector('[data-role="custom-wave-number"]');
    var customAdvectionXInput = root.querySelector('[data-role="custom-advection-x"]');
    var customAdvectionYInput = root.querySelector('[data-role="custom-advection-y"]');
    var customViscosityInput = root.querySelector('[data-role="custom-viscosity"]');
    var customYFields = root.querySelectorAll('[data-role="custom-y-field"]');
    var customCoordinateFields = root.querySelectorAll('[data-role="custom-coordinate-field"], [data-coordinate-field]');
    var customTimeFields = root.querySelectorAll('[data-role="custom-time-field"]');
    var customInitialFields = root.querySelectorAll('[data-role="custom-initial-field"]');
    var customParameterDiffusivity = root.querySelectorAll('[data-role="custom-parameter-diffusivity"]');
    var customParameterReaction = root.querySelectorAll('[data-role="custom-parameter-reaction"]');
    var customParameterWaveNumber = root.querySelectorAll('[data-role="custom-parameter-wave-number"]');
    var customParameterAdvectionX = root.querySelectorAll('[data-role="custom-parameter-advection-x"]');
    var customParameterAdvectionY = root.querySelectorAll('[data-role="custom-parameter-advection-y"]');
    var customParameterViscosity = root.querySelectorAll('[data-role="custom-parameter-viscosity"]');
    var customTermBuilder = root.querySelector('[data-role="custom-term-builder"]');
    var customTermList = root.querySelector('[data-role="custom-term-list"]');
    var customAddTermButton = root.querySelector('[data-role="custom-add-term"]');
    var physicsContainer = root.querySelector('[data-role="physics-editor"]');
    var physicsEditor = null;
    var selected = { baseline: "plain_pinn" };
    var values = {};
    var customPolygonData = null;
    var lastGeometryType = customGeometryTypeSelect.value;
    var customImageRaster = null;
    var customPolygonOriginal = null;
    var customPolygonEditorRing = 0;
    var customPreviewPolygonMapping = null;
    var customPolygonDrag = null;
    var customPolygonBoundaryState = [];

    payload.problems.forEach(function (problem) {
      var option = document.createElement("option");
      option.value = problem.name;
      option.textContent = problem.title + "  ·  " + problem.name;
      problemSelect.appendChild(option);
    });

    function currentProblem() {
      return payload.problems.find(function (item) {
        return item.name === problemSelect.value;
      });
    }

    function isCustomProblem() {
      return currentProblem().template === "custom_visual";
    }

    function currentFamilies() {
      var families = currentProblem().families.slice();
      if (isCustomProblem()) families.push(customKindSelect.value);
      return families;
    }

    function isCompatible(variant) {
      var families = currentFamilies();
      return variant.compatible_with.some(function (name) {
        return families.indexOf(name) !== -1;
      });
    }

    function familyByName(name) {
      return payload.families.find(function (item) {
        return item.method === name;
      });
    }

    function variantByName(family, name) {
      return family.variants.find(function (item) {
        return item.variant === name;
      });
    }

    function parameterKey(method, variant, name) {
      return method + "/" + variant + "/" + name;
    }

    function ensureValues(family, variant) {
      Object.entries(variant.parameters).forEach(function (entry) {
        var key = parameterKey(family.method, variant.variant, entry[0]);
        if (!(key in values)) {
          var defaultValue = entry[1].default;
          values[key] = defaultValue === null ? "" : JSON.parse(JSON.stringify(defaultValue));
        }
      });
    }

    function findConflict(family) {
      var result = null;
      Object.keys(selected).some(function (methodName) {
        if (methodName === family.method) return false;
        var other = familyByName(methodName);
        var overlap = family.slots.filter(function (slot) {
          return other.slots.indexOf(slot) !== -1;
        });
        if (overlap.length) {
          result = other;
          return true;
        }
        return false;
      });
      return result;
    }

    function showMessage(text, isError) {
      message.textContent = text || "";
      message.classList.toggle("is-error", Boolean(isError));
    }

    function renderMethodList() {
      methodList.innerHTML = "";
      payload.families.forEach(function (family) {
        var compatibleVariants = family.variants.filter(isCompatible);
        var card = document.createElement("div");
        var isSelected = Object.prototype.hasOwnProperty.call(selected, family.method);
        card.className =
          "configurator-method-card" +
          (isSelected ? " is-selected" : "") +
          (compatibleVariants.length ? "" : " is-disabled");
        card.dataset.methodCard = family.method;

        var heading = document.createElement("div");
        heading.className = "configurator-method-heading";
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.role = "method-toggle";
        checkbox.checked = isSelected;
        checkbox.disabled = compatibleVariants.length === 0;
        checkbox.setAttribute("aria-label", "选择" + family.title);
        var titleWrap = document.createElement("div");
        titleWrap.innerHTML =
          '<span class="configurator-method-title">' +
          family.title +
          '</span><span class="configurator-method-code">' +
          family.method +
          "</span>";
        heading.appendChild(checkbox);
        heading.appendChild(titleWrap);
        card.appendChild(heading);

        var variantSelect = document.createElement("select");
        variantSelect.dataset.role = "variant";
        variantSelect.setAttribute("aria-label", family.title + "具体方法");
        family.variants.forEach(function (variant) {
          var option = document.createElement("option");
          option.value = variant.variant;
          option.textContent = variant.title + "  ·  " + variant.variant;
          option.disabled = !isCompatible(variant);
          variantSelect.appendChild(option);
        });
        var currentVariant = selected[family.method];
        if (!currentVariant || !isCompatible(variantByName(family, currentVariant))) {
          currentVariant = compatibleVariants.length ? compatibleVariants[0].variant : family.variants[0].variant;
        }
        variantSelect.value = currentVariant;
        variantSelect.disabled = compatibleVariants.length === 0;
        card.appendChild(variantSelect);

        var summary = document.createElement("p");
        summary.className = "configurator-method-summary";
        summary.textContent = variantByName(family, currentVariant).summary;
        card.appendChild(summary);

        checkbox.addEventListener("change", function () {
          if (!checkbox.checked) {
            delete selected[family.method];
          } else if (family.method === "baseline") {
            selected = { baseline: "plain_pinn" };
          } else {
            delete selected.baseline;
            var conflict = findConflict(family);
            if (conflict) {
              checkbox.checked = false;
              showMessage(
                family.title + "与" + conflict.title + "控制同一组件，当前不能同时选择。",
                true
              );
              return;
            }
            selected[family.method] = variantSelect.value;
          }
          showMessage("");
          renderAll();
        });

        variantSelect.addEventListener("change", function () {
          summary.textContent = variantByName(family, variantSelect.value).summary;
          if (Object.prototype.hasOwnProperty.call(selected, family.method)) {
            selected[family.method] = variantSelect.value;
            showMessage("");
            renderAll();
          }
        });
        methodList.appendChild(card);
      });
    }

    function createInput(family, variant, name, schema) {
      var key = parameterKey(family.method, variant.variant, name);
      ensureValues(family, variant);
      var input;
      if (schema.kind === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(values[key]);
      } else if (schema.kind === "choice") {
        input = document.createElement("select");
        schema.choices.forEach(function (choice) {
          var option = document.createElement("option");
          option.value = String(choice);
          option.textContent = String(choice);
          input.appendChild(option);
        });
        input.value = String(values[key]);
      } else if (schema.kind === "number" || schema.kind === "integer") {
        input = document.createElement("input");
        input.type = "number";
        input.step = schema.kind === "integer" ? "1" : "any";
        if (schema.minimum !== null) input.min = String(schema.minimum);
        if (schema.maximum !== null) input.max = String(schema.maximum);
        input.value = values[key];
      } else if (schema.kind === "number_list" || schema.kind === "number_map") {
        input = document.createElement("textarea");
        input.rows = 2;
        input.value =
          typeof values[key] === "string" ? values[key] : JSON.stringify(values[key]);
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = values[key];
        input.placeholder = schema.placeholder || "";
      }
      input.dataset.parameterKey = key;
      input.dataset.parameterKind = schema.kind;
      input.dataset.required = schema.required ? "true" : "false";
      input.addEventListener("input", function () {
        if (schema.kind === "boolean") {
          values[key] = input.checked;
        } else if (schema.kind === "number_list" || schema.kind === "number_map") {
          try {
            values[key] = JSON.parse(input.value);
          } catch (error) {
            values[key] = input.value;
          }
        } else {
          values[key] = input.value;
        }
        updateCode();
      });
      input.addEventListener("change", function () {
        values[key] = schema.kind === "boolean" ? input.checked : input.value;
        updateCode();
      });
      return input;
    }

    function renderParameters() {
      parameterList.innerHTML = "";
      Object.keys(selected).forEach(function (methodName) {
        var family = familyByName(methodName);
        var variant = variantByName(family, selected[methodName]);
        var group = document.createElement("div");
        group.className = "configurator-parameter-group";
        var title = document.createElement("h3");
        title.textContent = family.title + " / " + variant.title;
        group.appendChild(title);

        var entries = Object.entries(variant.parameters);
        if (!entries.length) {
          var empty = document.createElement("div");
          empty.className = "configurator-empty";
          empty.textContent = "这个方法当前没有专用超参数；网络宽度等通用设置由问题默认配置提供。";
          group.appendChild(empty);
        }
        entries.forEach(function (entry) {
          var name = entry[0];
          var schema = entry[1];
          var row = document.createElement("div");
          row.className = "configurator-field";
          var label = document.createElement("label");
          label.textContent = schema.label + "  ·  " + name;
          var description = document.createElement("small");
          description.textContent = schema.description + " 修改影响：" + schema.effect;
          label.appendChild(description);
          row.appendChild(label);
          row.appendChild(createInput(family, variant, name, schema));
          group.appendChild(row);
        });
        parameterList.appendChild(group);
      });
    }

    function readParameter(input) {
      var kind = input.dataset.parameterKind;
      if (kind === "boolean") return input.checked;
      if (kind === "integer") {
        if (input.value === "") return null;
        var integer = Number(input.value);
        if (!Number.isInteger(integer)) throw new Error("整数参数不能包含小数。");
        return integer;
      }
      if (kind === "number") {
        if (input.value === "") return null;
        var number = Number(input.value);
        if (!Number.isFinite(number)) throw new Error("数值参数格式不正确。");
        return number;
      }
      if (kind === "number_list" || kind === "number_map") {
        try {
          return JSON.parse(input.value);
        } catch (error) {
          throw new Error("列表或字典参数必须使用正确的 JSON 格式。");
        }
      }
      if (input.value === "") {
        if (input.dataset.required === "true") throw new Error("必填参数不能为空。");
        return null;
      }
      return input.value;
    }

    function generatedMethodLines() {
      return Object.keys(selected).map(function (methodName) {
        var family = familyByName(methodName);
        var variant = variantByName(family, selected[methodName]);
        var entries = Object.keys(variant.parameters);
        if (!entries.length) {
          return '    op.method("' + family.method + '", "' + variant.variant + '"),';
        }
        var lines = [
          "    op.method(",
          '        "' + family.method + '",',
          '        "' + variant.variant + '",',
        ];
        entries.forEach(function (name) {
          var input = root.querySelector(
            '[data-parameter-key="' + parameterKey(family.method, variant.variant, name) + '"]'
          );
          var value = readParameter(input);
          if (value !== null) lines.push("        " + name + "=" + pythonLiteral(value) + ",");
        });
        lines.push("    ),");
        return lines.join("\n");
      });
    }

    function customNumber(input, label) {
      var value = Number(input.value);
      if (!Number.isFinite(value)) throw new Error(label + "必须是数值。");
      return value;
    }

    var customTermDefinitions = [
      ["u", "u", "u"],
      ["u2", "u²", "u^2"],
      ["u3", "u³", "u^3"],
      ["ux", "u_x", "u_x"],
      ["uy", "u_y（仅二维）", "u_y"],
      ["ut", "u_t（仅动态）", "u_t"],
      ["uxx", "u_xx", "u_{xx}"],
      ["uyy", "u_yy（仅二维）", "u_{yy}"],
      ["utt", "u_tt（仅动态）", "u_{tt}"],
      ["sine_x", "sin(πx̂)", "\\sin(\\pi \\hat{x})"],
      ["sine_xy", "sin(πx̂)sin(πŷ)（仅二维）", "\\sin(\\pi \\hat{x})\\sin(\\pi \\hat{y})"],
      ["gaussian", "高斯源项", "G(\\hat{x},\\hat{y})"],
      ["constant", "常数 1", "1"],
    ];

    function templateChoices() {
      if (customKindSelect.value === "static") {
        return [
          ["poisson", "Poisson 制造解"],
          ["helmholtz", "Helmholtz 制造解"],
          ["nonlinear_poisson", "非线性 Poisson 制造解"],
        ];
      }
      var choices = [
        ["heat", "线性热方程"],
        ["reaction_diffusion", "三次反应–扩散"],
        ["allen_cahn", "Allen–Cahn"],
        ["advection_diffusion", "对流–扩散"],
      ];
      if (customDimensionSelect.value === "1") {
        choices.push(["burgers", "Burgers"]);
      }
      return choices;
    }

    function termDefinition(name) {
      return customTermDefinitions.find(function (definition) {
        return definition[0] === name;
      });
    }

    function termIsCompatible(name, settings) {
      if (["uy", "uyy", "sine_xy"].indexOf(name) !== -1 && settings.dimension !== 2) {
        return false;
      }
      if (["ut", "utt"].indexOf(name) !== -1 && settings.kind !== "dynamic") {
        return false;
      }
      return true;
    }

    function addCustomTerm(coefficient, operator) {
      var row = document.createElement("div");
      row.className = "configurator-term-row";
      var coefficientInput = document.createElement("input");
      coefficientInput.type = "number";
      coefficientInput.step = "any";
      coefficientInput.value = String(coefficient);
      coefficientInput.setAttribute("aria-label", "带符号系数");
      coefficientInput.dataset.role = "custom-term-coefficient";
      var multiply = document.createElement("span");
      multiply.textContent = "×";
      var operatorSelect = document.createElement("select");
      operatorSelect.dataset.role = "custom-term-operator";
      operatorSelect.setAttribute("aria-label", "方程项");
      customTermDefinitions.forEach(function (definition) {
        var option = document.createElement("option");
        option.value = definition[0];
        option.textContent = definition[1];
        operatorSelect.appendChild(option);
      });
      operatorSelect.value = operator;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "configurator-term-remove";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", "删除方程项");
      function changed() {
        renderCustomPreview();
        updateCode();
      }
      coefficientInput.addEventListener("input", changed);
      operatorSelect.addEventListener("change", changed);
      remove.addEventListener("click", function () {
        row.remove();
        changed();
      });
      row.appendChild(coefficientInput);
      row.appendChild(multiply);
      row.appendChild(operatorSelect);
      row.appendChild(remove);
      customTermList.appendChild(row);
    }

    function resetCustomTerms() {
      customTermList.innerHTML = "";
      var dynamic = customKindSelect.value === "dynamic";
      var twoDimensional = customDimensionSelect.value === "2";
      if (dynamic) {
        addCustomTerm(1, "ut");
        addCustomTerm(-0.1, "uxx");
        if (twoDimensional) addCustomTerm(-0.1, "uyy");
      } else {
        addCustomTerm(-1, "uxx");
        if (twoDimensional) addCustomTerm(-1, "uyy");
        addCustomTerm(-1, twoDimensional ? "sine_xy" : "sine_x");
      }
    }

    function readCustomTerms(settings) {
      var rows = Array.from(customTermList.querySelectorAll(".configurator-term-row"));
      if (!rows.length) throw new Error("自由组合模式至少需要一个方程项。");
      return rows.map(function (row) {
        var coefficient = Number(row.querySelector('[data-role="custom-term-coefficient"]').value);
        var operator = row.querySelector('[data-role="custom-term-operator"]').value;
        if (!Number.isFinite(coefficient)) throw new Error("方程项系数必须是数值。");
        if (!termIsCompatible(operator, settings)) {
          throw new Error(termDefinition(operator)[1] + "与当前维度或问题类型不兼容。");
        }
        return { coefficient: coefficient, operator: operator };
      });
    }

    function samePoint(left, right) {
      return left[0] === right[0] && left[1] === right[1];
    }

    function ringArea(ring) {
      var twiceArea = 0;
      for (var index = 0; index < ring.length; index += 1) {
        var next = (index + 1) % ring.length;
        twiceArea += ring[index][0] * ring[next][1] - ring[next][0] * ring[index][1];
      }
      return twiceArea / 2;
    }

    function orientation(a, b, c) {
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    function pointOnSegment(point, start, end) {
      var tolerance = 1e-10;
      var cross = orientation(start, end, point);
      if (Math.abs(cross) > tolerance * Math.max(1, Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]))) {
        return false;
      }
      return point[0] >= Math.min(start[0], end[0]) - tolerance &&
        point[0] <= Math.max(start[0], end[0]) + tolerance &&
        point[1] >= Math.min(start[1], end[1]) - tolerance &&
        point[1] <= Math.max(start[1], end[1]) + tolerance;
    }

    function segmentsIntersect(a, b, c, d) {
      var tolerance = 1e-10;
      var o1 = orientation(a, b, c);
      var o2 = orientation(a, b, d);
      var o3 = orientation(c, d, a);
      var o4 = orientation(c, d, b);
      if (((o1 > tolerance && o2 < -tolerance) || (o1 < -tolerance && o2 > tolerance)) &&
          ((o3 > tolerance && o4 < -tolerance) || (o3 < -tolerance && o4 > tolerance))) {
        return true;
      }
      return (Math.abs(o1) <= tolerance && pointOnSegment(c, a, b)) ||
        (Math.abs(o2) <= tolerance && pointOnSegment(d, a, b)) ||
        (Math.abs(o3) <= tolerance && pointOnSegment(a, c, d)) ||
        (Math.abs(o4) <= tolerance && pointOnSegment(b, c, d));
    }

    function normalizeRing(rawRing, name, clockwise) {
      if (!Array.isArray(rawRing)) throw new Error(name + "必须是坐标数组。");
      var ring = rawRing.map(function (point) {
        if (!Array.isArray(point) || point.length < 2) throw new Error(name + "中的坐标必须写成 [x, y]。");
        var x = Number(point[0]);
        var y = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(name + "包含非数值坐标。");
        return [x, y];
      });
      if (ring.length >= 2 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
      if (ring.length < 3) throw new Error(name + "至少需要 3 个不同顶点。");
      if (ring.length > 5000) throw new Error(name + "超过 5,000 个顶点的安全上限，请先简化轮廓。");
      for (var repeated = 0; repeated < ring.length; repeated += 1) {
        if (samePoint(ring[repeated], ring[(repeated + 1) % ring.length])) {
          throw new Error(name + "含有连续重复顶点。");
        }
      }
      for (var left = 0; left < ring.length; left += 1) {
        for (var right = left + 1; right < ring.length; right += 1) {
          if (right === left + 1 || (left === 0 && right === ring.length - 1)) continue;
          if (segmentsIntersect(ring[left], ring[(left + 1) % ring.length], ring[right], ring[(right + 1) % ring.length])) {
            throw new Error(name + "发生自相交。");
          }
        }
      }
      var area = ringArea(ring);
      if (Math.abs(area) <= 1e-12) throw new Error(name + "面积为 0。");
      if (clockwise === (area > 0)) ring.reverse();
      return ring;
    }

    function pointInRing(point, ring, includeBoundary) {
      var inside = false;
      for (var index = 0; index < ring.length; index += 1) {
        var start = ring[index];
        var end = ring[(index + 1) % ring.length];
        if (pointOnSegment(point, start, end)) return includeBoundary;
        if ((start[1] > point[1]) !== (end[1] > point[1])) {
          var crossingX = start[0] + (point[1] - start[1]) * (end[0] - start[0]) / (end[1] - start[1]);
          if (point[0] < crossingX) inside = !inside;
        }
      }
      return inside;
    }

    function ringsIntersect(left, right) {
      for (var first = 0; first < left.length; first += 1) {
        for (var second = 0; second < right.length; second += 1) {
          if (segmentsIntersect(
            left[first], left[(first + 1) % left.length],
            right[second], right[(second + 1) % right.length]
          )) return true;
        }
      }
      return false;
    }

    function validatePolygon(rawOuter, rawHoles, sourceName) {
      var outer = normalizeRing(rawOuter, "外轮廓", false);
      var holes = (rawHoles || []).map(function (hole, index) {
        return normalizeRing(hole, "孔洞 " + (index + 1), true);
      });
      holes.forEach(function (hole, index) {
        if (ringsIntersect(outer, hole) || !hole.every(function (point) {
          return pointInRing(point, outer, false);
        })) throw new Error("孔洞 " + (index + 1) + " 必须完全位于外轮廓内部且不能接触外轮廓。");
      });
      holes.forEach(function (left, leftIndex) {
        holes.slice(leftIndex + 1).forEach(function (right, offset) {
          if (ringsIntersect(left, right) || pointInRing(left[0], right, true) || pointInRing(right[0], left, true)) {
            throw new Error("孔洞 " + (leftIndex + 1) + " 与孔洞 " + (leftIndex + offset + 2) + " 重叠或接触。");
          }
        });
      });
      var xs = outer.map(function (point) { return point[0]; });
      var ys = outer.map(function (point) { return point[1]; });
      return {
        outer: outer,
        holes: holes,
        sourceName: sourceName || "内置示例",
        bounds: [Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)],
      };
    }

    function polygonCoordinatesFromJson(data) {
      if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.outer)) {
        return [data.outer, data.holes || []];
      }
      if (Array.isArray(data)) return [data, []];
      if (!data || typeof data !== "object") throw new Error("JSON 必须是坐标数组或对象。");
      var geometry = data;
      if (data.type === "Feature") geometry = data.geometry;
      if (data.type === "FeatureCollection") {
        var polygons = (data.features || []).map(function (feature) {
          return feature && feature.geometry;
        }).filter(function (item) {
          return item && item.type === "Polygon";
        });
        if (polygons.length !== 1) throw new Error("FeatureCollection 必须恰好包含一个 Polygon。");
        geometry = polygons[0];
      }
      if (!geometry || geometry.type !== "Polygon") {
        throw new Error("目前只支持 GeoJSON Polygon，暂不支持 MultiPolygon。");
      }
      if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
        throw new Error("GeoJSON Polygon 没有坐标。");
      }
      return [geometry.coordinates[0], geometry.coordinates.slice(1)];
    }

    function polygonCoordinatesFromCsv(text) {
      var groups = {};
      var order = [];
      var current = "outer";
      var blankIndex = 0;
      text.replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function (line, lineIndex) {
        var trimmed = line.trim();
        if (!trimmed) {
          blankIndex += 1;
          current = "hole_" + blankIndex;
          return;
        }
        if (trimmed.charAt(0) === "#") return;
        var cells = trimmed.split(",").map(function (cell) { return cell.trim(); });
        var lower = cells.map(function (cell) { return cell.toLowerCase(); });
        if (lineIndex === 0 && lower.indexOf("x") !== -1 && lower.indexOf("y") !== -1) return;
        var x;
        var y;
        if (cells.length >= 3) {
          current = cells[0] || current;
          x = Number(cells[cells.length - 2]);
          y = Number(cells[cells.length - 1]);
        } else if (cells.length === 2) {
          x = Number(cells[0]);
          y = Number(cells[1]);
        } else {
          throw new Error("CSV 第 " + (lineIndex + 1) + " 行必须是 x,y 或 ring,x,y。");
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error("CSV 第 " + (lineIndex + 1) + " 行包含非数值坐标。");
        }
        if (!Object.prototype.hasOwnProperty.call(groups, current)) {
          groups[current] = [];
          order.push(current);
        }
        groups[current].push([x, y]);
      });
      if (!order.length) throw new Error("CSV 中没有坐标。");
      var outerKey = Object.prototype.hasOwnProperty.call(groups, "outer") ? "outer" : order[0];
      return [groups[outerKey], order.filter(function (key) { return key !== outerKey; }).map(function (key) { return groups[key]; })];
    }

    function clonePolygonData(polygon) {
      return {
        outer: polygon.outer.map(function (point) { return point.slice(); }),
        holes: polygon.holes.map(function (ring) {
          return ring.map(function (point) { return point.slice(); });
        }),
        sourceName: polygon.sourceName,
        bounds: polygon.bounds.slice(),
        imageStats: polygon.imageStats || null,
        dxfInfo: polygon.dxfInfo || null,
        circularHoles: (polygon.circularHoles || []).map(function (circle) {
          return circle ? { center: circle.center.slice(), radius: circle.radius,
            segments: circle.segments } : null;
        }),
      };
    }

    function polygonRings(polygon) {
      return [polygon.outer].concat(polygon.holes).map(function (ring) {
        return ring.map(function (point) { return point.slice(); });
      });
    }

    function defaultPolygonBoundaryCondition() {
      return { type: "dirichlet", value: 0, alpha: 1, beta: 1 };
    }

    function clonePolygonBoundaryCondition(condition) {
      return {
        type: condition.type,
        value: condition.value,
        alpha: condition.alpha,
        beta: condition.beta,
      };
    }

    function clonePolygonBoundaryState() {
      return customPolygonBoundaryState.map(function (ring) {
        return ring.map(clonePolygonBoundaryCondition);
      });
    }

    function reconcilePolygonBoundaryState(reset) {
      if (!customPolygonData) {
        customPolygonBoundaryState = [];
        return;
      }
      var previous = reset ? [] : customPolygonBoundaryState;
      customPolygonBoundaryState = polygonRings(customPolygonData).map(function (ring, ringIndex) {
        return ring.map(function (_point, edgeIndex) {
          var existing = previous[ringIndex] && previous[ringIndex][edgeIndex];
          return existing || defaultPolygonBoundaryCondition();
        });
      });
    }

    function polygonBoundaryDefinitions() {
      if (!customPolygonData) return [];
      reconcilePolygonBoundaryState(false);
      var rings = polygonRings(customPolygonData);
      var definitions = [];
      rings.forEach(function (ring, ringIndex) {
        if (ringIndex > 0 && customPolygonData.circularHoles &&
            customPolygonData.circularHoles[ringIndex - 1]) {
          var circleCondition = customPolygonBoundaryState[ringIndex][0];
          definitions.push({
            side: "polygon_r" + (ringIndex + 1),
            label: "孔洞 " + ringIndex + "（圆形，整圈）",
            polygonRing: true,
            ringIndex: ringIndex,
            edgeIndex: 0,
            type: circleCondition.type,
            value: Number(circleCondition.value),
            alpha: Number(circleCondition.alpha),
            beta: Number(circleCondition.beta),
          });
          return;
        }
        ring.forEach(function (_point, edgeIndex) {
          var nextIndex = (edgeIndex + 1) % ring.length;
          var condition = customPolygonBoundaryState[ringIndex][edgeIndex];
          definitions.push({
            side: "polygon_r" + (ringIndex + 1) + "_e" + (edgeIndex + 1),
            label: (ringIndex === 0 ? "外轮廓 " : "孔洞 " + ringIndex + " ") +
              (edgeIndex + 1) + "→" + (nextIndex + 1),
            polygonEdge: true,
            ringIndex: ringIndex,
            edgeIndex: edgeIndex,
            type: condition.type,
            value: Number(condition.value),
            alpha: Number(condition.alpha),
            beta: Number(condition.beta),
          });
        });
      });
      return definitions;
    }

    function renderPolygonBoundaries() {
      var isPolygon = isCustomProblem() && customDimensionSelect.value === "2" &&
        isPolygonGeometry(customGeometryTypeSelect.value);
      customPolygonBoundaryList.hidden = !isPolygon || !customPolygonData;
      customPolygonBoundaryList.innerHTML = "";
      if (!isPolygon || !customPolygonData) return;
      reconcilePolygonBoundaryState(false);
      polygonBoundaryDefinitions().forEach(function (boundary) {
        var condition = customPolygonBoundaryState[boundary.ringIndex][boundary.edgeIndex];
        var row = document.createElement("div");
        row.className = "configurator-boundary-row";
        row.dataset.polygonBoundaryEdge = boundary.side;

        var title = document.createElement("strong");
        title.textContent = boundary.label;
        row.appendChild(title);

        var typeLabel = document.createElement("label");
        typeLabel.textContent = "类型";
        var typeSelect = document.createElement("select");
        typeSelect.innerHTML = '<option value="dirichlet">Dirichlet：u=c</option>' +
          '<option value="neumann">Neumann：∂u/∂n=q</option>' +
          '<option value="robin">Robin：αu+β∂u/∂n=c</option>';
        typeSelect.value = condition.type;
        typeLabel.appendChild(typeSelect);
        row.appendChild(typeLabel);

        function numberField(text, key) {
          var label = document.createElement("label");
          label.textContent = text;
          var input = document.createElement("input");
          input.type = "number";
          input.step = "any";
          input.value = String(condition[key]);
          input.dataset.boundaryKey = key;
          label.appendChild(input);
          return label;
        }

        var valueLabel = numberField("目标值 c/q", "value");
        var alphaLabel = numberField("α", "alpha");
        var betaLabel = numberField("β", "beta");
        alphaLabel.dataset.robinParameter = "true";
        betaLabel.dataset.robinParameter = "true";
        row.appendChild(valueLabel);
        row.appendChild(alphaLabel);
        row.appendChild(betaLabel);

        function toggleRobinFields() {
          var hidden = typeSelect.value !== "robin";
          alphaLabel.hidden = hidden;
          betaLabel.hidden = hidden;
        }

        function refreshFromRow() {
          condition.type = typeSelect.value;
          row.querySelectorAll("input[data-boundary-key]").forEach(function (input) {
            condition[input.dataset.boundaryKey] = Number(input.value);
          });
          toggleRobinFields();
          renderCustomPreview();
          updateCode();
        }

        typeSelect.addEventListener("change", refreshFromRow);
        row.querySelectorAll("input[data-boundary-key]").forEach(function (input) {
          input.addEventListener("input", refreshFromRow);
          input.addEventListener("change", refreshFromRow);
        });
        toggleRobinFields();
        customPolygonBoundaryList.appendChild(row);
      });
    }

    function ringInteriorAngle(ring, index) {
      var previous = ring[(index + ring.length - 1) % ring.length];
      var current = ring[index];
      var next = ring[(index + 1) % ring.length];
      var incoming = [current[0] - previous[0], current[1] - previous[1]];
      var outgoing = [next[0] - current[0], next[1] - current[1]];
      var turn = Math.atan2(
        incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
        incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
      ) * 180 / Math.PI;
      var orientationSign = ringArea(ring) >= 0 ? 1 : -1;
      var angle = 180 - orientationSign * turn;
      while (angle <= 0) angle += 360;
      while (angle > 360) angle -= 360;
      return angle;
    }

    function applyPolygonRings(rings) {
      var validated = validatePolygon(
        rings[0],
        rings.slice(1),
        customPolygonData ? customPolygonData.sourceName : "编辑后轮廓"
      );
      if (customPolygonData && customPolygonData.imageStats) {
        validated.imageStats = customPolygonData.imageStats;
      }
      if (customPolygonData && customPolygonData.circularHoles) {
        validated.circularHoles = validated.holes.map(function (hole, index) {
          return customPolygonData.circularHoles[index] && window.OpenPINNDxfImport
            ? window.OpenPINNDxfImport.circularRing(hole) : null;
        });
      }
      if (customPolygonData && customPolygonData.dxfInfo) validated.dxfInfo = customPolygonData.dxfInfo;
      setPolygonData(validated, true);
    }

    function renderPolygonEditor() {
      if (!customPolygonData) {
        customPolygonEditor.hidden = true;
        return;
      }
      customPolygonEditor.hidden = false;
      var rings = [customPolygonData.outer].concat(customPolygonData.holes);
      customPolygonEditorRing = Math.min(customPolygonEditorRing, rings.length - 1);
      customPolygonRingSelect.innerHTML = "";
      rings.forEach(function (ring, index) {
        var option = document.createElement("option");
        option.value = String(index);
        option.textContent = index === 0
          ? "外轮廓（" + ring.length + " 个顶点）"
          : (customPolygonData.circularHoles && customPolygonData.circularHoles[index - 1]
            ? "孔洞 " + index + "（圆形）"
            : "孔洞 " + index + "（" + ring.length + " 个顶点）");
        customPolygonRingSelect.appendChild(option);
      });
      customPolygonRingSelect.value = String(customPolygonEditorRing);
      var ring = rings[customPolygonEditorRing];
      var circle = customPolygonEditorRing > 0 && customPolygonData.circularHoles &&
        customPolygonData.circularHoles[customPolygonEditorRing - 1];
      customDxfCircleEditor.hidden = !circle;
      customPolygonTableWrap.hidden = Boolean(circle);
      if (circle) {
        customDxfCircleXInput.value = String(circle.center[0]);
        customDxfCircleYInput.value = String(circle.center[1]);
        customDxfCircleRadiusInput.value = String(circle.radius);
        customDxfCircleDiameterInput.value = String(2 * circle.radius);
        customPolygonVertices.innerHTML = "";
        return;
      }
      customPolygonVertices.innerHTML = "";
      ring.forEach(function (point, index) {
        var row = document.createElement("tr");
        var next = ring[(index + 1) % ring.length];
        var length = Math.hypot(next[0] - point[0], next[1] - point[1]);
        var angle = ringInteriorAngle(ring, index);
        var numberCell = document.createElement("td");
        numberCell.textContent = String(index + 1);
        row.appendChild(numberCell);
        [0, 1].forEach(function (axis) {
          var cell = document.createElement("td");
          var input = document.createElement("input");
          input.type = "number";
          input.step = "any";
          input.value = String(point[axis]);
          input.setAttribute("aria-label", "顶点 " + (index + 1) + (axis ? " y" : " x"));
          input.addEventListener("change", function () {
            try {
              var value = Number(input.value);
              if (!Number.isFinite(value)) throw new Error("顶点坐标必须是有限数值。");
              var edited = polygonRings(customPolygonData);
              edited[customPolygonEditorRing][index][axis] = value;
              applyPolygonRings(edited);
            } catch (error) {
              customPolygonStatus.classList.add("is-error");
              customPolygonStatus.textContent = "顶点修改失败：" + error.message;
              renderPolygonEditor();
            }
          });
          cell.appendChild(input);
          row.appendChild(cell);
        });
        var lengthCell = document.createElement("td");
        var lengthInput = document.createElement("input");
        lengthInput.type = "number";
        lengthInput.min = "0";
        lengthInput.step = "any";
        lengthInput.value = length.toPrecision(8);
        lengthInput.setAttribute("aria-label", "顶点 " + (index + 1) + " 到下一点的边长");
        lengthInput.addEventListener("change", function () {
          try {
            var desired = Number(lengthInput.value);
            applyPolygonRings(window.OpenPINNImageTrace.setEdgeLength(
              polygonRings(customPolygonData), customPolygonEditorRing, index, desired
            ));
          } catch (error) {
            customPolygonStatus.classList.add("is-error");
            customPolygonStatus.textContent = "边长修改失败：" + error.message;
            renderPolygonEditor();
          }
        });
        lengthCell.appendChild(lengthInput);
        row.appendChild(lengthCell);
        var angleCell = document.createElement("td");
        var angleInput = document.createElement("input");
        angleInput.type = "number";
        angleInput.min = "0.01";
        angleInput.max = "359.99";
        angleInput.step = "any";
        angleInput.value = angle.toFixed(6);
        angleInput.setAttribute("aria-label", "顶点 " + (index + 1) + " 内角");
        angleInput.addEventListener("change", function () {
          try {
            var desired = Number(angleInput.value);
            applyPolygonRings(window.OpenPINNImageTrace.setInteriorAngle(
              polygonRings(customPolygonData), customPolygonEditorRing, index, desired
            ));
          } catch (error) {
            customPolygonStatus.classList.add("is-error");
            customPolygonStatus.textContent = "内角修改失败：" + error.message;
            renderPolygonEditor();
          }
        });
        angleCell.appendChild(angleInput);
        row.appendChild(angleCell);
        var actions = document.createElement("td");
        actions.className = "configurator-polygon-table-actions";
        var insertButton = document.createElement("button");
        insertButton.type = "button";
        insertButton.textContent = "后方加点";
        insertButton.addEventListener("click", function () {
          var boundaryStateBackup = clonePolygonBoundaryState();
          try {
            var edited = polygonRings(customPolygonData);
            var selectedRing = edited[customPolygonEditorRing];
            var following = selectedRing[(index + 1) % selectedRing.length];
            selectedRing.splice(index + 1, 0, [
              (selectedRing[index][0] + following[0]) / 2,
              (selectedRing[index][1] + following[1]) / 2,
            ]);
            var inherited = customPolygonBoundaryState[customPolygonEditorRing][index];
            customPolygonBoundaryState[customPolygonEditorRing].splice(
              index + 1,
              0,
              clonePolygonBoundaryCondition(inherited)
            );
            applyPolygonRings(edited);
          } catch (error) {
            customPolygonBoundaryState = boundaryStateBackup;
            customPolygonStatus.classList.add("is-error");
            customPolygonStatus.textContent = "增加顶点失败：" + error.message;
            renderPolygonBoundaries();
          }
        });
        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "删除";
        deleteButton.disabled = ring.length <= 3;
        deleteButton.addEventListener("click", function () {
          var boundaryStateBackup = clonePolygonBoundaryState();
          try {
            var edited = polygonRings(customPolygonData);
            edited[customPolygonEditorRing].splice(index, 1);
            customPolygonBoundaryState[customPolygonEditorRing].splice(index, 1);
            applyPolygonRings(edited);
          } catch (error) {
            customPolygonBoundaryState = boundaryStateBackup;
            customPolygonStatus.classList.add("is-error");
            customPolygonStatus.textContent = "删除顶点失败：" + error.message;
            renderPolygonBoundaries();
          }
        });
        actions.appendChild(insertButton);
        actions.appendChild(deleteButton);
        row.appendChild(actions);
        customPolygonVertices.appendChild(row);
      });
    }

    function importedGeometryInfo(polygon) {
      var outer = polygon.outer;
      var xs = outer.map(function (point) { return point[0]; });
      var ys = outer.map(function (point) { return point[1]; });
      var lower = [Math.min.apply(null, xs), Math.min.apply(null, ys)];
      var upper = [Math.max.apply(null, xs), Math.max.apply(null, ys)];
      var tolerance = 1e-10 * Math.max(upper[0] - lower[0], upper[1] - lower[1]);
      // Only four axis-aligned corner vertices qualify: no simplification or
      // reordering here, so existing edge numbers and conditions remain stable.
      var rectangle = outer.length === 4 && outer.every(function (point, index) {
        var next = outer[(index + 1) % outer.length];
        var corner = [0, 1].every(function (axis) {
          return Math.min(Math.abs(point[axis] - lower[axis]), Math.abs(point[axis] - upper[axis])) <= tolerance;
        });
        var dx = Math.abs(next[0] - point[0]);
        var dy = Math.abs(next[1] - point[1]);
        return corner && ((dx <= tolerance && dy > tolerance) || (dy <= tolerance && dx > tolerance));
      });
      var circles = polygon.circularHoles || [];
      var analytic = rectangle && polygon.holes.length > 0 &&
        polygon.holes.every(function (_ring, index) { return Boolean(circles[index]); });
      if (analytic) {
        circles.slice(0, polygon.holes.length).forEach(function (circle, index) {
          var x = circle.center[0], y = circle.center[1], r = circle.radius;
          if (![x, y, r].every(Number.isFinite) || r <= 0 ||
              x - r <= lower[0] || x + r >= upper[0] || y - r <= lower[1] || y + r >= upper[1]) {
            throw new Error("解析圆孔 " + (index + 1) + " 必须完整位于矩形内部，不能接触外边界。");
          }
          circles.slice(0, index).forEach(function (previous) {
            if (Math.hypot(x - previous.center[0], y - previous.center[1]) <= r + previous.radius) {
              throw new Error("解析圆孔不能相交或相切。");
            }
          });
        });
      }
      var note = analytic
        ? "训练几何：解析矩形＋圆孔；圆心/半径直接参与采样与法向计算，孔壁外法向指向孔内。图示点列不作为训练圆弧。"
        : "训练几何：多边形点列（非解析曲线）；当前外轮廓 " + outer.length + " 段。";
      if (!analytic) {
        polygon.holes.forEach(function (ring, index) {
          var circle = circles[index];
          note += " 孔洞 " + (index + 1) + "：" + ring.length + " 段";
          if (circle) {
            var sagitta = circle.radius * (1 - Math.cos(Math.PI / ring.length));
            note += "，等角重采样后的最大弦高约 " + sagitta.toPrecision(4) + "（模型长度单位，不含识别/拟合误差）";
          }
          note += "。";
        });
        note += "一般曲线与原图/CAD 的偏差尚未估计；法向按直线段计算。";
      }
      return { analytic: analytic, lower: lower, upper: upper, note: note };
    }

    function setPolygonData(polygon, keepOriginal) {
      var geometryInfo = importedGeometryInfo(polygon);
      customPolygonData = polygon;
      if (!keepOriginal) {
        customPolygonOriginal = clonePolygonData(polygon);
        reconcilePolygonBoundaryState(true);
      } else {
        reconcilePolygonBoundaryState(false);
      }
      customXMinInput.value = polygon.bounds[0];
      customXMaxInput.value = polygon.bounds[1];
      customYMinInput.value = polygon.bounds[2];
      customYMaxInput.value = polygon.bounds[3];
      customPolygonStatus.classList.remove("is-error");
      customPolygonStatus.textContent = "已载入 " + polygon.sourceName + "：外轮廓 " + polygon.outer.length +
        (polygon.imageStats ? " 个关键控制点，" : " 个顶点，") + polygon.holes.length + " 个孔洞；范围 x=[" + polygon.bounds[0] + ", " +
        polygon.bounds[1] + "]，y=[" + polygon.bounds[2] + ", " + polygon.bounds[3] + "]。" +
        (polygon.circularHoles && polygon.circularHoles.some(Boolean) ? " 其中 " + polygon.circularHoles.filter(Boolean).length +
          " 个圆孔按整圈设置边界，可编辑圆心和半径。" : "") +
        (polygon.imageStats ? " 图片识别：" + polygon.imageStats.rasterWidth + "×" +
          polygon.imageStats.rasterHeight + " 像素，" +
          (polygon.imageStats.segmentation === "alpha" ? "透明度分割" :
            polygon.imageStats.segmentation === "color" ? "自动色差分割" :
              (polygon.imageStats.foreground === "dark" ? "深色" : "浅色") +
              "前景、阈值 " + Math.round(polygon.imageStats.threshold)) + "。" : "");
      if (isPolygonGeometry(customGeometryTypeSelect.value)) customPolygonStatus.textContent += " " + geometryInfo.note;
      renderPolygonEditor();
      renderPolygonBoundaries();
      renderCustomPreview();
      updateCode();
    }

    function imageCoordinateBounds() {
      var bounds = [
        Number(customImageXMinInput.value),
        Number(customImageXMaxInput.value),
        Number(customImageYMinInput.value),
        Number(customImageYMaxInput.value),
      ];
      if (!bounds.every(Number.isFinite) || bounds[1] <= bounds[0] || bounds[3] <= bounds[2]) {
        throw new Error("图片坐标上限必须大于下限。");
      }
      return bounds;
    }

    function processPolygonImage() {
      if (!customImageRaster) throw new Error("请先选择 PNG 或 JPG 图片。");
      if (!window.OpenPINNImageTrace) throw new Error("图片轮廓模块未加载。");
      var maximumSide = Number(customImageResolutionSelect.value);
      var simplifyTolerance = Number(customImageSimplifyInput.value);
      if (![384, 768, 1024, 1536, 2048].includes(maximumSide)) throw new Error("识别分辨率无效。");
      if (!Number.isFinite(simplifyTolerance) || simplifyTolerance < 0.25 || simplifyTolerance > 5) {
        throw new Error("轮廓简化值必须在 0.25–5 像素之间。");
      }
      var scale = Math.min(1, maximumSide / Math.max(
        customImageRaster.image.naturalWidth,
        customImageRaster.image.naturalHeight
      ));
      var width = Math.max(2, Math.round(customImageRaster.image.naturalWidth * scale));
      var height = Math.max(2, Math.round(customImageRaster.image.naturalHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("浏览器无法创建图片解析画布。");
      context.imageSmoothingEnabled = true;
      context.drawImage(customImageRaster.image, 0, 0, width, height);
      var imageData = context.getImageData(0, 0, width, height);
      var traced = window.OpenPINNImageTrace.imageDataToPolygon(
        imageData.data,
        width,
        height,
        {
          foreground: customImageForegroundSelect.value,
          threshold: customImageThresholdModeSelect.value === "auto"
            ? "auto" : Number(customImageThresholdInput.value),
          bounds: imageCoordinateBounds(),
          simplifyTolerance: simplifyTolerance,
        }
      );
      var shapeMode = customImageShapeModeSelect.value;
      var splineShape = shapeMode === "auto"
        ? traced.curveShape
        : (shapeMode === "spline" ? {
          type: "closed_spline",
          controlPoints: traced.outer,
          tension: 0.2,
          confidence: traced.curveEvidence && traced.curveEvidence.confidence || 0,
        } : null);
      if (splineShape && traced.holes.length) {
        if (shapeMode === "spline") throw new Error("带孔图形暂不能强制转换为单一闭合样条。");
        splineShape = null;
      }
      if (splineShape) {
        customGeometryTypeSelect.value = "spline";
        customSplineTensionInput.value = String(splineShape.tension);
        var splinePolygon = validatePolygon(
          splineShape.controlPoints,
          [],
          customImageRaster.sourceName
        );
        splinePolygon.imageStats = traced;
        var curveConfidence = (100 * splineShape.confidence).toFixed(1);
        customCurvedNote.textContent = "已从 " + customImageRaster.sourceName +
          " 检测到连续曲率并生成可编辑闭合样条（识别置信度 " + curveConfidence +
          "%）。拖动控制点或修改张力即可改变局部曲率；边界不是多段折线。";
        toggleCustomFields();
        setPolygonData(splinePolygon);
        return;
      }
      var analyticShape = (shapeMode === "circle" || shapeMode === "rounded_rectangle") &&
        traced.analyticCandidates ? traced.analyticCandidates[shapeMode] : null;
      if (analyticShape && traced.holes.length) {
        throw new Error("带孔图形不能强制拟合为单一圆或圆角矩形。");
        analyticShape = null;
      }
      if (analyticShape && !analyticShape.isotropic) {
        throw new Error("当前 x/y 物理坐标比例会拉伸圆弧；请使每像素的 x/y 物理长度一致。");
      }
      if (analyticShape) {
        customPolygonData = null;
        customPolygonOriginal = null;
        if (analyticShape.type === "circle") {
          customCircleCenterXInput.value = String(analyticShape.center[0]);
          customCircleCenterYInput.value = String(analyticShape.center[1]);
          customCircleRadiusInput.value = String(analyticShape.radius);
          customGeometryTypeSelect.value = "circle";
        } else {
          customXMinInput.value = String(analyticShape.lower[0]);
          customXMaxInput.value = String(analyticShape.upper[0]);
          customYMinInput.value = String(analyticShape.lower[1]);
          customYMaxInput.value = String(analyticShape.upper[1]);
          customCornerRadiusInput.value = String(analyticShape.cornerRadius);
          customGeometryTypeSelect.value = "rounded_rectangle";
        }
        var confidence = (100 * analyticShape.confidence).toFixed(1);
        customCurvedNote.textContent = "已从 " + customImageRaster.sourceName + " 识别为" +
          (analyticShape.type === "circle" ? "纯圆" : "圆角矩形") +
          "（像素拟合度 " + confidence + "%）。已切换为解析曲线，不再使用多段折线。";
        toggleCustomFields();
        renderCustomPreview();
        updateCode();
        return;
      }
      customCurvedNote.textContent = customCurvedNoteDefault;
      customGeometryTypeSelect.value = "polygon";
      toggleCustomFields();
      var polygon = validatePolygon(traced.outer, traced.holes, customImageRaster.sourceName);
      polygon.imageStats = traced;
      setPolygonData(polygon);
    }

    function loadPolygonImage(file) {
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          try {
            if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效。");
            if (image.naturalWidth * image.naturalHeight > 40_000_000) {
              throw new Error("原图超过 4,000 万像素的安全上限，请先缩小图片。");
            }
            customImageRaster = {
              image: image,
              sourceName: file.name,
            };
            customImageXMinInput.value = "0";
            customImageXMaxInput.value = "1";
            customImageYMinInput.value = "0";
            customImageYMaxInput.value = String(
              Math.round(image.naturalHeight / image.naturalWidth * 1e6) / 1e6
            );
            customImageOptions.hidden = false;
            processPolygonImage();
          } catch (error) {
            customPolygonData = null;
            customPolygonStatus.classList.add("is-error");
            customPolygonStatus.textContent = "图片识别失败：" + error.message;
            renderCustomPreview();
            updateCode();
          }
        };
        image.onerror = function () {
          customPolygonData = null;
          customPolygonStatus.classList.add("is-error");
          customPolygonStatus.textContent = "图片识别失败：文件不是有效的 PNG/JPG。";
          renderCustomPreview();
          updateCode();
        };
        image.src = String(reader.result);
      };
      reader.onerror = function () {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "无法读取该图片。";
      };
      reader.readAsDataURL(file);
    }

    function escapeXml(value) {
      return String(value).replace(/[&<>"']/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character];
      });
    }

    function closedSplineSvgPath(points, tension, mapPoint) {
      if (!points || points.length < 4) return "";
      var scale = (1 - tension) / 6;
      var mappedStart = mapPoint(points[0]);
      var path = "M" + mappedStart[0].toFixed(2) + " " + mappedStart[1].toFixed(2);
      for (var index = 0; index < points.length; index += 1) {
        var previous = points[(index + points.length - 1) % points.length];
        var start = points[index];
        var end = points[(index + 1) % points.length];
        var following = points[(index + 2) % points.length];
        var first = [
          start[0] + scale * (end[0] - previous[0]),
          start[1] + scale * (end[1] - previous[1]),
        ];
        var second = [
          end[0] - scale * (following[0] - start[0]),
          end[1] - scale * (following[1] - start[1]),
        ];
        var mappedFirst = mapPoint(first);
        var mappedSecond = mapPoint(second);
        var mappedEnd = mapPoint(end);
        path += " C" + mappedFirst[0].toFixed(2) + " " + mappedFirst[1].toFixed(2) +
          " " + mappedSecond[0].toFixed(2) + " " + mappedSecond[1].toFixed(2) +
          " " + mappedEnd[0].toFixed(2) + " " + mappedEnd[1].toFixed(2);
      }
      return path + " Z";
    }

    function readCustomBoundaries(dimension, geometry) {
      if (dimension === 2 && isPolygonGeometry(geometry)) {
        return polygonBoundaryDefinitions().map(function (boundary) {
          if (![boundary.value, boundary.alpha, boundary.beta].every(Number.isFinite)) {
            throw new Error(boundary.label + " 的边界参数必须是有限数值。");
          }
          if (boundary.type === "robin" && boundary.alpha === 0 && boundary.beta === 0) {
            throw new Error(boundary.label + " 的 Robin α 和 β 不能同时为 0。");
          }
          return boundary;
        });
      }
      var activeSides = dimension === 1 ? ["left", "right"] :
        (["circle", "ellipse", "rounded_rectangle", "spline"].indexOf(geometry) !== -1
          ? ["curve"]
          : ["left", "right", "bottom", "top"]);
      return customBoundaryRows.filter(function (row) {
        return activeSides.indexOf(row.dataset.side) !== -1;
      }).map(function (row) {
        var type = row.querySelector('[data-role="boundary-type"]').value;
        var value = customNumber(row.querySelector('[data-role="boundary-value"]'), row.dataset.side + "边界目标值");
        var alpha = customNumber(row.querySelector('[data-role="boundary-alpha"]'), row.dataset.side + "边界 α");
        var beta = customNumber(row.querySelector('[data-role="boundary-beta"]'), row.dataset.side + "边界 β");
        if (type === "robin" && alpha === 0 && beta === 0) {
          throw new Error(row.dataset.side + "边界的 Robin α 和 β 不能同时为 0。");
        }
        return { side: row.dataset.side, type: type, value: value, alpha: alpha, beta: beta };
      });
    }

    function readCustomSettings() {
      var settings = {
        name: customNameInput.value.trim(),
        kind: customKindSelect.value,
        dimension: Number(customDimensionSelect.value),
        geometry: customDimensionSelect.value === "2" ? customGeometryTypeSelect.value : "interval",
        mode: customEquationModeSelect.value,
        template: customTemplateSelect.value,
        xMin: customNumber(customXMinInput, "x 下限"),
        xMax: customNumber(customXMaxInput, "x 上限"),
        yMin: customNumber(customYMinInput, "y 下限"),
        yMax: customNumber(customYMaxInput, "y 上限"),
        tMin: customNumber(customTMinInput, "t 下限"),
        tMax: customNumber(customTMaxInput, "t 上限"),
        initialPreset: customInitialPresetSelect.value,
        initialValue: customInitialValueInput ? customNumber(customInitialValueInput, "常数初值") : 0,
        diffusivity: customNumber(customDiffusivityInput, "扩散系数"),
        reaction: customNumber(customReactionInput, "反应系数"),
        waveNumber: customNumber(customWaveNumberInput, "波数"),
        advectionX: customNumber(customAdvectionXInput, "x 方向速度"),
        advectionY: customNumber(customAdvectionYInput, "y 方向速度"),
        viscosity: customNumber(customViscosityInput, "黏性系数"),
      };
      if (settings.dimension === 2 && settings.geometry === "circle") {
        settings.circleCenterX = customNumber(customCircleCenterXInput, "圆心 x");
        settings.circleCenterY = customNumber(customCircleCenterYInput, "圆心 y");
        settings.circleRadius = customNumber(customCircleRadiusInput, "圆半径");
        if (settings.circleRadius <= 0) throw new Error("圆半径必须大于 0。");
        settings.xMin = settings.circleCenterX - settings.circleRadius;
        settings.xMax = settings.circleCenterX + settings.circleRadius;
        settings.yMin = settings.circleCenterY - settings.circleRadius;
        settings.yMax = settings.circleCenterY + settings.circleRadius;
      }
      if (settings.dimension === 2 && settings.geometry === "ellipse") {
        settings.ellipseCenterX = customNumber(customEllipseCenterXInput, "椭圆中心 x");
        settings.ellipseCenterY = customNumber(customEllipseCenterYInput, "椭圆中心 y");
        settings.ellipseAxisA = customNumber(customEllipseAxisAInput, "椭圆半轴 a");
        settings.ellipseAxisB = customNumber(customEllipseAxisBInput, "椭圆半轴 b");
        settings.ellipseRotation = customNumber(customEllipseRotationInput, "椭圆旋转角");
        if (settings.ellipseAxisA <= 0 || settings.ellipseAxisB <= 0) {
          throw new Error("椭圆半轴 a 和 b 都必须大于 0。");
        }
        var ellipseRadians = settings.ellipseRotation * Math.PI / 180;
        var ellipseCosine = Math.cos(ellipseRadians);
        var ellipseSine = Math.sin(ellipseRadians);
        var ellipseHalfWidth = Math.hypot(
          settings.ellipseAxisA * ellipseCosine,
          settings.ellipseAxisB * ellipseSine
        );
        var ellipseHalfHeight = Math.hypot(
          settings.ellipseAxisA * ellipseSine,
          settings.ellipseAxisB * ellipseCosine
        );
        settings.xMin = settings.ellipseCenterX - ellipseHalfWidth;
        settings.xMax = settings.ellipseCenterX + ellipseHalfWidth;
        settings.yMin = settings.ellipseCenterY - ellipseHalfHeight;
        settings.yMax = settings.ellipseCenterY + ellipseHalfHeight;
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(settings.name)) {
        throw new Error("问题名称请使用英文字母、数字和下划线，且不能以数字开头。");
      }
      if (settings.xMax <= settings.xMin) throw new Error("x 上限必须大于 x 下限。");
      if (settings.dimension === 2 && settings.yMax <= settings.yMin) {
        throw new Error("y 上限必须大于 y 下限。");
      }
      if (settings.kind === "dynamic" && settings.tMax <= settings.tMin) {
        throw new Error("t 上限必须大于 t 下限。");
      }
      if (isPolygonGeometry(settings.geometry) || settings.geometry === "spline") {
        if (!customPolygonData) throw new Error("请先导入二维轮廓文件。");
        settings.polygon = customPolygonData;
        if (isPolygonGeometry(settings.geometry)) settings.importedGeometry = importedGeometryInfo(settings.polygon);
      }
      if (settings.geometry === "spline") {
        settings.splineTension = customNumber(customSplineTensionInput, "曲线张力");
        if (settings.polygon.holes.length) throw new Error("闭合样条暂不支持孔洞，请使用多边形模式。");
        if (settings.splineTension < 0 || settings.splineTension > 1) {
          throw new Error("曲线张力必须介于 0 和 1 之间。");
        }
      }
      if (settings.geometry === "rounded_rectangle") {
        settings.cornerRadius = customNumber(customCornerRadiusInput, "圆角半径");
        var maximumCornerRadius = 0.5 * Math.min(
          settings.xMax - settings.xMin,
          settings.yMax - settings.yMin
        );
        if (settings.cornerRadius < 0 || settings.cornerRadius > maximumCornerRadius) {
          throw new Error("圆角半径必须介于 0 和 " + maximumCornerRadius + " 之间。");
        }
      }
      settings.boundaries = readCustomBoundaries(settings.dimension, settings.geometry);
      if (settings.diffusivity < 0 || settings.waveNumber < 0 || settings.viscosity < 0) {
        throw new Error("扩散系数、波数和黏性系数不能为负数。");
      }
      if (settings.mode === "free") settings.terms = readCustomTerms(settings);
      if (settings.mode === "expression") {
        if (!physicsEditor) throw new Error("物理参数编辑器未加载，请重新构建文档并刷新页面。");
        settings.physics = physicsEditor.read({dimension: settings.dimension, kind: settings.kind});
      }
      return settings;
    }

    function syncCustomTemplateOptions() {
      var previous = customTemplateSelect.value;
      var choices = templateChoices();
      customTemplateSelect.innerHTML = "";
      choices.forEach(function (choice) {
        var option = document.createElement("option");
        option.value = choice[0];
        option.textContent = choice[1];
        customTemplateSelect.appendChild(option);
      });
      if (choices.some(function (choice) { return choice[0] === previous; })) {
        customTemplateSelect.value = previous;
      }
    }

    function setHidden(nodes, hidden) {
      nodes.forEach(function (node) { node.hidden = hidden; });
    }

    function toggleCustomFields() {
      var isTwoDimensional = customDimensionSelect.value === "2";
      var isPolygon = isTwoDimensional && isPolygonGeometry(customGeometryTypeSelect.value);
      var isSpline = isTwoDimensional && customGeometryTypeSelect.value === "spline";
      var isImported = isPolygon || isSpline;
      var isDxf = isTwoDimensional && customGeometryTypeSelect.value === "dxf";
      var isCircle = isTwoDimensional && customGeometryTypeSelect.value === "circle";
      var isEllipse = isTwoDimensional && customGeometryTypeSelect.value === "ellipse";
      var isRounded = isTwoDimensional && customGeometryTypeSelect.value === "rounded_rectangle";
      var isCurved = isCircle || isEllipse || isRounded || isSpline;
      var isDynamic = customKindSelect.value === "dynamic";
      var isTemplate = customEquationModeSelect.value === "template";
      var template = customTemplateSelect.value;
      customGeometryField.hidden = !isTwoDimensional;
      customPolygonImport.hidden = !isImported || isDxf;
      customDxfImport.hidden = !isDxf;
      customPolygonStatus.hidden = !isImported;
      customPolygonEditor.hidden = !isImported || !customPolygonData;
      setHidden(customCoordinateFields, isImported || isCircle || isEllipse);
      setHidden(customYFields, !isTwoDimensional || isImported || isCircle || isEllipse);
      setHidden(customCircleFields, !isCircle);
      setHidden(customEllipseFields, !isEllipse);
      setHidden(customRoundedFields, !isRounded);
      setHidden(customSplineFields, !isSpline);
      customCurvedNote.hidden = !isCurved;
      customBoundaryRows.forEach(function (row) {
        var activeSides = !isTwoDimensional
          ? ["left", "right"]
          : (isPolygon ? [] : (isCurved ? ["curve"] : ["left", "right", "bottom", "top"]));
        row.hidden = activeSides.indexOf(row.dataset.side) === -1;
        var isRobin = row.querySelector('[data-role="boundary-type"]').value === "robin";
        row.querySelectorAll('[data-role="robin-parameter"]').forEach(function (field) {
          field.hidden = !isRobin;
        });
      });
      renderPolygonBoundaries();
      setHidden(customTimeFields, !isDynamic);
      setHidden(customInitialFields, !isDynamic);
      if (customInitialValueField) customInitialValueField.hidden = !isDynamic || customInitialPresetSelect.value !== "constant";
      customTemplateField.hidden = !isTemplate;
      customTermBuilder.hidden = customEquationModeSelect.value !== "free";
      if (physicsContainer) physicsContainer.hidden = customEquationModeSelect.value !== "expression";
      if (physicsEditor) physicsEditor.setContext({dimension: Number(customDimensionSelect.value), kind: customKindSelect.value});
      setHidden(customParameterDiffusivity, !isTemplate || ["heat", "reaction_diffusion", "allen_cahn", "advection_diffusion"].indexOf(template) === -1);
      setHidden(customParameterReaction, !isTemplate || ["reaction_diffusion", "allen_cahn"].indexOf(template) === -1);
      setHidden(customParameterWaveNumber, !isTemplate || template !== "helmholtz");
      setHidden(customParameterAdvectionX, !isTemplate || template !== "advection_diffusion");
      setHidden(customParameterAdvectionY, !isTemplate || template !== "advection_diffusion" || !isTwoDimensional);
      setHidden(customParameterViscosity, !isTemplate || template !== "burgers");
    }

    function customFormulaLatex(settings) {
      if (settings.mode === "expression") return physicsEditor.getLatex();
      var laplacian = settings.dimension === 1 ? "u_{xx}" : "u_{xx}+u_{yy}";
      if (settings.mode === "free") {
        return settings.terms.map(function (term, index) {
          var magnitude = Math.abs(term.coefficient);
          var sign = term.coefficient < 0 ? "-" : (index ? "+" : "");
          var coefficient = magnitude === 1 ? "" : String(magnitude) + "\\,";
          var symbol = termDefinition(term.operator)[2];
          if (term.operator === "gaussian" && settings.dimension === 1) {
            symbol = "G(\\hat{x})";
          }
          return sign + coefficient + symbol;
        }).join(" ") + " = 0";
      }
      if (settings.template === "poisson") return "-(" + laplacian + ") = f";
      if (settings.template === "helmholtz") {
        return "-(" + laplacian + ") + " + settings.waveNumber + "^2u = f";
      }
      if (settings.template === "nonlinear_poisson") {
        return "-(" + laplacian + ") + u^3 = f";
      }
      if (settings.template === "reaction_diffusion") {
        return "u_t - " + settings.diffusivity + "(" + laplacian + ") + " + settings.reaction + "u^3 = 0";
      }
      if (settings.template === "allen_cahn") {
        return "u_t - " + settings.diffusivity + "(" + laplacian + ") + " + settings.reaction + "(u^3-u) = 0";
      }
      if (settings.template === "advection_diffusion") {
        var advection = settings.advectionX + "u_x";
        if (settings.dimension === 2) advection += "+" + settings.advectionY + "u_y";
        return "u_t + " + advection + " - " + settings.diffusivity + "(" + laplacian + ") = 0";
      }
      if (settings.template === "burgers") {
        return "u_t + uu_x - " + settings.viscosity + "u_{xx} = 0";
      }
      return "u_t - " + settings.diffusivity + "(" + laplacian + ") = 0";
    }

    function previewColour(value) {
      var bounded = Math.max(0, Math.min(1, value));
      return "hsl(" + (230 - 225 * bounded).toFixed(1) + ", 88%, 53%)";
    }

    function boundaryBySide(settings, side) {
      return settings.boundaries.find(function (boundary) { return boundary.side === side; });
    }

    function boundaryLabel(boundary) {
      if (boundary.type === "dirichlet") return "u=" + boundary.value;
      if (boundary.type === "neumann") return "∂u/∂n=" + boundary.value;
      return boundary.alpha + "u+" + boundary.beta + "∂u/∂n=" + boundary.value;
    }

    function boundaryColour(boundary) {
      if (boundary.type === "neumann") return "#e28b22";
      if (boundary.type === "robin") return "#7b4ab5";
      return "#e24a33";
    }

    function formatEdgeLength(value) {
      var magnitude = Math.abs(value);
      if (magnitude === 0) return "0";
      if (magnitude >= 1000 || magnitude < 0.001) return value.toExponential(2);
      return String(Number(value.toPrecision(4)));
    }

    function renderCustomPreview() {
      if (!isCustomProblem()) return;
      customPreviewPolygonMapping = null;
      try {
        var settings = readCustomSettings();
        var formula = customFormulaLatex(settings);
        if (window.katex) {
          window.katex.render(formula, customFormula, { throwOnError: false });
        } else {
          customFormula.textContent = formula;
        }
        var svg = [
          '<rect x="0" y="0" width="720" height="360" rx="12" fill="#f8fbfd"/>',
          '<text x="28" y="34" font-size="20" font-weight="700" fill="#173248">' +
            (settings.dimension === 1 ? "一维计算区域与示例场" : "二维计算区域与示例场") + '</text>',
        ];
        if (settings.dimension === 1) {
          var leftBoundary = boundaryBySide(settings, "left");
          var rightBoundary = boundaryBySide(settings, "right");
          var leftValue = leftBoundary.type === "dirichlet" ? leftBoundary.value : 0;
          var rightValue = rightBoundary.type === "dirichlet" ? rightBoundary.value : 0;
          var fieldValues = [];
          for (var sampleIndex = 0; sampleIndex <= 120; sampleIndex += 1) {
            var sampleFraction = sampleIndex / 120;
            var shape = Math.sin(Math.PI * sampleFraction);
            if (settings.kind === "dynamic" && settings.initialPreset === "zero") shape = 0;
            if (settings.kind === "dynamic" && settings.initialPreset === "gaussian") {
              shape *= Math.exp(-40 * Math.pow(sampleFraction - 0.5, 2));
            }
            fieldValues.push(settings.kind === "dynamic" && settings.initialPreset === "constant"
              ? settings.initialValue : leftValue * (1 - sampleFraction) + rightValue * sampleFraction + shape);
          }
          var fieldMin = Math.min.apply(null, fieldValues.concat([0]));
          var fieldMax = Math.max.apply(null, fieldValues.concat([0]));
          if (fieldMax === fieldMin) {
            fieldMax += 1;
            fieldMin -= 1;
          }
          var padding = 0.12 * (fieldMax - fieldMin);
          fieldMax += padding;
          fieldMin -= padding;
          function plotY(value) {
            return 75 + (fieldMax - value) / (fieldMax - fieldMin) * 211;
          }
          var zeroY = plotY(0);
          var path = [];
          for (var index = 0; index <= 120; index += 1) {
            var fraction = index / 120;
            var x = 70 + 590 * fraction;
            var y = plotY(fieldValues[index]);
            path.push((index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2));
          }
          var xOrigin = settings.xMin <= 0 && settings.xMax >= 0
            ? 70 + 590 * (0 - settings.xMin) / (settings.xMax - settings.xMin)
            : null;
          svg.push(
            '<line x1="70" y1="' + zeroY.toFixed(2) + '" x2="660" y2="' + zeroY.toFixed(2) + '" stroke="#617b8c" stroke-width="2"/>',
            xOrigin === null ? '' : '<line x1="' + xOrigin.toFixed(2) + '" y1="75" x2="' + xOrigin.toFixed(2) + '" y2="286" stroke="#617b8c" stroke-width="2" stroke-dasharray="5 4"/>',
            xOrigin === null ? '' : '<circle cx="' + xOrigin.toFixed(2) + '" cy="' + zeroY.toFixed(2) + '" r="4" fill="#173248"/><text x="' + (xOrigin + 7).toFixed(2) + '" y="' + (zeroY - 7).toFixed(2) + '" font-size="13" fill="#173248">O</text>',
            '<path d="' + path.join(" ") + '" fill="none" stroke="#1769d2" stroke-width="5"/>',
            '<circle cx="70" cy="' + plotY(fieldValues[0]).toFixed(2) + '" r="7" fill="' + boundaryColour(leftBoundary) + '"/><circle cx="660" cy="' + plotY(fieldValues[120]).toFixed(2) + '" r="7" fill="' + boundaryColour(rightBoundary) + '"/>',
            '<text x="62" y="315" font-size="15" fill="#173248">' + settings.xMin + '</text>',
            '<text x="646" y="315" font-size="15" fill="#173248">' + settings.xMax + '</text>',
            '<text x="72" y="58" font-size="13" fill="' + boundaryColour(leftBoundary) + '">左：' + boundaryLabel(leftBoundary) + '</text>',
            '<text x="648" y="58" text-anchor="end" font-size="13" fill="' + boundaryColour(rightBoundary) + '">右：' + boundaryLabel(rightBoundary) + '</text>',
            '<text x="60" y="82" text-anchor="end" font-size="13" fill="#526b7d">' + fieldMax.toFixed(2) + '</text>',
            '<text x="60" y="286" text-anchor="end" font-size="13" fill="#526b7d">' + fieldMin.toFixed(2) + '</text>',
            '<text x="365" y="340" text-anchor="middle" font-size="16" fill="#173248">x</text>',
            '<text x="25" y="185" text-anchor="middle" transform="rotate(-90 25 185)" font-size="16" fill="#173248">u(x)</text>'
          );
        } else {
          var cols = 42;
          var rows = 24;
          var xSpan = settings.xMax - settings.xMin;
          var ySpan = settings.yMax - settings.yMin;
          var domainAspect = Math.max(0.35, Math.min(3.5, xSpan / ySpan));
          var maxWidth = 480;
          var maxHeight = 220;
          var width = maxWidth;
          var height = width / domainAspect;
          if (height > maxHeight) {
            height = maxHeight;
            width = height * domainAspect;
          }
          var left = 75 + (maxWidth - width) / 2;
          var top = 60 + (maxHeight - height) / 2;
          var right = left + width;
          var bottom = top + height;
          var isPolygon = isPolygonGeometry(settings.geometry);
          var isSpline = settings.geometry === "spline";
          var isImported = isPolygon || isSpline;
          var isCircle = settings.geometry === "circle";
          var isEllipse = settings.geometry === "ellipse";
          var isRounded = settings.geometry === "rounded_rectangle";
          var isCurved = isCircle || isEllipse || isRounded || isSpline;
          if (isImported) {
            customPreviewPolygonMapping = {
              left: left,
              top: top,
              width: width,
              height: height,
              bottom: bottom,
              xMin: settings.xMin,
              xMax: settings.xMax,
              yMin: settings.yMin,
              yMax: settings.yMax,
              ringIndex: customPolygonEditorRing,
            };
          }
          var polygonBoundaries = isPolygon ? settings.boundaries.filter(function (boundary) {
            return boundary.polygonEdge || boundary.polygonRing;
          }) : [];
          var curveCondition = isCurved ? boundaryBySide(settings, "curve") : null;
          var leftCondition = (isPolygon || isCurved) ? null : boundaryBySide(settings, "left");
          var rightCondition = (isPolygon || isCurved) ? null : boundaryBySide(settings, "right");
          var bottomCondition = (isPolygon || isCurved) ? null : boundaryBySide(settings, "bottom");
          var topCondition = (isPolygon || isCurved) ? null : boundaryBySide(settings, "top");
          var previewBoundaries = (isPolygon || isCurved) ? [] : [
            { condition: leftCondition, distance: function (xFraction, yFraction) { return xFraction; } },
            { condition: rightCondition, distance: function (xFraction, yFraction) { return 1 - xFraction; } },
            { condition: bottomCondition, distance: function (xFraction, yFraction) { return yFraction; } },
            { condition: topCondition, distance: function (xFraction, yFraction) { return 1 - yFraction; } },
          ];
          var polygonDirichlet = polygonBoundaries.filter(function (boundary) {
            return boundary.type === "dirichlet";
          });
          var fieldGrid = [];
          for (var row = 0; row < rows; row += 1) {
            for (var col = 0; col < cols; col += 1) {
              var xFraction = (col + 0.5) / cols;
              var yFraction = (row + 0.5) / rows;
              var boundaryWeight = 0;
              var boundaryTotal = 0;
              previewBoundaries.forEach(function (entry) {
                if (entry.condition.type !== "dirichlet") return;
                var distance = entry.distance(xFraction, yFraction);
                var weight = 1 / Math.pow(distance + 0.035, 3);
                boundaryWeight += weight;
                boundaryTotal += weight * entry.condition.value;
              });
              var boundaryField = isCurved && curveCondition.type === "dirichlet"
                ? curveCondition.value
                : (isPolygon && polygonDirichlet.length
                ? polygonDirichlet.reduce(function (total, boundary) {
                  return total + boundary.value;
                }, 0) / polygonDirichlet.length
                : (boundaryWeight ? boundaryTotal / boundaryWeight : 0));
              var profile = Math.sin(Math.PI * xFraction) * Math.sin(Math.PI * yFraction);
              if (settings.kind === "dynamic" && settings.initialPreset === "zero") profile = 0;
              if (settings.kind === "dynamic" && settings.initialPreset === "gaussian") {
                profile *= Math.exp(-40 * (Math.pow(xFraction - 0.5, 2) + Math.pow(yFraction - 0.5, 2)));
              }
              fieldGrid.push(settings.kind === "dynamic" && settings.initialPreset === "constant"
                ? settings.initialValue : boundaryField + profile);
            }
          }
          var gridMin = Math.min.apply(null, fieldGrid.concat([0]));
          var gridMax = Math.max.apply(null, fieldGrid.concat([0]));
          if (gridMax === gridMin) gridMax = gridMin + 1;
          var polygonPath = "";
          var splinePath = "";
          var ellipseCenterX = 0;
          var ellipseCenterY = 0;
          var ellipseRadiusX = 0;
          var ellipseRadiusY = 0;
          var ellipseTransform = "";
          var ellipseGuides = "";
          var domainClip = "";
          if (isPolygon) {
            polygonPath = [settings.polygon.outer].concat(settings.polygon.holes).map(function (ring) {
              return ring.map(function (point, pointIndex) {
                var mappedX = left + width * (point[0] - settings.xMin) / xSpan;
                var mappedY = bottom - height * (point[1] - settings.yMin) / ySpan;
                return (pointIndex ? "L" : "M") + mappedX.toFixed(2) + " " + mappedY.toFixed(2);
              }).join(" ") + " Z";
            }).join(" ");
            svg.push('<defs><clipPath id="openpinn-polygon-clip"><path d="' + polygonPath + '" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs>');
            domainClip = ' clip-path="url(#openpinn-polygon-clip)"';
          } else if (isSpline) {
            splinePath = closedSplineSvgPath(settings.polygon.outer, settings.splineTension, function (point) {
              return [
                left + width * (point[0] - settings.xMin) / xSpan,
                bottom - height * (point[1] - settings.yMin) / ySpan,
              ];
            });
            svg.push('<defs><clipPath id="openpinn-spline-clip"><path d="' + splinePath + '"/></clipPath></defs>');
            domainClip = ' clip-path="url(#openpinn-spline-clip)"';
          } else if (isCircle) {
            svg.push('<defs><clipPath id="openpinn-curve-clip"><circle cx="' +
              ((left + right) / 2).toFixed(2) + '" cy="' + ((top + bottom) / 2).toFixed(2) +
              '" r="' + (Math.min(width, height) / 2).toFixed(2) + '"/></clipPath></defs>');
            domainClip = ' clip-path="url(#openpinn-curve-clip)"';
          } else if (isEllipse) {
            ellipseCenterX = left + width * (settings.ellipseCenterX - settings.xMin) / xSpan;
            ellipseCenterY = bottom - height * (settings.ellipseCenterY - settings.yMin) / ySpan;
            ellipseRadiusX = width * settings.ellipseAxisA / xSpan;
            ellipseRadiusY = height * settings.ellipseAxisB / ySpan;
            ellipseTransform = 'rotate(' + (-settings.ellipseRotation).toFixed(6) + ' ' +
              ellipseCenterX.toFixed(2) + ' ' + ellipseCenterY.toFixed(2) + ')';
            svg.push('<defs><clipPath id="openpinn-curve-clip"><ellipse cx="' +
              ellipseCenterX.toFixed(2) + '" cy="' + ellipseCenterY.toFixed(2) + '" rx="' +
              ellipseRadiusX.toFixed(2) + '" ry="' + ellipseRadiusY.toFixed(2) + '" transform="' +
              ellipseTransform + '"/></clipPath></defs>');
            domainClip = ' clip-path="url(#openpinn-curve-clip)"';
            var ellipseAngle = settings.ellipseRotation * Math.PI / 180;
            function ellipsePoint(localX, localY) {
              var physicalX = settings.ellipseCenterX + localX * Math.cos(ellipseAngle) - localY * Math.sin(ellipseAngle);
              var physicalY = settings.ellipseCenterY + localX * Math.sin(ellipseAngle) + localY * Math.cos(ellipseAngle);
              return [
                left + width * (physicalX - settings.xMin) / xSpan,
                bottom - height * (physicalY - settings.yMin) / ySpan,
              ];
            }
            var axisALeft = ellipsePoint(-settings.ellipseAxisA, 0);
            var axisARight = ellipsePoint(settings.ellipseAxisA, 0);
            var axisBBottom = ellipsePoint(0, -settings.ellipseAxisB);
            var axisBTop = ellipsePoint(0, settings.ellipseAxisB);
            ellipseGuides = '<line x1="' + axisALeft[0].toFixed(2) + '" y1="' + axisALeft[1].toFixed(2) +
              '" x2="' + axisARight[0].toFixed(2) + '" y2="' + axisARight[1].toFixed(2) +
              '" stroke="#173248" stroke-width="1.4" stroke-dasharray="5 4"/>' +
              '<line x1="' + axisBBottom[0].toFixed(2) + '" y1="' + axisBBottom[1].toFixed(2) +
              '" x2="' + axisBTop[0].toFixed(2) + '" y2="' + axisBTop[1].toFixed(2) +
              '" stroke="#173248" stroke-width="1.4" stroke-dasharray="5 4"/>' +
              '<circle cx="' + ellipseCenterX.toFixed(2) + '" cy="' + ellipseCenterY.toFixed(2) +
              '" r="4" fill="#173248"/><text x="' + (axisARight[0] + 7).toFixed(2) + '" y="' +
              (axisARight[1] - 5).toFixed(2) + '" font-size="12" fill="#173248">a=' +
              settings.ellipseAxisA + '</text><text x="' + (axisBTop[0] + 7).toFixed(2) + '" y="' +
              (axisBTop[1] - 5).toFixed(2) + '" font-size="12" fill="#173248">b=' +
              settings.ellipseAxisB + '</text>';
          } else if (isRounded) {
            var previewRadiusX = width * settings.cornerRadius / xSpan;
            var previewRadiusY = height * settings.cornerRadius / ySpan;
            svg.push('<defs><clipPath id="openpinn-curve-clip"><rect x="' + left.toFixed(2) +
              '" y="' + top.toFixed(2) + '" width="' + width.toFixed(2) + '" height="' +
              height.toFixed(2) + '" rx="' + previewRadiusX.toFixed(2) + '" ry="' +
              previewRadiusY.toFixed(2) + '"/></clipPath></defs>');
            domainClip = ' clip-path="url(#openpinn-curve-clip)"';
          }
          for (var gridRow = 0; gridRow < rows; gridRow += 1) {
            for (var gridCol = 0; gridCol < cols; gridCol += 1) {
              var value = fieldGrid[gridRow * cols + gridCol];
              var normalizedValue = (value - gridMin) / (gridMax - gridMin);
              svg.push(
                '<rect x="' + (left + gridCol * width / cols).toFixed(2) + '" y="' +
                (top + (rows - gridRow - 1) * height / rows).toFixed(2) + '" width="' +
                (width / cols + 0.4).toFixed(2) + '" height="' + (height / rows + 0.4).toFixed(2) +
                '" fill="' + previewColour(normalizedValue) + '"' +
                domainClip + '/>'
              );
            }
          }
          var xZero = settings.xMin <= 0 && settings.xMax >= 0
            ? left + width * (0 - settings.xMin) / xSpan
            : null;
          var yZero = settings.yMin <= 0 && settings.yMax >= 0
            ? bottom - height * (0 - settings.yMin) / ySpan
            : null;
          var boundaryDrawing = isPolygon
            ? polygonBoundaries.map(function (boundary) {
              var boundaryRing = [settings.polygon.outer].concat(settings.polygon.holes)[boundary.ringIndex];
              if (boundary.polygonRing) {
                var ringPoints = boundaryRing.map(function (point) {
                  return (left + width * (point[0] - settings.xMin) / xSpan).toFixed(2) + "," +
                    (bottom - height * (point[1] - settings.yMin) / ySpan).toFixed(2);
                }).join(" ");
                return '<polygon points="' + ringPoints + '" fill="none" stroke="' +
                  boundaryColour(boundary) + '" stroke-width="5"/>';
              }
              var boundaryStart = boundaryRing[boundary.edgeIndex];
              var boundaryEnd = boundaryRing[(boundary.edgeIndex + 1) % boundaryRing.length];
              var boundaryStartX = left + width * (boundaryStart[0] - settings.xMin) / xSpan;
              var boundaryStartY = bottom - height * (boundaryStart[1] - settings.yMin) / ySpan;
              var boundaryEndX = left + width * (boundaryEnd[0] - settings.xMin) / xSpan;
              var boundaryEndY = bottom - height * (boundaryEnd[1] - settings.yMin) / ySpan;
              return '<line x1="' + boundaryStartX.toFixed(2) + '" y1="' + boundaryStartY.toFixed(2) +
                '" x2="' + boundaryEndX.toFixed(2) + '" y2="' + boundaryEndY.toFixed(2) +
                '" stroke="' + boundaryColour(boundary) + '" stroke-width="5"/>';
            }).join("")
            : (isSpline
              ? '<path d="' + splinePath + '" fill="none" stroke="' +
                boundaryColour(curveCondition) + '" stroke-width="5"/>'
            : (isCircle
              ? '<circle cx="' + ((left + right) / 2).toFixed(2) + '" cy="' +
                ((top + bottom) / 2).toFixed(2) + '" r="' +
                (Math.min(width, height) / 2).toFixed(2) + '" fill="none" stroke="' +
                boundaryColour(curveCondition) + '" stroke-width="5"/>'
              : (isEllipse
                ? '<ellipse cx="' + ellipseCenterX.toFixed(2) + '" cy="' +
                  ellipseCenterY.toFixed(2) + '" rx="' + ellipseRadiusX.toFixed(2) + '" ry="' +
                  ellipseRadiusY.toFixed(2) + '" transform="' + ellipseTransform +
                  '" fill="none" stroke="' + boundaryColour(curveCondition) + '" stroke-width="5"/>'
              : (isRounded
                ? '<rect x="' + left.toFixed(2) + '" y="' + top.toFixed(2) + '" width="' +
                  width.toFixed(2) + '" height="' + height.toFixed(2) + '" rx="' +
                  (width * settings.cornerRadius / xSpan).toFixed(2) + '" ry="' +
                  (height * settings.cornerRadius / ySpan).toFixed(2) + '" fill="none" stroke="' +
                  boundaryColour(curveCondition) + '" stroke-width="5"/>'
            : '<line x1="' + left.toFixed(2) + '" y1="' + top.toFixed(2) + '" x2="' + left.toFixed(2) + '" y2="' + bottom.toFixed(2) + '" stroke="' + boundaryColour(leftCondition) + '" stroke-width="5"/>' +
              '<line x1="' + right.toFixed(2) + '" y1="' + top.toFixed(2) + '" x2="' + right.toFixed(2) + '" y2="' + bottom.toFixed(2) + '" stroke="' + boundaryColour(rightCondition) + '" stroke-width="5"/>' +
              '<line x1="' + left.toFixed(2) + '" y1="' + bottom.toFixed(2) + '" x2="' + right.toFixed(2) + '" y2="' + bottom.toFixed(2) + '" stroke="' + boundaryColour(bottomCondition) + '" stroke-width="5"/>' +
              '<line x1="' + left.toFixed(2) + '" y1="' + top.toFixed(2) + '" x2="' + right.toFixed(2) + '" y2="' + top.toFixed(2) + '" stroke="' + boundaryColour(topCondition) + '" stroke-width="5"/>'))));
          var edgeLabels = "";
          var vertexHandles = "";
          var holeLabels = "";
          if (isPolygon) {
            holeLabels = settings.polygon.holes.map(function (ring, index) {
              var circle = (settings.polygon.circularHoles || [])[index];
              var center = circle ? circle.center : [
                ring.reduce(function (total, point) { return total + point[0]; }, 0) / ring.length,
                ring.reduce(function (total, point) { return total + point[1]; }, 0) / ring.length,
              ];
              var cx = left + width * (center[0] - settings.xMin) / xSpan;
              var cy = bottom - height * (center[1] - settings.yMin) / ySpan;
              var active = customPolygonEditorRing === index + 1;
              var label = '<text data-hole-label="' + (index + 1) + '" x="' + cx.toFixed(2) +
                '" y="' + (cy - (circle ? 4 : 0)).toFixed(2) + '" text-anchor="middle" font-size="12" font-weight="800"' +
                ' fill="' + (active ? '#1565c0' : '#173248') + '" stroke="white" stroke-width="3" paint-order="stroke" pointer-events="none">孔洞 ' +
                (index + 1) + '</text>';
              if (circle) {
                label += '<text data-hole-diameter="' + (index + 1) + '" x="' + cx.toFixed(2) +
                  '" y="' + (cy + 13).toFixed(2) + '" text-anchor="middle" font-size="11" fill="#173248" stroke="white" stroke-width="3" paint-order="stroke" pointer-events="none">D=' +
                  formatEdgeLength(2 * circle.radius) + '</text>';
                if (active) label += '<ellipse cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) +
                  '" rx="' + (width * circle.radius / xSpan + 4).toFixed(2) + '" ry="' +
                  (height * circle.radius / ySpan + 4).toFixed(2) + '" fill="none" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>';
              }
              return label;
            }).join("");
          }
          if (isImported) {
            var editableRings = [settings.polygon.outer].concat(settings.polygon.holes);
            var editableRing = editableRings[Math.min(customPolygonEditorRing, editableRings.length - 1)];
            var ringOrientation = ringArea(editableRing) >= 0 ? 1 : -1;
            var selectedCircle = isPolygon && customPolygonEditorRing > 0 &&
              settings.polygon.circularHoles && settings.polygon.circularHoles[customPolygonEditorRing - 1];
            edgeLabels = selectedCircle ? "" : window.OpenPINNImageTrace.edgeMeasurements(editableRing).map(function (edge) {
              var start = editableRing[edge.startIndex];
              var end = editableRing[edge.endIndex];
              var startX = left + width * (start[0] - settings.xMin) / xSpan;
              var startY = bottom - height * (start[1] - settings.yMin) / ySpan;
              var endX = left + width * (end[0] - settings.xMin) / xSpan;
              var endY = bottom - height * (end[1] - settings.yMin) / ySpan;
              var screenDx = endX - startX;
              var screenDy = endY - startY;
              var screenLength = Math.hypot(screenDx, screenDy) || 1;
              var offsetDirection = ringOrientation;
              var labelX = (startX + endX) / 2 + offsetDirection * screenDy / screenLength * 13;
              var labelY = (startY + endY) / 2 - offsetDirection * screenDx / screenLength * 13;
              var edgeCondition = isPolygon ? polygonBoundaries.find(function (boundary) {
                return boundary.ringIndex === customPolygonEditorRing &&
                  boundary.edgeIndex === edge.startIndex;
              }) : curveCondition;
              return '<text data-polygon-edge-label="true" x="' + labelX.toFixed(2) +
                '" y="' + labelY.toFixed(2) + '" text-anchor="middle" dominant-baseline="central"' +
                ' font-size="11" font-weight="700" fill="' + boundaryColour(edgeCondition) + '" stroke="#ffffff" stroke-width="3"' +
                ' paint-order="stroke" pointer-events="none">' + (edge.startIndex + 1) + '→' +
                (edge.endIndex + 1) + ': ' + formatEdgeLength(edge.length) + '</text>';
            }).join("");
            vertexHandles = selectedCircle ? "" : editableRing.map(function (point, pointIndex) {
              var handleX = left + width * (point[0] - settings.xMin) / xSpan;
              var handleY = bottom - height * (point[1] - settings.yMin) / ySpan;
              return '<circle data-polygon-vertex="true" data-index="' + pointIndex +
                '" cx="' + handleX.toFixed(2) + '" cy="' + handleY.toFixed(2) +
                '" r="9" fill="#ffffff" stroke="#173248" stroke-width="2.5" vector-effect="non-scaling-stroke" style="cursor: grab; touch-action: none"/>' +
                '<text data-polygon-vertex-number="true" x="' + handleX.toFixed(2) + '" y="' +
                (handleY + 0.5).toFixed(2) + '" text-anchor="middle" dominant-baseline="central"' +
                ' font-size="9.5" font-weight="800" fill="#173248" pointer-events="none">' +
                (pointIndex + 1) + '</text>';
            }).join("");
          }
          var boundaryLabels = isPolygon
            ? '<text x="' + ((left + right) / 2).toFixed(2) + '" y="52" text-anchor="middle" font-size="12" fill="#173248">各边独立：红 Dirichlet / 橙 Neumann / 紫 Robin</text>'
            : (isCurved
              ? '<text x="' + ((left + right) / 2).toFixed(2) + '" y="52" text-anchor="middle" font-size="12" fill="' +
                boundaryColour(curveCondition) + '">曲线边界 ' + boundaryLabel(curveCondition) + '</text>'
            : '<text x="' + (left - 8).toFixed(2) + '" y="52" text-anchor="start" font-size="12" fill="' + boundaryColour(leftCondition) + '">左 ' + boundaryLabel(leftCondition) + '</text>' +
              '<text x="' + (right + 8).toFixed(2) + '" y="52" text-anchor="end" font-size="12" fill="' + boundaryColour(rightCondition) + '">右 ' + boundaryLabel(rightCondition) + '</text>' +
              '<text x="' + ((left + right) / 2).toFixed(2) + '" y="' + (top - 8).toFixed(2) + '" text-anchor="middle" font-size="12" fill="' + boundaryColour(topCondition) + '">上 ' + boundaryLabel(topCondition) + '</text>' +
              '<text x="' + ((left + right) / 2).toFixed(2) + '" y="' + (bottom + 38).toFixed(2) + '" text-anchor="middle" font-size="12" fill="' + boundaryColour(bottomCondition) + '">下 ' + boundaryLabel(bottomCondition) + '</text>');
          svg.push(
            boundaryDrawing,
            ellipseGuides,
            edgeLabels,
            vertexHandles,
            holeLabels,
            xZero === null ? '' : '<line x1="' + xZero.toFixed(2) + '" y1="' + top.toFixed(2) + '" x2="' + xZero.toFixed(2) + '" y2="' + bottom.toFixed(2) + '" stroke="#173248" stroke-width="1.5" stroke-dasharray="5 4"/>',
            yZero === null ? '' : '<line x1="' + left.toFixed(2) + '" y1="' + yZero.toFixed(2) + '" x2="' + right.toFixed(2) + '" y2="' + yZero.toFixed(2) + '" stroke="#173248" stroke-width="1.5" stroke-dasharray="5 4"/>',
            xZero === null || yZero === null ? '' : '<circle cx="' + xZero.toFixed(2) + '" cy="' + yZero.toFixed(2) + '" r="4" fill="#173248"/><text x="' + (xZero + 7).toFixed(2) + '" y="' + (yZero - 7).toFixed(2) + '" font-size="13" fill="#173248">O</text>',
            '<text x="' + left.toFixed(2) + '" y="' + (bottom + 22).toFixed(2) + '" text-anchor="middle" font-size="14" fill="#173248">' + settings.xMin + '</text>',
            '<text x="' + right.toFixed(2) + '" y="' + (bottom + 22).toFixed(2) + '" text-anchor="middle" font-size="14" fill="#173248">' + settings.xMax + '</text>',
            '<text x="' + (left - 10).toFixed(2) + '" y="' + (bottom + 5).toFixed(2) + '" text-anchor="end" font-size="14" fill="#173248">' + settings.yMin + '</text>',
            '<text x="' + (left - 10).toFixed(2) + '" y="' + (top + 5).toFixed(2) + '" text-anchor="end" font-size="14" fill="#173248">' + settings.yMax + '</text>',
            '<text x="' + ((left + right) / 2).toFixed(2) + '" y="337" text-anchor="middle" font-size="16" fill="#173248">x</text>',
            '<text x="27" y="170" text-anchor="middle" transform="rotate(-90 27 170)" font-size="16" fill="#173248">y</text>',
            boundaryLabels,
            '<defs><linearGradient id="openpinn-custom-colour" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="hsl(230,88%,53%)"/><stop offset="0.5" stop-color="hsl(117.5,88%,53%)"/><stop offset="1" stop-color="hsl(5,88%,53%)"/></linearGradient></defs>',
            '<rect x="620" y="82" width="22" height="190" fill="url(#openpinn-custom-colour)" stroke="#173248"/>',
            '<text x="652" y="91" font-size="14" fill="#173248">' + gridMax.toFixed(2) + '</text><text x="652" y="273" font-size="14" fill="#173248">' + gridMin.toFixed(2) + '</text>',
            '<text x="610" y="302" font-size="14" fill="#173248">示例场 u(x,y)</text>'
          );
        }
        customPreview.innerHTML = svg.join("");
        var previewDescription = settings.kind === "dynamic"
          ? "显示 t=" + settings.tMin + " 的所选初始场。"
          : (settings.mode === "template" ? "显示静态制造解示例场。" : "显示静态示例场。");
        if (settings.mode === "expression") {
          previewDescription += " 图中 u 表示未知量 " + settings.physics.field + "（" + settings.physics.field_unit + "）。修改公式不会在浏览器求解 PDE。";
        }
        if (settings.kind === "dynamic" && settings.initialPreset === "constant") {
          previewDescription += " 常数初值须与 t 下限处的边界条件核对相容性。";
        }
        var domainDescription = "x∈[" + settings.xMin + ", " + settings.xMax + "]";
        if (settings.dimension === 2) {
          domainDescription += "，y∈[" + settings.yMin + ", " + settings.yMax + "]";
          if (isPolygonGeometry(settings.geometry)) {
            domainDescription = "导入二维轮廓（" + settings.polygon.outer.length +
              " 个外轮廓顶点，" + settings.polygon.holes.length + " 个孔洞）";
          } else if (settings.geometry === "spline") {
            domainDescription = "可编辑闭合样条（" + settings.polygon.outer.length +
              " 个控制点，张力=" + settings.splineTension + "）";
          } else if (settings.geometry === "circle") {
            domainDescription = "圆形（圆心 " + settings.circleCenterX + ", " +
              settings.circleCenterY + "；R=" + settings.circleRadius + "）";
          } else if (settings.geometry === "ellipse") {
            domainDescription = "椭圆（中心 " + settings.ellipseCenterX + ", " +
              settings.ellipseCenterY + "；a=" + settings.ellipseAxisA + "，b=" +
              settings.ellipseAxisB + "，θ=" + settings.ellipseRotation + "°）";
          } else if (settings.geometry === "rounded_rectangle") {
            domainDescription = "圆角矩形（r=" + settings.cornerRadius + "）";
          }
        }
        var boundaryDescription = settings.boundaries.map(function (boundary) {
          var sideName = boundary.polygonEdge ? boundary.label : boundary.side;
          if (boundary.polygonRing) sideName = boundary.label;
          return sideName + "（" + boundaryLabel(boundary) + "）";
        }).join("，");
        customPreviewNote.textContent = previewDescription + " 当前区域：" + domainDescription +
          "；边界：" + boundaryDescription +
          "。此图只帮助检查区域、维度和边界，不是 PINN 训练结果。" +
          (settings.importedGeometry ? " " + settings.importedGeometry.note : "");
      } catch (error) {
        customFormula.textContent = "请修正参数";
        customPreview.innerHTML = '<text x="30" y="70" font-size="18" fill="#a12622">' + escapeXml(error.message) + '</text>';
        customPreviewNote.textContent = "";
      }
    }

    function generatedProblemLines() {
      if (!isCustomProblem()) {
        return ['PROBLEM = "' + problemSelect.value + '"'];
      }
      var settings = readCustomSettings();
      var analyticImported = Boolean(settings.importedGeometry && settings.importedGeometry.analytic);
      var dirichletBoundaries = settings.boundaries.filter(function (boundary) {
        return boundary.type === "dirichlet";
      });
      var baseValue = dirichletBoundaries.length
        ? dirichletBoundaries.reduce(function (total, boundary) { return total + boundary.value; }, 0) / dirichletBoundaries.length
        : 0;
      var exactAvailable = !isPolygonGeometry(settings.geometry) &&
        ["circle", "ellipse", "rounded_rectangle", "spline"].indexOf(settings.geometry) === -1 &&
        settings.mode === "template" && settings.kind === "static" &&
        dirichletBoundaries.length === settings.boundaries.length &&
        dirichletBoundaries.every(function (boundary) { return boundary.value === dirichletBoundaries[0].value; });
      if (Object.prototype.hasOwnProperty.call(selected, "hard_boundary")) {
        var hardBoundaryCompatible = settings.dimension === 1 &&
          dirichletBoundaries.length === settings.boundaries.length &&
          dirichletBoundaries.every(function (boundary) { return boundary.value === dirichletBoundaries[0].value; });
        if (!hardBoundaryCompatible) {
          throw new Error("当前硬边界变体只支持一维且左右 Dirichlet 值相同；请调整边界或取消硬边界方法。");
        }
      }
      var lines = [
        "# ==================================================",
        "# ① 新控制方程编辑区：定义计算区域与归一化坐标",
        "# ==================================================",
        "X_MIN = " + pythonLiteral(settings.xMin),
        "X_MAX = " + pythonLiteral(settings.xMax),
        "X_SCALE = X_MAX - X_MIN",
        "EXAMPLE_BASE_VALUE = " + pythonLiteral(baseValue),
        "INITIAL_VALUE = " + pythonLiteral(settings.initialValue),
      ];
      if (settings.dimension === 2) {
        lines = lines.concat([
          "Y_MIN = " + pythonLiteral(settings.yMin),
          "Y_MAX = " + pythonLiteral(settings.yMax),
          "Y_SCALE = Y_MAX - Y_MIN",
        ]);
        if (isPolygonGeometry(settings.geometry)) {
          lines.push("POLYGON_VERTICES = " + pythonLiteral(settings.polygon.outer));
          var circularHoles = settings.polygon.circularHoles || [];
          if (analyticImported) {
            lines.push("# 解析矩形＋圆孔：预览点列只用于编号；训练直接使用圆心、半径。");
            circularHoles.forEach(function (circle, index) {
              lines.push("HOLE_" + (index + 1) + "_CENTER_X = " + pythonLiteral(circle.center[0]));
              lines.push("HOLE_" + (index + 1) + "_CENTER_Y = " + pythonLiteral(circle.center[1]));
              lines.push("HOLE_" + (index + 1) + "_RADIUS = " + pythonLiteral(circle.radius));
            });
            lines.push("CIRCULAR_HOLES = (");
            circularHoles.forEach(function (_circle, index) {
              var prefix = "HOLE_" + (index + 1);
              lines.push("    (" + prefix + "_CENTER_X, " + prefix + "_CENTER_Y, " + prefix + "_RADIUS),");
            });
            lines.push(")");
            lines.push("SPACE = op.RectangleWithCircularHoles(");
            lines.push("    lower=" + pythonLiteral(settings.importedGeometry.lower) + ",");
            lines.push("    upper=" + pythonLiteral(settings.importedGeometry.upper) + ",");
            lines.push("    holes=CIRCULAR_HOLES, stratified_boundary=True,");
            lines.push(")");
          } else if (circularHoles.some(Boolean)) {
            lines.push("# 圆孔用圆心和半径定义；计算时离散为多边形近似圆弧。");
            lines.push("def make_circle_hole(center_x, center_y, radius, count, start_angle):");
            lines.push("    return [[center_x + radius * math.cos(start_angle - 2 * math.pi * i / count),");
            lines.push("             center_y + radius * math.sin(start_angle - 2 * math.pi * i / count)] for i in range(count)]");
            circularHoles.forEach(function (circle, index) {
              if (!circle) return;
              lines.push("HOLE_" + (index + 1) + "_CENTER_X = " + pythonLiteral(circle.center[0]));
              lines.push("HOLE_" + (index + 1) + "_CENTER_Y = " + pythonLiteral(circle.center[1]));
              lines.push("HOLE_" + (index + 1) + "_RADIUS = " + pythonLiteral(circle.radius));
            });
            lines.push("POLYGON_HOLES = [");
            settings.polygon.holes.forEach(function (ring, index) {
              if (!circularHoles[index]) {
                lines.push("    " + pythonLiteral(ring) + ",");
                return;
              }
              var circle = circularHoles[index];
              var startAngle = Math.atan2(ring[0][1] - circle.center[1], ring[0][0] - circle.center[0]);
              lines.push("    make_circle_hole(HOLE_" + (index + 1) + "_CENTER_X, HOLE_" +
                (index + 1) + "_CENTER_Y, HOLE_" + (index + 1) + "_RADIUS, " +
                ring.length + ", " + pythonLiteral(startAngle) + "),");
            });
            lines.push("]");
          } else {
            lines.push("POLYGON_HOLES = " + pythonLiteral(settings.polygon.holes));
          }
          if (!analyticImported) {
            lines.push("# " + settings.importedGeometry.note);
            lines.push("SPACE = op.Polygon(POLYGON_VERTICES, holes=POLYGON_HOLES)");
          }
        } else if (settings.geometry === "spline") {
          lines = lines.concat([
            "SPLINE_CONTROL_POINTS = " + pythonLiteral(settings.polygon.outer),
            "SPLINE_TENSION = " + pythonLiteral(settings.splineTension),
            "SPACE = op.ClosedSpline(",
            "    SPLINE_CONTROL_POINTS,",
            "    tension=SPLINE_TENSION,",
            ")",
          ]);
        } else if (settings.geometry === "circle") {
          lines = lines.concat([
            "CIRCLE_CENTER_X = " + pythonLiteral(settings.circleCenterX),
            "CIRCLE_CENTER_Y = " + pythonLiteral(settings.circleCenterY),
            "CIRCLE_RADIUS = " + pythonLiteral(settings.circleRadius),
            "SPACE = op.Disk(",
            "    center=(CIRCLE_CENTER_X, CIRCLE_CENTER_Y),",
            "    radius=CIRCLE_RADIUS,",
            ")",
          ]);
        } else if (settings.geometry === "ellipse") {
          lines = lines.concat([
            "ELLIPSE_CENTER_X = " + pythonLiteral(settings.ellipseCenterX),
            "ELLIPSE_CENTER_Y = " + pythonLiteral(settings.ellipseCenterY),
            "ELLIPSE_AXIS_A = " + pythonLiteral(settings.ellipseAxisA),
            "ELLIPSE_AXIS_B = " + pythonLiteral(settings.ellipseAxisB),
            "ELLIPSE_ROTATION_DEG = " + pythonLiteral(settings.ellipseRotation),
            "SPACE = op.Ellipse(",
            "    center=(ELLIPSE_CENTER_X, ELLIPSE_CENTER_Y),",
            "    semi_axis_a=ELLIPSE_AXIS_A,",
            "    semi_axis_b=ELLIPSE_AXIS_B,",
            "    rotation_deg=ELLIPSE_ROTATION_DEG,",
            ")",
          ]);
        } else if (settings.geometry === "rounded_rectangle") {
          lines = lines.concat([
            "CORNER_RADIUS = " + pythonLiteral(settings.cornerRadius),
            "SPACE = op.RoundedRectangle(",
            "    lower=(X_MIN, Y_MIN),",
            "    upper=(X_MAX, Y_MAX),",
            "    corner_radius=CORNER_RADIUS,",
            ")",
          ]);
        } else {
          lines = lines.concat([
            "SPACE = op.RectangleWithCircularHoles(",
            "    lower=(X_MIN, Y_MIN),",
            "    upper=(X_MAX, Y_MAX),",
            "    holes=(),",
            ...(settings.mode === "expression" ? ["    stratified_boundary=True,"] : []),
            ")",
          ]);
        }
      } else {
        lines.push("SPACE = op.Interval(X_MIN, X_MAX)");
      }
      if (settings.kind === "dynamic") {
        lines = lines.concat([
          "T_MIN = " + pythonLiteral(settings.tMin),
          "T_MAX = " + pythonLiteral(settings.tMax),
          "DOMAIN = op.SpaceTimeDomain(SPACE, T_MIN, T_MAX)",
        ]);
      } else {
        lines.push("DOMAIN = SPACE");
      }
      lines.push("");
      settings.boundaries.forEach(function (boundary) {
        var upper = boundary.side.toUpperCase();
        lines.push(upper + "_BOUNDARY_VALUE = " + pythonLiteral(boundary.value));
        if (boundary.type === "robin") {
          lines.push(upper + "_ROBIN_ALPHA = " + pythonLiteral(boundary.alpha));
          lines.push(upper + "_ROBIN_BETA = " + pythonLiteral(boundary.beta));
        }
      });
      lines.push("");
      settings.boundaries.forEach(function (boundary) {
        if (boundary.polygonEdge || boundary.polygonRing) return;
        if (boundary.side === "curve") return;
        var coordinate = boundary.side === "left" || boundary.side === "right" ? 0 : 1;
        var bound = boundary.side === "left" ? "X_MIN" :
          boundary.side === "right" ? "X_MAX" :
          boundary.side === "bottom" ? "Y_MIN" : "Y_MAX";
        lines.push("def on_" + boundary.side + "(points):");
        lines.push("    return torch.isclose(points[:, " + coordinate + "], points.new_tensor(" + bound + "), atol=1e-7, rtol=0.0)");
        lines.push("");
      });
      if (isPolygonGeometry(settings.geometry)) {
        lines.push("def geometry_roundoff_tolerance(points):");
        lines.push("    scale = max(abs(value) for pair in SPACE.bounds for value in pair)");
        lines.push("    return 8 * torch.finfo(points.dtype).eps * max(scale, 1.0)");
        lines.push("");
        lines.push("def polygon_edge_selector(ring_index, edge_index):");
        if (analyticImported) {
          lines.push("    # Only outer edges use segment selectors; holes use exact circle selectors.");
          lines.push("    if ring_index != 0: raise ValueError('Circular holes require a whole-ring selector.')");
          lines.push("    start_coordinates = POLYGON_VERTICES[edge_index]");
          lines.push("    end_coordinates = POLYGON_VERTICES[(edge_index + 1) % len(POLYGON_VERTICES)]");
        } else {
          lines.push("    start_coordinates = SPACE.rings[ring_index][edge_index]");
          lines.push("    end_coordinates = SPACE.rings[ring_index][(edge_index + 1) % len(SPACE.rings[ring_index])]");
        }
        lines.push("    def selector(points):");
        lines.push("        spatial = points[:, :2]");
        lines.push("        start = spatial.new_tensor(start_coordinates)");
        lines.push("        end = spatial.new_tensor(end_coordinates)");
        lines.push("        edge = end - start");
        lines.push("        projection = ((spatial - start) * edge).sum(dim=1) / (edge * edge).sum()");
        lines.push("        closest = start + projection.clamp(0.0, 1.0).unsqueeze(1) * edge");
        lines.push("        tolerance = 1e-6 * torch.maximum(torch.linalg.vector_norm(edge), spatial.new_tensor(1.0))");
        lines.push("        tolerance = torch.maximum(tolerance, spatial.new_tensor(geometry_roundoff_tolerance(points)))");
        lines.push("        return torch.linalg.vector_norm(spatial - closest, dim=1) <= tolerance");
        lines.push("    return selector");
        lines.push("");
        if (settings.boundaries.some(function (boundary) { return boundary.polygonRing; })) {
          lines.push("def polygon_ring_selector(ring_index):");
          if (analyticImported) {
            lines.push("    center_x, center_y, radius = SPACE.holes[ring_index - 1]");
            lines.push("    def selector(points):");
            lines.push("        radial = points[:, :2] - points.new_tensor((center_x, center_y))");
            lines.push("        distance = torch.linalg.vector_norm(radial, dim=1)");
            lines.push("        tolerance = max(1e-7, 8 * torch.finfo(points.dtype).eps * max(abs(center_x), abs(center_y), radius, 1.0))");
            lines.push("        return torch.isclose(distance, distance.new_tensor(radius), atol=tolerance, rtol=0.0)");
            lines.push("    return selector");
            lines.push("");
          } else {
          lines.push("    ring = SPACE.rings[ring_index]");
          lines.push("    def selector(points):");
          lines.push("        spatial = points[:, :2]");
          lines.push("        matched = torch.zeros(points.shape[0], dtype=torch.bool, device=points.device)");
          lines.push("        for edge_index in range(len(ring)):");
          lines.push("            start = spatial.new_tensor(ring[edge_index])");
          lines.push("            end = spatial.new_tensor(ring[(edge_index + 1) % len(ring)])");
          lines.push("            edge = end - start");
          lines.push("            projection = ((spatial - start) * edge).sum(dim=1) / (edge * edge).sum()");
          lines.push("            closest = start + projection.clamp(0.0, 1.0).unsqueeze(1) * edge");
          lines.push("            tolerance = 1e-6 * torch.maximum(torch.linalg.vector_norm(edge), spatial.new_tensor(1.0))");
          lines.push("            tolerance = torch.maximum(tolerance, spatial.new_tensor(geometry_roundoff_tolerance(points)))");
          lines.push("            matched |= torch.linalg.vector_norm(spatial - closest, dim=1) <= tolerance");
          lines.push("        return matched");
          lines.push("    return selector");
          lines.push("");
          }
        }
      }
      if (isPolygonGeometry(settings.geometry) && settings.boundaries.some(function (boundary) {
        return boundary.type !== "dirichlet";
      })) {
        lines.push("def polygon_boundary_normal(points):");
        lines.push("    spatial_normal = SPACE.boundary_normal(points[:, :2], atol=max(1e-5, geometry_roundoff_tolerance(points)))");
        lines.push("    if points.shape[1] == 2:");
        lines.push("        return spatial_normal");
        lines.push("    return torch.cat((spatial_normal, torch.zeros_like(points[:, 2:])), dim=1)");
        lines.push("");
      }
      if (["circle", "ellipse", "rounded_rectangle", "spline"].indexOf(settings.geometry) !== -1 &&
          settings.boundaries.some(function (boundary) { return boundary.type !== "dirichlet"; })) {
        lines.push("def curved_boundary_normal(points):");
        lines.push("    spatial_normal = SPACE.boundary_normal(points[:, :2])");
        lines.push("    if points.shape[1] == 2:");
        lines.push("        return spatial_normal");
        lines.push("    return torch.cat((spatial_normal, torch.zeros_like(points[:, 2:])), dim=1)");
        lines.push("");
      }
      if (settings.mode === "template") {
        if (["heat", "reaction_diffusion", "allen_cahn", "advection_diffusion"].indexOf(settings.template) !== -1) {
          lines.push("DIFFUSIVITY = " + pythonLiteral(settings.diffusivity));
        }
        if (["reaction_diffusion", "allen_cahn"].indexOf(settings.template) !== -1) {
          lines.push("REACTION_RATE = " + pythonLiteral(settings.reaction));
        }
        if (settings.template === "helmholtz") {
          lines.push("WAVE_NUMBER = " + pythonLiteral(settings.waveNumber));
        }
        if (settings.template === "advection_diffusion") {
          lines.push("ADVECTION_X = " + pythonLiteral(settings.advectionX));
          if (settings.dimension === 2) {
            lines.push("ADVECTION_Y = " + pythonLiteral(settings.advectionY));
          }
        }
        if (settings.template === "burgers") {
          lines.push("VISCOSITY = " + pythonLiteral(settings.viscosity));
        }
      }
      lines = lines.concat([
        "",
        "# ==================================================",
        "# ② 初值/示例场：可按实际问题修改",
        "# ==================================================",
        "def example_field(points):",
        "    x_hat = (points[:, 0:1] - X_MIN) / X_SCALE",
      ]);
      if (settings.dimension === 2) lines.push("    y_hat = (points[:, 1:2] - Y_MIN) / Y_SCALE");
      if (settings.kind === "dynamic" && settings.initialPreset === "constant") {
        lines.push("    profile = torch.full_like(x_hat, INITIAL_VALUE - EXAMPLE_BASE_VALUE)");
      } else if (settings.kind === "dynamic" && settings.initialPreset === "zero") {
        lines.push("    profile = torch.zeros_like(x_hat)");
      } else if (settings.kind === "dynamic" && settings.initialPreset === "gaussian") {
        var gaussianExpression = "torch.exp(-40.0 * (x_hat - 0.5) ** 2) * torch.sin(math.pi * x_hat)";
        if (settings.dimension === 2) {
          gaussianExpression = "torch.exp(-40.0 * ((x_hat - 0.5) ** 2 + (y_hat - 0.5) ** 2)) * torch.sin(math.pi * x_hat) * torch.sin(math.pi * y_hat)";
        }
        lines.push("    profile = " + gaussianExpression);
      } else {
        lines.push("    profile = torch.sin(math.pi * x_hat)");
        if (settings.dimension === 2) {
          lines.push("    profile = profile * torch.sin(math.pi * y_hat)");
        }
      }
      lines = lines.concat([
        "    return EXAMPLE_BASE_VALUE + profile",
        "",
        "# ==================================================",
        "# ③ 控制方程残差：返回值应等于 0",
        "# ==================================================",
      ]);
      if (settings.mode === "expression") {
        lines.push(
          "# 参数、单位与安全表达式树完整内嵌；无需原始参数库文件。",
          "# 输入坐标/场值使用选定单位；残差内部按 SI 换算。",
          "# Neumann 目标值仍是显示单位下的法向导数，不是 Darcy 通量。",
          "PHYSICS_SPEC = " + pythonPrettyLiteral(settings.physics),
          "equation = op.make_physics_residual(PHYSICS_SPEC)"
        );
      } else lines.push("def equation(x, u):");
      if (settings.mode === "free") {
        var operators = settings.terms.map(function (term) { return term.operator; });
        var needsGradient = operators.some(function (name) { return ["ux", "uy", "ut"].indexOf(name) !== -1; });
        if (needsGradient) lines.push("    gradient = op.grad(u, x)");
        if (operators.indexOf("ux") !== -1) lines.push("    u_x = gradient[:, 0:1]");
        if (operators.indexOf("uy") !== -1) lines.push("    u_y = gradient[:, 1:2]");
        if (operators.indexOf("ut") !== -1) {
          lines.push("    u_t = gradient[:, " + settings.dimension + " : " + (settings.dimension + 1) + "]");
        }
        if (operators.indexOf("uxx") !== -1) lines.push("    u_xx = op.hessian(u, x, i=0, j=0)");
        if (operators.indexOf("uyy") !== -1) lines.push("    u_yy = op.hessian(u, x, i=1, j=1)");
        if (operators.indexOf("utt") !== -1) {
          lines.push("    u_tt = op.hessian(u, x, i=" + settings.dimension + ", j=" + settings.dimension + ")");
        }
        if (operators.some(function (name) { return ["sine_x", "sine_xy", "gaussian"].indexOf(name) !== -1; })) {
          lines.push("    x_hat = (x[:, 0:1] - X_MIN) / X_SCALE");
        }
        if (operators.some(function (name) { return ["sine_xy", "gaussian"].indexOf(name) !== -1; }) && settings.dimension === 2) {
          lines.push("    y_hat = (x[:, 1:2] - Y_MIN) / Y_SCALE");
        }
        if (operators.indexOf("sine_x") !== -1) {
          lines.push("    source_sine_x = torch.sin(math.pi * x_hat)");
        }
        if (operators.indexOf("sine_xy") !== -1) {
          lines.push("    source_sine_xy = torch.sin(math.pi * x_hat) * torch.sin(math.pi * y_hat)");
        }
        if (operators.indexOf("gaussian") !== -1) {
          var gaussianSource = "torch.exp(-40.0 * (x_hat - 0.5) ** 2)";
          if (settings.dimension === 2) {
            gaussianSource = "torch.exp(-40.0 * ((x_hat - 0.5) ** 2 + (y_hat - 0.5) ** 2))";
          }
          lines.push("    source_gaussian = " + gaussianSource);
        }
        var pythonTerms = settings.terms.map(function (term) {
          var expressions = {
            u: "u",
            u2: "u**2",
            u3: "u**3",
            ux: "u_x",
            uy: "u_y",
            ut: "u_t",
            uxx: "u_xx",
            uyy: "u_yy",
            utt: "u_tt",
            sine_x: "source_sine_x",
            sine_xy: "source_sine_xy",
            gaussian: "source_gaussian",
            constant: "torch.ones_like(u)",
          };
          return pythonLiteral(term.coefficient) + " * " + expressions[term.operator];
        });
        lines.push("    return " + pythonTerms.join(" + "));
      } else if (settings.mode === "template") {
        lines.push("    u_xx = op.hessian(u, x, i=0, j=0)");
        if (settings.dimension === 2) {
          lines.push("    u_yy = op.hessian(u, x, i=1, j=1)", "    laplacian = u_xx + u_yy");
        } else {
          lines.push("    laplacian = u_xx");
        }
        if (settings.kind === "static") {
          var coefficient = settings.dimension === 2
            ? "(math.pi / X_SCALE) ** 2 + (math.pi / Y_SCALE) ** 2"
            : "(math.pi / X_SCALE) ** 2";
          lines.push("    profile = example_field(x) - EXAMPLE_BASE_VALUE");
          if (settings.template === "helmholtz") {
            lines.push(
              "    source = (" + coefficient + ") * profile + WAVE_NUMBER**2 * example_field(x)",
              "    return -laplacian + WAVE_NUMBER**2 * u - source"
            );
          } else if (settings.template === "nonlinear_poisson") {
            lines.push(
              "    source = (" + coefficient + ") * profile + example_field(x)**3",
              "    return -laplacian + u**3 - source"
            );
          } else {
            lines.push("    source = (" + coefficient + ") * profile", "    return -laplacian - source");
          }
        } else {
          lines.push("    gradient = op.grad(u, x)", "    u_t = gradient[:, " + settings.dimension + " : " + (settings.dimension + 1) + "]");
          if (settings.template === "burgers") {
            lines.push("    u_x = gradient[:, 0:1]", "    return u_t + u * u_x - VISCOSITY * u_xx");
          } else if (settings.template === "advection_diffusion") {
            lines.push("    u_x = gradient[:, 0:1]");
            if (settings.dimension === 2) lines.push("    u_y = gradient[:, 1:2]");
            var advectionPython = "ADVECTION_X * u_x" + (settings.dimension === 2 ? " + ADVECTION_Y * u_y" : "");
            lines.push("    return u_t + " + advectionPython + " - DIFFUSIVITY * laplacian");
          } else if (settings.template === "reaction_diffusion") {
            lines.push("    return u_t - DIFFUSIVITY * laplacian + REACTION_RATE * u**3");
          } else if (settings.template === "allen_cahn") {
            lines.push("    return u_t - DIFFUSIVITY * laplacian + REACTION_RATE * (u**3 - u)");
          } else {
            lines.push("    return u_t - DIFFUSIVITY * laplacian");
          }
        }
      }
      if (exactAvailable) {
        lines.push(
          "",
          "# 解析解只用于训练后评估，不参与训练。",
          "def exact_solution(x):",
          "    return example_field(x)"
        );
      }
      lines = lines.concat([
        "",
        "# ==================================================",
        "# ④ 边界/初值条件与问题组装",
        "# ==================================================",
        "CONDITIONS = [",
      ]);
      settings.boundaries.forEach(function (boundary) {
        var upper = boundary.side.toUpperCase();
        if (boundary.polygonEdge || boundary.polygonRing) {
          var selector = boundary.polygonRing
            ? "polygon_ring_selector(" + boundary.ringIndex + ")"
            : "polygon_edge_selector(" + boundary.ringIndex + ", " + boundary.edgeIndex + ")";
          if (boundary.type === "dirichlet") {
            lines.push('    op.DirichletBC(' + upper + '_BOUNDARY_VALUE, boundary=' + selector + ', name="boundary_' + boundary.side + '"),');
          } else if (boundary.type === "neumann") {
            lines.push('    op.NeumannBC(' + upper + '_BOUNDARY_VALUE, normal=polygon_boundary_normal, boundary=' + selector + ', name="boundary_' + boundary.side + '"),');
          } else {
            lines.push('    op.RobinBC(' + upper + '_BOUNDARY_VALUE, normal=polygon_boundary_normal, boundary=' + selector + ', alpha=' + upper + '_ROBIN_ALPHA, beta=' + upper + '_ROBIN_BETA, name="boundary_' + boundary.side + '"),');
          }
          return;
        }
        if (boundary.side === "curve") {
          if (boundary.type === "dirichlet") {
            lines.push('    op.DirichletBC(' + upper + '_BOUNDARY_VALUE, name="boundary_curve"),');
          } else if (boundary.type === "neumann") {
            lines.push('    op.NeumannBC(' + upper + '_BOUNDARY_VALUE, normal=curved_boundary_normal, name="boundary_curve"),');
          } else {
            lines.push('    op.RobinBC(' + upper + '_BOUNDARY_VALUE, normal=curved_boundary_normal, alpha=' + upper + '_ROBIN_ALPHA, beta=' + upper + '_ROBIN_BETA, name="boundary_curve"),');
          }
          return;
        }
        var spatialNormal = boundary.side === "left" ? [-1, 0] :
          boundary.side === "right" ? [1, 0] :
          boundary.side === "bottom" ? [0, -1] : [0, 1];
        if (settings.dimension === 1) {
          spatialNormal = boundary.side === "left" ? [-1] : [1];
        }
        if (settings.kind === "dynamic") spatialNormal.push(0);
        if (boundary.type === "dirichlet") {
          lines.push('    op.DirichletBC(' + upper + '_BOUNDARY_VALUE, boundary=on_' + boundary.side + ', name="boundary_' + boundary.side + '"),');
        } else if (boundary.type === "neumann") {
          lines.push('    op.NeumannBC(' + upper + '_BOUNDARY_VALUE, normal=' + pythonLiteral(spatialNormal) + ', boundary=on_' + boundary.side + ', name="boundary_' + boundary.side + '"),');
        } else {
          lines.push('    op.RobinBC(' + upper + '_BOUNDARY_VALUE, normal=' + pythonLiteral(spatialNormal) + ', boundary=on_' + boundary.side + ', alpha=' + upper + '_ROBIN_ALPHA, beta=' + upper + '_ROBIN_BETA, name="boundary_' + boundary.side + '"),');
        }
      });
      if (settings.kind === "dynamic") {
        lines.push('    op.InitialCondition(example_field, name="initial"),');
      }
      lines = lines.concat([
        "]",
        "",
        "PROBLEM = op.PDEProblem(",
        "    DOMAIN,",
        "    equation,",
        "    CONDITIONS,",
      ]);
      if (exactAvailable) {
        lines.push("    exact_solution=exact_solution,");
      }
      if (settings.mode === "expression") lines.push("    field_names=(" + pythonLiteral(settings.physics.field) + ",),");
      lines.push(
        "    name=" + pythonLiteral(settings.name) + ",",
        "    metadata={",
        '        "kind": "custom_' + settings.kind + '",',
        '        "equation_mode": ' + pythonLiteral(settings.mode) + ",",
        '        "geometry": ' + pythonLiteral(analyticImported ? "rectangle_with_circular_holes" : (isPolygonGeometry(settings.geometry) ? "polygon" : settings.geometry)) + ",",
        '        "geometry_source": ' + pythonLiteral(settings.geometry) + ",",
        "        \"equation\": " + pythonLiteral(customFormulaLatex(settings)) + ",",
        '        "residual_names": ("pde",),',
        ...(settings.mode === "expression" ? ['        "physics": PHYSICS_SPEC,'] : []),
        "    },",
        ")"
      );
      return lines;
    }

    function updateCode() {
      try {
        var steps = Number(stepsInput.value);
        var logEvery = Number(logEveryInput.value);
        var seed = Number(seedInput.value);
        if (!Number.isInteger(steps) || steps < 1) throw new Error("训练步数必须是正整数。");
        if (!Number.isInteger(logEvery) || logEvery < 1) {
          throw new Error("终端输出间隔必须是正整数。");
        }
        if (!Number.isInteger(seed) || seed < 0) throw new Error("随机种子必须是非负整数。");
        if (!outputRootInput.value.trim()) throw new Error("结果文件夹不能为空。");
        var methodLines = generatedMethodLines();
        var importLines = ["import math", "from pathlib import Path", "", "import openpinn as op", "import torch"];
        if (!isCustomProblem()) {
          importLines = ["from pathlib import Path", "", "import openpinn as op"];
        }
        var settingLines = [
          "STEPS = " + steps,
          "LOG_EVERY = " + logEvery,
          "SEED = " + seed,
        ];
        var solveLines = [
          "result = op.solve(",
          "    PROBLEM,",
          "    methods=METHODS,",
          "    steps=STEPS,",
          "    seed=SEED,",
          '    training={"log_every": LOG_EVERY},',
        ];
        solveLines.push(
          "    output_root=OUTPUT_ROOT,",
          ")",
          "",
          'print("训练完成")',
          'print("结果目录：", result.output_dir)'
        );
        var referenceSetupLines = [];
        if (referenceEnableInput.checked) {
          var referencePath = referencePathInput.value.trim();
          var referenceColumns = referenceCoordinatesInput.value.split(",").map(function (name) { return name.trim(); });
          var referenceScales = referenceCoordinateScalesInput.value.split(",").map(function (item) { return Number(item.trim()); });
          var expectedDimension = isCustomProblem()
            ? Number(customDimensionSelect.value) + (customKindSelect.value === "dynamic" ? 1 : 0)
            : (problemSelect.value === "tunnel_model1" ? 3 : problemSelect.value === "burgers" ? 2 : 1);
          var dynamicProblem = isCustomProblem()
            ? customKindSelect.value === "dynamic"
            : ["burgers", "tunnel_model1"].indexOf(problemSelect.value) !== -1;
          var fixedTimeText = referenceFixedTimeInput.value.trim();
          var fixedTime = fixedTimeText === "" ? null : Number(fixedTimeText);
          var valueColumn = referenceValueInput.value.trim();
          var valueScale = Number(referenceValueScaleInput.value);
          var predictionScale = Number(referencePredictionScaleInput.value);
          var fieldIndex = Number(referenceFieldIndexInput.value);
          if (!referencePath) throw new Error("请填写参考表在项目中的运行时路径。");
          if (fixedTime !== null && (!dynamicProblem || !Number.isFinite(fixedTime))) {
            throw new Error("单个时间切片的时间值只适用于含时间方程，且必须是有效数字。");
          }
          var expectedColumns = expectedDimension - (fixedTime !== null ? 1 : 0);
          if (referenceColumns.length !== expectedColumns || referenceColumns.some(function (name) { return !name; })) {
            throw new Error("参考坐标列必须按模型输入顺序填写 " + expectedColumns + " 列。");
          }
          if (!valueColumn || referenceColumns.indexOf(valueColumn) !== -1) {
            throw new Error("参考场值列不能为空，也不能和坐标列同名。");
          }
          if (referenceScales.length !== expectedDimension || referenceScales.some(function (item) { return !Number.isFinite(item) || item <= 0; })) {
            throw new Error("每个参考坐标列都需要一个正数换算系数。");
          }
          if (!Number.isFinite(valueScale) || valueScale === 0) throw new Error("参考场值换算系数必须是非零数。");
          if (!Number.isFinite(predictionScale) || predictionScale === 0) throw new Error("模型预测值换算系数必须是非零数。");
          if (!Number.isInteger(fieldIndex) || fieldIndex < 0) throw new Error("模型输出分量序号必须是非负整数。");
          referenceSetupLines = [
            "# 参考表不参与训练；请将文件放到此路径再运行。",
            "REFERENCE_FILE = Path(" + pythonLiteral(referencePath) + ")",
            "if not REFERENCE_FILE.is_absolute():",
            "    REFERENCE_FILE = PROJECT_ROOT / REFERENCE_FILE",
            "REFERENCE_COLUMNS = " + pythonLiteral(referenceColumns),
            "REFERENCE_COORDINATE_SCALES = " + pythonLiteral(referenceScales),
            "REFERENCE_VALUE_COLUMN = " + pythonLiteral(valueColumn),
            "REFERENCE_VALUE_SCALE = " + pythonLiteral(valueScale),
            "REFERENCE_PREDICTION_SCALE = " + pythonLiteral(predictionScale),
            "REFERENCE_FIELD_INDEX = " + fieldIndex,
            "REFERENCE_TIME_AXIS = " + pythonLiteral(dynamicProblem),
            "REFERENCE_FIXED_TIME = " + pythonLiteral(fixedTime),
          ];
          var referenceProblemFactories = {
            poisson: "op.make_poisson_problem()",
            burgers: "op.make_burgers_problem()",
            tunnel_model1: "op.make_tunnel_consolidation_model1_problem()",
            heterogeneous_poisson: "op.make_piecewise_poisson_problem()",
            coupled_manufactured: "op.make_coupled_manufactured_problem()",
          };
          var referenceProblemExpression = isCustomProblem()
            ? "PROBLEM" : referenceProblemFactories[problemSelect.value] || "None";
          solveLines.push(
            "",
            "# 在独立参考点上预测并计算误差，不插值、也不把参考数据用于训练。",
            "reference_metrics = op.evaluate_reference_csv(",
            "    result, REFERENCE_FILE,",
            "    coordinate_columns=REFERENCE_COLUMNS,",
            "    coordinate_scales=REFERENCE_COORDINATE_SCALES,",
            "    value_column=REFERENCE_VALUE_COLUMN,",
            "    value_scale=REFERENCE_VALUE_SCALE,",
            "    prediction_scale=REFERENCE_PREDICTION_SCALE,",
            "    field_index=REFERENCE_FIELD_INDEX,",
            "    time_axis=REFERENCE_TIME_AXIS,",
            "    fixed_time=REFERENCE_FIXED_TIME,",
            "    problem=" + referenceProblemExpression + ",",
            ")",
            'print("独立参考场指标：", reference_metrics)',
            'print("对比图：", result.output_dir / "reference_comparison.svg")'
          );
        }
        var source = importLines.concat([
          "",
          "# 保存为项目 examples/ 目录中的 .py 文件后，可直接点击 VS Code 三角形运行。",
        ], generatedProblemLines(), [""], settingLines, [
          "",
          "METHODS = [",
          methodLines.join("\n"),
          "]",
          "",
          "PROJECT_ROOT = Path(__file__).resolve().parents[1]",
          "OUTPUT_ROOT = PROJECT_ROOT / " + pythonLiteral(outputRootInput.value.trim()),
          "",
        ], referenceSetupLines, referenceSetupLines.length ? [""] : [], solveLines).join("\n");
        code.textContent = source;
        showMessage("已生成可复制的完整代码。", false);
        copyButton.disabled = false;
        downloadCodeButton.disabled = false;
        codeActionStatus.textContent = "";
      } catch (error) {
        code.textContent = "# 请先修正上方参数。";
        showMessage(error.message, true);
        copyButton.disabled = true;
        downloadCodeButton.disabled = true;
        codeActionStatus.textContent = "参数无效，请修正后再复制或下载。";
      }
    }

    function renderAll() {
      customPanel.hidden = !isCustomProblem();
      if (isCustomProblem()) {
        syncCustomTemplateOptions();
        toggleCustomFields();
        renderCustomPreview();
      }
      renderMethodList();
      renderParameters();
      updateCode();
    }

    function suggestedReferenceColumns() {
      var fixed = referenceFixedTimeInput.value.trim() !== "";
      if (isCustomProblem()) {
        return Number(customDimensionSelect.value) === 2
          ? (customKindSelect.value === "dynamic" && !fixed ? "x,y,t" : "x,y")
          : (customKindSelect.value === "dynamic" && !fixed ? "x,t" : "x");
      }
      if (problemSelect.value === "tunnel_model1") return fixed ? "x,y" : "x,y,t";
      if (problemSelect.value === "burgers") return fixed ? "x" : "x,t";
      return "x";
    }

    function syncReferenceColumns() {
      if (referenceEnableInput.checked && !referenceColumnsEdited) {
        var suggestion = suggestedReferenceColumns();
        referenceCoordinatesInput.value = suggestion;
        if (!referenceValueEdited) referenceValueInput.value = problemSelect.value === "tunnel_model1" ? "p" : "u";
        if (!referenceUnitsEdited) {
          referenceCoordinateScalesInput.value = problemSelect.value === "tunnel_model1"
            ? "0.025,0.025,0.025"
            : Array.from({ length: suggestion.split(",").length + (
              referenceFixedTimeInput.value.trim() !== "" ? 1 : 0
            ) }, function () { return "1"; }).join(",");
          referencePredictionScaleInput.value = problemSelect.value === "tunnel_model1" ? "20" : "1";
        }
        referenceStatus.textContent = problemSelect.value === "tunnel_model1"
          ? "双隧道默认模型把 40 m、40 年归一化到 1，预测 U 乘 20 得到 kPa。若实际模型参数或参考单位不同，请修改换算系数。选择 CSV 可检查列名；运行前还需把文件复制到填写的路径。"
          : "选择文件可检查列名；运行前还需把参考表复制到填写的路径。";
      }
    }

    function removeIncompatibleSelections() {
      Object.keys(selected).forEach(function (methodName) {
        var family = familyByName(methodName);
        var variant = variantByName(family, selected[methodName]);
        if (!isCompatible(variant)) delete selected[methodName];
      });
      if (!Object.keys(selected).length) selected = { baseline: "plain_pinn" };
    }

    problemSelect.addEventListener("change", function () {
      if (isCustomProblem()) syncCustomTemplateOptions();
      removeIncompatibleSelections();
      syncReferenceColumns();
      renderAll();
    });
    customKindSelect.addEventListener("change", function () {
      syncCustomTemplateOptions();
      if (customEquationModeSelect.value === "free") resetCustomTerms();
      toggleCustomFields();
      removeIncompatibleSelections();
      syncReferenceColumns();
      renderAll();
    });
    customDimensionSelect.addEventListener("change", function () {
      syncCustomTemplateOptions();
      if (customEquationModeSelect.value === "free") resetCustomTerms();
      toggleCustomFields();
      syncReferenceColumns();
      renderCustomPreview();
      updateCode();
    });
    customGeometryTypeSelect.addEventListener("change", function () {
      var nextGeometryType = customGeometryTypeSelect.value;
      if (nextGeometryType !== lastGeometryType &&
          (nextGeometryType === "dxf" || lastGeometryType === "dxf")) {
        customPolygonData = null;
        customPolygonOriginal = null;
        customPolygonBoundaryState = [];
        customPolygonStatus.classList.remove("is-error");
        customPolygonStatus.textContent = "尚未导入几何。";
        renderPolygonEditor();
      }
      lastGeometryType = nextGeometryType;
      customCurvedNote.textContent = customCurvedNoteDefault;
      toggleCustomFields();
      renderCustomPreview();
      updateCode();
    });
    customPolygonFileInput.addEventListener("change", function () {
      var file = customPolygonFileInput.files && customPolygonFileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        customPolygonData = null;
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "导入失败：文件超过 5 MB 安全上限。";
        renderCustomPreview();
        updateCode();
        return;
      }
      var lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
        loadPolygonImage(file);
        return;
      }
      customImageRaster = null;
      customImageOptions.hidden = true;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var coordinates;
          if (lowerName.endsWith(".csv")) {
            coordinates = polygonCoordinatesFromCsv(String(reader.result));
          } else if (lowerName.endsWith(".json") || lowerName.endsWith(".geojson")) {
            coordinates = polygonCoordinatesFromJson(JSON.parse(String(reader.result)));
          } else {
            throw new Error("文件扩展名必须是 .csv、.json、.geojson、.png、.jpg 或 .jpeg。");
          }
          customGeometryTypeSelect.value = "polygon";
          toggleCustomFields();
          setPolygonData(validatePolygon(coordinates[0], coordinates[1], file.name));
        } catch (error) {
          customPolygonData = null;
          customPolygonStatus.classList.add("is-error");
          customPolygonStatus.textContent = "导入失败：" + error.message;
          renderCustomPreview();
          updateCode();
        }
      };
      reader.onerror = function () {
        customPolygonData = null;
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "无法读取该文件。";
        renderCustomPreview();
        updateCode();
      };
      reader.readAsText(file, "utf-8");
    });
    function importDxfFile() {
      var file = customDxfFileInput.files && customDxfFileInput.files[0];
      if (!file) return;
      var selectedGeometry = customGeometryTypeSelect.value;
      customPolygonData = null;
      customPolygonOriginal = null;
      customPolygonBoundaryState = [];
      renderPolygonEditor();
      renderPolygonBoundaries();
      renderCustomPreview();
      updateCode();
      if (!file.name.toLowerCase().endsWith(".dxf")) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "导入失败：请选择二维 ASCII .dxf 文件。";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "导入失败：DXF 文件超过 5 MB 安全上限。";
        return;
      }
      var unitScale = Number(customDxfUnitScaleInput.value);
      if (!Number.isFinite(unitScale) || unitScale <= 0) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "导入失败：坐标换算系数必须是正数。";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (customGeometryTypeSelect.value !== selectedGeometry) return;
          if (!window.OpenPINNDxfImport) throw new Error("DXF 读取模块未加载，请刷新页面。");
          var parsed = window.OpenPINNDxfImport.parseDetailed(String(reader.result), { unitScale: unitScale });
          customImageRaster = null;
          customImageOptions.hidden = true;
          var polygon = validatePolygon(parsed.outer, parsed.holes, file.name);
          polygon.circularHoles = parsed.circularHoles;
          polygon.dxfInfo = { unitsCode: parsed.unitsCode, unitScale: unitScale,
            stitchedEntityCount: parsed.stitchedEntityCount, joinTolerance: parsed.joinTolerance };
          setPolygonData(polygon);
          customPolygonStatus.textContent += " 已拼合 " + parsed.stitchedEntityCount +
            " 段开放实体；DXF $INSUNITS=" + (parsed.unitsCode === null ? "未声明" : parsed.unitsCode) +
            "；坐标已乘 " + unitScale + "。请核对尺寸。";
        } catch (error) {
          customPolygonStatus.classList.add("is-error");
          customPolygonStatus.textContent = "DXF 导入失败：" + error.message;
          renderCustomPreview();
          updateCode();
        }
      };
      reader.onerror = function () {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "无法读取 DXF 文件。";
      };
      reader.readAsText(file, "utf-8");
    }
    customDxfFileInput.addEventListener("change", importDxfFile);
    customDxfUnitScaleInput.addEventListener("change", importDxfFile);
    customImageReprocessButton.addEventListener("click", function () {
      try {
        processPolygonImage();
      } catch (error) {
        customPolygonData = null;
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "图片识别失败：" + error.message;
        renderCustomPreview();
        updateCode();
      }
    });
    customImageThresholdModeSelect.addEventListener("change", function () {
      customImageThresholdField.hidden = customImageThresholdModeSelect.value !== "manual";
      if (!customImageRaster) return;
      try {
        processPolygonImage();
      } catch (error) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "图片识别失败：" + error.message;
        renderCustomPreview();
        updateCode();
      }
    });
    customImageShapeModeSelect.addEventListener("change", function () {
      if (!customImageRaster) return;
      try {
        processPolygonImage();
      } catch (error) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "曲线识别失败：" + error.message;
        renderCustomPreview();
        updateCode();
      }
    });
    customPolygonRingSelect.addEventListener("change", function () {
      customPolygonEditorRing = Number(customPolygonRingSelect.value);
      renderPolygonEditor();
      renderCustomPreview();
    });
    [customDxfCircleXInput, customDxfCircleYInput, customDxfCircleRadiusInput, customDxfCircleDiameterInput].forEach(function (input) {
      input.addEventListener("change", function () {
        if (!customPolygonData || customPolygonEditorRing < 1) return;
        var circle = customPolygonData.circularHoles &&
          customPolygonData.circularHoles[customPolygonEditorRing - 1];
        if (!circle) return;
        try {
          var x = Number(customDxfCircleXInput.value);
          var y = Number(customDxfCircleYInput.value);
          var radius = input === customDxfCircleDiameterInput
            ? Number(customDxfCircleDiameterInput.value) / 2 : Number(customDxfCircleRadiusInput.value);
          if (input.value.trim() === "") throw new Error("请输入完整的圆孔参数。");
          if (![x, y, radius].every(Number.isFinite) || radius <= 0) {
            throw new Error("圆心必须为有限数值，半径必须大于 0。");
          }
          var rings = polygonRings(customPolygonData);
          var old = rings[customPolygonEditorRing];
          var start = Math.atan2(old[0][1] - circle.center[1], old[0][0] - circle.center[0]);
          var direction = ringArea(old) < 0 ? -1 : 1;
          rings[customPolygonEditorRing] = old.map(function (_point, index) {
            var angle = start + direction * 2 * Math.PI * index / old.length;
            return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
          });
          applyPolygonRings(rings);
        } catch (error) {
          customPolygonStatus.classList.add("is-error");
          customPolygonStatus.textContent = "圆孔修改失败：" + error.message;
          renderPolygonEditor();
        }
      });
    });
    customPolygonTransformButton.addEventListener("click", function () {
      try {
        if (!customPolygonData) throw new Error("请先导入或识别几何。");
        var angle = Number(customPolygonRotateInput.value);
        var scaleX = Number(customPolygonScaleXInput.value);
        var scaleY = Number(customPolygonScaleYInput.value);
        var translateX = Number(customPolygonTranslateXInput.value);
        var translateY = Number(customPolygonTranslateYInput.value);
        if (customPolygonData.circularHoles && customPolygonData.circularHoles.some(Boolean) &&
            Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > 1e-10) {
          throw new Error("含圆孔的整体变换须使用相同的 X/Y 缩放；要保持真圆，请直接修改圆心和半径。");
        }
        var transformed = window.OpenPINNImageTrace.transformRings(
          polygonRings(customPolygonData),
          {
            angle: angle,
            scaleX: scaleX,
            scaleY: scaleY,
            translateX: translateX,
            translateY: translateY,
          }
        );
        applyPolygonRings(transformed);
        customPolygonRotateInput.value = "0";
        customPolygonScaleXInput.value = "1";
        customPolygonScaleYInput.value = "1";
        customPolygonTranslateXInput.value = "0";
        customPolygonTranslateYInput.value = "0";
      } catch (error) {
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "整体变换失败：" + error.message;
      }
    });
    customPolygonResetButton.addEventListener("click", function () {
      if (!customPolygonOriginal) return;
      setPolygonData(clonePolygonData(customPolygonOriginal), true);
    });
    customPreview.addEventListener("pointerdown", function (event) {
      var handle = event.target.closest && event.target.closest("[data-polygon-vertex]");
      if (!handle || !customPolygonData || !customPreviewPolygonMapping) return;
      event.preventDefault();
      customPolygonDrag = {
        pointerId: event.pointerId,
        index: Number(handle.dataset.index),
        ringIndex: customPreviewPolygonMapping.ringIndex,
        mapping: Object.assign({}, customPreviewPolygonMapping),
        backup: clonePolygonData(customPolygonData),
      };
      customPreview.classList.add("is-polygon-dragging");
      customPreview.setPointerCapture(event.pointerId);
    });
    customPreview.addEventListener("pointermove", function (event) {
      if (!customPolygonDrag || event.pointerId !== customPolygonDrag.pointerId) return;
      event.preventDefault();
      var rectangle = customPreview.getBoundingClientRect();
      var viewBox = customPreview.viewBox.baseVal;
      var point = window.OpenPINNImageTrace.clientPointToViewBox(
        event.clientX,
        event.clientY,
        {
          left: rectangle.left + customPreview.clientLeft,
          top: rectangle.top + customPreview.clientTop,
          width: customPreview.clientWidth,
          height: customPreview.clientHeight,
        },
        { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }
      );
      var mapping = customPolygonDrag.mapping;
      var svgX = Math.max(mapping.left, Math.min(mapping.left + mapping.width, point[0]));
      var svgY = Math.max(mapping.top, Math.min(mapping.bottom, point[1]));
      var x = mapping.xMin + (svgX - mapping.left) / mapping.width * (mapping.xMax - mapping.xMin);
      var y = mapping.yMin + (mapping.bottom - svgY) / mapping.height * (mapping.yMax - mapping.yMin);
      var rings = polygonRings(customPolygonData);
      rings[customPolygonDrag.ringIndex][customPolygonDrag.index] = [x, y];
      customPolygonData.outer = rings[0];
      customPolygonData.holes = rings.slice(1);
      renderCustomPreview();
      updateCode();
    });
    function finishPolygonDrag(event, cancelled) {
      if (!customPolygonDrag || event.pointerId !== customPolygonDrag.pointerId) return;
      var drag = customPolygonDrag;
      customPolygonDrag = null;
      customPreview.classList.remove("is-polygon-dragging");
      if (customPreview.hasPointerCapture(event.pointerId)) customPreview.releasePointerCapture(event.pointerId);
      if (cancelled) {
        setPolygonData(drag.backup, true);
        return;
      }
      try {
        applyPolygonRings(polygonRings(customPolygonData));
      } catch (error) {
        setPolygonData(drag.backup, true);
        customPolygonStatus.classList.add("is-error");
        customPolygonStatus.textContent = "拖动顶点失败：" + error.message;
      }
    }
    customPreview.addEventListener("pointerup", function (event) {
      finishPolygonDrag(event, false);
    });
    customPreview.addEventListener("pointercancel", function (event) {
      finishPolygonDrag(event, true);
    });
    customEquationModeSelect.addEventListener("change", function () {
      if (customEquationModeSelect.value === "free" && !customTermList.children.length) {
        resetCustomTerms();
      }
      toggleCustomFields();
      renderCustomPreview();
      updateCode();
    });
    customTemplateSelect.addEventListener("change", function () {
      toggleCustomFields();
      renderCustomPreview();
      updateCode();
    });
    customInitialPresetSelect.addEventListener("change", function () {
      toggleCustomFields();
      renderCustomPreview();
      updateCode();
    });
    customAddTermButton.addEventListener("click", function () {
      addCustomTerm(1, "u");
      renderCustomPreview();
      updateCode();
    });
    [
      customNameInput,
      customXMinInput,
      customXMaxInput,
      customYMinInput,
      customYMaxInput,
      customCircleCenterXInput,
      customCircleCenterYInput,
      customCircleRadiusInput,
      customEllipseCenterXInput,
      customEllipseCenterYInput,
      customEllipseAxisAInput,
      customEllipseAxisBInput,
      customEllipseRotationInput,
      customCornerRadiusInput,
      customSplineTensionInput,
      customTMinInput,
      customTMaxInput,
      customInitialValueInput,
      customDiffusivityInput,
      customReactionInput,
      customWaveNumberInput,
      customAdvectionXInput,
      customAdvectionYInput,
      customViscosityInput,
    ].filter(Boolean).forEach(function (input) {
      function changed() {
        renderCustomPreview();
        updateCode();
      }
      input.addEventListener("input", changed);
      input.addEventListener("change", changed);
    });
    customBoundaryRows.forEach(function (row) {
      row.querySelectorAll("input, select").forEach(function (input) {
        input.addEventListener("input", function () {
          toggleCustomFields();
          renderCustomPreview();
          updateCode();
        });
        input.addEventListener("change", function () {
          toggleCustomFields();
          renderCustomPreview();
          updateCode();
        });
      });
    });
    stepsInput.addEventListener("input", updateCode);
    logEveryInput.addEventListener("input", updateCode);
    seedInput.addEventListener("input", updateCode);
    outputRootInput.addEventListener("input", updateCode);
    referenceEnableInput.addEventListener("change", function () {
      referenceFields.hidden = !referenceEnableInput.checked;
      syncReferenceColumns();
      updateCode();
    });
    referenceCoordinatesInput.addEventListener("input", function () {
      referenceColumnsEdited = true;
      updateCode();
    });
    referenceFixedTimeInput.addEventListener("input", function () {
      syncReferenceColumns();
      updateCode();
    });
    referenceValueInput.addEventListener("input", function () {
      referenceValueEdited = true;
      updateCode();
    });
    [referenceCoordinateScalesInput, referencePredictionScaleInput].forEach(function (input) {
      input.addEventListener("input", function () { referenceUnitsEdited = true; updateCode(); });
    });
    [referencePathInput,
      referenceValueScaleInput, referenceFieldIndexInput].forEach(function (input) {
      input.addEventListener("input", updateCode);
    });
    referenceFileInput.addEventListener("change", function () {
      var file = referenceFileInput.files && referenceFileInput.files[0];
      if (!file) return;
      referencePathInput.value = "examples/references/" + file.name;
      var reader = new FileReader();
      reader.onload = function () {
        var firstLine = String(reader.result).replace(/^\uFEFF/, "").split(/\r?\n/).find(function (line) {
          return line.trim() && !/^[%#]/.test(line.trim());
        });
        if (!firstLine) {
          referenceStatus.textContent = "文件前 64 KB 没有数据行；请检查格式或手动填写列名。";
          updateCode();
          return;
        }
        var delimiters = [",", ";", "\t"];
        delimiters.sort(function (left, right) { return firstLine.split(right).length - firstLine.split(left).length; });
        var headers = (firstLine.indexOf(delimiters[0]) !== -1
          ? firstLine.split(delimiters[0]) : firstLine.trim().split(/\s+/))
          .map(function (item) { return item.trim().replace(/^"|"$/g, ""); });
        var headerless = headers.every(function (item) { return item !== "" && Number.isFinite(Number(item)); });
        if (headerless) {
          var dimensions = suggestedReferenceColumns().split(",").length;
          referenceCoordinatesInput.value = Array.from({ length: dimensions }, function (_, index) { return "#" + (index + 1); }).join(",");
          referenceValueInput.value = "#" + (dimensions + 1);
          referenceColumnsEdited = true;
          referenceValueEdited = true;
          referenceStatus.textContent = "检测到无列名数值表（" + headers.length + " 列）。已按 #1、#2… 预填；请核对坐标与场值列，并把文件复制到 " + referencePathInput.value + "。";
        } else {
          referenceStatus.textContent = "检测到列：" + headers.join("、") +
            "。请按真实列名填写上方字段，并把文件复制到项目中的 " + referencePathInput.value + "。";
        }
        updateCode();
      };
      reader.onerror = function () { referenceStatus.textContent = "参考 CSV 预览失败；仍可手动填写路径和列名。"; };
      reader.readAsText(file.slice(0, 65536), "utf-8");
    });
    copyButton.addEventListener("click", function () {
      if (copyButton.disabled) return;
      var source = code.textContent;
      function copied() {
        codeActionStatus.textContent = "代码已复制，可粘贴到项目 examples/ 下的 Python 文件。";
        showMessage("代码已复制，可以粘贴到 examples/ 下的新 Python 文件。", false);
        copyButton.textContent = "已复制";
        window.setTimeout(function () {
          copyButton.textContent = "复制代码";
        }, 1400);
      }
      function copyWithSelection() {
        var textarea = document.createElement("textarea");
        textarea.value = source;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        // Keep the fallback inside the active dialog; body siblings are inert.
        codePane.appendChild(textarea);
        textarea.select();
        try {
          if (document.execCommand("copy")) copied();
          else codeActionStatus.textContent = "复制未成功，请手动选择代码复制或下载 .py 文件。";
        } catch (error) {
          codeActionStatus.textContent = "复制未成功，请手动选择代码复制或下载 .py 文件。";
        } finally {
          textarea.remove();
          copyButton.focus();
        }
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(source).then(copied).catch(copyWithSelection);
        return;
      }
      copyWithSelection();
    });

    if (physicsContainer && window.OpenPINNPhysicsEditor && payload.physics_catalog) {
      physicsEditor = window.OpenPINNPhysicsEditor.create(physicsContainer, {
        catalog: payload.physics_catalog,
        dimension: Number(customDimensionSelect.value), kind: customKindSelect.value,
        onChange: function () {
          if (physicsEditor && customEquationModeSelect.value === "expression") {
            renderCustomPreview();
            updateCode();
          }
        },
      });
    }
    resetCustomTerms();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-openpinn-configurator]").forEach(function (root) {
      var dataNode = root.nextElementSibling;
      if (!dataNode || !dataNode.matches("[data-openpinn-configurator-data]")) return;
      startConfigurator(root, JSON.parse(dataNode.textContent));
    });
  });
})();
