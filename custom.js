// Script-owned. Edit GIT_REPO_URL at the top of the script and re-run. The other
// three are stamped by the deploy workflow at build time: MDB_VERSION from the tag
// on the built commit (empty when it carries none), MDB_UPDATED from the build
// date, MDB_SHA from the built commit itself.
var MDB_REPO = "https://github.com/jake-47/docwright";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // 'b' toggles the sidebar. The guard mirrors mdBook's own
  // (mdbook_something_else_has_focus): composedPath for shadow-DOM targets, form
  // fields, and contenteditable.
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== "b") return;
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!t) return;
    if (t.isContentEditable) return;
    if (/^(input|textarea|select)$/i.test(t.tagName || "")) return;
    var btn = document.getElementById("mdbook-sidebar-toggle");
    if (btn) { btn.click(); e.preventDefault(); }
  });

  // Keep mdBook's '?' shortcut popup honest about the key we just added.
  ready(function () {
    var help = document.querySelector("#mdbook-help-popup > div");
    if (!help) return;
    var p = document.createElement("p");
    var k = document.createElement("kbd");
    k.textContent = "b";
    p.appendChild(document.createTextNode("Press "));
    p.appendChild(k);
    p.appendChild(document.createTextNode(" to toggle the sidebar"));
    help.appendChild(p);
  });

  // Off-site links open in a new tab.
  ready(function () {
    var here = location.origin;
    var links = document.querySelectorAll(".content a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], u;
      try { u = new URL(a.href, location.href); } catch (err) { continue; }
      if (u.origin !== here) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    }
  });

  // The masthead is sticky at the top of the sidebar (CSS), and grows a hairline
  // once the TOC scrolls under it — the same thing book.js does to the menu bar
  // opposite it, whose 'bordered' class it adds the moment the bar leaves the top
  // of the page. A class and not a selector because nothing in CSS can see a scroll
  // offset. Its own ready() block, kept clear of the site-meta one below, which
  // returns early on an unstamped build and would take this with it.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // Site-meta at the foot of the sidebar (site-level, not per-page). A part is
  // shown only if the workflow stamped it, so an unstamped local build shows no
  // line at all rather than a placeholder word.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var stamped = function (v) { return v !== "" && v.indexOf("__MDB_") !== 0; };
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) parts.push(document.createTextNode("updated " + MDB_UPDATED));
    if (stamped(MDB_SHA)) {
      if (MDB_REPO) {
        var s = document.createElement("a");
        s.href = MDB_REPO + "/commit/" + encodeURIComponent(MDB_SHA);
        s.textContent = MDB_SHA;
        parts.push(s);
      } else {
        parts.push(document.createTextNode(MDB_SHA));
      }
    }
    if (!parts.length) return;
    var p = document.createElement("div");
    p.className = "mdb-sitemeta";
    for (var i = 0; i < parts.length; i++) {
      if (i) p.appendChild(document.createTextNode(" \u00b7 "));
      p.appendChild(parts[i]);
    }
    box.appendChild(p);
  });

  // print.html. mdBook auto-opens the print dialog there, and cancelling it
  // otherwise strands you on the concatenated whole-book page it renders for PDF
  // export.
  //
  // Two paths, on purpose. The events are the nice path: go back when the dialog
  // closes — on cancel and on a completed job alike, since no browser distinguishes
  // the two. Two triggers, because browsers disagree about which they fire:
  // afterprint, and the print media query ceasing to match (that one only after it
  // has actually matched, so a spurious change event at load cannot bounce you); a
  // once-flag stops the pair double-firing. Neither is guaranteed to fire in every
  // browser, so the link is the path that cannot fail: it is always there, it needs
  // no event, and it is hidden from the printed output. No referrer test —
  // document.referrer is empty on a reload, a pasted URL or a restored tab.
  (function () {
    if (!/(^|\/)print\.html$/.test(location.pathname)) return;

    ready(function () {
      var main = document.querySelector("#mdbook-content main");
      if (!main) return;
      var p = document.createElement("p");
      p.className = "mdb-print-back";
      var a = document.createElement("a");
      a.href = (typeof path_to_root === "string" ? path_to_root : "") + "index.html";
      a.textContent = "\u2190 Back";
      p.appendChild(a);
      main.insertBefore(p, main.firstChild);
    });

    var left = false, entered = false;
    function leave() {
      if (left) return;
      left = true;
      if (history.length > 1) history.back();
    }
    window.addEventListener("afterprint", leave);
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var onChange = function (e) {
        if (e.matches) entered = true;
        else if (entered) leave();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  })();
})();

// Line numbers. book.js highlights synchronously before this file runs, so the
// blocks already carry code.hljs. The numbers go in a sibling div, never inside
// <code>: mdBook's copy button reads code.innerText, so anything that rewrites
// <code>'s DOM corrupts what a reader copies.
//
// ONE style rule: a block shorter than MIN_LINES is not numbered. Nobody counts to
// four, and a gutter on a three-line block is furniture.
//
// The three tests above it are not style rules, they are correctness guards, and
// removing any one of them breaks something. Number a block only when its fence
// named a language — mdBook emits class="language-x" for ```bash and no such class
// for a bare ```, even though highlight.js still auto-detects and colours the bare
// one. Skip .playground blocks (their <pre> also holds a .result panel, which a flex
// row would put beside the code instead of below it) and blocks with hidden lines
// (the eye button display:none's .boring spans, which drops lines out of the flow
// and leaves the numbers pointing at the wrong ones).
(function () {
  var MIN_LINES = 10;
  function gutters() {
    var blocks = document.querySelectorAll("pre > code.hljs");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var pre = b.parentNode;
      if (!/(^|\s)language-\S+/.test(b.className)) continue;
      if (pre.classList.contains("playground")) continue;
      if (b.querySelector(".boring")) continue;
      var lines = b.textContent.replace(/\n+$/, "").split("\n").length;
      if (lines < MIN_LINES) continue;
      var g = document.createElement("div");
      g.className = "mdb-gutter";
      g.setAttribute("aria-hidden", "true");
      var s = "1";
      for (var n = 2; n <= lines; n++) s += "\n" + n;
      g.textContent = s;
      pre.insertBefore(g, b);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gutters);
  else gutters();
})();
