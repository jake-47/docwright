// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy stamp is in version.js.
var MDB_REPO = "https://github.com/jake-47/docwright";
var MDB_OFFLINE = "full";
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // mdBook's print.html, at the book's root (a print.md in a folder is a page like any other).
  var isPrint = function () {
    return /(^|\/)print\.html$/.test(location.pathname) &&
      (typeof path_to_root !== "string" || path_to_root === "");
  };

  // A stamped value: non-empty and no longer a placeholder.
  var stamped = function (v) {
    return typeof v === "string" && v !== "" && v.indexOf("__MDB_") !== 0;
  };

  // Relative time by local calendar day ("just now", "yesterday", then the date); exact on hover.
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

  // Swipes, through the sidebar's checkbox: mdBook 0.5.4's set a class and move nothing.
  (function () {
    var box = document.getElementById("mdbook-sidebar-toggle-anchor");
    var bar = document.getElementById("mdbook-sidebar");
    if (!box || !bar) return;
    var set = function (on) {
      if (box.checked === on) return;
      // As mdBook's own toggle does: back on screen first, so it slides in.
      if (on) { bar.style.display = ""; void bar.offsetHeight; }
      box.checked = on;
      box.dispatchEvent(new Event("change"));
    };
    var start = null;
    document.addEventListener("touchstart", function (e) {
      var t = e.target;
      start = e.touches.length === 1 && !(t.closest && t.closest("pre, table, .table-wrapper, input, select, textarea, .theme-popup, .checkbox-img:checked ~ .img-wrapper, #mdbook-help-container, .mdb-menu")) ?
        { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() } : null;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (start) {
        var x = e.touches[0].clientX, dx = x - start.x, dy = e.touches[0].clientY - start.y;
        if (Date.now() - start.time < 250 && Math.abs(dx) >= 150) {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx >= 0 && start.x < Math.min(document.body.clientWidth * 0.25, 300)) set(true);
            else if (dx < 0 && x < 300) set(false);
          }
          start = null;
        }
      }
      // mdBook's handler took the gestures this one passes over: keep its state in step.
      if (document.documentElement.classList.contains("sidebar-visible") !== box.checked)
        box.dispatchEvent(new Event("change"));
    }, { passive: true });
  })();

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

  // The pencil in front of print, so print and the offline button, last, go together; a space apart, as mdBook's.
  ready(function () {
    var right = document.querySelector("#mdbook-menu-bar .right-buttons");
    var print = right && right.querySelector('a[href$="print.html"]'), edit = right && right.querySelector('a[rel="edit"]');
    if (!print || !edit) return;
    right.insertBefore(edit, print);
    right.insertBefore(document.createTextNode(" "), print);
  });

  // Remove (not hide) prev/next links into src/unlisted/: book.js follows a hidden one too.
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

  // The sidebar footer; each part only if stamped (version.js).
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var version = window.MDB_VERSION, updated = window.MDB_UPDATED, sha = window.MDB_SHA;
    var parts = [];
    if (stamped(version)) parts.push(document.createTextNode(version));
    if (stamped(updated)) {
      // Relative, exact on hover; an unparseable stamp shows as it is.
      var u = document.createElement("span");
      u.appendChild(document.createTextNode("updated "));
      var w = mdbWhen(updated);
      if (w) u.appendChild(w);
      else u.appendChild(document.createTextNode(updated));
      parts.push(u);
    }
    if (stamped(sha)) {
      if (MDB_REPO) {
        var s = document.createElement("a");
        s.href = MDB_REPO + "/commit/" + encodeURIComponent(sha);
        s.textContent = sha;
        parts.push(s);
      } else {
        parts.push(document.createTextNode(sha));
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

  // "Last updated <when>" under the H1: the source from the edit link, else from the URL.
  ready(function () {
    var MDB_PAGE_DATES = window.MDB_PAGE_DATES;
    if (typeof MDB_PAGE_DATES !== "object" || !MDB_PAGE_DATES) return;
    if (isPrint()) return;
    var main = document.querySelector("#mdbook-content main");
    if (!main) return;
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
        var cand = "src/" + rel.replace(/\.html$/, "") + ".md";
        if (MDB_PAGE_DATES[cand]) src = cand;
      }
    }
    var iso = src ? MDB_PAGE_DATES[src] : "";
    if (!iso) return;
    var w = mdbWhen(iso);
    if (!w) return;
    var head = main.querySelector("h1");
    if (!head) return;
    var after = head;
    var sib = head.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("mdb-subtitle")) after = sib;
    var p = document.createElement("p");
    p.className = "mdb-updated";
    p.appendChild(document.createTextNode("Last updated "));
    p.appendChild(w);
    after.parentNode.insertBefore(p, after.nextSibling);
  });

  // print.html: a back link, and back to the page you came from when the print dialog closes.
  (function () {
    if (!isPrint()) return;

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

// THEME "picker": the theme menu trimmed to Auto, Light and Dark; rows removed, not hidden.
(function () {
  function trim() {
    var list = document.getElementById("mdbook-theme-list");
    if (!list) return;
    ["rust", "coal", "navy"].forEach(function (name) {
      var b = document.getElementById("mdbook-theme-" + name);
      if (b && b.parentNode && b.parentNode.parentNode === list) b.parentNode.remove();
    });
    var dark = document.getElementById("mdbook-theme-ayu");
    if (dark) dark.textContent = "Dark";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", trim);
  else trim();
})();

// Line numbers in a gutter beside <code>: language-fenced blocks of MIN_LINES or more.
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

// Code that overflows sideways takes tabindex="0", so the keyboard reaches it.
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
  // Re-checked on resize, debounced: a sidebar toggle fires no window resize.
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
  // While a code block has focus, Left and Right scroll it instead of turning the page.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();

// OFFLINE: the last button on the right, after print: save in the browser ("full"; sw.js serves it), or download.
// Icons: from Font Awesome Free, the set mdBook draws its own from, with its
// notice: Font Awesome Free 6.2.0 by @fontawesome - https://fontawesome.com
// License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL
// OFL 1.1, Code: MIT License) Copyright 2022 Fonticons, Inc.
(function () {
  "use strict";
  var MODE = typeof MDB_OFFLINE === "string" ? MDB_OFFLINE : "none";
  var COPY = typeof MDB_COPY === "object" && MDB_COPY ? MDB_COPY : null;
  // The book's address: document.baseURI, since the 404 page sets <base>.
  var ROOT = new URL(typeof path_to_root === "string" && path_to_root ? path_to_root : "./", document.baseURI).href;
  // Stored copies are named by the book's path: github.io sites share an origin.
  var PREFIX = "mdb-offline " + new URL(ROOT).pathname + " ";
  var META = PREFIX + "meta";
  var CURRENT = ROOT + "__mdb-offline/current";
  var LIST = ROOT + "__mdb-offline/files-";
  var ICONS = {
    save: ["0 0 640 512", "M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-167l80 80c9.4 9.4 24.6 9.4 33.9 0l80-80c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-39 39V184c0-13.3-10.7-24-24-24s-24 10.7-24 24V318.1l-39-39c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9z"],
    busy: ["0 0 512 512", "M304 48c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zm0 416c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zM48 304c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zm464-48c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zM142.9 437c18.7-18.7 18.7-49.1 0-67.9s-49.1-18.7-67.9 0s-18.7 49.1 0 67.9s49.1 18.7 67.9 0zm0-294.2c18.7-18.7 18.7-49.1 0-67.9S93.7 56.2 75 75s-18.7 49.1 0 67.9s49.1 18.7 67.9 0zM369.1 437c18.7 18.7 49.1 18.7 67.9 0s18.7-49.1 0-67.9s-49.1-18.7-67.9 0s-18.7 49.1 0 67.9z"],
    saved: ["0 0 512 512", "M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"],
    away: ["0 0 576 512", "M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"]
  };
  var st = { latest: null, reach: null, up: false, checked: false, saved: null, files: null, busy: null, error: "",
             online: navigator.onLine !== false };
  var LOST = "Couldn't reach the site, so the saved copy stays.";
  var button = null, panel = null, live = null;
  // Screen readers hear what a save, an update or a removal comes to.
  var say = function (text) { if (live) live.textContent = text; };

  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  var icon = function (name) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    s.setAttribute("viewBox", ICONS[name][0]);
    s.setAttribute("aria-hidden", "true");
    p.setAttribute("d", ICONS[name][1]);
    s.appendChild(p);
    var span = el("span", "fa-svg");
    span.appendChild(s);
    return span;
  };
  var mb = function (n) { return n >= 1e5 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB"; };
  var ver = function (v, built) { return "v" + v + (typeof built === "string" && built ? " · built " + built.slice(0, 10) : ""); };
  var count = function (n, one, many) { return n + " " + (n === 1 ? one : many); };
  // An error's message, less any full stop: ours follows it.
  var why = function (err) { return String(err && err.message ? err.message : err).replace(/[\s.]+$/, ""); };
  // A file of the book by its path in version.json, as the browser asks for it.
  var key = function (path) {
    return new URL("./" + path.replace(/%/g, "%25").replace(/#/g, "%23").replace(/\?/g, "%3F").replace(/\\/g, "%5C"), ROOT).href;
  };
  var json = function (v) { return new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } }); };
  var sha256 = function (buf) {
    return crypto.subtle.digest("SHA-256", buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    });
  };
  var lock = function (fn) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request(PREFIX + "lock", fn) : fn();
  };
  var total = function (files) {
    var n = 0;
    for (var k in files) n += files[k][0];
    return n;
  };

  // Saving needs a secure, published site: not localhost, not a file from disk, not a download.
  var standalone = function () {
    return navigator.standalone === true || !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  };
  var canSave = function () {
    var h = location.hostname;
    return MODE === "full" && !COPY && window.isSecureContext === true && location.protocol !== "file:" &&
      "serviceWorker" in navigator && "caches" in window && !!(window.crypto && crypto.subtle) &&
      h !== "localhost" && !/\.localhost$/.test(h) && !/^127(\.\d+){3}$/.test(h) && h !== "[::1]";
  };

  // The copy saved here, or null; strict, for a caller about to delete: errors are thrown.
  var readSaved = async function (strict) {
    try {
      if (!(await caches.has(META))) return null;
      var meta = await caches.open(META);
      var r = await meta.match(CURRENT);
      var cur = r ? await r.json() : null;
      if (!cur || !cur.cache || !(await caches.has(cur.cache))) return null;
      var f = await meta.match(LIST + cur.fingerprint);
      st.files = f ? await f.json() : null;
      return cur;
    } catch (e) {
      if (strict) throw e;
      return null;
    }
  };

  // st.up: the site answered (version.json, or a 404 for a book that's gone); onLine can't tell.
  var refresh = async function () {
    if (COPY) return;
    var v = null, gone = false;
    try {
      var r = await fetch(ROOT + "version.json", { cache: "no-cache" });
      gone = r.status === 404 || r.status === 410;
      v = r.ok ? await r.json() : null;
    } catch (e) {}
    if (v && typeof v.version === "number") st.latest = v;
    st.reach = !!(v && typeof v.version === "number");
    st.up = st.reach || gone;
    st.checked = true;
    if (st.up && st.error === LOST) st.error = "";
    render();
  };

  // What saving or updating fetches and keeps; pages counted once (no print, 404, toc, redirects, copies).
  var plan = function (L) {
    var files = L.files, old = (st.saved && st.files) || {};
    var p = { get: [], keep: [], bytes: 0, changed: 0, added: 0, removed: 0 };
    var page = function (path, entry, seen) {
      if (!/\.html$/.test(path) || /^(print|404|toc)\.html$/.test(path) || entry[2] || seen[entry[1]]) return false;
      seen[entry[1]] = true;
      return true;
    };
    var seen = {}, gone = {};
    Object.keys(files).forEach(function (path) {
      var o = old[path];
      if (o && o[1] === files[path][1]) return p.keep.push(path);
      p.get.push(path);
      p.bytes += files[path][0];
      // A page where a redirect was (output.html.redirect, since changed) is new.
      if (page(path, files[path], seen)) {
        if (o && !o[2]) p.changed++;
        else p.added++;
      }
    });
    // Gone, a redirect now, or now the first chapter's copy: removed.
    Object.keys(old).forEach(function (path) {
      var f = files[path];
      if ((!f || f[2] === 1 || (f[2] === 2 && !old[path][2])) && page(path, old[path], gone)) p.removed++;
    });
    return p;
  };
  var update = function () {
    var L = st.latest;
    return st.saved && L && L.files && L.fingerprint && L.fingerprint !== st.saved.fingerprint ? plan(L) : null;
  };

  // Four at a time; after a failure the rest are skipped, and it's thrown once all have stopped.
  var pool = function (items, n, work) {
    var i = 0, failure = null;
    var run = function () {
      if (failure || i >= items.length) return Promise.resolve();
      var item = items[i++];
      return Promise.resolve().then(function () { return work(item); })
        .then(run, function (e) { if (!failure) failure = e; });
    };
    var all = [];
    for (var k = 0; k < Math.min(n, items.length); k++) all.push(run());
    return Promise.all(all).then(function () { if (failure) throw failure; });
  };

  // Copies other than cur, and their file lists: replaced, or left by an interrupted update.
  var sweep = async function (meta, cur) {
    var names = await caches.keys();
    for (var i = 0; i < names.length; i++)
      if (names[i].indexOf(PREFIX + "copy ") === 0 && (!cur || names[i] !== cur.cache)) await caches.delete(names[i]);
    var keys = await meta.keys();
    for (var j = 0; j < keys.length; j++)
      if (keys[j].url.indexOf(LIST) === 0 && (!cur || keys[j].url !== LIST + cur.fingerprint)) await meta.delete(keys[j]);
  };

  var activated = function (reg) {
    return new Promise(function (done) {
      var w = reg.installing || reg.waiting;
      if (!w) return done();
      w.addEventListener("statechange", function () {
        if (w.state === "activated" || w.state === "redundant") done();
      });
    });
  };

  // The worker in control before the downloads: WebKit can stall a fetch passing through one.
  var ready = async function (reg) {
    // A worker starting now claims this page; one already running doesn't, so there's no wait.
    var fresh = !!(reg.installing || reg.waiting);
    await activated(reg);
    // Replaced before it started: a deploy may just have turned saving off.
    if (!reg.active) throw new Error("the site's offline service didn't start; reload the page");
    if (navigator.serviceWorker.controller || !fresh) return;
    await new Promise(function (done) {
      var timer = setTimeout(done, 5000);
      navigator.serviceWorker.addEventListener("controllerchange", function () { clearTimeout(timer); done(); }, { once: true });
    });
  };

  // Save or update: changed files fetched, the rest copied, all checked, then one switch.
  var save = async function () {
    var L = null, had = null, name = null, switched = false, reg = null;
    if (st.busy || !st.latest || !st.latest.files) return;

    var make = async function (p) {
      reg = await navigator.serviceWorker.register(ROOT + "sw.js", { scope: ROOT, updateViaCache: "none" });
      await ready(reg);
      // A name of its own: never the copy in use, whatever another tab did.
      name = PREFIX + "copy " + L.fingerprint + " " + Date.now();
      var cache = await caches.open(name);
      var old = had ? await caches.open(had.cache) : null;
      var jobs = p.keep.map(function (k) { return [k, true]; }).concat(p.get.map(function (k) { return [k, false]; }));
      await pool(jobs, 4, async function (job) {
        var path = job[0], want = L.files[path], url = key(path), res = job[1] && old ? await old.match(url) : null;
        if (!res) {
          // A minute for the answer to start, however long the file then takes.
          var stop = window.AbortController ? new AbortController() : null;
          var timer = stop ? setTimeout(function () { stop.abort(); }, 60000) : null;
          try {
            res = await fetch(url, stop ? { cache: "no-store", signal: stop.signal } : { cache: "no-store" });
          } catch (e) {
            throw new Error("couldn't fetch " + path + (stop && stop.signal.aborted ? " (no answer in a minute)" : ""));
          } finally {
            clearTimeout(timer);
          }
          if (!res.ok) throw new Error("couldn't fetch " + path + " (" + res.status + ")");
        }
        var body = await res.arrayBuffer();
        if (body.byteLength !== want[0] || (await sha256(body)) !== want[1])
          throw new Error(path + " isn't the file the site lists; the book may have just changed");
        await cache.put(url, new Response(body, { headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream" } }));
        st.busy.done++;
        later();
      });
      var meta = await caches.open(META);
      await meta.put(LIST + L.fingerprint, json(L.files));
      var cur = { cache: name, version: L.version, built: L.built, fingerprint: L.fingerprint };
      await meta.put(CURRENT, json(cur));
      switched = true;
      st.saved = cur;
      st.files = L.files;
      // Saved, whatever this does: what it misses goes on a later page load.
      try { await sweep(meta, cur); } catch (e) {}
    };

    st.error = "";
    st.busy = { what: "Checking…", done: 0, total: 0 };
    render();
    // The site's file list as it is now: the panel's may be a deploy behind.
    await refresh();
    L = st.latest;
    if (!st.reach || !L.files || !L.fingerprint) {
      st.busy = null;
      st.error = (st.saved ? "Couldn't update" : "Couldn't save") + ": couldn't check the book on the site.";
      say(st.error);
      render();
      return;
    }
    try {
      await lock(async function () {
        // Another tab may have saved or updated since this one looked.
        had = st.saved = await readSaved();
        if (had && had.fingerprint === L.fingerprint) return;
        var p = plan(L);
        st.busy = { what: (had ? "Updating to " : "Saving ") + "v" + L.version + "…", done: 0, total: p.keep.length + p.get.length };
        say(st.busy.what);
        render();
        // Not awaited: Firefox asks the reader, and an unanswered prompt would hold the save.
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        try {
          await make(p);
        } catch (err) {
          // Still under the lock, so no other tab saves in between.
          if (!switched) {
            if (name) { try { await caches.delete(name); } catch (e) {} }
            // No worker left behind where nothing is saved, whatever this tab thought.
            try {
              if (!(await readSaved(true)) && reg && reg.scope === ROOT) await reg.unregister();
            } catch (e) {}
          }
          throw err;
        }
      });
    } catch (err) {
      st.error = (had ? "Couldn't update: " : "Couldn't save: ") + why(err) +
        (!switched && had ? ". The saved copy is as it was." : ".");
    }
    st.busy = null;
    say(st.error || (st.saved ? "Saved on this device: v" + st.saved.version : ""));
    render();
    if (switched && had && !st.error) location.reload();
  };

  var remove = async function () {
    if (st.busy) return;
    st.busy = { what: "Removing the saved copy…", done: 0, total: 0 };
    render();
    // Only while the site answers: removed, the copy can't come back until it does.
    await refresh();
    if (!st.up) {
      st.busy = null;
      st.error = LOST;
      say(st.error);
      render();
      return;
    }
    try {
      await lock(async function () {
        var names = await caches.keys();
        for (var i = 0; i < names.length; i++)
          if (names[i].indexOf(PREFIX) === 0) await caches.delete(names[i]);
        var reg = await navigator.serviceWorker.getRegistration(ROOT);
        if (reg && reg.scope === ROOT) await reg.unregister();
      });
      st.saved = null;
      st.files = null;
      st.error = "";
    } catch (err) {
      st.error = "Couldn't remove it: " + why(err) + ".";
    }
    st.busy = null;
    say(st.error || "Removed the saved copy.");
    render();
    // Reloaded from the site, out of the removed worker's hands (WebKit can stall a save there).
    if (!st.error) location.reload();
  };

  // A button: small (Remove) unless cls makes it big (Save, Update).
  var action = function (label, fn, off, cls) {
    var b = el("button", cls || "mdb-offline-act", label);
    b.type = "button";
    b.setAttribute("data-k", label);
    b.disabled = !!off;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    return b;
  };
  // A paragraph of text and links: parts are strings or [text, address].
  var para = function (cls, parts) {
    var p = el("p", cls);
    parts.forEach(function (part) {
      if (typeof part === "string") return p.appendChild(document.createTextNode(part));
      var a = el("a", null, part[0]);
      a.href = part[1];
      a.setAttribute("data-k", part[0]);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      p.appendChild(a);
    });
    return p;
  };

  // The download: a big button, what it's for, its version, size and checksum.
  var download = function (box, c, label, what) {
    if (!c || !c.file) return;
    var a = el("a", "mdb-offline-big", label), sum = el("p", "mdb-offline-sum", "SHA-256 ");
    a.href = key(c.file);
    a.setAttribute("data-k", label);
    a.setAttribute("download", "");
    box.appendChild(a);
    box.appendChild(el("p", "mdb-offline-what", what));
    box.appendChild(el("p", "mdb-offline-note", "v" + st.latest.version + " · " + mb(c.size)));
    sum.appendChild(el("code", null, c.sha256));
    sum.appendChild(document.createTextNode(" · "));
    var s = el("a", null, "checksum file");
    s.href = key(c.file + ".sha256");
    s.setAttribute("data-k", label + " checksum");
    s.setAttribute("download", "");
    sum.appendChild(s);
    box.appendChild(sum);
  };

  // Redrawn only when something changed (a redrawn control is announced again); focus stays.
  var fill = function () {
    var inside = panel.contains(document.activeElement);
    var focus = inside ? document.activeElement.getAttribute("data-k") : null;
    var box = document.createElement("div");
    draw(box);
    if (box.innerHTML === panel.innerHTML) return;
    panel.textContent = "";
    while (box.firstChild) panel.appendChild(box.firstChild);
    if (!inside) return;
    var same = Array.prototype.find.call(panel.querySelectorAll("[data-k]"), function (n) { return n.getAttribute("data-k") === focus; });
    (same || first()).focus();
  };
  // Focus on opening: Save or Update, else the panel (or a lone download); never Remove.
  var first = function () {
    var ok = ':not([data-k="Remove saved copy"]):not(:disabled)';
    return panel.querySelector("button.mdb-offline-big" + ok) ||
      (panel.querySelector(".mdb-offline-sep") ? null : panel.querySelector("[data-k]" + ok)) || panel;
  };
  // The panel's content, into box: saving first, the download under it.
  var draw = function (box) {
    var L = st.latest, S = st.saved, u = update(), panel = box;
    panel.appendChild(el("p", "mdb-offline-title", "Read offline"));
    if (COPY) {
      panel.appendChild(el("p", null, "Downloaded copy " + ver(COPY.version, COPY.built)));
      if (typeof COPY.home === "string" && /^https?:\/\//.test(COPY.home))
        panel.appendChild(para("mdb-offline-note", ["Newer versions: ", [COPY.home, COPY.home]]));
      return;
    }
    var saving = canSave() && !!(S || (L && L.files));
    if (saving && st.busy) {
      panel.appendChild(el("p", null, st.busy.what));
      if (st.busy.total) {
        var bar = el("progress", "mdb-offline-progress");
        bar.setAttribute("aria-label", st.busy.what);
        bar.max = st.busy.total;
        bar.value = st.busy.done;
        panel.appendChild(bar);
        panel.appendChild(el("p", "mdb-offline-note mdb-offline-count", st.busy.done + " of " + st.busy.total + " files"));
      }
    } else if (saving && !S) {
      panel.appendChild(action("Save for offline", save, !st.online, "mdb-offline-big"));
      panel.appendChild(el("p", "mdb-offline-what", "Keeps the book in this browser, to read without a connection."));
      panel.appendChild(el("p", "mdb-offline-note", ver(L.version, L.built) + " · " + mb(total(L.files))));
      // Not in a Home Screen app: it has storage of its own.
      if (!standalone())
        panel.appendChild(el("p", "mdb-offline-note", "On an iPhone or iPad, add the book to your Home Screen first (Share, then Add to Home Screen) and save it from there: a book saved in Safari is deleted after 7 days of browsing without opening it."));
    } else if (saving) {
      panel.appendChild(el("p", null, "Saved on this device: " + ver(S.version, S.built)));
      if (!st.online) panel.appendChild(el("p", "mdb-offline-note", "You're offline: the book comes from this copy."));
      else if (u) {
        var behind = L.version - S.version;
        panel.appendChild(el("p", null, "Latest: " + ver(L.version, L.built) +
          (behind > 0 ? " · " + count(behind, "version", "versions") + " behind" : "")));
        panel.appendChild(el("p", "mdb-offline-note", count(u.changed, "page changed", "pages changed") + ", " +
          u.added + " new, " + u.removed + " removed · " + mb(u.bytes) + " to download"));
      } else if (st.reach === false) panel.appendChild(el("p", "mdb-offline-note", "Couldn't check for a newer version."));
      else if (L && L.files) panel.appendChild(el("p", "mdb-offline-note", "Up to date."));
      if (u && st.online) panel.appendChild(action("Update to v" + L.version, save, false, "mdb-offline-big"));
      var acts = el("div", "mdb-offline-actions");
      if (st.online && st.up) acts.appendChild(action("Remove saved copy", remove));
      if (acts.firstChild) panel.appendChild(acts);
    }
    if (st.error) panel.appendChild(el("p", "mdb-offline-error", st.error));
    // Not while busy: it would move up under the pointer, into a double-click's second click.
    var c = L && L.copies;
    if (!c || !st.online || st.busy) return;
    var d = el("div", saving ? "mdb-offline-dl mdb-offline-sep" : "mdb-offline-dl");
    download(d, c.laptop, "Download a copy", "A copy to keep on any computer, online or air-gapped. Unpack it and open index.html in the folder it makes.");
    if (d.firstChild) panel.appendChild(d);
  };

  var render = function () {
    if (!button) return;
    var L = st.latest, S = st.saved;
    var show = !!COPY || !!S || !!(st.online && L && ((canSave() && L.files) || L.copies));
    // Until the first check answers, the button keeps its place unseen.
    var wait = !show && !st.checked;
    button.hidden = !show && !wait;
    button.classList.toggle("mdb-offline-wait", wait);
    var name = st.busy ? "busy" : S && !COPY ? (st.online ? "saved" : "away") : "save";
    var label = "Read offline" + (COPY ? "" : st.busy ? ": working" : S ? (!st.online ? ": offline, saved copy" : update() ? ": update available" : ": saved") : "");
    if (button.getAttribute("data-icon") !== name) {
      button.textContent = "";
      button.appendChild(icon(name));
      button.setAttribute("data-icon", name);
    }
    button.title = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("mdb-offline-busy", !!st.busy);
    button.classList.toggle("mdb-offline-new", !st.busy && !!S && st.online && !!update());
    if (!show && !panel.hidden) toggle(false);
    if (!panel.hidden) fill();
    stale();
  };

  // A saved copy behind the site: a line before <main> (not in it: LAYOUT splits <main>).
  var line = null;
  var stale = function () {
    var L = st.latest, S = st.saved, main = document.querySelector("#mdbook-content main");
    var on = !COPY && !st.busy && st.online && st.reach === true && !!S && !!L && L.version > S.version && !!update();
    if (!on || !main) {
      if (line && line.parentNode) line.parentNode.removeChild(line);
      return;
    }
    if (!line) line = el("p", "mdb-stale");
    var text = "You're reading your saved copy, v" + S.version + ". v" + L.version + " is out: update it from the ✓ above.";
    if (line.textContent !== text) line.textContent = text;
    if (line.nextSibling !== main) main.parentNode.insertBefore(line, main);
  };

  // Progress, at most once a frame, in place: a redraw would move focus and be announced.
  var queued = false;
  var later = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var bar = panel.querySelector("progress"), count = panel.querySelector(".mdb-offline-count");
      if (!st.busy || !bar || !count) return render();
      bar.value = st.busy.done;
      count.textContent = st.busy.done + " of " + st.busy.total + " files";
    });
  };

  var toggle = function (open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    render();
    if (COPY || st.busy) return;
    // Another tab may have saved, updated or removed the copy.
    if (canSave()) readSaved().then(function (s) { if (!st.busy) { st.saved = s; render(); } });
    if (st.online) refresh();
  };

  var start = async function () {
    var bar = document.getElementById("mdbook-menu-bar");
    var right = bar && bar.querySelector(".right-buttons");
    if (!right) return;
    // Unseen, but in its place, until render() knows whether it shows.
    button = el("button", "icon-button mdb-offline-wait");
    button.id = "mdb-offline-toggle";
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "mdb-offline-panel");
    // Last, a space apart as mdBook's own are: the panel, at the bar's end, opens under it.
    right.append(" ", button);
    // mdb-menu: the sidebar's swipes leave it alone.
    panel = el("div", "mdb-offline-panel mdb-menu");
    panel.id = "mdb-offline-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Read offline");
    panel.tabIndex = -1;
    // Next to its button, so Tab goes from one to the other.
    right.insertBefore(panel, button.nextSibling);
    live = el("span", "mdb-offline-live");
    live.setAttribute("role", "status");
    bar.appendChild(live);
    // Left and right inside the panel stay there: mdBook turns the page on them.
    panel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopPropagation();
    });
    button.addEventListener("click", function (e) {
      toggle(panel.hidden);
      // Opened from the keyboard: into the panel, as mdBook's theme menu does.
      if (e.detail === 0 && !panel.hidden) first().focus();
    });
    // Focus moving on out of the panel closes it, as it does mdBook's theme menu.
    panel.addEventListener("focusout", function (e) {
      var to = e.relatedTarget;
      if (to && !panel.contains(to) && to !== button) toggle(false);
    });
    // A click anywhere else closes it (Safari focuses no clicked button, so focusout won't).
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) toggle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { toggle(false); button.focus(); }
    });
    window.addEventListener("online", function () { st.online = true; refresh(); });
    window.addEventListener("offline", function () { st.online = false; render(); });
    st.checked = !!COPY || !st.online;
    // Drawn at once, unseen, so it's as wide as it will be before anything is read.
    render();
    if (canSave()) st.saved = await readSaved();
    render();
    if (!COPY && st.online) refresh();
    // A copy a cut-short save left goes, unless another tab is saving; nothing saved: all of it.
    if (canSave() && navigator.locks && navigator.locks.request) {
      navigator.locks.request(PREFIX + "lock", { ifAvailable: true }, async function (held) {
        if (!held) return;
        var cur = await readSaved(true);
        if (cur) return sweep(await caches.open(META), cur);
        var names = await caches.keys();
        for (var i = 0; i < names.length; i++)
          if (names[i].indexOf(PREFIX) === 0) await caches.delete(names[i]);
        // And the worker a first save cut short registered.
        var reg = await navigator.serviceWorker.getRegistration(ROOT);
        if (reg && reg.scope === ROOT) await reg.unregister();
      }).catch(function () {});
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
