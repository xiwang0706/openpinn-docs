(function () {
  "use strict";
  function start() {
    var routeNode = document.querySelector("[data-manual-routes]");
    if (routeNode) {
      var routes = JSON.parse(routeNode.textContent);
      function routeLegacyAnchor() {
        var id;
        try { id = decodeURIComponent(window.location.hash.slice(1)); }
        catch (error) { return; }
        if (Object.prototype.hasOwnProperty.call(routes, id)) {
          window.location.replace(routes[id] + "#" + encodeURIComponent(id));
        }
      }
      window.addEventListener("hashchange", routeLegacyAnchor);
      routeLegacyAnchor();
    }
    var root = document.querySelector(".openpinn-manual");
    if (!root) return;
    document.body.classList.add("manual-document");
    function updateCurrentChapter() {
      var id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); }
      catch (error) { id = ""; }
      var target = document.getElementById(id);
      if (target && root.contains(target)) {
        var ancestor = target.parentElement;
        while (ancestor && ancestor !== root) {
          if (ancestor.tagName === "DETAILS") ancestor.open = true;
          ancestor.hidden = false;
          ancestor = ancestor.parentElement;
        }
      }
      var section = target && target.closest("section");
      root.querySelectorAll(".manual-contents a").forEach(function (link) {
        if (section && root.contains(section) && link.hash === "#" + section.id) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }
    window.addEventListener("hashchange", updateCurrentChapter);
    updateCurrentChapter();
    root.querySelector("[data-manual-search]").addEventListener("input", function (event) {
      var needle = event.target.value.trim().toLowerCase();
      root.querySelector(".manual-local-nav").open = Boolean(needle);
      root.querySelectorAll(".manual-contents a").forEach(function (link) {
        var section = document.getElementById(link.hash.slice(1));
        link.parentElement.hidden = Boolean(needle) && !section.textContent.toLowerCase().includes(needle);
      });
    });
    root.querySelector("[data-manual-expand]").addEventListener("click", function () {
      root.querySelectorAll("details").forEach(function (node) { node.open = true; });
    });
    root.querySelector("[data-manual-collapse]").addEventListener("click", function () {
      root.querySelectorAll("details").forEach(function (node) { node.open = false; });
    });
    root.querySelectorAll("[data-filter-target]").forEach(function (input) {
      input.addEventListener("input", function () {
        var needle = input.value.trim().toLowerCase();
        var container = document.getElementById(input.dataset.filterTarget);
        Array.from(container.children).forEach(function (node) {
          node.hidden = Boolean(needle) && !node.textContent.toLowerCase().includes(needle);
          if (needle && !node.hidden) node.open = true;
        });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
