/* Local section search: no fetch, external service, eval, or SVG mutation. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.OpenPINNSearch = api;
    function ready() { api.start(root.document, root); }
    // Deferred scripts execute while readyState is interactive, before the
    // later deferred index script. Wait for all deferred resources, not only DOM.
    if (root.document.readyState !== "complete") root.document.addEventListener("DOMContentLoaded", ready, {once: true});
    else ready();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function terms(query) {
    return Array.from(new Set(String(query || "").slice(0, 160).toLowerCase().trim().split(/\s+/).filter(Boolean)));
  }
  function search(records, query) {
    var words = terms(query);
    if (!words.length) return [];
    return records.map(function (record) {
      var title = record.title.toLowerCase(), heading = record.heading.toLowerCase();
      var body = record.text.toLowerCase(), all = title + " " + heading + " " + body;
      if (!words.every(function (word) { return all.includes(word); })) return null;
      var score = words.reduce(function (sum, word) {
        return sum + (heading.includes(word) ? 20 : 0) + (title.includes(word) ? 10 : 0) + (body.includes(word) ? 1 : 0);
      }, 0);
      return {record: record, score: score};
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score || a.record.href.localeCompare(b.record.href);
    }).map(function (item) { return item.record; });
  }
  function snippet(text, query) {
    var lower = text.toLowerCase();
    var hits = terms(query).map(function (word) { return lower.indexOf(word); }).filter(function (pos) { return pos >= 0; });
    var start = Math.max(0, (hits.length ? Math.min.apply(null, hits) : 0) - 45);
    return (start ? "…" : "") + text.slice(start, start + 200) + (start + 200 < text.length ? "…" : "");
  }
  function markedText(document, text, query) {
    var lower = text.toLowerCase(), ranges = [];
    terms(query).forEach(function (word) {
      var index = lower.indexOf(word);
      while (index >= 0 && ranges.length < 400) {
        ranges.push([index, index + word.length]);
        index = lower.indexOf(word, index + word.length);
      }
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (last && last[1] >= range[0]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range.slice());
    });
    var fragment = document.createDocumentFragment(), cursor = 0;
    merged.forEach(function (range) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, range[0])));
      var mark = document.createElement("mark"); mark.className = "openpinn-search-match";
      mark.textContent = text.slice(range[0], range[1]); fragment.appendChild(mark); cursor = range[1];
    });
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    return fragment;
  }
  function clearHighlights(document) {
    document.querySelectorAll("mark.openpinn-search-match").forEach(function (mark) {
      mark.replaceWith(document.createTextNode(mark.textContent));
    });
  }
  function highlightDocument(document, query) {
    if (!terms(query).length) return;
    var body = document.querySelector('[itemprop="articleBody"]');
    if (!body) return;
    var skip = "svg, math, script, style, button, input, textarea, select, pre, code, nav, .nohighlight, [contenteditable], [data-openpinn-configurator], .openpinn-problem-designer, .visual-problem-designer, mark";
    var walker = document.createTreeWalker(body, 4), nodes = [], node;
    var words = terms(query);
    while ((node = walker.nextNode()) && nodes.length < 400) {
      if (node.parentElement && !node.parentElement.closest(skip) && words.some(function (word) { return node.nodeValue.toLowerCase().includes(word); })) nodes.push(node);
    }
    nodes.forEach(function (text) { text.replaceWith(markedText(document, text.nodeValue, query)); });
  }
  function render(document, win, index) {
    var output = document.getElementById("search-results");
    var form = document.getElementById("openpinn-search-form");
    if (!output || !form) return;
    var query = new URL(win.location.href).searchParams.get("q") || "";
    form.elements.q.value = query.slice(0, 160);
    output.replaceChildren();
    var heading = document.createElement("h2"); heading.textContent = "搜索结果"; output.appendChild(heading);
    var status = document.createElement("p"); status.setAttribute("role", "status"); output.appendChild(status);
    if (!index || index.version !== 1 || !Array.isArray(index.records)) {
      status.textContent = "本地搜索索引未加载。请保留完整网页目录，并重新运行 python scripts/build_docs.py 后刷新。";
      output.dataset.searchState = "error"; return;
    }
    if (query.length > 160) {
      status.textContent = "关键词过长，请缩短到 160 个字符以内。"; output.dataset.searchState = "invalid"; return;
    }
    if (!terms(query).length) { status.textContent = "请输入关键词。"; output.dataset.searchState = "empty"; return; }
    var found = search(index.records, query);
    status.textContent = found.length ? "找到 " + found.length + " 个相关小节。点击标题定位到正文。" : "没有找到匹配内容。可缩短关键词，或使用左侧目录。";
    output.dataset.searchState = "complete"; output.dataset.resultCount = String(found.length);
    var list = document.createElement("ul"); list.className = "search"; output.appendChild(list);
    var shown = 0, more = document.createElement("button");
    more.type = "button"; more.className = "btn btn-neutral search-more"; more.textContent = "显示更多结果";
    function addPage() {
      found.slice(shown, shown + 20).forEach(function (record) {
        // All index links are generated from local Sphinx document names.
        if (!/^[\w/-]+\.html(?:#[^\s?]*)?$/.test(record.href)) return;
        var item = document.createElement("li"), link = document.createElement("a");
        var url = new URL(record.href, win.location.href); url.search = "";
        url.searchParams.set("highlight", query); link.href = url.href;
        link.className = "search-title";
        var label = record.title === record.heading ? record.title : record.title + " › " + record.heading;
        link.appendChild(markedText(document, label, query)); item.appendChild(link);
        var excerpt = document.createElement("p"); excerpt.className = "context";
        excerpt.appendChild(markedText(document, snippet(record.text, query), query)); item.appendChild(excerpt); list.appendChild(item);
      });
      shown += 20; more.hidden = shown >= found.length;
    }
    more.addEventListener("click", addPage); output.appendChild(more); addPage();
  }
  function start(document, win) {
    // Do not carry highlights to unrelated pages via legacy Sphinx storage.
    var legacy = "";
    try { legacy = win.localStorage.getItem("sphinx_highlight_terms") || ""; win.localStorage.removeItem("sphinx_highlight_terms"); } catch (_) { /* file:// storage can be unavailable */ }
    if (document.getElementById("openpinn-search-form")) render(document, win, win.OpenPINNSearchIndex);
    else highlightDocument(document, new URL(win.location.href).searchParams.get("highlight") || legacy);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) clearHighlights(document);
    });
  }
  return {terms: terms, search: search, snippet: snippet, markedText: markedText,
          highlightDocument: highlightDocument, clearHighlights: clearHighlights, render: render, start: start};
});
