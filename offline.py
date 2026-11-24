#!/usr/bin/env python3
# Script-owned: bootstrap-mdbook.sh writes it, and a re-run rewrites it.
MODE = "full"
NAME = "docwright"
TITLE = "Docwright"
AUTHOR = "Jake Sully"
DESCRIPTION = "Empowering students with tools of power and productivity"
HOME = "https://jake-47.github.io/docwright/"

# OFFLINE's build step (./build runs it): sw.js always; unless "none", the downloads and version.json.

import base64
import datetime
import hashlib
import html
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
import zlib
from urllib.parse import unquote

# A commit that changes any of these is a version.
SOURCES = ["book.toml", "src", "theme", "custom.css", "custom.js", "version.js",
           "offline.py", "build", ".github/workflows/deploy.yml"]
# The downloads and their checksums, inside the built book.
FOLDER = "offline"
# The deploy stamp: version.js, or its fingerprinted name when mdBook hashes files.
STAMP = re.compile(r"version(-[0-9a-f]{8})?\.js")
FONT_TYPES = {".woff2": "font/woff2"}
# Mask images: the image masthead (src/logo.svg).
MASK_TYPES = {".svg": "image/svg+xml"}


def die(msg):
    sys.stderr.write("offline.py: %s\n" % msg)
    sys.exit(1)


def git(*args):
    """git's output, or None when git or the repository isn't there."""
    try:
        r = subprocess.run(["git"] + list(args), stdout=subprocess.PIPE,
                           stderr=subprocess.DEVNULL, universal_newlines=True)
    except OSError:
        return None
    return r.stdout if r.returncode == 0 else None


def utc(seconds):
    return datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def history():
    """The versions, newest first, as [number, date, commit]."""
    rows = [line.split() for line in (git("log", "--format=%H %ct", "--", *SOURCES) or "").splitlines()]
    rows = [r for r in rows if len(r) == 2]
    return [[len(rows) - i, utc(int(t)), h[:7]] for i, (h, t) in enumerate(rows)]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def write(path, data):
    with open(path, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode("utf-8", "surrogateescape"))


def read_text(path):
    """A file as text, its bytes and line ends kept through write()."""
    with open(path, encoding="utf-8", errors="surrogateescape", newline="") as f:
        return f.read()


def files_of(book, skip):
    """Every file under book, as sorted relative paths, less hidden ones and skip."""
    out = []
    for top, dirs, names in os.walk(book):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in names:
            rel = os.path.relpath(os.path.join(top, name), book).replace(os.sep, "/")
            if not name.startswith(".") and rel not in skip:
                out.append(rel)
    return sorted(out)


def language(book):
    """The book's language, as mdBook's <html lang> has it."""
    with open(os.path.join(book, "index.html"), encoding="utf-8") as f:
        m = re.search(r'<html\b[^>]*\blang="([^"]*)"', f.read(4096))
    return m.group(1) if m else "en"


def stage(book, files, to):
    """A copy of the book's files under to."""
    for rel in files:
        dst = os.path.join(to, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(book, rel), dst)


def mark_copy(where, files, info, commit):
    """The copy's stamp is its version's commit, no tag, so a version's builds match; plus MDB_COPY."""
    names = [rel for rel in files if STAMP.fullmatch(rel)]
    if len(names) != 1:
        die("the built book has no version.js; book.toml's additional-js must list it")
    path = os.path.join(where, names[0])
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for var, value in (("MDB_VERSION", ""), ("MDB_UPDATED", info["built"]), ("MDB_SHA", commit)):
        text = re.sub(r'^var %s = "[^"\n]*";$' % var, lambda m: "var %s = %s;" % (var, json.dumps(value)), text, flags=re.M)
    write(path, text.rstrip("\n") + "\nvar MDB_COPY = %s;\n" % json.dumps(info, sort_keys=True))


def folder_links(where, files):
    """A link to a folder (sub/) as one to its index.html, which a book opened from disk needs."""
    have = set(files)
    link = re.compile(r"""(<a(?:\s[^>]*?)?\shref=)(["'])([^"'#?]*)([#?][^"']*)?\2""", re.I)
    for rel in files:
        if not rel.endswith(".html"):
            continue
        path = os.path.join(where, rel)
        text = read_text(path)
        here = os.path.dirname(rel)

        def fix(m):
            target = m.group(3)
            if not target or re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|/", target):
                return m.group(0)
            folder = os.path.normpath(os.path.join(here, unquote(target))).replace(os.sep, "/")
            index = "index.html" if folder == "." else folder + "/index.html"
            if folder == ".." or folder.startswith("../") or folder in have or index not in have:
                return m.group(0)
            return "%s%s%s%sindex.html%s%s" % (m.group(1), m.group(2), target, "" if target.endswith("/") else "/",
                                              m.group(4) or "", m.group(2))
        new = link.sub(fix, text)
        if new != text:
            write(path, new)


def embed_assets(where, files):
    """Fonts and mask images as data: URIs: from disk, browsers won't load them from files."""
    face = re.compile(r"@font-face\s*\{[^}]*\}", re.I)
    mask = re.compile(r"(?:-webkit-)?mask(?:-image)?\s*:[^;}]*", re.I)
    url = re.compile(r"""url\(\s*(['"]?)([^'")]*)\1\s*\)""", re.I)
    for rel in files:
        if not rel.endswith(".css"):
            continue
        path = os.path.abspath(os.path.join(where, rel))
        css = read_text(path)
        base = os.path.dirname(path)

        def inline(types):
            def one(m):
                target = unquote(m.group(2).strip().split("#")[0].split("?")[0])
                kind = types.get(os.path.splitext(target)[1].lower())
                if not kind or re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|/", target):
                    return m.group(0)
                file = os.path.normpath(os.path.join(base, target))
                if not file.startswith(os.path.join(os.path.abspath(where), "")) or not os.path.isfile(file):
                    return m.group(0)
                with open(file, "rb") as f:
                    return 'url("data:%s;base64,%s")' % (kind, base64.b64encode(f.read()).decode("ascii"))
            return one
        new = face.sub(lambda m: url.sub(inline(FONT_TYPES), m.group(0)), css)
        new = mask.sub(lambda m: url.sub(inline(MASK_TYPES), m.group(0)), new)
        if new != css:
            write(path, new)


def readme(stem, version, built):
    home = ("%s\nOpen it when you're online and use the offline button in the menu bar."
            % HOME) if HOME else "From the site you downloaded this from."
    return """%s
Downloaded copy v%d, built %s

To read it, open index.html in this folder with any web browser. It needs no
connection.

To check the download: next to it, the site shows its SHA-256 checksum and
offers a checksum file. Save that file in the folder with the download, then:
  Linux:    sha256sum -c %s.zip.sha256
  macOS:    shasum -a 256 -c %s.zip.sha256
            (if Safari unpacked the download, it moved the original to
            the Trash: put it back first)
  Windows:  certutil -hashfile %s.zip SHA256
            (it prints the checksum: compare it with the one in
            %s.zip.sha256)
"OK" means the download is intact.

Newer versions:
%s
""" % (TITLE, version, built[:10], stem, stem, stem, stem, home)


def first_chapter(book, files):
    """The chapter index.html copies, if any (the same but for ../ before its links)."""
    if "index.html" not in files:
        return None
    with open(os.path.join(book, "index.html"), "rb") as f:
        index = f.read()
    title = re.search(rb"<title>.*?</title>", index, re.S)
    flat = index.replace(b"../", b"")
    for rel in files:
        if not rel.endswith(".html") or rel in ("index.html", "print.html", "404.html", "toc.html"):
            continue
        with open(os.path.join(book, rel), "rb") as f:
            head = f.read(8192)
            if title and title.group(0) not in head:
                continue
            data = head + f.read()
        if data.replace(b"../", b"") == flat:
            return rel
    return None


def write_zip(where, files, dest, top):
    """The same files give the same bytes: sorted, one fixed date, fixed modes."""
    tmp = dest + ".part"
    with zipfile.ZipFile(tmp, "w") as z:
        for rel in sorted(files):
            info = zipfile.ZipInfo(top + "/" + rel, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o644 << 16
            with open(os.path.join(where, rel), "rb") as f:
                z.writestr(info, f.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.replace(tmp, dest)

# The phone copy: an archive in openZIM's format, for the Kiwix app, written here with the
# standard library: major version 6, minor 1 (every file in namespace C), no full-text index.
ZIM_MIME = {".html": "text/html", ".htm": "text/html", ".css": "text/css", ".js": "application/javascript",
            ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
            ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
            ".otf": "font/otf", ".txt": "text/plain", ".xml": "application/xml", ".pdf": "application/pdf",
            ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".webm": "video/webm",
            ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4"}
# Compressed with xz in their clusters; the rest (pictures, fonts, media) are stored as they are.
ZIM_PACK = {"application/javascript", "application/json", "image/svg+xml", "application/xml",
            "application/manifest+json", "application/octet-stream+zimlisting"}
ZIM_LISTING = "listing/titleOrdered/v1"
# Kiwix takes ISO 639-3; mdBook's <html lang> gives ISO 639-1.
LANG3 = {"ar": "ara", "bn": "ben", "cs": "ces", "da": "dan", "de": "deu", "el": "ell", "en": "eng",
         "es": "spa", "fa": "fas", "fi": "fin", "fr": "fra", "he": "heb", "hi": "hin", "hu": "hun",
         "id": "ind", "it": "ita", "ja": "jpn", "kn": "kan", "ko": "kor", "ml": "mal", "mr": "mar",
         "nl": "nld", "no": "nor", "pl": "pol", "pt": "por", "ro": "ron", "ru": "rus", "sv": "swe",
         "ta": "tam", "te": "tel", "th": "tha", "tr": "tur", "uk": "ukr", "ur": "urd", "vi": "vie",
         "zh": "zho"}


def png_tile(n, ground, edge):
    """A square PNG of n pixels: ground, with a one-pixel edge: the phone copy's icon in Kiwix."""
    rows = b"".join(b"\0" + b"".join(bytes(edge if x in (0, n - 1) or y in (0, n - 1) else ground)
                                     for x in range(n)) for y in range(n))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def page_title(data):
    """A page's <title>, less mdBook's \" - TITLE\": what Kiwix lists it by."""
    m = re.search(rb"<title>(.*?)</title>", data, re.S)
    if not m:
        return ""
    t = html.unescape(m.group(1).decode("utf-8", "replace")).strip()
    end = " - " + TITLE
    return t[:-len(end)].strip() if t.endswith(end) and len(t) > len(end) else t


def zim_cluster(blobs, pack):
    """One cluster: its blobs' offsets, then the blobs, xz-compressed (4) or as they are (1)."""
    offsets, at = [], 4 * (len(blobs) + 1)
    for b in blobs:
        offsets.append(at)
        at += len(b)
    offsets.append(at)
    raw = struct.pack("<%dI" % len(offsets), *offsets) + b"".join(blobs)
    if not pack:
        return b"\x01" + raw
    # Here, not at the top: a Python built without xz then fails only at the phone copy.
    import lzma
    return b"\x04" + lzma.compress(raw, preset=9)


def write_zim(where, files, dest, built, first):
    """The phone copy: the same files give the same bytes. Each file is read as its cluster is
    made, and the clusters go to disk as they're made, so the book is never held in memory."""
    # Each entry: [namespace, path, title, mime type (None for a redirect), file or bytes,
    # redirect target, in Kiwix's suggestions].
    items = []
    for rel in files:
        # 404.html's <base href> points at the site; index.html is the first chapter again.
        if rel == "404.html":
            continue
        if rel == "index.html" and first:
            items.append(["C", rel, "", None, None, ("C", first), False])
            continue
        path = os.path.join(where, rel)
        ext = os.path.splitext(rel)[1].lower()
        title, front = "", False
        if ext in (".html", ".htm"):
            with open(path, "rb") as f:
                head = f.read(8192)
            title = page_title(head)
            # Suggested as a reader types: the pages, less print, toc, unlisted and redirect pages.
            front = (rel not in ("print.html", "toc.html") and not re.search(r"(^|/)unlisted/", rel)
                     and not re.search(rb"<meta[^>]+http-equiv=[\"']?refresh", head[:2048], re.I))
        items.append(["C", rel, title, ZIM_MIME.get(ext, "application/octet-stream"), path, None, front])
    items.append(["W", "mainPage", "", None, None, ("C", first or "index.html"), False])
    # How many files of each type: Kiwix's library won't take an archive without it.
    kinds = {}
    for e in items:
        if e[0] == "C" and e[3]:
            kinds[e[3]] = kinds.get(e[3], 0) + 1
    who = AUTHOR or TITLE
    meta = [("Name", NAME), ("Title", TITLE[:30]), ("Language", LANG3.get(language(where).split("-")[0].lower(), "eng")),
            ("Creator", who), ("Publisher", who), ("Date", built[:10]), ("Description", (DESCRIPTION or TITLE)[:80]),
            ("Source", HOME), ("Counter", ";".join("%s=%d" % k for k in sorted(kinds.items())))]
    for key, value in meta:
        if value:
            items.append(["M", key, "", "text/plain", value.encode("utf-8"), None, False])
    items.append(["M", "Illustration_48x48@1", "", "image/png", png_tile(48, (0x11, 0x11, 0x11), (0x42, 0x42, 0x3c)), None, False])
    items.append(["X", ZIM_LISTING, "", "application/octet-stream+zimlisting", b"", None, False])
    items.sort(key=lambda e: (e[0], e[1].encode("utf-8")))
    index = {(e[0], e[1]): i for i, e in enumerate(items)}
    fronts = sorted((i for i, e in enumerate(items) if e[6]), key=lambda i: ((items[i][2] or items[i][1]).encode("utf-8"), i))
    items[index[("X", ZIM_LISTING)]][4] = struct.pack("<%dI" % len(fronts), *fronts)

    def data(e):
        if isinstance(e[4], bytes):
            return e[4]
        with open(e[4], "rb") as f:
            return f.read()

    # The clusters, to a file beside dest: their sizes and order are all the rest needs.
    part = dest + ".clusters"
    sizes, place, waiting, held, ident = [], {}, {True: [], False: []}, {True: 0, False: 0}, hashlib.sha256()
    with open(part, "wb") as out:
        def flush(pack):
            if waiting[pack]:
                for blob, i in enumerate(waiting[pack]):
                    place[i] = (len(sizes), blob)
                cluster = zim_cluster([data(items[i]) for i in waiting[pack]], pack)
                out.write(cluster)
                ident.update(cluster)
                sizes.append(len(cluster))
                waiting[pack], held[pack] = [], 0
        for i, e in enumerate(items):
            if e[3] is None:
                continue
            pack = e[3].startswith("text/") or e[3] in ZIM_PACK
            waiting[pack].append(i)
            held[pack] += os.path.getsize(e[4]) if isinstance(e[4], str) else len(e[4])
            if held[pack] >= 1 << 20:
                flush(pack)
        flush(True)
        flush(False)

    mimes = sorted({e[3] for e in items if e[3]})
    dirents = []
    for i, e in enumerate(items):
        tail = e[1].encode("utf-8") + b"\0" + (e[2].encode("utf-8") if e[2] != e[1] else b"") + b"\0"
        if e[3] is None:
            dirents.append(struct.pack("<HBcII", 0xffff, 0, e[0].encode(), 0, index[e[5]]) + tail)
        else:
            dirents.append(struct.pack("<HBcIII", mimes.index(e[3]), 0, e[0].encode(), 0, *place[i]) + tail)
    mime_list = b"".join(m.encode("ascii") + b"\0" for m in mimes) + b"\0"
    n, c = len(items), len(sizes)
    path_at = 80 + len(mime_list)
    title_at = path_at + 8 * n
    at = title_at + 4 * n
    path_ptrs = []
    for d in dirents:
        path_ptrs.append(at)
        at += len(d)
    cluster_ptrs_at = at
    at += 8 * c
    cluster_ptrs = []
    for size in sizes:
        cluster_ptrs.append(at)
        at += size
    titles = sorted(range(n), key=lambda i: (items[i][0], (items[i][2] or items[i][1]).encode("utf-8"), i))
    lists = (mime_list + struct.pack("<%dQ" % n, *path_ptrs) + struct.pack("<%dI" % n, *titles) + b"".join(dirents)
             + struct.pack("<%dQ" % c, *cluster_ptrs))
    # Its ID from what it holds: the same book, the same ID.
    ident.update(lists)
    header = struct.pack("<IHH16sIIQQQQIIQ", 72173914, 6, 1, ident.digest()[:16], n, c, path_at, title_at,
                         cluster_ptrs_at, 80, index[("W", "mainPage")], 0xffffffff, at)
    tmp, check = dest + ".part", hashlib.md5()
    try:
        with open(tmp, "wb") as out, open(part, "rb") as clusters:
            block = header + lists
            while block:
                out.write(block)
                check.update(block)
                block = clusters.read(1 << 20)
            out.write(check.digest())
        os.replace(tmp, dest)
    finally:
        os.remove(part)



def copies(book, files, version, built, commit, first):
    """The downloads in offline/: the computer's and the phone's, each with a .sha256 file."""
    stem = "%s-v%d" % (NAME, version)
    work = tempfile.mkdtemp(prefix=".offline-", dir=book)
    try:
        laptop = os.path.join(work, "laptop")
        stage(book, files, laptop)
        mark_copy(laptop, files, {"kind": "laptop", "version": version, "built": built, "home": HOME}, commit)
        folder_links(laptop, files)
        embed_assets(laptop, files)
        write(os.path.join(laptop, "README.txt"), readme(stem, version, built))
        write_zip(laptop, sorted(set(files + ["README.txt"])), os.path.join(book, FOLDER, stem + ".zip"), stem)
        phone = os.path.join(work, "phone")
        stage(book, files, phone)
        mark_copy(phone, files, {"kind": "phone", "version": version, "built": built, "home": HOME}, commit)
        folder_links(phone, files)
        write_zim(phone, files, os.path.join(book, FOLDER, stem + ".zim"), built, first)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    out = {}
    for kind, name in (("laptop", stem + ".zip"), ("phone", stem + ".zim")):
        path = os.path.join(book, FOLDER, name)
        digest = sha256(path)
        write(path + ".sha256", "%s  %s\n" % (digest, name))
        out[kind] = {"file": FOLDER + "/" + name, "size": os.path.getsize(path), "sha256": digest}
    return out


def size(n):
    return "%.1f MB" % (n / 1e6) if n >= 1e5 else "%d KB" % max(1, round(n / 1e3))


def main(argv):
    if len(argv) != 2:
        die("usage: python3 -I offline.py BOOK_DIR")
    book = argv[1].rstrip("/") or "/"
    if MODE not in ("none", "download", "full"):
        die('MODE must be "none", "download" or "full", got: %r' % MODE)
    if not os.path.isdir(book):
        die("%s is missing: build the book first" % book)
    write(os.path.join(book, "sw.js"), SW_FULL if MODE == "full" else SW_CLEANUP)
    if MODE == "none":
        return 0
    if not os.path.isfile(os.path.join(book, "index.html")):
        die("%s/index.html is missing: the download needs a book with at least one chapter" % book)
    # A version's date and commit are its own commit's, whatever came after it.
    versions = history()
    if versions:
        version, built, commit = versions[0]
    else:
        print("offline: no commit yet, so this build is v0")
        version, built, commit = 0, utc(int(datetime.datetime.now().timestamp())), ""
    if os.path.exists(os.path.join(book, FOLDER)) and not os.path.isdir(os.path.join(book, FOLDER)):
        die("%s/%s is a file, and the download needs that name for its folder: rename src/%s" % (book, FOLDER, FOLDER))
    os.makedirs(os.path.join(book, FOLDER), exist_ok=True)
    if MODE == "full":
        manifest = {"name": TITLE, "lang": language(book), "start_url": "./", "scope": "./",
                    "display": "standalone"}
        # The favicon, an SVG drawn at any size, is the app's icon.
        if os.path.isfile(os.path.join(book, "favicon.svg")):
            manifest["icons"] = [{"src": "favicon.svg", "sizes": "any", "type": "image/svg+xml"}]
        if DESCRIPTION:
            manifest["description"] = DESCRIPTION
        write(os.path.join(book, "manifest.webmanifest"),
              json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    stem = "%s-v%d" % (NAME, version)
    skip = {"sw.js", "version.json"} | {"%s/%s%s" % (FOLDER, stem, ext) for ext in (".zip", ".zip.sha256", ".zim", ".zim.sha256")}
    files = files_of(book, skip)
    first = first_chapter(book, files)
    info = {"version": version, "built": built, "copies": copies(book, files, version, built, commit, first)}
    if MODE == "full":
        # [size, SHA-256], then 2 for index.html copying the first chapter.
        listed = {}
        for rel in files:
            path = os.path.join(book, rel)
            listed[rel] = [os.path.getsize(path), sha256(path)]
        if first:
            listed["index.html"].append(2)
        # The stamp changes with every commit; the book doesn't.
        info["fingerprint"] = hashlib.sha256("".join(
            "%s %s\n" % (rel, listed[rel][1]) for rel in files if not STAMP.fullmatch(rel)
        ).encode("utf-8")).hexdigest()
        info["files"] = listed
    write(os.path.join(book, "version.json"),
          json.dumps(info, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    c = info["copies"]
    print("offline: v%d; air-gapped laptop's copy %s, phone's copy %s%s"
          % (version, size(c["laptop"]["size"]), size(c["phone"]["size"]),
             "; %d files to save, %s" % (len(files), size(sum(v[0] for v in info["files"].values())))
             if MODE == "full" else ""))
    return 0


# Outside "full": deletes a copy a reader saved before, then itself, and reloads open pages.
SW_CLEANUP = r"""// Written by offline.py (OFFLINE "none" or "download"): deletes the copy a
// reader saved while the book was "full", unregisters, and reloads open pages.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var prefix = "mdb-offline " + new URL("./", self.location).pathname + " ";
    var names = await caches.keys();
    for (var i = 0; i < names.length; i++)
      if (names[i].indexOf(prefix) === 0) await caches.delete(names[i]);
    await self.registration.unregister();
    var open = await self.clients.matchAll({ type: "window" });
    for (var j = 0; j < open.length; j++) open[j].navigate(open[j].url).catch(function () {});
  })());
});
"""

# OFFLINE "full": serves every page of the book from the saved copy, online or offline.
SW_FULL = r"""// Written by offline.py (OFFLINE "full"). Registered when a reader saves the
// book; serves the saved copy (custom.js saves and updates it).
"use strict";
var ROOT = new URL("./", self.location).href;
// Copies are named by the book's path: github.io sites share one origin.
var PREFIX = "mdb-offline " + new URL(ROOT).pathname + " ";
var META = PREFIX + "meta";
var CURRENT = ROOT + "__mdb-offline/current";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

// The saved copy, or null; read on every request: an update switches it with one write.
async function current() {
  if (!(await caches.has(META))) return null;
  var r = await (await caches.open(META)).match(CURRENT);
  if (!r) return null;
  var cur = null;
  try { cur = await r.json(); } catch (e) { return null; }
  return cur && cur.cache && (await caches.has(cur.cache)) ? cur : null;
}

// The copy's file for an address: the file, a folder's index.html, or a page without .html.
async function lookup(cache, address) {
  var u = new URL(address);
  u.search = "";
  u.hash = "";
  if (u.href.indexOf(ROOT) !== 0) return null;
  var rel = u.href.slice(ROOT.length);
  var names = rel === "" || rel.slice(-1) === "/" ? [rel + "index.html"]
    : /\.[^\/]*$/.test(rel) ? [rel] : [rel, rel + ".html", rel + "/index.html"];
  for (var i = 0; i < names.length; i++) {
    var hit = await cache.match(ROOT + names[i]);
    if (hit) return i === 2 ? Response.redirect(u.href + "/", 301) : hit;
  }
  return null;
}

async function answer(e) {
  var req = e.request;
  var cur = await current();
  if (!cur) return fetch(req);
  var cache = await caches.open(cur.cache);
  if (req.mode === "navigate") {
    var page = await lookup(cache, req.url);
    if (page) return page;
    // Not a page of the copy: the network, else the copy's 404 page.
    try {
      return await fetch(req);
    } catch (err) {
      var missing = await cache.match(ROOT + "404.html");
      if (!missing) throw err;
      return new Response(await missing.blob(), { status: 404, statusText: "Not Found", headers: missing.headers });
    }
  }
  // A page that came from the copy gets everything else from it too.
  var client = e.clientId ? await self.clients.get(e.clientId) : null;
  if (client && (await lookup(cache, client.url))) {
    var hit = await lookup(cache, req.url);
    if (hit) return part(req, hit);
  }
  return fetch(req);
}

// The byte range a player asks for (iOS plays media by ranges); anything else, the whole file.
async function part(req, res) {
  var m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.get("Range") || "").trim());
  if (res.status !== 200 || !m || (m[1] === "" && m[2] === "") || (m[1] !== "" && m[2] !== "" && +m[2] < +m[1])) return res;
  var body = await res.blob(), n = body.size;
  var a = m[1] === "" ? Math.max(0, n - +m[2]) : +m[1];
  var b = m[1] === "" || m[2] === "" ? n - 1 : Math.min(+m[2], n - 1);
  var h = new Headers(res.headers);
  if (a > b) {
    h.set("Content-Range", "bytes */" + n);
    return new Response(null, { status: 416, statusText: "Range Not Satisfiable", headers: h });
  }
  h.set("Content-Range", "bytes " + a + "-" + b + "/" + n);
  h.set("Content-Length", String(b - a + 1));
  return new Response(body.slice(a, b + 1), { status: 206, statusText: "Partial Content", headers: h });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || req.url.indexOf(ROOT) !== 0) return;
  // Saving and updating fetch with no-store, from the network.
  if (req.cache === "no-store") return;
  var rel = req.url.slice(ROOT.length).split(/[?#]/)[0];
  if (rel === "sw.js" || rel === "version.json") return;
  // If the saved copy can't be read at all, the site.
  e.respondWith(answer(e).catch(function () { return fetch(req); }));
});
"""

if __name__ == "__main__":
    sys.exit(main(sys.argv))
