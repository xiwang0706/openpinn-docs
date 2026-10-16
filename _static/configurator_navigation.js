/* Same-page workflow navigation; never changes the user's model settings. */
(function () {
  "use strict";
  var targets = new Set([
    "configurator-problem", "configurator-geometry", "configurator-equation",
    "configurator-boundary", "configurator-method-title", "configurator-code-title",
    "configurator-workbench", "configurator-run-help", "configurator-results-help",
    "configurator-troubleshooting-help", "configurator-initial", "configurator-budget"
  ]);
  function initialize() {
    var guide = document.querySelector(".configurator-guide");
    var root = document.querySelector("[data-openpinn-configurator]");
    if (!guide || !root || guide.dataset.navigationReady) return;
    guide.dataset.navigationReady = "true";
    var status = root.querySelector('[data-role="guide-navigation-status"]');
    var active = null, timer = null;
    function role(name) { return root.querySelector('[data-role="' + name + '"]'); }
    function visible(node) { return !!node && !node.closest("[hidden]"); }
    function hashId(hash) {
      try { return decodeURIComponent((hash || "").slice(1)); }
      catch (_error) { return ""; }
    }
    function locate(id) {
      if (!targets.has(id)) return;
      var node = document.getElementById(id);
      if (!node) return;
      var message = "";
      var stepNames = {
        "configurator-geometry": "自定义几何", "configurator-equation": "控制方程",
        "configurator-boundary": "边界条件", "configurator-initial": "初值设置"
      };
      if (stepNames[id] && !visible(role("custom-problem-panel"))) {
        node = document.getElementById("configurator-problem");
        message = stepNames[id] + "尚未展开：请在“控制方程”中选择“新控制方程（可视化一维/二维）”。已填写的配置没有改变。";
      } else if (id === "configurator-geometry" && visible(role("custom-geometry-field"))) {
        node = role("custom-geometry-field");
      } else if (id === "configurator-equation") {
        if (visible(role("physics-editor"))) node = role("physics-editor");
        else if (visible(role("custom-term-builder"))) node = role("custom-term-builder");
      } else if (id === "configurator-initial" && !visible(node)) {
        node = role("custom-kind") ? role("custom-kind").closest("label") : document.getElementById("configurator-problem");
        message = "当前为静态方程，无需初值。导航没有修改问题类型。";
      }
      if (status) { status.textContent = message; status.hidden = !message; }
      var dialog = role("code-dialog");
      if (dialog && dialog.open && typeof dialog.close === "function") dialog.close();
      for (var ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === "DETAILS") ancestor.open = true;
      }
      if (typeof node.scrollIntoView === "function") node.scrollIntoView({block: "start", behavior: "auto"});
      var focus = node;
      if (node === role("physics-editor") && visible(role("physics-formula"))) focus = role("physics-formula");
      else if (!node.matches("input,select,textarea,button,summary")) {
        focus = Array.from(node.querySelectorAll("summary,input,select,textarea,button"))
          .find(function (candidate) { return visible(candidate) && !candidate.disabled; }) || node;
      }
      if (!focus.hasAttribute("tabindex") && !focus.matches("input,select,textarea,button,summary")) focus.setAttribute("tabindex", "-1");
      if (typeof focus.focus === "function") focus.focus({preventScroll: true});
      if (active) active.classList.remove("configurator-navigation-target");
      clearTimeout(timer); active = node;
      node.classList.add("configurator-navigation-target");
      timer = setTimeout(function () { node.classList.remove("configurator-navigation-target"); active = null; }, 1600);
    }
    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest('a[href^="#configurator-"]');
      if (!link || !document.contains(link)) return;
      var hash = link.getAttribute("href"), id = hashId(hash);
      if (!targets.has(id)) return;
      event.preventDefault();
      if (window.location.hash !== hash) window.location.hash = hash;
      locate(id);
    });
    window.addEventListener("hashchange", function () { locate(hashId(window.location.hash)); });
    locate(hashId(window.location.hash));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
}());
