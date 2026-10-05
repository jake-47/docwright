// Script-owned. Edit GIT_REPO_URL at the top of the script and re-run. The other
// four are stamped by the deploy workflow at build time: MDB_VERSION from the tag
// on the built commit (empty when it carries none), MDB_UPDATED from the build
// time, MDB_SHA from the built commit itself, and MDB_PAGE_DATES, whose whole
// quoted token the workflow replaces with an object literal mapping each chapter
// source to its last commit time ({"src/x.md":"2026-…"}). It is a QUOTED string
// here on purpose: unstamped (every local build) the file must still parse, and a
// bare identifier would throw and take the rest of this file with it.
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

  // One test for every workflow-stamped string: non-empty and actually
  // substituted (an unstamped local build leaves the __MDB_ placeholder).
  var stamped = function (v) {
    return typeof v === "string" && v !== "" && v.indexOf("__MDB_") !== 0;
  };

  // The one relative-time formatter, shared by the sidebar footer and the
  // per-page line. Buckets are LOCAL CALENDAR DAYS, not 24-hour windows, so
  // "yesterday" means yesterday on the reader's clock: same day, "N hours ago"
  // ("just now" under an hour); one day back, "yesterday"; two and three,
  // spelled out; older, the plain local date (YYYY-MM-DD, the format the footer
  // showed before). A future timestamp (clock skew) lands in days<=0 with ms
  // clamped, so it reads "just now" rather than a negative; an unparseable one
  // returns null and the caller falls back or draws nothing. Computed once at
  // load — no ticking timer — and the exact timestamp rides the element's title
  // attribute, so hover shows the precision the words drop. 'now' is a
  // parameter only so the formatter can be unit-tested; callers pass nothing.
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

  // Drop the prev/next links that point INTO the reserved src/unlisted/ directory,
  // so the chapter arrows and the Left/Right keys skip those chapters the way the
  // sidebar rule already hides their rows. Remove, not hide: book.js reads
  // .nav-chapters.next straight out of the DOM and follows its href, so CSS alone
  // leaves the key walking in. Links OUT of an unlisted chapter are left alone —
  // its own back arrow still works. Same two href alternatives as the CSS rule (the
  // root form and the rewritten ../ form), and the class test is a substring because
  // mdBook emits the desktop pair and the mobile pair under different class names.
  ready(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
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
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) {
      // "updated <when>", relative, with the exact timestamp on hover. If the
      // stamp doesn't parse as a date, show it verbatim rather than nothing.
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

  // Per-page "Last updated <when>" under the chapter H1, after the subtitle when
  // there is one. MDB_PAGE_DATES is stamped by the workflow as an object literal
  // mapping each chapter source to its last commit time; unstamped it is still
  // the placeholder STRING, so the typeof test is the whole local-build guard.
  // The source path comes from the edit link — mdBook's #git-edit-button sits
  // inside the <a> whose href ends in the expanded {path}, src/…; matching the
  // href against the stamped keys (longest wins) sidesteps parsing the branch
  // segment, which may itself contain '/'. The fallback maps the page URL
  // (foo/bar.html -> src/foo/bar.md) using path_to_root for the depth.
  // index.html is a COPY of the first chapter, so the fallback would name a
  // source that doesn't exist and the map lookup draws nothing — the edit link,
  // when there is one, carries it. print.html is skipped outright: a flat
  // concatenation has no single source.
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

// Scrollable code is keyboard-reachable. tabindex="0" goes on code blocks that
// overflow sideways, and ONLY those: the keyboard must reach what scrolls (axe:
// scrollable-region-focusable) and skip what doesn't — a tab stop on every block
// would make Tab a long walk. mdBook's pre > code.hljs is the scroll container
// (white-space:pre; overflow-x:auto), so it takes the attribute, and a tabindex
// of "0" comes off again once the block no longer overflows. Current Chromium
// puts a scrolling block in the Tab order by itself; the attribute is for
// engines that don't, and for axe, which flags the block without it. This
// section sits AFTER the line-number section on purpose: the gutter narrows
// <code> when it is drawn, and measuring before it would miss blocks the gutter
// pushes into overflow.
(function () {
  // "Overflows" means by MORE than a pixel. scrollWidth and clientWidth are
  // integers, so a line that fits to within a fraction of a pixel reads as 1px
  // of overflow (measured: 657 against 656 for a 0.9px overhang), and a tab stop
  // that scrolls one pixel is noise. Still stricter than axe-core, whose
  // scrollable-region-focusable rule only counts overflow beyond 13px
  // (getScroll(node, 13)), so every region axe would flag keeps its stop.
  var apply = function () {
    var blocks = document.querySelectorAll("pre > code.hljs");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.scrollWidth > b.clientWidth + 1) b.setAttribute("tabindex", "0");
      else if (b.getAttribute("tabindex") === "0") b.removeAttribute("tabindex");
    }
  };
  // Re-check when a BLOCK changes size, not when the window does. mdBook animates
  // .page-wrapper for 0.3s (general.css: margin-left and transform), and toggling
  // the sidebar re-sizes every block without firing a resize event at all, so a
  // check 150ms after the last window resize measured mid-animation and could
  // leave a tab stop on a block that ended up fitting. A ResizeObserver reports
  // each size a block passes through; debounced ~150ms, the check runs once the
  // layout has settled. Window resize is the fallback where it is missing.
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
  // Focus alone is not enough: the arrows must reach the block. book.js turns
  // Left/Right into chapter navigation from a keydown listener on document that
  // calls preventDefault() — its guard (mdbook_something_else_has_focus) exempts
  // only input, select and textarea — so a focused code block never scrolled,
  // and on a page with a next chapter Right turned the page instead. While a
  // code block has focus, stop the two bare arrows in the CAPTURE phase, which
  // on document runs before book.js's bubble-phase listener on the same node.
  // Nothing then cancels the event, so the browser does its default and scrolls
  // the block. Arrows with a modifier, and every other key, pass through.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();
