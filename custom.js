// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy workflow stamps the
// other four. MDB_PAGE_DATES stays a quoted string until stamped, so an unstamped
// file still parses.
var MDB_REPO = "https://github.com/jake-47/docwright";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
var MDB_PAGE_DATES = "__MDB_PAGE_DATES__";
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // A stamped value: non-empty and no longer a placeholder.
  var stamped = function (v) {
    return typeof v === "string" && v !== "" && v.indexOf("__MDB_") !== 0;
  };

  // Relative time by local calendar day: "N hours ago" ("just now" under an
  // hour), "yesterday", "two days ago", "three days ago", then the date. Computed
  // once; the exact time is the title. 'now' is a parameter for tests only.
  var mdbWhen = function (iso, now) {
    var d = new Date(iso);
    if (isNaN(d)) return null;
    now = now || new Date();
    var ms = now - d;
    if (ms < 0) ms = 0;
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
    var days = Math.round((day(now) - day(d)) / 86400000);
    var text;
    if (days <= 0) {
      var h = Math.floor(ms / 3600000);
      text = h < 1 ? "just now" : h === 1 ? "1 hour ago" : h + " hours ago";
    } else if (days === 1) text = "yesterday";
    else if (days === 2) text = "two days ago";
    else if (days === 3) text = "three days ago";
    else {
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      text = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    }
    var t = document.createElement("time");
    t.dateTime = iso;
    t.title = iso;
    t.textContent = text;
    return t;
  };

  // 'b' toggles the sidebar, behind the same focus guard mdBook uses.
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

  // Remove (not hide) prev/next links into src/unlisted/: book.js follows the
  // href from the DOM, so a hidden link would still take the arrow keys there.
  ready(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
  });

  // The masthead's hairline once the list scrolls under it.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // The sidebar footer; each part only if stamped.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) {
      // Relative, exact on hover; an unparseable stamp shows as it is.
      var u = document.createElement("span");
      u.appendChild(document.createTextNode("updated "));
      var w = mdbWhen(MDB_UPDATED);
      if (w) u.appendChild(w);
      else u.appendChild(document.createTextNode(MDB_UPDATED));
      parts.push(u);
    }
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
      if (i) p.appendChild(document.createTextNode(" · "));
      p.appendChild(parts[i]);
    }
    box.appendChild(p);
  });

  // "Last updated <when>" under the H1, from the stamped dates. The source path
  // comes from the edit link (the longest key its href ends with), else from the
  // page URL; print.html has no single source and is skipped.
  ready(function () {
    if (typeof MDB_PAGE_DATES !== "object" || !MDB_PAGE_DATES) return;
    if (/(^|\/)print\.html$/.test(location.pathname)) return;
    var src = "";
    var btn = document.getElementById("git-edit-button");
    var a = btn && btn.closest ? btn.closest("a") : null;
    var href = a ? a.getAttribute("href") || "" : "";
    if (href) {
      try { href = decodeURIComponent(href); } catch (err) {}
      for (var k in MDB_PAGE_DATES) {
        if (href.slice(-(k.length + 1)) === "/" + k && k.length > src.length) src = k;
      }
    }
    if (!src) {
      var depth = 0;
      if (typeof path_to_root === "string")
        depth = (path_to_root.match(/\.\.\//g) || []).length;
      var segs = location.pathname.split("/").filter(Boolean);
      var rel = segs.slice(segs.length - 1 - depth).join("/");
      try { rel = decodeURIComponent(rel); } catch (err) {}
      if (/\.html$/.test(rel) && rel !== "index.html") {
        var cand = "src/" + rel.replace(/\.html$/, ".md");
        if (MDB_PAGE_DATES[cand]) src = cand;
      }
    }
    var iso = src ? MDB_PAGE_DATES[src] : "";
    if (!iso) return;
    var w = mdbWhen(iso);
    if (!w) return;
    var main = document.querySelector("#mdbook-content main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (!h1) return;
    var after = h1;
    var sib = h1.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("mdb-subtitle")) after = sib;
    var p = document.createElement("p");
    p.className = "mdb-updated";
    p.appendChild(document.createTextNode("Last updated "));
    p.appendChild(w);
    after.parentNode.insertBefore(p, after.nextSibling);
  });

  // print.html: a back link, and a return to the page you came from when the
  // print dialog closes (afterprint or the print media query; once only).
  (function () {
    if (!/(^|\/)print\.html$/.test(location.pathname)) return;

    ready(function () {
      var main = document.querySelector("#mdbook-content main");
      if (!main) return;
      var p = document.createElement("p");
      p.className = "mdb-print-back";
      var a = document.createElement("a");
      a.href = (typeof path_to_root === "string" ? path_to_root : "") + "index.html";
      a.textContent = "← Back";
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

// Line numbers in a gutter beside <code> (the copy button reads code.innerText).
// Only language-fenced blocks of MIN_LINES or more; not playgrounds or blocks with
// hidden lines, where the numbers would sit wrong.
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

// Scrollable code is keyboard-reachable: tabindex="0" on blocks that overflow
// sideways, and only those (axe: scrollable-region-focusable). After the gutter
// section, which narrows <code>.
(function () {
  // More than 1px: whole-pixel widths turn a sub-pixel overhang into 1px.
  var apply = function () {
    var blocks = document.querySelectorAll("pre > code.hljs");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.scrollWidth > b.clientWidth + 1) b.setAttribute("tabindex", "0");
      else if (b.getAttribute("tabindex") === "0") b.removeAttribute("tabindex");
    }
  };
  // Re-check when a block resizes, debounced: mdBook animates the page for 0.3s,
  // and a sidebar toggle fires no window resize.
  var timer = null;
  var later = function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(apply, 150);
  };
  var run = function () {
    apply();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(later);
      var blocks = document.querySelectorAll("pre > code.hljs");
      for (var i = 0; i < blocks.length; i++) ro.observe(blocks[i]);
    } else {
      window.addEventListener("resize", later);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  // book.js turns Left/Right into page turns and cancels them unless a form field
  // has focus. Stopped in the capture phase while a code block has focus, the
  // browser scrolls the block instead.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();
