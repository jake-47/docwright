# Stopwatch pomodoro tracker

Track the time you work. Use another app or the `sw` stopwatch+pomodoro script below. If you can’t measure it, you can’t improve it.

## The one idea

`sw` is an instrument of self-honesty, and everything below follows from that.

It measures one thing with total accuracy: the wall-clock span between the keypress that starts a session and the keypress that stops it.
Not the time you were at the keyboard, not the time you were "productive," just clock time from start to stop.
That makes it good for exactly one job, seeing where your hours actually go, and useless for any job that needs the number to mean something to someone other than you.
The three warnings at the end are not separate rules; they are one rule, that a log built on self-honesty survives only when no one with power over you reads it, you do not turn it into a stick to beat yourself with, and you are not hiding from what it shows.

## What it does

Three modes, one log.

- A **stopwatch** that counts up from zero until you stop it (`sw`, the default).
- A **pomodoro** that counts a fixed focus block down, then runs a break (`sw pomo`).
- A **work log** that every finished session writes to, which the reporting commands read back.

Each finished session is one row: the date, the clock time you stopped, the duration, and an optional tag.
The reports are just arithmetic over those rows.

## Driving it

Start the stopwatch, optionally tagged:

```bash
sw                 # untagged
sw deep work       # tagged: deep-work
```

Press **Enter** to stop and log the session.
Press **Ctrl+C** to throw it away and log nothing.

Run a pomodoro:

```bash
sw pomo deep work
```

It shows a live countdown, logs the block when it completes, then starts a break.
Enter during the work phase stops early and logs the partial session; Enter during the break skips the break.
Ctrl+C during the break only ends the break, because the block before it is already logged.

Record or fix sessions by hand:

```bash
sw add 1h30m deep work   # log a session that ended now
sw amend 45m             # rewrite the last session's duration
sw sub 10m               # reduce the last session (bare `sw sub` removes it)
```

Run `sw help` for the rest: `sum`, `last`, `regen`, the clears, and `sound`.

## Why a closed lid still counts

Because `sw` measures wall-clock, it keeps counting while the machine is suspended, the lid is shut, or the screen has blanked.
Close the lid for ten minutes mid-session and those ten minutes land in the log.

This is deliberate, and usually right.
A blank screen is not proof you stopped working: you might be reading on paper, thinking, or on a call, and that is real work the keyboard never saw.
But it cuts both ways, and that is the whole discipline the tool asks of you.
The same property that correctly counts your offline thinking also counts the lunch you walked away from without stopping the timer.
`sw` cannot tell the two apart, so the one habit it requires is simple: stop it when you actually stop.

For pomodoros specifically, a suspend counts toward the focus block, and a completed pomodoro logs its set length, so a nap mid-session does not inflate the logged focus.

## What a crash costs

The boundary is clean, so you can trust the history.

Everything already logged is on disk and safe no matter how the machine dies.
A clean logout, a closed terminal, or a `kill` commits the session you are in the middle of before exiting.
**Ctrl+C** discards the in-progress session on purpose.
Only a hard power loss or a forced kill (`SIGKILL`) loses anything, and the most it can ever take is the single session you were running, never the log behind it.
If a finished session can't be saved, say because the disk is full, `sw` tells you why and prints the `sw add` command that puts it back.

## Use it as a calibration, not a regime

The point of `sw` is not a number that goes up.
People are bad at estimating where their hours go, so the tool earns its keep by correcting that estimate.
Run it honestly for a week or two, find out where the time actually went, adjust, and then you can put it down.
Treating it as a permanent scoreboard is how a measurement turns into the two failure modes below.

## Who it is not for

### Not for employers, and not for any audience with power over you

The moment the log flows to someone who can reward or punish you by it, it stops being a measurement.
This is Goodhart's law: when a measure becomes a target, it stops measuring anything.
Mandated self-tracking produces padding, presenteeism, and clock theater, and the number drifts away from the work it was meant to reflect.
`sw` only works pointed at yourself, because only then do you have a reason to be honest with it.

### Not as a whip, for the flow worker or the obsessive

For deep, absorbed work, the stopwatch is the wrong instrument.
Starting and stopping it breaks the absorption, and you forget it anyway, so it under-measures the work you most care about; keep it for fragmented and administrative time, not deep sessions.
And if you are already prone to optimising yourself, watch the opposite failure: you will not forget the stopwatch, you will micromanage it until it becomes a compulsion and a way to punish yourself.
That is Goodhart's law again, aimed inward, the same failure as the employer case turned on yourself.
The number is an approximate proxy for attention, not a score; treat it as one.

### Not for what you are afraid to see

The tool runs on honesty, so it fails the instant part of you dreads the result.
If you are scared of what the log will show, you will skip sessions, round the duration down, or quietly stop tracking, and the log becomes a source of shame instead of information.
The audience you fear here can be an employer or your own inner critic, and the failure is the same either way.
Track what you actually want to understand, not what you are bracing to be judged for.

## A couple of edges worth knowing

- A session is logged against the day you **stop** it, so a timer left running across midnight lands wholly on the new day. If you split your days at midnight and the boundary matters, stop the session before midnight and start a fresh one after.
- A session shorter than a minute isn't logged, because it's almost always an accidental start. `sw add` and `sw amend` refuse anything under a minute for the same reason.
- `wlog.md` shows each session as a start–end range, worked back from the time you stopped it and rounded to the minute. A pomodoro that finishes while the machine is asleep is stamped when it wakes, so its range ends at wake-up rather than when the block actually finished.
- `sw` needs a real terminal for its timers; with no readable `/dev/tty` it refuses to start.
- You can fix the raw log by hand: one session per line, with the date, the time you stopped, the seconds, and a one-word tag. `sw regen` names any line it can't read, and that line stays out of the totals until you fix it.

## Installing

Deploy through your `install_scripts`, mapping the source file to the command name `sw`.
The script then lives at `~/.local/bin/sw`.
It is a Python 3 script that uses only the standard library, so there is nothing else to install.
Settings (daily target, working days per week, pomodoro work and break minutes) and the readable log live in `wlog.md`; the settings at its top are what you edit to change configuration, not the script.
The raw log, `~/.stopwatch_log`, is the source of truth; `sw regen` rebuilds `wlog.md` from it.

## The script

````python3
#!/usr/bin/python3
# sw, v30
#
# Stopwatch, pomodoro, and work log.
#
# Subcommands (run `sw help` for details):
#   sw [tag]                   run the stopwatch (default)
#   sw pomo [tag]              pomodoro timer
#   sw break [mins]            standalone break timer
#   sw sum                     today's total + work-length session count
#   sw last                    print the last logged session
#   sw add DURATION [tag]      record a session ending now
#   sw amend DURATION          rewrite the last entry's duration
#   sw sub [DURATION]          reduce the last entry, or remove it (no arg)
#   sw clear [-y]              wipe the raw log
#   sw clear-before DATE [-y]  delete entries before DATE
#   sw regen                   rebuild wlog.md from the raw log
#   sw sound                   test the alert sounds
#   sw help / version
#
# Python 3, standard library only.

import datetime
import fcntl
import locale
import os
import re
import select
import shutil
import signal
import subprocess
import sys
import tempfile
import termios
import time

# ---- defaults (used only when wlog.md lacks the corresponding config key) ----

DEFAULT_DAILY_TARGET = 8
DEFAULT_WORKING_DAYS = 5
DEFAULT_WORK_MINS = 25
DEFAULT_BREAK_MINS = 5

# Freedesktop stereo sounds. Override via env, or by editing these paths.
DEFAULT_SOUND_SESSION_END = "/usr/share/sounds/freedesktop/stereo/message.oga"
DEFAULT_SOUND_BREAK_END = "/usr/share/sounds/freedesktop/stereo/complete.oga"


class Config:
    daily_target = DEFAULT_DAILY_TARGET
    working_days = DEFAULT_WORKING_DAYS
    work_mins = DEFAULT_WORK_MINS
    break_mins = DEFAULT_BREAK_MINS


CFG = Config()

# Set by _init_paths() from the environment.
RAW_LOG = MD_LOG = LOCK_DIR = LOCK_FILE = ""
SOUND_SESSION_END = SOUND_BREAK_END = ""
LOCK_DIR_IS_FALLBACK = False

HELP_TEXT = r"""sw — stopwatch + pomodoro + work log

Usage
  sw [tag]                       stopwatch (default); live elapsed timer,
                                 Enter stops & logs, Ctrl+C cancels
  sw pomo [tag]                  pomodoro timer (live countdown, then a break)
  sw break [MINUTES]             standalone break timer (default = break mins)
  sw sum                         today's total + work-length session count
  sw last                        print the last logged session
  sw add DURATION [tag]          record a session of DURATION ending now
  sw amend DURATION              rewrite the last entry's duration
  sw sub [DURATION]              reduce the last entry by DURATION, or remove it
  sw clear [-y]                  wipe the raw log (dry-run without -y)
  sw clear-before DATE [-y]      delete entries before DATE (dry-run without -y)
  sw regen                       rebuild wlog.md from the raw log
  sw sound                       play both sounds for volume/preview check
  sw help                        print this help
  sw version                     print identity string

  --help, -h, --version are accepted as aliases.

Stopping and logging
  The stopwatch and the pomodoro share one live timer and log to the same
  place, so the day's total accrues whichever you run. Enter stops and logs
  (for the pomodoro work timer, the partial session); a pomodoro also logs on
  its own when the countdown completes. Ctrl+C cancels with nothing logged.
  A logout, a terminal close, or `kill` (SIGHUP/SIGTERM) commits the running
  session before exiting rather than dropping it; only Ctrl+C discards.
  Ctrl+C during a pomodoro's break only ends the break: the pomodoro before
  it is already logged. If a finished session can't be saved, sw says why
  and prints the `sw add` command that restores it.
  A session under a minute isn't logged: it's almost always an accidental
  start. For the same reason `sw add` and `sw amend` refuse durations under
  1m, `sw sub` won't leave an entry under 1m, and rows under a minute already
  in the raw log are left out of every total.

Pomodoro flow
  Work timer counts down → session-end chime → break timer counts down →
  break-end chime + desktop notification. Enter skips the break early.

DURATION accepts: 90m, 1h, 1h30m, 5400s, or a bare integer (= minutes).
DATE accepts: YYYY-MM-DD (e.g. 2026-05-12) or YYYYMMDD (e.g. 20260512).

Tag: a single positional, joined with `-` if multi-word.
  sw                             untagged stopwatch
  sw theology                    tagged: theology
  sw deep work                   tagged: deep-work
  sw pomo deep work              pomodoro, tagged: deep-work
  sw -- break                    `--` ends subcommand matching: stopwatch
                                 tagged `break` (for tags that collide with
                                 subcommand names)
  Tag words can't begin with `-`: a mistyped flag dies instead of being
  silently logged as tag text.
  Renaming a tag: change the tag field (the last column) directly in the raw
  log ~/.stopwatch_log, which is the source of truth, not in wlog.md (a
  generated view that gets overwritten on the next rebuild). Refresh as
  elsewhere: `sw regen`, or just let the next logged session rebuild wlog.md.
  A tag can't contain spaces.

Files (defaults; override with environment variables)
  ~/.stopwatch_log               raw log, one session per line: date, HH:MM
                                 (when it ended), seconds, tag, separated by
                                 tabs or spaces; `sw regen` names any line it
                                 can't read
                                 override: SW_RAW_LOG
  ~/Documents/mv/wlog.md         readable summary, each session shown as
                                 start–end and rounded to the minute; rebuilt
                                 on every change (or on demand with `sw regen`
                                 after a hand-edit)
                                 override: SW_MD_LOG

Config (in wlog.md, above the `# log` line; seeded on first run inside a code
fence, which is optional; missing keys use defaults; a line whose value can't
be read is a hard error, not a silent fallback, so trailing notes after a
value break it):
  Daily target: 8h               default 8; integer >= 1; `h` suffix optional
  Working days per week: 5       default 5; integer 1-7
  Pomodoro work: 25m             default 25; integer minutes >= 1; `m` optional
  Pomodoro break: 5m             default 5; integer minutes >= 1; `m` optional

Sounds (override with SW_SOUND_SESSION_END / SW_SOUND_BREAK_END, or edit the paths):
  Pomo session-end: message.oga  short chime when a pomodoro work timer completes
  Break-end: complete.oga        longer chime + desktop notification when any
                                 break ends (pomodoro break or standalone `sw break`)

Concurrency
  Mutating ops (session commit, add, amend, sub, clear, clear-before, regen)
  acquire an exclusive flock on ${XDG_RUNTIME_DIR:-$HOME/.cache}/sw-${UID}.lock
  so two parallel invocations can't corrupt the log or wlog.md. Read-only ops
  (last, sum, help, break, dry-run clears) don't lock.

Drawbacks
  - The timer must be started and stopped manually. If you forget:
    `sw add 90m tag`              for a missed session that ended around now
    `sw amend 1h30m`              to fix the last entry's duration
    `sw sub 20m` / `sw sub`       to trim the last entry, or drop it entirely
    Anything else: edit the raw log directly, then `sw regen`
    (format: date<TAB>HH:MM<TAB>seconds<TAB>tag).
  - `sw amend` and `sw sub` change the duration but keep the logged end time,
    so in wlog.md it's the start that moves. After a forgotten stop, fix the
    HH:MM in the raw log as well if you want the range to be right.
"""

# ---- output ----


def _write(stream, text):
    # Terminal output is best effort: after a logout the terminal is gone, and
    # a session being committed on SIGHUP must still reach the log.
    if stream is None:
        return
    try:
        stream.write(text)
        stream.flush()
    except (OSError, ValueError):
        pass


def say(msg=""):
    _write(sys.stdout, msg + "\n")


def warn(msg):
    _write(sys.stderr, msg + "\n")


def die(msg):
    warn(msg)
    sys.exit(1)


# ---- formatting (integer division truncates toward zero) ----


def _tdiv(a, b):
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


def _tmod(a, b):
    return a - b * _tdiv(a, b)


# Whole minutes, half a minute rounding up. Applied once to each session when
# the log is read, and every figure sums the results, so a day's sessions add
# up to its total and the terminal agrees with wlog.md.
def round_mins(secs):
    return (secs + 30) // 60


# The reports' one duration format. Zero-padded minutes keep columns aligned,
# and the h/m units keep a duration from reading as a clock time.
def fmt_mins(m):
    return "%dh %02dm" % (m // 60, m % 60)


# The same format to the second, for what the reports don't round: a duration
# the user typed (`sw sub 90s`) and a raw row too short to count.
def fmt_secs(s):
    m, sec = divmod(s, 60)
    return fmt_mins(m) + (" %02ds" % sec if sec else "")


# Clock for the live timer line: MM:SS under an hour, H:MM:SS at or above one.
def fmt_clock(s):
    if s >= 3600:
        return "%d:%02d:%02d" % (_tdiv(s, 3600), _tdiv(_tmod(s, 3600), 60), _tmod(s, 60))
    return "%02d:%02d" % (_tdiv(s, 60), _tmod(s, 60))


# ---- argument parsing ----

_DUR_HM = re.compile(r"([0-9]+)h([0-9]+)m?")
_DUR_ONE = re.compile(r"([0-9]+)([hms])")
_DIGITS = re.compile(r"[0-9]+")


# Seconds for 90m, 1h, 1h30m, 5400s, or a bare integer (minutes); None if the
# text isn't one of those or comes to zero.
def parse_duration(d):
    m = _DUR_HM.fullmatch(d)
    if m:
        total = int(m.group(1)) * 3600 + int(m.group(2)) * 60
    else:
        m = _DUR_ONE.fullmatch(d)
        if m:
            total = int(m.group(1)) * {"h": 3600, "m": 60, "s": 1}[m.group(2)]
        elif _DIGITS.fullmatch(d):
            total = int(d) * 60
        else:
            return None
    return total if total > 0 else None


# YYYY-MM-DD or YYYYMMDD to YYYY-MM-DD; None for other shapes or impossible
# dates such as 2026-02-30.
def normalize_date(d):
    if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", d):
        n = d
    elif re.fullmatch(r"[0-9]{8}", d):
        n = "%s-%s-%s" % (d[0:4], d[4:6], d[6:8])
    else:
        return None
    try:
        datetime.date(int(n[0:4]), int(n[5:7]), int(n[8:10]))
    except ValueError:
        return None
    return n


# Joins the words with `-` (runs of whitespace and dashes collapse to one) and
# returns `-`, the in-band "no tag" marker, when nothing is left. A leading `--`
# is consumed; any other word starting with `-` is fatal, so a mistyped flag
# dies loudly instead of being committed to the log as tag text.
def args_to_tag(args):
    if args and args[0] == "--":
        args = args[1:]
    for a in args:
        if a.startswith("-"):
            die("unknown flag: %s (tag words can't start with '-'; try sw help)" % a)
    tag = "-"
    if args:
        t = re.sub(r"[ \t\n\v\f\r]", "-", " ".join(args))
        t = re.sub(r"-{2,}", "-", t)
        if t.startswith("-"):
            t = t[1:]
        if t.endswith("-"):
            t = t[:-1]
        tag = t or "-"
    return tag


# ---- config (the section of wlog.md above `# log`) ----

_WS = r"[ \t\n\r\f\v]*"


def _read_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def _lines(text):
    if not text:
        return []
    lines = text.split("\n")
    if text.endswith("\n"):
        lines.pop()
    return lines


def _config_section():
    text = _read_bytes(MD_LOG).decode("utf-8", "surrogateescape")
    section = []
    for line in _lines(text):
        if line == "# log":
            break
        section.append(line)
    return section


def read_config():
    if not os.path.isfile(MD_LOG):
        return
    try:
        section = _config_section()
    except OSError as e:
        die("config: cannot read %s: %s" % (MD_LOG, e.strerror))

    # First line whose whole value parses wins. A line that has the key but no
    # readable value is a hard error rather than a silent fallback to the default.
    def value(key, suffix):
        pat = re.compile(re.escape(key) + ":" + _WS + "([0-9]+)" + suffix + _WS)
        for line in section:
            m = pat.fullmatch(line)
            if m:
                return int(m.group(1))
        return None

    def present(key):
        return any(line.startswith(key + ":") for line in section)

    v = value("Daily target", "h?")
    if v is not None:
        if v < 1:
            die("config: 'Daily target' must be >= 1 (got %d)" % v)
        CFG.daily_target = v
    elif present("Daily target"):
        die("config: 'Daily target' line is present but its value is unreadable (expected an integer >= 1, optional 'h' suffix, and nothing after it; see 'sw help')")
    v = value("Working days per week", "")
    if v is not None:
        if not 1 <= v <= 7:
            die("config: 'Working days per week' must be 1-7 (got %d)" % v)
        CFG.working_days = v
    elif present("Working days per week"):
        die("config: 'Working days per week' line is present but its value is unreadable (expected an integer 1-7 and nothing after it; see 'sw help')")
    v = value("Pomodoro work", "m?")
    if v is not None:
        if v < 1:
            die("config: 'Pomodoro work' must be >= 1 (got %d)" % v)
        CFG.work_mins = v
    elif present("Pomodoro work"):
        die("config: 'Pomodoro work' line is present but its value is unreadable (expected an integer >= 1, optional 'm' suffix, and nothing after it; see 'sw help')")
    v = value("Pomodoro break", "m?")
    if v is not None:
        if v < 1:
            die("config: 'Pomodoro break' must be >= 1 (got %d)" % v)
        CFG.break_mins = v
    elif present("Pomodoro break"):
        die("config: 'Pomodoro break' line is present but its value is unreadable (expected an integer >= 1, optional 'm' suffix, and nothing after it; see 'sw help')")


# ---- the raw log ----
#
# One session per line: date, HH:MM (when it ended, which is when it was
# logged), seconds, tag, split on tabs or spaces. The reports read every line
# through parse_entry; last, amend and sub check only the last line's field
# count, so they can show or change a row the reports skip.

_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_TIME_RE = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]")
_FIELD_SEP = re.compile(r"[ \t]+")

# Shorter sessions are accidental start/stops: no command writes one, and the
# reports leave out any found in an older or hand-edited raw log.
MIN_SESSION_SECS = 60


class Entry:
    __slots__ = ("date", "day", "hm", "secs", "mins", "tag")

    def __init__(self, date, day, hm, secs, tag):
        self.date = date
        self.day = day
        self.hm = hm
        self.secs = secs
        self.mins = round_mins(secs)
        self.tag = tag


def split_fields(line):
    return [f for f in _FIELD_SEP.split(line) if f]


def is_blank(line):
    return line.strip(" \t\r") == ""


def parse_entry(line):
    f = split_fields(line)
    if len(f) != 4:
        return None
    d, hm, s, tag = f
    if not (_DATE_RE.fullmatch(d) and _TIME_RE.fullmatch(hm) and _DIGITS.fullmatch(s)):
        return None
    try:
        day = datetime.date(int(d[0:4]), int(d[5:7]), int(d[8:10]))
    except ValueError:
        return None
    return Entry(d, day, hm, int(s), tag)


def read_raw_text():
    """The raw log as text, or None when it doesn't exist."""
    try:
        return _read_bytes(RAW_LOG).decode("utf-8", "surrogateescape")
    except FileNotFoundError:
        return None


def read_raw_or_die():
    try:
        return read_raw_text() or ""
    except OSError as e:
        die("cannot read %s" % _describe(e, RAW_LOG))


def load_entries(text):
    """Valid entries in file order, and (line number, text) for every non-blank
    line that isn't one."""
    entries, bad = [], []
    for n, line in enumerate(_lines(text or ""), 1):
        e = parse_entry(line)
        if e is not None:
            entries.append(e)
        elif not is_blank(line):
            bad.append((n, line))
    return entries, bad


# Only the reports filter: the clears count every entry, so a dry run and the
# real run agree on how many lines go.
def report_entries(entries):
    return [e for e in entries if e.secs >= MIN_SESSION_SECS]


def last_entry_index(lines):
    for i in range(len(lines) - 1, -1, -1):
        if not is_blank(lines[i]):
            return i
    return None


# ---- how a session reads (wlog.md and the terminal share these) ----


def _clock_mins(hm):
    return int(hm[0:2]) * 60 + int(hm[3:5])


def session_range(hm, mins):
    """`start–end` for a session logged at HH:MM, which is when it ended, that
    ran MINS minutes. One that began the evening before shows that evening's
    clock: 23:40–00:25."""
    start = (_clock_mins(hm) - mins) % 1440
    return "%02d:%02d–%s" % (start // 60, start % 60, hm)


# A tag literally named "untagged" reads the same as no tag, so it shares the
# untagged row instead of appearing twice under one name.
def _is_untagged(tag):
    return tag in ("-", "", "untagged")


def tag_label(tag):
    return "untagged" if _is_untagged(tag) else tag


def entry_dur(secs):
    """A logged duration as the reports show it, or to the second for a row
    too short for them to count."""
    return fmt_secs(secs) if secs < MIN_SESSION_SECS else fmt_mins(round_mins(secs))


def describe_session(date, hm, secs, tag):
    """A raw-log session as the terminal echoes it, in wlog.md's terms; a
    malformed time field is shown as it stands."""
    when = session_range(hm, round_mins(secs)) if _TIME_RE.fullmatch(hm) else hm
    return "%s %s %s %s" % (date, when, entry_dur(secs), tag_label(tag))


def day_total(date):
    """DATE's total in minutes, counted as wlog.md counts it."""
    try:
        entries, _ = load_entries(read_raw_text())
    except OSError:
        return 0
    return sum(e.mins for e in report_entries(entries) if e.date == date)


# "Today's total" when DATE is today, "Total for DATE" otherwise: amend and sub
# act on the last entry, which may belong to an earlier day, and a commit that
# straddles midnight lands on the day it was stamped.
def say_day_total(date):
    mins = day_total(date)
    if date == datetime.date.today().isoformat():
        say("Today's total: %s" % fmt_mins(mins))
    else:
        say("Total for %s: %s" % (date, fmt_mins(mins)))


# ---- writes ----


class LogUnchanged(Exception):
    """The raw log was left as it was. args[0] is the reason to print, or None
    when it has already been printed."""


class NoChange(Exception):
    """Nothing to change, so nothing to rebuild. args[0] is the caller's value."""


def _describe(e, path=""):
    if isinstance(e, OSError):
        where = e.filename or path
        return "%s: %s" % (where, e.strerror) if where else str(e.strerror)
    return "%s: %s" % (type(e).__name__, e)


def _write_all(fd, data):
    view = memoryview(data)
    while view:
        n = os.write(fd, view)
        view = view[n:]


# Temp file beside the target so the replace is a same-filesystem rename: a
# reader or a crash sees the old file or the new one, never a partial one.
def write_atomic(path, data):
    fd, tmp = tempfile.mkstemp(prefix=os.path.basename(path) + ".", dir=os.path.dirname(path) or ".")
    try:
        try:
            _write_all(fd, data)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def append_row(row):
    """Append one row. Adds the newline a hand edit may have left off the last
    line, and on any write error cuts the file back to its prior size, so a
    failed append leaves no partial row behind."""
    try:
        d = os.path.dirname(RAW_LOG)
        if d:
            os.makedirs(d, exist_ok=True)
        fd = os.open(RAW_LOG, os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_CLOEXEC, 0o666)
    except OSError as e:
        raise LogUnchanged("cannot write %s" % _describe(e, RAW_LOG))
    try:
        size = os.fstat(fd).st_size
        data = row.encode("utf-8", "surrogateescape") + b"\n"
        if size and os.pread(fd, 1, size - 1) != b"\n":
            data = b"\n" + data
        try:
            _write_all(fd, data)
            os.fsync(fd)
        except OSError:
            try:
                os.ftruncate(fd, size)
            except OSError:
                pass
            raise
    except OSError as e:
        raise LogUnchanged("cannot write %s" % _describe(e, RAW_LOG))
    finally:
        os.close(fd)


def rewrite_raw(lines):
    data = "".join(line + "\n" for line in lines).encode("utf-8", "surrogateescape")
    try:
        write_atomic(RAW_LOG, data)
    except OSError as e:
        raise LogUnchanged("cannot write %s" % _describe(e, RAW_LOG))


def load_raw_lines():
    try:
        return _lines(read_raw_text() or "")
    except OSError as e:
        raise LogUnchanged("cannot read %s" % _describe(e, RAW_LOG))


# ---- lock ----


def acquire_lock():
    """Exclusive flock on LOCK_FILE, waiting up to 5 seconds. Returns the fd, or
    None after printing why."""
    try:
        if LOCK_DIR_IS_FALLBACK:
            os.makedirs(LOCK_DIR, mode=0o700, exist_ok=True)
        fd = os.open(LOCK_FILE, os.O_WRONLY | os.O_CREAT | os.O_CLOEXEC | os.O_NOFOLLOW, 0o600)
    except OSError as e:
        warn("cannot open lock %s" % _describe(e, LOCK_FILE))
        return None
    deadline = time.monotonic() + 5
    while True:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BlockingIOError:
            pass
        except OSError as e:
            os.close(fd)
            warn("cannot lock %s" % _describe(e, LOCK_FILE))
            return None
        if time.monotonic() >= deadline:
            os.close(fd)
            warn("another sw instance is running on this lock; try again in a moment")
            return None
        time.sleep(0.1)


_HELD_SIGNALS = {signal.SIGINT, signal.SIGHUP, signal.SIGTERM}


class held_signals:
    """Defers Ctrl+C, logout, and kill until the block ends, so no write is cut
    off halfway; a signal that arrived meanwhile takes effect right after."""

    def __enter__(self):
        self.old = signal.pthread_sigmask(signal.SIG_BLOCK, _HELD_SIGNALS)

    def __exit__(self, *exc):
        signal.pthread_sigmask(signal.SIG_SETMASK, self.old)
        return False


def locked_change(change):
    """Under the lock, apply change() to the raw log and rebuild wlog.md.

    change() returns a value for the caller or raises LogUnchanged. Returns
    (value, stale): stale is None when wlog.md was rebuilt, otherwise the reason
    it wasn't. The raw-log change stands either way, so the two failures are
    reported differently: a retry after a stale rebuild would log twice."""
    fd = acquire_lock()
    if fd is None:
        raise LogUnchanged(None)
    try:
        with held_signals():
            try:
                value = change()
            except NoChange as e:
                return e.args[0], None
            try:
                regenerate_md()
            except Exception as e:  # any rebuild failure leaves the raw-log change in place
                return value, _describe(e)
            return value, None
    finally:
        os.close(fd)


def run_change(change, fail_msg):
    try:
        value, stale = locked_change(change)
    except LogUnchanged as e:
        if e.args and e.args[0]:
            warn(e.args[0])
        die(fail_msg)
    if stale:
        warn("%s was updated, but %s wasn't rebuilt (%s); run: sw regen" % (RAW_LOG, MD_LOG, stale))
    return value


# ---- aggregates (whole minutes: every figure sums each entry's `mins`) ----


def summarize(entries):
    """Minutes logged, days worked, and the longest session, for ENTRIES."""
    total = longest = 0
    days = set()
    for e in entries:
        total += e.mins
        days.add(e.date)
        if e.mins > longest:
            longest = e.mins
    return total, len(days), longest


def in_range(entries, start, end):
    return [e for e in entries if start <= e.day <= end]


def per_day_worked(total, days):
    """TOTAL minutes averaged over DAYS worked, to the nearest minute."""
    return (2 * total + days) // (2 * days) if days else 0


def _whole_percents(values, total):
    """Whole percentages of TOTAL for VALUES, which sum to it, reconciled to
    100 by largest remainder; the earlier value wins a tie."""
    floors, rems = [], []
    for v in values:
        p = v * 100.0 / total
        floors.append(int(p))
        rems.append(p - int(p))
    for _ in range(100 - sum(floors)):
        i = max(range(len(rems)), key=lambda k: (rems[k], -k))
        floors[i] += 1
        rems[i] = -1
    return floors


def tag_rows(entries):
    """Every tag as (name, minutes, percent), most time first and the name
    breaking ties, with untagged time as an "untagged" row in its place. Each
    percent is rounded on its own, so equal times always show equal shares;
    the hours column is the exact one."""
    mins = {}
    for e in entries:
        name = tag_label(e.tag)
        mins[name] = mins.get(name, 0) + e.mins
    total = sum(mins.values())
    if total <= 0:
        return []
    names = sorted(mins, key=lambda t: (-mins[t], t))
    return [(n, mins[n], (200 * mins[n] + total) // (2 * total)) for n in names]


def top_tags(entries):
    """The top 3 tags plus "other" (the remaining tags and all untagged time),
    as whole percentages reconciled to 100. Empty when no tagged time falls in
    the range."""
    untagged = total = 0
    mins = {}
    for e in entries:
        if _is_untagged(e.tag):
            untagged += e.mins
        else:
            mins[e.tag] = mins.get(e.tag, 0) + e.mins
        total += e.mins
    if total <= untagged:
        return ""
    names = sorted(mins, key=lambda t: (-mins[t], t))
    buckets = [[n, mins[n]] for n in names[:3]]
    other = untagged + sum(mins[n] for n in names[3:])
    if other > 0:
        for b in buckets:
            if b[0] == "other":  # a real tag named "other" absorbs the residual
                b[1] += other
                break
        else:
            buckets.append(["other", other])
    percents = _whole_percents([b[1] for b in buckets], total)
    return ", ".join("%s %d%%" % (b[0], p) for b, p in zip(buckets, percents))


def best_records(entries):
    """All-time records as (minutes, when), or None where nothing is logged:
    the longest session (its day), and the best day, Mon-Sun week (its Monday),
    calendar month ((year, month)) and year. Periods still in progress count,
    as today does for the best day; the later period wins a tie, and the
    earlier session keeps the longest."""
    longest = None
    days, weeks, months, years = {}, {}, {}, {}
    for e in entries:
        if longest is None or e.mins > longest[0]:
            longest = (e.mins, e.day)
        monday = e.day - datetime.timedelta(days=e.day.weekday())
        for totals, key in ((days, e.day), (weeks, monday),
                            (months, (e.day.year, e.day.month)), (years, e.day.year)):
            totals[key] = totals.get(key, 0) + e.mins

    def best(totals):
        top = None
        for k, v in totals.items():
            if top is None or (v, k) > top:
                top = (v, k)
        return top

    return longest, best(days), best(weeks), best(months), best(years)


def count_working_days(start, end):
    """Days in [start, end] whose weekday (Mon=1) is <= the working days per week."""
    if start > end:
        return 0
    n = (end - start).days + 1
    full, rest = divmod(n, 7)
    count = full * CFG.working_days
    dow = start.isoweekday()
    for i in range(rest):
        if (dow - 1 + i) % 7 + 1 <= CFG.working_days:
            count += 1
    return count


def to_date_line(entries, period_start, period_end, first_ever, today):
    """The current period's line: its minutes against the target, and how many
    of its working days so far had any work. Both count from the later of the
    period's start and the first logged day, so the time before tracking began
    counts against neither."""
    start = max(period_start, first_ever)
    total = sum(e.mins for e in entries)
    target = CFG.daily_target * count_working_days(start, period_end)
    worked = len({e.day for e in entries
                  if start <= e.day <= today and e.day.isoweekday() <= CFG.working_days})
    line = "To date: %s" % fmt_mins(total)
    if target > 0:
        line += " of %dh target (%.1f%%)" % (target, total * 100.0 / (target * 60))
    return line + ", worked %d of %d working days" % (worked, count_working_days(start, today))


# ---- block renderers ----

FENCE = "```"


def _table(rows, right):
    """ROWS of text cells, aligned: columns three spaces apart, those indexed in
    RIGHT right-aligned, empty columns dropped, trailing blanks trimmed."""
    widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    out = []
    for r in rows:
        cells = [c.rjust(w) if i in right else c.ljust(w)
                 for i, (c, w) in enumerate(zip(r, widths)) if w]
        out.append("   ".join(cells).rstrip())
    return out


def _day_label(d):
    return "%s %s %d" % (d.strftime("%a"), d.strftime("%b"), d.day)


def _dated(d):
    return "%s %s" % (d.strftime("%a"), d.isoformat())


def _week_label(monday):
    sunday = monday + datetime.timedelta(days=6)
    if monday.month == sunday.month:
        return "%s %d–%d" % (monday.strftime("%b"), monday.day, sunday.day)
    return "%s %d – %s %d" % (monday.strftime("%b"), monday.day, sunday.strftime("%b"), sunday.day)


def render_dashboard(entries, today):
    one = datetime.timedelta(days=1)
    yesterday = today - one
    week_start = today - datetime.timedelta(days=today.weekday())
    last_week_start = week_start - 7 * one

    def row(label, when, start, end, with_longest):
        ents = in_range(entries, start, end)
        total, _, longest = summarize(ents)
        lng = "longest %s" % fmt_mins(longest) if with_longest and longest else ""
        return [label, when, fmt_mins(total), lng, top_tags(ents)]

    # This week and last week are closed Mon-Sun ranges, matching the monthly
    # week lines. This week leaves out its longest session: still a moving target.
    rows = [row("Today", _day_label(today), today, today, True),
            row("Yesterday", _day_label(yesterday), yesterday, yesterday, True),
            row("This week", _week_label(week_start), week_start, week_start + 6 * one, False),
            row("Last week", _week_label(last_week_start), last_week_start, week_start - one, True)]
    out = [FENCE] + _table(rows, {2})
    longest, day, week, month, year = best_records(entries)
    best = []
    if longest:
        best.append(["Best session", fmt_mins(longest[0]), _dated(longest[1])])
    if day:
        best.append(["Best day", fmt_mins(day[0]), _dated(day[1])])
    if week:
        best.append(["Best week", fmt_mins(week[0]), "week of %s" % week[1].isoformat()])
    if month:
        best.append(["Best month", fmt_mins(month[0]), "%04d-%02d" % month[1]])
    if year:
        best.append(["Best year", fmt_mins(year[0]), "%04d" % year[1]])
    if best:
        out += [""] + _table(best, {1})
    out.append(FENCE)
    return "\n".join(out) + "\n"


_PERIOD_HEAD = ["Hours", "Days", "Avg/day", "Longest", "Top tag"]


def _period_cells(label, entries):
    """A period's table row: minutes, days worked, per day worked, longest
    session, top tag. One with nothing logged shows its zeros and no more."""
    if not entries:
        return [label, fmt_mins(0), "0", "", "", ""]
    total, days, longest = summarize(entries)
    top = next(("%s %d%%" % (n, p) for n, _, p in tag_rows(entries) if n != "untagged"), "")
    return [label, fmt_mins(total), str(days), fmt_mins(per_day_worked(total, days)),
            fmt_mins(longest), top]


def _period_table(first_head, rows):
    return _table([[first_head] + _PERIOD_HEAD] + rows, {1, 2, 3, 4})


def render_tag_table(entries):
    rows = [[n, fmt_mins(m), "%d%%" % p] for n, m, p in tag_rows(entries)]
    return _table([["Tag", "Hours", "%"]] + rows, {1, 2}) if rows else []


def render_years(entries, first_ever, today):
    """A row for every year since the first logged one, newest first, zeros
    included; empty until the span covers two years."""
    if first_ever is None:
        return ""
    last = max([today.year] + [e.day.year for e in entries])
    if last == first_ever.year:
        return ""
    by_year = {}
    for e in entries:
        by_year.setdefault(e.day.year, []).append(e)
    rows = [_period_cells("%04d" % y, by_year.get(y, [])) for y in range(last, first_ever.year - 1, -1)]
    return "\n".join([FENCE] + _period_table("Year", rows) + [FENCE]) + "\n"


def render_year(year, entries, first_ever, today):
    """The to-date line while it's the current year; a row for every month
    since tracking began, newest first, zeros included, the year's total last;
    then the year's tags."""
    first = first_ever.month if year == first_ever.year else 1
    if year < today.year:
        last = 12
    else:
        last = max([e.day.month for e in entries] + ([today.month] if year == today.year else []))
    by_month = {}
    for e in entries:
        by_month.setdefault(e.day.month, []).append(e)
    rows = [_period_cells(datetime.date(year, m, 1).strftime("%b"), by_month.get(m, []))
            for m in range(last, first - 1, -1)]
    rows.append(_period_cells("%04d" % year, entries))
    out = [FENCE]
    if year == today.year:
        out += [to_date_line(entries, datetime.date(year, 1, 1), datetime.date(year, 12, 31),
                             first_ever, today), ""]
    out += _period_table("Month", rows) + [""] + render_tag_table(entries) + [FENCE]
    return "\n".join(out) + "\n"


def _last_of_month(year, month):
    nxt = datetime.date(year + month // 12, month % 12 + 1, 1)
    return nxt - datetime.timedelta(days=1)


def render_month(year, month, entries, all_entries, first_ever, today):
    """The month's summary; while it's the current month, its to-date line and
    weeks; then its tags. Closed months show only what the raw log alone
    decides, so editing the config never rewrites them."""
    total, days, longest = summarize(entries)
    out = [FENCE, "%s · %d %s worked · %s per day worked · longest %s"
           % (fmt_mins(total), days, "day" if days == 1 else "days",
              fmt_mins(per_day_worked(total, days)), fmt_mins(longest))]
    if (year, month) == (today.year, today.month):
        out.append(to_date_line(entries, datetime.date(year, month, 1), _last_of_month(year, month),
                                first_ever, today))
        weeks = render_weeks_for_month(year, month, all_entries, today)
        if weeks:
            out += [""] + weeks
    out += [""] + render_tag_table(entries) + [FENCE]
    return "\n".join(out) + "\n"


def render_weeks_for_month(year, month, entries, today):
    """ISO weeks whose Monday falls in the month, latest first, skipping Mondays
    still ahead. Each shows its full Mon-Sun total, so a week that spills into
    the next month sits under the month it started in."""
    first = datetime.date(year, month, 1)
    last = _last_of_month(year, month)
    monday = first + datetime.timedelta(days=(7 - first.weekday()) % 7)
    mondays = []
    while monday <= last:
        mondays.append(monday)
        monday += datetime.timedelta(days=7)
    rows = []
    for mon in reversed(mondays):
        if mon > today:
            continue
        total = summarize(in_range(entries, mon, mon + datetime.timedelta(days=6)))[0]
        rows.append(["Week %02d" % mon.isocalendar()[1], _week_label(mon), fmt_mins(total)])
    return _table(rows, {2}) if rows else []


def _start_order(e):
    end = _clock_mins(e.hm)
    return (end - e.mins, end, e.secs, e.tag)


def render_days(entries):
    """Days latest first, each day's sessions in the order they started."""
    by_day = {}
    for e in entries:
        by_day.setdefault(e.day, []).append(e)
    width = max(len(fmt_mins(e.mins)) for e in entries)
    out = []
    for d in sorted(by_day, reverse=True):
        sessions = by_day[d]
        n = len(sessions)
        out.append("- %s — %s, %d %s" % (_dated(d), fmt_mins(sum(e.mins for e in sessions)), n,
                                         "session" if n == 1 else "sessions"))
        for e in sorted(sessions, key=_start_order):
            out.append("  - %s   %s   %s" % (session_range(e.hm, e.mins), fmt_mins(e.mins).rjust(width),
                                            tag_label(e.tag)))
    return "".join(line + "\n" for line in out)


def render_config_seed():
    """Written once, when wlog.md is first created: the effective config, which
    is the defaults at that point, fenced so a markdown preview keeps its lines
    apart. The suffixes are the ones read_config accepts, and it skips the
    fence lines, so the block reads back unchanged."""
    return ("# config (edit a value; delete a line to use its default)\n"
            + FENCE + "\n"
            + "%-22s %s\n" % ("Daily target:", "%dh" % CFG.daily_target)
            + "%-22s %s\n" % ("Working days per week:", "%d" % CFG.working_days)
            + "%-22s %s\n" % ("Pomodoro work:", "%dm" % CFG.work_mins)
            + "%-22s %s\n" % ("Pomodoro break:", "%dm" % CFG.break_mins)
            + FENCE + "\n\n")


_BAD_LINE_SHOWN = 5


def regenerate_md():
    """Rebuild wlog.md from the raw log, keeping everything above `# log`.
    Lines of the raw log that aren't sessions are named on stderr and left out;
    sessions under a minute are left out silently."""
    if not os.path.isfile(RAW_LOG):
        return
    entries, bad = load_entries(read_raw_text())
    for n, line in bad[:_BAD_LINE_SHOWN]:
        warn("warning: %s line %d isn't date, HH:MM, seconds, tag; left out of the totals: %s"
             % (RAW_LOG, n, line))
    if len(bad) > _BAD_LINE_SHOWN:
        warn("warning: %d more such lines in %s" % (len(bad) - _BAD_LINE_SHOWN, RAW_LOG))

    d = os.path.dirname(MD_LOG)
    if d:
        os.makedirs(d, exist_ok=True)
    # Keep everything above `# log`. A file with no `# log` line keeps all of it,
    # plus a separating blank line. Only a missing or empty file gets the seeded
    # config block, so a block the user deletes stays gone.
    if os.path.exists(MD_LOG) and os.path.getsize(MD_LOG) > 0:
        text = _read_bytes(MD_LOG).decode("utf-8", "surrogateescape")
        head, found = [], False
        for line in _lines(text):
            if line == "# log":
                found = True
                break
            head.append(line)
        header = "".join(line + "\n" for line in head) + ("" if found else "\n")
    else:
        header = render_config_seed()

    entries = report_entries(entries)
    today = datetime.date.today()
    first_ever = min((e.day for e in entries), default=None)
    by_year, by_month = {}, {}
    for e in entries:
        by_year.setdefault(e.day.year, []).append(e)
        by_month.setdefault((e.day.year, e.day.month), []).append(e)

    parts = [header, "# log\n\n", render_dashboard(entries, today)]
    years = render_years(entries, first_ever, today)
    if years:
        parts.append("\n## All years\n\n" + years)
    for y in sorted(by_year, reverse=True):
        parts.append("\n## %04d\n\n" % y)
        parts.append(render_year(y, by_year[y], first_ever, today))
        for (yy, m) in sorted((k for k in by_month if k[0] == y), reverse=True):
            parts.append("\n### %s\n\n" % datetime.date(yy, m, 1).strftime("%B"))
            parts.append(render_month(yy, m, by_month[(yy, m)], entries, first_ever, today))
            parts.append("\n")
            parts.append(render_days(by_month[(yy, m)]))
    write_atomic(MD_LOG, "".join(parts).encode("utf-8", "surrogateescape"))


# ---- live timer ----


class Timer:
    start = 0          # epoch the current timer began
    completed = False  # a countdown reached zero (never, for the count-up)
    elapsed = 0        # what the finished timer logs
    commit_tag = ""    # tag to log if logout or kill ends a committable phase; "" for the break
    signal_commit = False


TIMER = Timer()


def open_tty():
    """/dev/tty, which the timer reads for Enter. Checked before anything is
    printed: without a controlling terminal the timer can't run."""
    try:
        return os.open("/dev/tty", os.O_RDONLY | os.O_CLOEXEC)
    except OSError:
        die("sw needs a terminal: no readable /dev/tty, so the timer can't run")


def _exit_now(code):
    _write(sys.stdout, "")
    _write(sys.stderr, "")
    os._exit(code)


# Ctrl+C discards the running work session on purpose and says so. During a
# break there is nothing to discard: the pomodoro before it is already logged.
def _on_interrupt(signum, frame):
    if TIMER.commit_tag:
        _write(sys.stdout, "\n\n⏹ cancelled, nothing logged\n")
    else:
        _write(sys.stdout, "\n\n⏹ break cancelled\n")
    _exit_now(130)


def _commit_and_exit(code):
    """Logout, a terminal close, or kill during a committable phase: the session
    lives only in memory until committed, so commit what ran, then exit with the
    conventional 128+signal code."""
    if TIMER.signal_commit:
        return  # a second signal mid-commit: let the first one finish
    TIMER.signal_commit = True
    signal.pthread_sigmask(signal.SIG_BLOCK, _HELD_SIGNALS)
    elapsed = int(time.time()) - TIMER.start
    _write(sys.stderr, "\n\n⏹ terminated by signal\n")
    try:
        finish(elapsed, TIMER.commit_tag)
    except SystemExit as e:
        _exit_now(e.code if isinstance(e.code, int) else 1)
    _exit_now(code)


def _on_terminate(signum, frame):
    _commit_and_exit(129 if signum == signal.SIGHUP else 143)


def _enter_pressed(tty, timeout):
    """True once a line has been typed. Ctrl+D on a live terminal is ignored; a
    terminal that has gone away (read at EOF and no longer a working tty) is
    handled as the hangup it is, even where SIGHUP never arrives."""
    ready, _, _ = select.select([tty], [], [], timeout)
    if not ready:
        return False
    try:
        data = os.read(tty, 4096)
    except OSError:
        data = b""
    if data:
        return True
    try:
        termios.tcgetattr(tty)
        return False
    except termios.error:
        pass
    if TIMER.commit_tag:
        _commit_and_exit(129)
    _exit_now(129)


# One-second live timer shared by the stopwatch, the pomodoro work phase, and
# the break, so their displays are identical by construction. Both modes count
# from wall-clock time, so a suspend or a closed lid counts as elapsed instead
# of pausing the timer. A countdown that reaches zero logs its nominal length;
# an early Enter and the count-up log the wall-clock span actually run. Each
# redraw ends with EL (\033[K) so a clock that shrinks at the hour boundary
# (1:00:00 -> 59:59) leaves no stale columns.
def run_timer(tty, mode, icon, label, total=0, commit_tag=""):
    TIMER.start = int(time.time())
    TIMER.completed = False
    TIMER.commit_tag = commit_tag
    TIMER.signal_commit = False
    signal.signal(signal.SIGINT, _on_interrupt)
    if commit_tag:
        signal.signal(signal.SIGHUP, _on_terminate)
        signal.signal(signal.SIGTERM, _on_terminate)
    try:
        while True:
            now = int(time.time())
            if mode == "down":
                remaining = max(0, total - (now - TIMER.start))
                _write(sys.stdout, "\r   %s  %s: %s \033[K" % (icon, label, fmt_clock(remaining)))
                if remaining == 0:
                    TIMER.completed = True
                    break
            else:
                _write(sys.stdout, "\r   %s  %s: %s \033[K" % (icon, label, fmt_clock(now - TIMER.start)))
            if _enter_pressed(tty, 1.0):
                break
    finally:
        for s in (signal.SIGINT, signal.SIGHUP, signal.SIGTERM):
            signal.signal(s, signal.SIG_DFL)
    TIMER.elapsed = total if TIMER.completed else int(time.time()) - TIMER.start


def _hm_in(seconds):
    return time.strftime("%H:%M", time.localtime(time.time() + seconds))


def _run_quietly(cmd, **kw):
    try:
        subprocess.run(cmd, check=False, **kw)
    except OSError:
        pass


def play_sound(path):
    if shutil.which("paplay"):
        _run_quietly(["paplay", path], stderr=subprocess.DEVNULL)


# ---- modes ----


def finish(elapsed, tag):
    """Commit a finished timer session. If it can't be written, say so with the
    command that puts it back, since the session exists nowhere else."""
    if elapsed < MIN_SESSION_SECS:
        say("under a minute, not logged")
        return
    stamp = time.localtime()  # one reading: the row's date and the total line agree
    day = time.strftime("%Y-%m-%d", stamp)
    hm = time.strftime("%H:%M", stamp)
    recover = "sw add %ds%s" % (elapsed, "" if tag == "-" else " " + tag)
    run_change(lambda: append_row("%s\t%s\t%d\t%s" % (day, hm, elapsed, tag)),
               "failed to commit session; recover it with: %s" % recover)
    say("Session: %s" % fmt_mins(round_mins(elapsed)))
    say_day_total(day)


def run_stopwatch(tag):
    tty = open_tty()
    say("⏱  stopwatch started %s. Enter stops & logs, Ctrl+C cancels." % time.strftime("%H:%M"))
    say("")
    run_timer(tty, "up", "⏱", "elapsed", 0, tag)
    say("")
    say("")
    say("⏹ stopped")
    finish(TIMER.elapsed, tag)


def run_pomodoro(tag):
    tty = open_tty()
    mins = CFG.work_mins
    say("🍅 pomodoro started! focus for %d minutes." % mins)
    say("   Started %s, ends %s. Enter stops early & logs, Ctrl+C cancels."
        % (time.strftime("%H:%M"), _hm_in(mins * 60)))
    say("")
    run_timer(tty, "down", "⏱", "time remaining", mins * 60, tag)
    say("")
    say("")
    if TIMER.completed:
        say("✅ session complete!")
        finish(TIMER.elapsed, tag)
        play_sound(SOUND_SESSION_END)
        say("")
        run_break(tty, CFG.break_mins)
    else:
        say("⏹ stopped early")
        finish(TIMER.elapsed, tag)


# Rest timer shared by the pomodoro and `sw break`. Logs nothing.
def run_break(tty, mins):
    say("%dm break. Press Enter to skip." % mins)
    say("   Break ends %s" % _hm_in(mins * 60))
    say("")
    run_timer(tty, "down", "☕", "break remaining", mins * 60)
    say("")
    say("")
    if TIMER.completed:
        say("⏰ break over!")
        play_sound(SOUND_BREAK_END)
        if shutil.which("notify-send"):
            _run_quietly(["notify-send", "⏰ break over", "back to work"])
    else:
        say("⏭ break skipped")


def cmd_break(args):
    mins, got = CFG.break_mins, False
    for a in args:
        if a.startswith("-"):
            die("break: unknown flag: %s" % a)
        if got:
            die("break: only one minutes value allowed (got extra '%s')" % a)
        m = re.fullmatch(r"([0-9]+)m?", a)
        if not m:
            die("break: minutes must be a positive integer (got '%s')" % a)
        if int(m.group(1)) < 1:
            die("break: minutes must be >= 1")
        mins, got = int(m.group(1)), True
    run_break(open_tty(), mins)


def cmd_sum(args):
    if args:
        die("sum: takes no arguments")
    today = datetime.date.today().isoformat()
    total = count = 0
    if os.path.isfile(RAW_LOG):
        for e in report_entries(load_entries(read_raw_or_die())[0]):
            if e.date == today:
                total += e.mins
                if e.mins >= CFG.work_mins:
                    count += 1
    say("Today's total: %s (%d work-length sessions)" % (fmt_mins(total), count))


def cmd_last(args):
    if args:
        die("last: takes no arguments")
    if not os.path.isfile(RAW_LOG):
        say("no sessions logged")
        return
    lines = _lines(read_raw_or_die())
    i = last_entry_index(lines)
    if i is None:
        say("no sessions logged")
        return
    last = lines[i]
    f = split_fields(last)
    if len(f) != 4:
        die("last entry isn't in the expected 4-field format ('%s'); edit %s" % (last, RAW_LOG))
    d, t, s, tg = f
    if not _DIGITS.fullmatch(s):
        die("last entry has a malformed seconds field ('%s'); edit %s" % (s, RAW_LOG))
    say(describe_session(d, t, int(s), tg))


# Unlike the timer paths, where a missing player or file stays silent, the
# point of `sw sound` is diagnosis, so it reports what's wrong.
def cmd_sound(args):
    if args:
        die("sound: takes no arguments")
    if not shutil.which("paplay"):
        die("paplay not found (Devuan: apt install pulseaudio-utils)")
    say("pomo session-end sound:")
    if os.path.isfile(SOUND_SESSION_END):
        play_sound(SOUND_SESSION_END)
    else:
        say("missing: %s" % SOUND_SESSION_END)
    time.sleep(1)
    say("break-end sound:")
    if os.path.isfile(SOUND_BREAK_END):
        play_sound(SOUND_BREAK_END)
    else:
        say("missing: %s" % SOUND_BREAK_END)


# ---- mutating commands ----


def _has_entries():
    return os.path.isfile(RAW_LOG) and os.path.getsize(RAW_LOG) > 0


def cmd_add(args):
    if not args:
        die("usage: sw add DURATION [tag]   (e.g. 90m, 1h30m, 5400s)")
    secs = parse_duration(args[0])
    if secs is None:
        die("invalid duration: %s (use 90m, 1h30m, 5400s, or a bare integer = minutes)" % args[0])
    if secs < MIN_SESSION_SECS:
        die("too short: %s (sessions under a minute aren't logged)" % args[0])
    tag = args_to_tag(args[1:])
    # Stamped now, like the live timer: column 2 means "when the session ended
    # or was logged" for every row, whatever wrote it.
    stamp = time.localtime()
    log_date = time.strftime("%Y-%m-%d", stamp)
    log_hm = time.strftime("%H:%M", stamp)
    run_change(lambda: append_row("%s\t%s\t%d\t%s" % (log_date, log_hm, secs, tag)), "failed to add session")
    say("added: %s" % describe_session(log_date, log_hm, secs, tag))
    say_day_total(log_date)


# The last entry is read, checked, and rewritten entirely under the lock:
# reading it outside would let a concurrent commit land in between and be lost.
def cmd_amend(args):
    if len(args) != 1:
        die("usage: sw amend DURATION   (rewrites the last entry's duration)")
    if not _has_entries():
        die("no entries to amend")
    secs = parse_duration(args[0])
    if secs is None:
        die("invalid duration: %s" % args[0])
    if secs < MIN_SESSION_SECS:
        die("too short: %s (sessions under a minute aren't logged)" % args[0])

    def change():
        lines = load_raw_lines()
        i = last_entry_index(lines)
        if i is None:
            raise LogUnchanged("no entries to amend")
        f = split_fields(lines[i])
        if len(f) != 4:
            raise LogUnchanged("last entry isn't in the expected 4-field format; edit %s directly" % RAW_LOG)
        rewrite_raw(lines[:i] + ["%s\t%s\t%d\t%s" % (f[0], f[1], secs, f[3])])
        return f

    f = run_change(change, "failed to amend session")
    old = entry_dur(int(f[2])) if _DIGITS.fullmatch(f[2]) else "'%s'" % f[2]
    say("amended: %s (was %s)" % (describe_session(f[0], f[1], secs, f[3]), old))
    say_day_total(f[0])


def cmd_sub(args):
    if not _has_entries():
        die("no entries to remove")
    if len(args) > 1:
        die("usage: sw sub [DURATION]   (no arg removes the last entry; DURATION reduces it)")
    if not args:
        # Removes the last entry and echoes it, so a mistaken delete can be re-added.
        def delete():
            lines = load_raw_lines()
            i = last_entry_index(lines)
            if i is None:
                raise LogUnchanged("no entries to remove")
            rewrite_raw(lines[:i])
            return lines[i]

        removed = run_change(delete, "failed to remove entry")
        f = split_fields(removed)
        if len(f) == 4 and _DIGITS.fullmatch(f[2]):
            say("removed: %s" % describe_session(f[0], f[1], int(f[2]), f[3]))
            say_day_total(f[0])
        else:
            say("removed: %s" % removed)
        return
    delta = parse_duration(args[0])
    if delta is None:
        die("invalid duration: %s (use 90m, 1h30m, 5400s, or a bare integer = minutes)" % args[0])

    # Refuses to leave less than a minute: removing the entry is bare `sw sub`'s
    # job, not a side effect of over-subtracting.
    def reduce():
        lines = load_raw_lines()
        i = last_entry_index(lines)
        if i is None:
            raise LogUnchanged("no entries to subtract from")
        f = split_fields(lines[i])
        if len(f) != 4:
            raise LogUnchanged("last entry isn't in the expected 4-field format; edit %s directly" % RAW_LOG)
        if not _DIGITS.fullmatch(f[2]):
            raise LogUnchanged("last entry has a malformed seconds field ('%s'); edit %s" % (f[2], RAW_LOG))
        cur = int(f[2])
        new = cur - delta
        if new < MIN_SESSION_SECS:
            raise LogUnchanged("cannot subtract %s from a %s entry: that would leave under a minute "
                               "(use bare 'sw sub' to remove the entry)" % (fmt_secs(delta), entry_dur(cur)))
        rewrite_raw(lines[:i] + ["%s\t%s\t%d\t%s" % (f[0], f[1], new, f[3])])
        return f, new

    f, new = run_change(reduce, "failed to subtract")
    say("subtracted %s: %s" % (fmt_secs(delta), describe_session(f[0], f[1], new, f[3])))
    say_day_total(f[0])


def _parse_yes_flags(args, cmd, positional):
    apply, values = False, []
    for a in args:
        if a in ("-y", "--yes"):
            apply = True
        elif a.startswith("-"):
            die("%s: unknown flag: %s" % (cmd, a))
        else:
            positional(values, a)
    return apply, values


def cmd_clear(args):
    def reject(values, a):
        die("clear: unexpected argument: %s" % a)

    apply, _ = _parse_yes_flags(args, "clear", reject)
    if not _has_entries():
        say("no log to clear (%s is empty or missing)" % RAW_LOG)
        return
    if not apply:
        count = read_raw_or_die().count("\n")
        say("would clear all %d lines from %s" % (count, RAW_LOG))
        say("re-run with -y to commit: sw clear -y")
        return

    # A file-level wipe: counts lines, junk included, under the lock.
    def wipe():
        try:
            count = _read_bytes(RAW_LOG).count(b"\n")
            fd = os.open(RAW_LOG, os.O_WRONLY | os.O_CLOEXEC)
            try:
                os.ftruncate(fd, 0)
                os.fsync(fd)
            finally:
                os.close(fd)
        except OSError as e:
            raise LogUnchanged("cannot write %s" % _describe(e, RAW_LOG))
        return count

    count = run_change(wipe, "failed to clear log")
    say("cleared %d lines from %s" % (count, RAW_LOG))


def _clear_before_counts(entries, cutoff):
    return len(entries), sum(1 for e in entries if e.date >= cutoff)


def cmd_clear_before(args):
    def one_date(values, a):
        if values:
            die("clear-before: only one date allowed (got '%s' and '%s')" % (values[0], a))
        values.append(a)

    apply, values = _parse_yes_flags(args, "clear-before", one_date)
    if not values:
        die("usage: sw clear-before DATE [-y]   (DATE: YYYY-MM-DD or YYYYMMDD)")
    cutoff = normalize_date(values[0])
    if cutoff is None:
        die("invalid date: %s (use YYYY-MM-DD or YYYYMMDD)" % values[0])
    if not _has_entries():
        say("no log to clear (%s is empty or missing)" % RAW_LOG)
        return
    if not apply:
        total, keep = _clear_before_counts(load_entries(read_raw_or_die())[0], cutoff)
        if total == keep:
            say("no entries before %s; nothing to do" % cutoff)
            return
        say("would delete %d entries before %s (keeping %d)" % (total - keep, cutoff, keep))
        say("re-run with -y to commit: sw clear-before %s -y" % cutoff)
        return

    # Counted under the lock, so the number reported is the number removed.
    # Lines that aren't entries pass through: the contract is "delete entries
    # before DATE", and a stray hand-edited line is not an entry.
    def prune():
        lines = load_raw_lines()
        kept, total, keep = [], 0, 0
        for line in lines:
            e = parse_entry(line)
            if e is None:
                kept.append(line)
                continue
            total += 1
            if e.date >= cutoff:
                keep += 1
                kept.append(line)
        if total == keep:
            raise NoChange(0)
        rewrite_raw(kept)
        return total - keep

    deleted = run_change(prune, "failed to clear log")
    if deleted == 0:
        say("no entries before %s; nothing to do" % cutoff)
    else:
        say("deleted %d entries before %s" % (deleted, cutoff))


def cmd_regen(args):
    if args:
        die("regen: takes no arguments")
    if not os.path.isfile(RAW_LOG):
        say("no raw log to regenerate from (%s is missing)" % RAW_LOG)
        return
    fd = acquire_lock()
    if fd is None:
        die("failed to regenerate %s" % MD_LOG)
    try:
        with held_signals():
            regenerate_md()
    except Exception as e:
        warn(_describe(e, MD_LOG))
        die("failed to regenerate %s" % MD_LOG)
    finally:
        os.close(fd)
    say("regenerated %s from %s" % (MD_LOG, RAW_LOG))


# ---- help and version ----


def show_help():
    _write(sys.stdout, HELP_TEXT)


def version_line():
    """Line 2 of this file (`# sw, vN`) without the `# `: the single source for
    the version, so the header and `sw version` can't drift."""
    try:
        with open(os.path.realpath(__file__), "rb") as f:
            f.readline()
            line = f.readline().decode("utf-8", "replace").rstrip("\n")
    except OSError:
        return ""
    return line[2:] if line.startswith("# ") else ""


# ---- dispatch ----


def _init_paths():
    global RAW_LOG, MD_LOG, LOCK_DIR, LOCK_FILE, LOCK_DIR_IS_FALLBACK
    global SOUND_SESSION_END, SOUND_BREAK_END
    home = os.environ.get("HOME")
    if home is None:
        die("HOME is not set")

    def env(name, default):
        return os.environ.get(name) or default

    RAW_LOG = env("SW_RAW_LOG", home + "/.stopwatch_log")
    MD_LOG = env("SW_MD_LOG", home + "/Documents/mv/wlog.md")
    SOUND_SESSION_END = env("SW_SOUND_SESSION_END", DEFAULT_SOUND_SESSION_END)
    SOUND_BREAK_END = env("SW_SOUND_BREAK_END", DEFAULT_SOUND_BREAK_END)
    # Never /tmp: a lock file another account can create first would block
    # every commit. Only this user can write under ~/.cache.
    runtime = os.environ.get("XDG_RUNTIME_DIR")
    LOCK_DIR_IS_FALLBACK = not runtime
    LOCK_DIR = runtime or home + "/.cache"
    LOCK_FILE = "%s/sw-%d.lock" % (LOCK_DIR, os.getuid())


def main(argv):
    # Ctrl+C outside a timer, and a closed pipe, end the program quietly as they
    # would a shell tool, instead of raising a Python traceback.
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    for stream in (sys.stdout, sys.stderr):
        if stream is not None:
            stream.reconfigure(encoding="utf-8", errors="surrogateescape")
    try:
        locale.setlocale(locale.LC_TIME, "")  # month names follow LC_TIME, as date(1) does
    except locale.Error:
        pass
    _init_paths()

    first = argv[0] if argv else ""
    # help and version work even when the config is broken, so you can read how to fix it.
    if first in ("help", "-h", "--help"):
        show_help()
        return 0
    if first in ("version", "--version"):
        say(version_line())
        return 0

    read_config()

    commands = {
        "sound": cmd_sound, "last": cmd_last, "sum": cmd_sum, "add": cmd_add,
        "amend": cmd_amend, "sub": cmd_sub, "clear": cmd_clear,
        "clear-before": cmd_clear_before, "regen": cmd_regen, "break": cmd_break,
    }
    if first == "--":
        # `--` ends subcommand matching, so tags named like subcommands stay reachable.
        run_stopwatch(args_to_tag(argv[1:]))
    elif first in commands:
        commands[first](argv[1:])
    elif first == "pomo":
        run_pomodoro(args_to_tag(argv[1:]))
    elif first.startswith("-"):
        die("unknown flag: %s (try sw help)" % first)
    else:
        # Default: stopwatch, every argument a tag word.
        run_stopwatch(args_to_tag(argv))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

````