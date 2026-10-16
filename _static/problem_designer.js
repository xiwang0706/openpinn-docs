(function () {
  "use strict";

  function sourceTemplate(kind, problemName, hasCheckpoint) {
    var safeName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(problemName)
      ? problemName
      : "my_new_equation";
    var tail = [
      "",
      "# 只检查方法适用性，这里不开始训练。",
      "REPORT = op.check_method_compatibility(",
      "    PROBLEM,",
      "    has_checkpoint=" + (hasCheckpoint ? "True" : "False") + ",",
      ")",
      "print(REPORT.to_text())",
    ];

    if (kind === "dynamic") {
      return [
        "import openpinn as op",
        "import torch",
        "",
        "# ① 定义空间和时间区域：x 在 [-1, 1]，t 在 [0, 1]",
        "DOMAIN = op.SpaceTimeDomain(op.Interval(-1.0, 1.0), 0.0, 1.0)",
        "",
        "# ② 定义 PDE 残差；示例为 u_t - u_xx = 0",
        "def equation(x, u):",
        "    derivatives = op.grad(u, x)",
        "    u_t = derivatives[:, 1:2]",
        "    u_xx = op.hessian(u, x, i=0, j=0)",
        "    return u_t - u_xx",
        "",
        "# ③ 定义空间边界、初值和问题名称",
        "PROBLEM = op.PDEProblem(",
        "    DOMAIN,",
        "    equation,",
        "    [",
        "        op.DirichletBC(0.0, name=\"boundary\"),",
        "        op.InitialCondition(",
        "            lambda x: torch.sin(torch.pi * x[:, :1]),",
        "            name=\"initial\",",
        "        ),",
        "    ],",
        "    name=" + JSON.stringify(safeName) + ",",
        "    metadata={\"kind\": \"custom_dynamic\", \"residual_names\": (\"pde\",)},",
        ")",
      ].concat(tail).join("\n");
    }

    if (kind === "heterogeneous") {
      return [
        "import openpinn as op",
        "import torch",
        "",
        "# ① 定义一维两材料参数",
        "DOMAIN = op.Interval(-1.0, 1.0)",
        "INTERFACE = 0.0",
        "LEFT_DIFFUSIVITY = 1.0",
        "RIGHT_DIFFUSIVITY = 4.0",
        "",
        "def coefficient(x):",
        "    return torch.where(",
        "        x[:, :1] <= INTERFACE,",
        "        x.new_full((x.shape[0], 1), LEFT_DIFFUSIVITY),",
        "        x.new_full((x.shape[0], 1), RIGHT_DIFFUSIVITY),",
        "    )",
        "",
        "# ② 定义 PDE 残差；示例为 -(a(x)u_x)_x = 0",
        "def equation(x, u):",
        "    flux = coefficient(x) * op.grad(u, x)[:, :1]",
        "    return -op.grad(flux, x)[:, :1]",
        "",
        "# ③ 定义边界和界面元数据",
        "PROBLEM = op.PDEProblem(",
        "    DOMAIN,",
        "    equation,",
        "    [op.DirichletBC(0.0, name=\"boundary\")],",
        "    name=" + JSON.stringify(safeName) + ",",
        "    metadata={",
        "        \"kind\": \"heterogeneous_static\",",
        "        \"interface\": INTERFACE,",
        "        \"left_diffusivity\": LEFT_DIFFUSIVITY,",
        "        \"right_diffusivity\": RIGHT_DIFFUSIVITY,",
        "        \"residual_names\": (\"pde\",),",
        "    },",
        ")",
      ].concat(tail).join("\n");
    }

    return [
      "import math",
      "",
      "import openpinn as op",
      "import torch",
      "",
      "# ① 定义计算区域",
      "DOMAIN = op.Interval(-1.0, 1.0)",
      "",
      "# ② 定义 PDE 残差；示例为 -u_xx = pi^2 sin(pi*x)",
      "def equation(x, u):",
      "    u_xx = op.hessian(u, x, i=0, j=0)",
      "    source = math.pi**2 * torch.sin(math.pi * x[:, :1])",
      "    return -u_xx - source",
      "",
      "# ③ 定义边界和问题名称",
      "PROBLEM = op.PDEProblem(",
      "    DOMAIN,",
      "    equation,",
      "    [op.DirichletBC(0.0, name=\"boundary\")],",
      "    name=" + JSON.stringify(safeName) + ",",
      "    metadata={\"kind\": \"custom_static\", \"residual_names\": (\"pde\",)},",
      ")",
    ].concat(tail).join("\n");
  }

  function startDesigner(root, payload) {
    var nameInput = root.querySelector('[data-role="problem-name"]');
    var kindSelect = root.querySelector('[data-role="problem-kind"]');
    var checkpointInput = root.querySelector('[data-role="has-checkpoint"]');
    var source = root.querySelector('[data-role="source"]');
    var resetButton = root.querySelector('[data-role="reset"]');
    var copyButton = root.querySelector('[data-role="copy"]');
    var message = root.querySelector('[data-role="message"]');
    var summary = root.querySelector('[data-role="summary"]');
    var results = root.querySelector('[data-role="method-results"]');

    function familyInfo() {
      if (kindSelect.value === "dynamic") {
        return { name: "dynamic", aliases: ["dynamic"] };
      }
      if (kindSelect.value === "heterogeneous") {
        return {
          name: "heterogeneous_poisson",
          aliases: ["heterogeneous_poisson", "static"],
        };
      }
      return { name: "static", aliases: ["static"] };
    }

    function assess(item, info) {
      var matched = item.compatible_with.some(function (family) {
        return info.aliases.indexOf(family) !== -1;
      });
      if (!matched) {
        return {
          status: "incompatible",
          reason: "当前实现仅声明支持：" + item.compatible_with.join("、"),
        };
      }
      if (item.requires_checkpoint) {
        return {
          status: "conditional",
          reason: checkpointInput.checked
            ? "已声明有 checkpoint，仍需核对网络输入、输出和结构"
            : "尚缺少与当前网络结构匹配的 checkpoint.pt",
        };
      }
      if (item.method === "domain_decomposition") {
        return {
          status: "conditional",
          reason: "当前只实现一维两材料界面，须再核对材料参数和界面位置",
        };
      }
      return {
        status: "applicable",
        reason: "问题结构与该实现的注册条件相符",
      };
    }

    function renderResults() {
      var info = familyInfo();
      var groups = {
        applicable: [],
        conditional: [],
        incompatible: [],
      };
      payload.methods.forEach(function (item) {
        var assessment = assess(item, info);
        groups[assessment.status].push({ item: item, reason: assessment.reason });
      });
      summary.textContent =
        "当前识别为 " +
        info.name +
        "；有 " +
        groups.applicable.length +
        " 个变体结构上可尝试，" +
        groups.conditional.length +
        " 个需附加条件。";
      results.innerHTML = "";
      [
        ["applicable", "结构上可直接尝试"],
        ["conditional", "满足附加条件后可尝试"],
        ["incompatible", "当前不适用"],
      ].forEach(function (definition) {
        var section = document.createElement("section");
        section.className = "problem-method-group is-" + definition[0];
        var heading = document.createElement("h3");
        heading.textContent = definition[1] + "（" + groups[definition[0]].length + "）";
        section.appendChild(heading);
        groups[definition[0]].forEach(function (entry) {
          var row = document.createElement("div");
          row.className = "problem-method-result";
          var label = document.createElement("strong");
          label.textContent =
            entry.item.family_title +
            " / " +
            entry.item.title +
            "  ·  " +
            entry.item.method +
            "/" +
            entry.item.variant;
          var reason = document.createElement("span");
          reason.textContent = entry.reason;
          row.appendChild(label);
          row.appendChild(reason);
          section.appendChild(row);
        });
        results.appendChild(section);
      });
    }

    function resetSource() {
      source.value = sourceTemplate(
        kindSelect.value,
        nameInput.value.trim(),
        checkpointInput.checked
      );
      message.textContent = "已按当前问题结构生成可运行的检查模板。";
    }

    function copySource() {
      function copied() {
        message.textContent = "代码已复制；粘贴到 examples/ 下的 .py 文件运行即可查看同样的报告。";
      }
      function copyWithSelection() {
        source.select();
        if (document.execCommand("copy")) copied();
        else message.textContent = "复制未成功，请手动选择代码复制。";
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(source.value).then(copied).catch(copyWithSelection);
        return;
      }
      copyWithSelection();
    }

    function syncCheckpointFlag() {
      source.value = source.value.replace(
        /has_checkpoint=(True|False),/,
        "has_checkpoint=" + (checkpointInput.checked ? "True" : "False") + ","
      );
    }

    function syncProblemName() {
      var selectedName = nameInput.value.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(selectedName)) {
        message.textContent = "问题名称需使用英文字母、数字或下划线，且不能以数字开头。";
        return;
      }
      source.value = source.value.replace(
        /(\n    name=)"[A-Za-z_][A-Za-z0-9_]*",/,
        "$1" + JSON.stringify(selectedName) + ","
      );
      message.textContent = "已更新代码中的问题名称，其他手工修改已保留。";
    }

    kindSelect.addEventListener("change", function () {
      resetSource();
      renderResults();
    });
    checkpointInput.addEventListener("change", function () {
      syncCheckpointFlag();
      renderResults();
    });
    resetButton.addEventListener("click", resetSource);
    copyButton.addEventListener("click", copySource);
    nameInput.addEventListener("change", syncProblemName);

    resetSource();
    renderResults();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-openpinn-problem-designer]").forEach(function (root) {
      var dataNode = root.nextElementSibling;
      if (!dataNode || !dataNode.matches("[data-openpinn-problem-designer-data]")) return;
      startDesigner(root, JSON.parse(dataNode.textContent));
    });
  });
})();
