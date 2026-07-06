# Ollama Guide: Set up a local LLM

**TLDR.**
Install with `bash install-ollama.sh` (verifies sha256, scans for unsafe paths, no sudo, no system writes).
Best starter model for a 16 GB CPU-only laptop as of May 2026: `gemma3:4b`.
After install, run `ollama serve` in one terminal, then in another run `ollama pull gemma3:4b && ollama run gemma3:4b`.
Type to chat, `/bye` to exit.

A walkthrough for installing Ollama on Devuan and running your first local model, written for someone who has never used it.

## What Ollama is

A local LLM runtime.
It pulls open-weight models (Llama, Qwen, Gemma, Mistral, and others) from a registry, runs them on your CPU or GPU, and exposes them through a small HTTP API and a command-line tool.
Everything stays on your machine: the models, the inference, and your prompts and responses.
No accounts, no cloud round-trip.

Does it need the internet?
Only to download a model the first time.
Once a model is pulled, you can unplug the network and it still works.
There is no live web lookup and no built-in dictionary fetched on demand.
Everything the model "knows" was baked into it during training and is frozen at the model's training cutoff, so it can be confidently wrong and has no awareness of events after that date unless you paste the information in yourself.

How it works, briefly.
Your text is split into small chunks called tokens.
The model is a large set of learned numbers (its parameters) that, given the tokens so far, computes the most likely next token, then the next, and so on.
That is the whole mechanism: predict the next token, repeat.

Two components:

- `ollama serve` is the daemon. It listens on `127.0.0.1:11434`, holds models in RAM, and runs inference.
- `ollama` is the command-line client. It talks to the daemon over HTTP.

The daemon has to be running before any other `ollama` command works.

## Install

Save the script to your machine as `install-ollama.sh` (for example in `~/Downloads/`), then run:

```bash
bash install-ollama.sh
```

It fetches the latest Ollama release from GitHub, verifies its sha256 against the published checksum, scans the archive for unsafe paths, and installs to `~/.local/opt/ollama/` (no sudo, no system paths) with a symlink (a small pointer file: running `ollama` actually runs the real binary it points to) at `~/.local/bin/ollama`.

Re-run it any time to upgrade.
If the latest version is already installed, it exits without touching anything.

The Ollama binary is self-contained, so you could extract the tarball by hand and skip the script entirely; the official manual steps are at https://docs.ollama.com/linux.
The script adds sha256 verification (otherwise you are trusting whatever bytes the network handed you), protection against malicious archive paths, idempotent upgrades, and a clean uninstall path.

If the version-fetch step fails, it is almost always GitHub's API rate limit (60 requests per hour per IP) or a temporary network blip.
Wait an hour and retry, or open https://api.github.com/repos/ollama/ollama/releases/latest in a browser to check.

After installing, you may need to make `ollama` findable.
The installer warns if `~/.local/bin` is not on your `$PATH`.
On Devuan this happens the first time you install anything into `~/.local/bin/`, because `~/.profile` only adds that directory if it already existed when you logged in.
Fix it for the current terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

For a permanent fix, log out and back in so `~/.profile` picks it up.
Then verify:

```bash
which ollama
# expect: /home/<you>/.local/bin/ollama
ollama --version
```

There is no fully automatic way around this short of the script writing into your shell startup files, which it deliberately does not do.
Keeping your dotfiles untouched is part of why the install is safe to run and trivial to undo.

## First run

Ollama needs two terminals: one for the daemon, one for everything else.
The daemon stays in the foreground and prints its log there; you will do all real work in a second terminal.

Terminal 1, start the daemon and leave it running:

```bash
ollama serve
```

It prints a startup log.
The success line is `Listening on 127.0.0.1:11434`.
Below it you will see hardware detection; on a laptop without a CUDA or ROCm GPU, look for `inference compute id=cpu` with your available RAM.
Keep this terminal open.
Ctrl-C stops the daemon, and if you close this terminal the daemon goes with it.

Terminal 2, check that the daemon is responding:

```bash
curl 127.0.0.1:11434
# expect: Ollama is running
```

If you get `connection refused` instead, the daemon is not running: go back to Terminal 1 and start `ollama serve` there.
If you see `Ollama is running`, you are ready to pull a model.

## Pull and run your first model

Local LLMs are not in the same class as frontier APIs (Opus/Sonnet, GPT-5, Gemini).
The flagship open models that approach frontier quality, such as DeepSeek R1 671B, Llama 3.3 70B, and Qwen 3 235B, need 40 to 400 GB of memory and do not run on laptops at all.
(The B is billions of parameters, the internal learned numbers described above; more parameters generally means more capability and more RAM needed to run.)
What runs locally on a 16 GB laptop is the smallest models in the open lineup.
They are useful for offline work, privacy-sensitive tasks, light coding help, learning, and pulling structured data out of text.
They are not a replacement for frontier APIs on hard reasoning or long-context work.

Start here on a 16 GB laptop:

```bash
ollama pull gemma3:4b && ollama run gemma3:4b
```

The pull is about 2.5 GB and takes a few minutes the first time.
The run drops you into an interactive chat prompt: type a message, hit Enter, get a response.
`/bye` or Ctrl-D exits the chat.

If you get `model 'NAME' not found, try pulling it first`, the model was not pulled or the tag is wrong.
Run `ollama list` to see exactly what you have, and remember tags are case-sensitive and the colon matters (`gemma3:4b`, not `gemma3 4b`).

The first response after starting a model takes 10 to 30 seconds while the model loads from disk; later responses are immediate.
The model stays loaded in RAM for five minutes after you exit, so re-running is instant within that window; after the keep-alive expires, the next run reloads from disk in a few seconds.

Gemma 3's 4b is the best quality-per-byte at this size in 2026: strong general reasoning, good instruction-following, multilingual.
If you want a code-specialized model alongside it, run `ollama pull qwen2.5-coder:3b`.

Inside the chat, `/?` lists all slash commands.
The ones worth knowing early: `/clear` resets the conversation so the model forgets prior turns, `/set system "..."` gives the model a standing instruction for the session, `/show parameters` dumps the active settings (temperature, context size, and so on), and `/save NAME` plus `/load NAME` persist a session to disk.

The model's working memory is bounded.
The default context window is 4096 tokens, roughly 3000 English words.
Once a chat or a pasted document exceeds that, the earliest content gets dropped silently and the model starts acting like it forgot what you said.
If a long chat starts giving disconnected answers, that is the cause: either `/clear` and restart with a tighter prompt, or restart the daemon with a bigger window.
To work with longer inputs, restart the daemon as `OLLAMA_CONTEXT_LENGTH=16384 ollama serve`.
This costs more RAM; doubling the context roughly doubles the KV-cache footprint.
The biggest lever for fitting longer contexts on a constrained machine is quantizing the cache itself: `OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve` cuts KV memory roughly in half with no detectable quality loss.
Combine both for maximum reach.

### Picking a different size

Match the parameter count to the RAM you have free at the moment the model loads.
Q4_K_M is the default quantization Ollama pulls; the figures below are approximate at that quant.

- `:1b` to `:2b` (0.5 to 2 GB on disk): fit anywhere with 4+ GB free RAM. Fast even on slow CPUs. Useful for sanity checks and routing.
- `:3b` to `:4b` (2 to 3 GB): need 4+ GB free RAM. Comfortable on 8 GB systems. Genuinely useful for chat and light tasks.
- `:7b` to `:8b` (4 to 6 GB): need 8+ GB free RAM. The starting point of capable. Slow on CPU, smooth on GPU.
- `:13b` to `:14b` (8 to 10 GB): need 16+ GB free RAM. Painful on CPU, want a GPU.
- `:30b` and up (20+ GB): need 32+ GB RAM or a serious GPU. Do not try on a laptop.

Close your browser and heavy apps before pulling the larger sizes; they consume RAM that could go to the model.
If the daemon exits with an out-of-memory error while loading a model, the model is too big for available RAM: close other apps or pick a smaller size from this list.

### Current model families (May 2026)

The lineup turns over fast.
Browse the full catalog at https://ollama.com/library; the families below are reasonable starting points.

- `llama3.2` (`:1b`, `:3b`): Meta's small models. Solid general-purpose.
- `gemma3` (`:1b`, `:4b`, `:12b`, `:27b`): Google. The `:4b` punches above its weight.
- `qwen3` (`:0.6b`, `:1.7b`, `:4b`, `:8b`, `:14b`, `:30b`, `:32b`): Alibaba. Has a thinking mode for chain-of-thought reasoning. Strong multilingual.
- `qwen2.5-coder` (`:0.5b` through `:32b`): code-specialized, strong at generating and fixing code.
- `mistral` (`:7b`): well-rounded, good for tool calling.
- `phi4-mini` (`:3.8b`): Microsoft. Dense knowledge per parameter, strong on STEM.

## After you're done

Nothing to clean up.
`/bye` exits the chat but leaves the model loaded in RAM for five minutes (the keep-alive window) so re-running is instant.
After that the daemon unloads the model automatically; the model file stays on disk and reloads in a few seconds next time.
Ctrl-C on the `ollama serve` terminal stops the daemon, and model files survive.
A reboot clears everything from memory while disk state persists.

Chat history is not something to manage.
Ollama's command-line chat is ephemeral; your `/bye` discards the conversation and nothing was saved.
(Third-party UIs like Open WebUI store history separately if you ever add one.)

The only thing that grows over time is your model cache at `~/.ollama/models/`.
Each pulled model is hundreds of MB to tens of GB and does not get auto-deleted.
Check its size occasionally with `du -sh ~/.ollama/models`.
To remove a model, run `ollama list` to see the exact names, then `ollama rm MODEL`.

## What to expect on different hardware (May 2026)

Before the numbers, the one idea that explains all of them: how fast a model replies depends mostly on memory bandwidth, which is how quickly the chip can read the model out of RAM for each token it produces.
It depends much less on raw compute (FLOPS, floating-point operations per second, the usual headline spec for a processor).
A bigger model or slower RAM means slower replies.
That is why a small model feels snappy on a laptop while a large one crawls, even on the same chip.

Rule of thumb at Q4: expected output is roughly (RAM bandwidth in GB/s) divided by (model size in GB).
A 4 GB model on a 50 GB/s laptop is about 12 tokens/s; on a 1000 GB/s GPU it is about 250 tokens/s.

Reading-speed reference: 15+ tokens/s feels fast (faster than you read), 5 to 15 is fine for chat, 2 to 5 is tolerable for one-shot prompts, and under 2 is painful.

- Typical 2021-era ultrabook (dual-channel DDR4-3200, around 50 GB/s, CPU-only; an integrated Iris-class iGPU is not usable for Ollama in practice). 1b at 15 to 25 tokens/s, 3b to 4b at 6 to 12, 7b to 8b at 3 to 5, 13b under 2. Practical zone: stay under 4b for interactive use, go to 7b when you can wait.
- Recent mini-PC APU (Ryzen 9 8945HS class, DDR5-5600, around 90 GB/s, Radeon 780M iGPU). About 1.8x the ultrabook on CPU. 1b at 30 to 50 tokens/s, 3b to 4b at 15 to 25, 7b to 8b at 6 to 10, 13b to 14b at 3 to 5, 30b at 1 to 2 (needs a 96 GB RAM option). ROCm on the 780M is bandwidth-limited by shared system RAM, so gains over CPU are modest; the real upgrade is an external NVIDIA GPU over an Oculink port. The install script is identical on both machines: same x86_64 Linux, same tarball.
- Apple Silicon (M-series, unified memory). M1/M2 base: 7b at 15 to 25 tokens/s. M3/M4 Pro/Max: 7b at 30 to 50, 13b at 15 to 25. M-Max with 64+ GB unified memory: 70b at 8 to 12.
- Discrete NVIDIA (CUDA, 500 to 1000 GB/s). RTX 3060 12 GB: 7b at 40 to 60 tokens/s. RTX 4090 24 GB: 7b at 100 to 150, 13b at 40 to 80, 32b at 15 to 25.

## Day-to-day commands

```bash
ollama pull MODEL          # download (or re-fetch latest tag) without running
ollama run MODEL "prompt"  # one-shot prompt
ollama run MODEL           # interactive chat
ollama list                # what's installed locally
ollama ps                  # what's loaded in RAM right now
ollama stop MODEL          # unload from RAM (keep on disk)
ollama rm MODEL            # delete from disk
ollama show MODEL          # parameters, template, size
ollama --help              # full command reference
```

Running `ollama pull MODEL` on a model you already have re-fetches it if the registry's `latest` tag has moved; that is how you update models.

## Keeping the daemon running

The `ollama serve` terminal approach is fine for trying things out, but you will want something better long-term.
Pick the option that matches how you use the machine.

One-off, when needed.
Run `ollama serve` in a terminal, use it, Ctrl-C when done.
Nothing to set up.
Best for first exploration and intermittent use.

Laptop, daily use, graphical session.
Add an XFCE autostart entry so the daemon comes up at login:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/ollama-serve.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Ollama daemon
Exec=sh -c 'exec "\$HOME/.local/bin/ollama" serve >/tmp/ollama.log 2>&1'
NoDisplay=true
EOF
```

The full path to the binary in `Exec=` avoids PATH-resolution issues at autostart time.
Logs go to `/tmp/ollama.log` and survive until reboot.
To stop the daemon, run `pkill -f 'ollama serve'`.
To remove the autostart, delete the `.desktop` file.

SSH, headless, or always-on.
Run the daemon inside a terminal multiplexer so it survives after you disconnect.
A terminal multiplexer keeps a shell session alive on the machine even after you close the connection, so a long-running process keeps going and you can reattach to it later.
tmux is the modern default; screen is the older one and is preinstalled more often.

```bash
tmux new -d -s ollama 'ollama serve'   # start the daemon in a detached session named "ollama"
# reattach later with: tmux attach -t ollama
# detach again without killing it: press Ctrl-b, then d
```

If tmux is not installed, `sudo apt install tmux`, or use the autostart option above instead.

Multi-user box or server-grade always-on.
Write a sysvinit script in `/etc/init.d/ollama` and enable it with `update-rc.d ollama defaults`.
That is out of scope here; for a personal machine, the autostart or tmux options cover everything.

## Where things live

- Binary symlink: `~/.local/bin/ollama` points to `~/.local/opt/ollama/bin/ollama`
- Runtime libraries: `~/.local/opt/ollama/lib/ollama/`
- Models and manifests: `~/.ollama/models/`
- HTTP API: `127.0.0.1:11434` (no auth, localhost-only)
- Daemon logs: stderr of the terminal running `ollama serve`, or `/tmp/ollama.log` if you used the autostart entry above

Uninstall with `bash install-ollama.sh --uninstall`.
To also delete cached models and any autostart entry, run `rm -rf ~/.ollama` and `rm -f ~/.config/autostart/ollama-serve.desktop`.

## Going further

The interactive chat is the easiest way in, but it is not where local Ollama shines hardest.
The command line's real advantage over a web chat is that it plugs into your other tools.

Here is the idea, in plain terms.
Most programs read text in and write text out as streams.
You can feed one program's output straight into `ollama run` as the prompt, and capture the model's answer as plain text that flows into your next command.
No copy-paste, no upload dialog, no switching to a browser tab.

```bash
# Summarize a file: the file's text becomes the prompt, the summary prints to your terminal
cat README.md | ollama run gemma3:4b "summarize in 3 bullets"

# Write a commit message from staged changes: the diff becomes the prompt
git diff --cached | ollama run gemma3:4b "write a conventional commit message"

# Explain an error: the command's error output becomes the prompt
some-command 2>&1 | ollama run gemma3:4b "what does this error mean?"
```

You can also save the answer to a file instead of just printing it, by redirecting with `>`:

```bash
git diff --cached | ollama run gemma3:4b "write a commit message" > msg.txt
```

For these cases this beats a frontier web chat: no frontier model is needed, and the answer flows straight into your shell pipeline.

### Clipboard

The X11 standard works in any terminal: select text with the mouse, then middle-click to paste the primary selection.
For the Ctrl-V clipboard proper, xfce4-terminal uses Ctrl-Shift-C to copy and Ctrl-Shift-V to paste.
For copying program output directly, install `xclip` (`sudo apt install xclip`) and pipe into it:

```bash
ollama run gemma3:4b "explain rsync flags" | xclip -selection clipboard
```

There is no built-in copy-last-response inside the interactive chat; `ollama run` just writes plain text to the terminal with no scrollback of its own.
Two workarounds.
When you know upfront you want the output, use the one-shot piping pattern above (pipe to `xclip` or redirect to a file).
After the fact, run the session inside tmux and use its copy mode: press Ctrl-b then `[` to enter copy mode, move to the start of what you want, press Space to begin selecting, move to the end, press Enter to copy into tmux's buffer, then push that to the system clipboard with `tmux save-buffer - | xclip -i -selection clipboard`.
Neither is strictly better; the piping route is simpler when you plan ahead, tmux copy is for grabbing something you did not plan to capture.

### Tools that wrap Ollama

The Ollama command line is the floor, not the ceiling.
The ecosystem builds richer interactions on the same daemon.

- `llm` (Simon Willison): a pipeable CLI with templates, plugins, and conversation logging. Apache-licensed, widely used among Linux and command-line developers, and speaks to many backends with Ollama as one of them.
- `shell-gpt` (`sgpt`): turns a natural-language description into a shell command, then lets you review and run it.
- Open WebUI: a self-hosted web interface on top of Ollama with chat history, document Q&A (retrieval), file upload, and system-prompt presets. The "web AI but local" surface. It does not modify your filesystem; it is just a chat surface.
- aider: a terminal AI pair-programmer that reads, edits, and commits files in a git repo through conversation. Thin and open, with the smallest attack surface of the agentic tools. Built for frontier models; works with Ollama, but the quality gap shows on multi-step coding.
- continue.dev: a VSCode/JetBrains extension with inline autocomplete plus chat. Works with Ollama, but autocomplete needs sub-second responses, which means a GPU.
- Cline: an agentic VSCode extension that reads files, edits them, and runs terminal commands. Same hardware constraints as aider and continue.
- `ollama launch`: a built-in subcommand in recent versions that wires Ollama into coding agents and assistants automatically. Supported integrations include Claude Code, Codex, Copilot CLI, Droid, and OpenCode; `ollama launch claude` points Claude Code at your local Ollama, and `ollama launch openclaw` sets up OpenClaw as a personal assistant across WhatsApp, Telegram, Slack, and Discord.

Which to choose:

- Just chat and piping, nothing extra to install: `ollama run` directly.
- A scriptable CLI with logging and templates: `llm`. This is what most Linux and command-line developers reach for, and it is fully open source.
- Natural-language to shell commands: `shell-gpt`.
- A local web interface with document Q&A: Open WebUI.
- Editing files in a git repo you trust: aider (thin, open, smallest attack surface).
- Inline help inside an editor: continue.dev or Cline, once you have a GPU.

For a sovereignty-minded, CPU-only setup, the most open and most self-contained picks are `llm` and aider for the command line and Open WebUI for a browser surface; all three are permissively licensed and run entirely on your machine.

### Best way forward on a CPU-only laptop

A 16 GB CPU-only laptop does a couple of things well and several things poorly.
Lean into the former:

1. Install `xclip` immediately. It unlocks the piping and capture-to-clipboard workflow.
2. Use one-shot piping as your daily-driver pattern. It is where a local LLM is most useful and least sluggish.
3. Install Open WebUI if you want chat-with-files or document Q&A. Slow on CPU but functional, and installable with pipx.
4. Skip the agentic editor tools (continue.dev autocomplete, aider, Cline) until you have a GPU. The latency makes them frustrating rather than helpful.
5. For tasks that need frontier quality (hard reasoning, multi-step coding, long-context analysis), use a frontier web AI. Local Ollama complements it, it does not replace it.

When you later move to a mini-PC with an external GPU, revisit item 4: continue.dev's autocomplete becomes responsive, aider and Cline become genuinely useful for multi-file changes, and the latency-bound tools shift from frustrating to fine.

## Sovereignty-minded alternatives

Ollama is a friendly wrapper around llama.cpp, which is the actual inference engine underneath.
Most people never need to go below Ollama.
You only drop down to raw llama.cpp if Ollama's defaults block something you specifically need: a model file too large for it to load, a compression setting (quantization) it does not expose, or fine control over how the model picks each word (samplers).
If none of those bite you, skip this section.

If you do drop down, the interface is `llama-server`, a daemon similar to `ollama serve` but with the full llama.cpp surface, and a companion tool `llama-swap` handles switching between several loaded models.
It speaks the same OpenAI-compatible HTTP API, so anything pointed at `127.0.0.1:11434` for Ollama can usually be repointed at llama-server.
The Bitcoin-aligned framing is direct: run your own node, run your own model; both validate inputs under rules you set, and neither asks permission.

If you run StartOS (Start9's sovereign-server platform, a common home for a Bitcoin node, Nostr relay, or private cloud), Ollama is available as a dedicated package: the current `ollama-startos` release is v0.21.0 (April 2026), shipping generic x86_64 and aarch64 builds plus a ROCm GPU build, and a companion package bundles Ollama with Open WebUI.
Start9's own guidance on running AI next to Bitcoin services is to keep them on separate machines; the cautious move is dedicated hardware.
Bitcoin Knots users (Luke Dashjr's more conservative Bitcoin Core fork) sit in the same sovereign-stack orientation: pair a Knots node with Ollama on separate hardware over Tailscale or similar, and treat the AI machine as untrusted relative to your node.

How does StartOS packaging compare to this script, and why pick one over the other?
StartOS gives you a turnkey, GUI-managed service with automatic updates and backups, packaged ROCm GPU support, and Open WebUI bundled, running always-on alongside your other sovereign services.
This script gives you a local install on the laptop you already own, with no extra hardware, no Docker, and no server OS to maintain: a single sha256-verified file you can audit, that writes nothing outside its own tree and is trivial to undo, and that is portable across any x86_64 Linux box.
If you already run StartOS on a separate machine, use its package.
If you want a local model on your working laptop without standing up a server, this script is the right tool.
They are complementary, not competing.

For tasks where your local hardware cannot fit the model you need, the sovereignty-respecting alternative to OpenAI or Anthropic is not another centralized service; it is Nostr's Data Vending Machine layer (NIP-90).
You publish a job request to Nostr relays, providers compete to fulfill it, and payment goes over Lightning.
No account, no identity tied to a payment method, no Big Tech logging your prompts into a training corpus.
Routstr provides a drop-in OpenAI-compatible client that routes over this layer, with Tor and SOCKS5 support; you pay in sats per call and get inference from whichever provider bid lowest.
For Bitcoin and Nostr-aligned developers this is the analog of a Lightning-paid VPN over a Big Tech cloud: same capability, different trust model.

A caveat worth internalizing: open-weights is not open-source.
The model files you pull with `ollama pull` are the trained weights (Llama, Qwen, Gemma, DeepSeek, all of them).
What you do not get is the training code, the training data, or the recipe to reproduce them.
You cannot audit a downloaded model for backdoors, cannot verify it is not acting in its creator's interest under certain triggers, and cannot rebuild it from sources.
The script's sha256 check proves the file matches what upstream published; it does not prove the file behaves as advertised under all inputs.

A handful of models go further and publish weights, training data, and code together, which is the actual open-source bar.
They lag the open-weights frontier on raw capability, but they are the ones you can fully inspect:

- OLMo (Allen Institute for AI): the most prominent, now at OLMo 3 with 7B and 32B models plus full datasets, code, and training logs. https://allenai.org/olmo
- Pythia (EleutherAI): one of the earliest fully transparent model suites, Apache-2.0, with training data, code, and checkpoints; dated in quality but the benchmark for reproducibility. https://github.com/EleutherAI/pythia
- LLM360 (Amber, Crystal, K2): releases all training code, data, intermediate checkpoints, and analyses. https://www.llm360.ai
- M-A-P Neo and DCLM baseline models: further fully-open efforts that AI2 itself names alongside its own.

Which to pick: to actually run something useful and fully open, OLMo 3; to study or reproduce a training run, Pythia or LLM360; for everything else you pull through Ollama, assume it is open-weights, not open-source, and choose models from teams whose incentives you understand.
The "not your keys, not your coins" frame extends here: not your training, not your model.

## What's possible on bigger hardware

A few developments worth knowing for when you upgrade.
They change little for a 16 GB CPU-only laptop, but they reshape what a mini-PC with an external GPU or a 64 GB+ setup can do.

MoE (Mixture of Experts) architectures.
Qwen3-30B-A3B has 30B total parameters but activates only 3B per token.
It runs at roughly 3B speed while drawing on near-30B knowledge.
Qwen3-Coder-Next is 80B with 3B active, comparable to dense models with 10 to 20 times more active parameters, running on 46 GB of RAM or VRAM.
The full weights still have to fit, so "tiny RAM" is true relative to dense equivalents, not in absolute terms.

Unsloth dynamic quantization.
The Han brothers' open-source work compresses large models with minimal quality loss by using a different bit-depth per layer.
DeepSeek-R1's 671B model compresses from 715 GB to 162 GB at 1.66-bit dynamic.
This is the breakthrough that makes 30B+ models viable on prosumer hardware.
Their docs at unsloth.ai are the reference.

The current local-agent stack.
As of May 2026 this has stopped being a prediction and become real.
Nous Research's Hermes Agent is an open-source (MIT) agent framework that crossed 140,000 GitHub stars in under three months and is currently the most-used agent on OpenRouter; it is built to run locally and stay on all day.
It pairs with Alibaba's Qwen 3.6 models, where the 27B dense model matches the accuracy of 400B-class predecessors at one-sixteenth the size, and the 35B model runs in roughly 20 GB while surpassing 120B-parameter models.
NVIDIA's DGX Spark (shipping since October 2025, a desktop box with 128 GB of unified memory) and RTX-class GPUs are the hardware these are tuned for.
On a 16 GB CPU-only laptop you will mostly run distilled 4 to 8B versions; on a mini-PC with a GPU you can reach the 27 to 35B Unsloth-quantized variants and unlock most of the headline capability.

Chinese open-weight labs.
DeepSeek, Qwen (Alibaba), Kimi (Moonshot), GLM (Zhipu).
Faster release cadence than US labs, and competitive on specific benchmarks; Qwen3-Coder-480B claims rough parity with Claude Sonnet-4 on Aider Polyglot.
These are not more powerful than the closed frontier in general, but they are strong in specific domains (coding, math, multilingual) at no per-token cost if you can fit them.

## Security and trust model

The sha256 verification in the install script covers transit and CDN-layer integrity; it does not cover the trust you place in the agentic tools you point at your daemon.
Worth knowing what has actually happened in 2025 and 2026 before pointing any of them at sensitive code.

Anthropic's Claude Code has had a notable security track record.
CVE-2025-59536 (CVSS 8.7, October 2025) allowed arbitrary shell command execution via Hooks configuration when Claude Code was started in an attacker-controlled directory.
CVE-2026-21852 (January 2026) let malicious repositories exfiltrate Anthropic API keys before the trust prompt appeared.
CVE-2025-54794 and CVE-2025-54795 ("InversePrompt") added a path-restriction bypass and command injection via whitelisted commands.
CVE-2025-66479 was a sandbox bypass where `allowedDomains: []` was misread as "allow everything".
A SOCKS5 sandbox bypass affected around 130 versions over 5.5 months and was silently patched in v2.1.90 with no CVE and no mention in release notes; that is the one worth flagging, because the disclosure pattern was opaque.
A separate event in March 2026 was the leak of around 512K lines of Claude Code's TypeScript source via npm, which triggered more researcher review and surfaced a deny-rule bypass via subcommand-limit overflow.

The through-line is repository-controlled configuration: `.claude/settings.json`, hooks, MCP configs, and environment variables read from cloned repos.
These run with your privileges before the model is even invoked, so prompt-injection defenses do not help.
Open an untrusted repo, get owned.

What that means in practice for a sovereignty-minded workflow:

- Never run any agentic AI tool in a directory you do not fully trust.
- Pointing an agent at local Ollama does not shrink the local attack surface; the bugs are in the agent's configuration parsing, not its inference backend.
- The simpler agentic tools have smaller attack surfaces. aider is a thin layer over git and a model, with much less surface than a full settings/hooks/MCP system.
- Sandbox aggressively. Run agentic tools inside a container or VM if you will point them at unfamiliar repos. Bubblewrap, Firejail, or a full VM all work.
- Treat configuration files in cloned repos as executable code. Audit them before opening.

The conservative recommendation: use `ollama run` directly for chat and one-shot piping, reach for aider when you need file edits on repos you wrote yourself, and avoid running configuration-driven agents on untrusted codebases regardless of which backend they point at.

## Troubleshooting

Most errors are handled inline in the sections above, right where they come up.
The two that do not have a natural home:

- `Error: listen tcp 127.0.0.1:11434: bind: address already in use`: a daemon is already running, possibly a stale one. Find and stop it with `pkill -f 'ollama serve'`, then start fresh.
- `ollama: command not found`: `~/.local/bin/` is not on your `$PATH`. See the PATH fix in the Install section.

## Further reading

- Model catalog: https://ollama.com/library
- Docs: https://docs.ollama.com
- Manual Linux install: https://docs.ollama.com/linux
- HTTP API reference: https://docs.ollama.com/api