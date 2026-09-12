# Static Site Generators: Which one to pick in 2026
*Which SSG to pick in 2026 for a blog, and which to pick for a book. The plan is to keep this post updated as things change.*

## TL;DR

For a blog, pick Zola or Hugo. Single binary, no Node, builds in milliseconds, and a site that will still build in 2036 from a binary and a tarball without a `node_modules` archaeology project. 
Astro is the consensus pick if you specifically need React islands or want a Cloudflare-backed managed path; most blogs don't, and the single-binary route is the one that lets you stop thinking about the toolchain.

For a book or knowledge base, pick mdBook. 
Pick Quarto if you need PDF and ePub from the same source or there's executable code in it. 
Pick Sphinx with MyST Markdown if you need deep cross-referencing, glossaries, indexes, or LaTeX output.

For a digital garden or an Obsidian vault you want to publish online with wikilinks, backlinks, and a graph view, pick Quartz. Nothing else on this list serves that use case natively.

## Why an SSG, and not Substack, Medium, or Write Freely

When considering where to publish, there are three categories worth comparing: Hosted platforms, Self-hosted dynamic platforms, and Static site generators.

Hosted platforms (Substack, Medium, Ghost Pro, Bear Blog, and the long tail of similar services). 
You write in a polished editor; the platform handles hosting, discovery, analytics, comments, and -- for Substack and Ghost Pro -- paid subscriptions. 
The cost is that the platform owns your content: your URL, your subscriber-relationship format, the recommendation algorithm, the moderation policy, the aesthetic, and often a revenue cut. 
Lock-in varies. 
Substack's newsletter export is workable, Medium's is rougher, but the network effects of platform-native discovery don't transfer no matter how clean the export. 
Substack is the strongest pick if a paid newsletter is the goal; Medium reaches Medium's reader network at the cost of a paywall most casual readers don't cross; Ghost Pro is closer to a portable self-hosted Ghost with managed ops; Bear Blog and similar minimalist services compete on simplicity, with smaller-scale in-platform discovery than Substack or Medium.

Self-hosted dynamic platforms (WordPress, Ghost self-hosted, Write Freely). 
You own the URL, the database, and the software. Write Freely is the most notable for readers of this doc: single Go binary, ActivityPub-native so Mastodon and Pleroma users can follow the blog directly; it has a distraction-free editor and runs on a Raspberry Pi. 
As of v0.16 (still pre-1.0), it powers around 550,000 blogs on the hosted Write.as service - the same software with the ops handled. 
The cost of self-hosting any platform in this category is real: server uptime, security patches, database and content backups, and an attack surface that grows with every plugin or theme.

Static site generators. 
Output is plain HTML on disk, no database, no server-side runtime, no CMS to patch. 
Deploy targets include GitHub Pages or Cloudflare Pages for free, a $5 VPS, a CDN, or a USB stick. 
Source is Markdown in Git, which (per the hundred-year section) outlasts every platform on this page. 
The honest costs: no built-in audience or recommendation algorithm, no comments without an external service, no subscriber-and-email management without something like Buttondown or Listmonk bolted on, content editing means opening a text file in an editor and running a build (mobile publishing is awkward), and any nontrivial design change means learning the SSG's templating language.

Conclusion:
Pick a hosted platform when audience growth and monetization dominate the decision and you accept the platform owning the relationship. 
Pick Write Freely or another self-hosted-dynamic platform when you want full ownership (and possibly federation) without a build step, and you're willing to run a server. 
Pick an SSG when you want plain-text portability, minimum substrate, and free or near-free hosting, and you're fine with a writer's workflow that runs through Git and a terminal.
This 

## Decision shortcut

For a blog, in order of preference:

1. Zola or Hugo. Single binary, leave-you-alone community, site that builds in 2036.
1. Eleventy if you want JS minimalism without framework weight.
1. Jekyll only if you're already on GitHub Pages and happy.
1. Astro if you specifically need React islands or want Cloudflare-backed hosting.

For a knowledge base or documentation site, in order of preference:

1. mdBook. Simplest, fastest, meant to live on the web but also has print capabilities.
1. MkDocs + Material, built on Python, good for most project docs.
1. Docusaurus only if you need versioned multilingual docs and you're already React-heavy.
1. Sphinx + MyST for large, reference-heavy, cross-linked docs.
1. Astro + Starlight.

For a book, in order of preference:

1. mdBook.
1. Quarto if you need PDF/ePub from one source or there's executable code in it.
1. Sphinx + MyST (or Jupyter Book for an easier starting point built on the same foundation) if it's academic, reference-heavy, or Python-adjacent.

For a digital garden or Obsidian vault, in order of preference:

1. Quartz. The only tool on this list designed specifically for this.
1. Astro with a community wikilinks plugin, if you need more design control and are willing to wire it up yourself.
1. Obsidian Publish (the commercial first-party option), if you don't want to self-host at all.

## What counts as "widely used" in 2026

Rough current signals (GitHub stars, download trajectories, State of JS/HTML surveys):

- Next.js has ~139k GitHub stars and the largest ecosystem of any SSG-capable framework.
- Hugo has roughly 87,665 stars as of April 18, 2026, with a fast release cycle.
- Astro has roughly 58,517 stars as of April 17, 2026.
- Astro ranked #1 in State of JavaScript 2025 meta-framework satisfaction, 39 points ahead of Next.js.
- MkDocs plus the Material theme is behind a large fraction of open-source project documentation portals.
- Sphinx still has roughly 2.5x the live-site footprint of Quarto, despite Quarto's rapid growth in the scientific and data communities.
- Jekyll is the default on GitHub Pages and still runs countless personal sites, even though new projects rarely pick it.

## Build reproducibility and the ten-year test

A real data point when comparing SSGs, is rarely named out loud: will the same source files build the same site in ten years with minimal intervention.

Single-binary SSGs win this decisively. A Hugo, Zola, or mdBook binary from 2026, kept on disk, will build your site identically in 2036. No interpreter to install, no package registry to query, no transitive dependencies to resolve. You can tar the binary with your content and walk away.

Python SSGs (MkDocs, Sphinx) sit in the middle. Python itself is stable enough that the stdlib-only parts work for decades, but plugins pull in the broader PyPI ecosystem, which has its own deprecation cycles. Pinning versions in `requirements.txt` and periodically rebuilding the environment is the realistic maintenance path.

Ruby SSGs (Jekyll) sit between Python and Node. Ruby itself is more stable than the npm ecosystem and less stable than Python's stdlib floor. A `Gemfile.lock` pinned to a specific Ruby version, kept alongside the content, will usually resurrect a Jekyll site years later, but you're maintaining a Bundler environment and a gem set, not just keeping a binary on disk. Better than Node, worse than Hugo or Zola.

Node-based SSGs (Astro, Next.js, Docusaurus, Eleventy, Quartz) sit at the hard end of this spectrum. JavaScript projects from 2020 routinely fail to build in 2026 without real dependency archaeology: deprecated packages, broken lockfiles, Node versions that no longer support your toolchain. This is not theoretical and it is not solvable by being careful. It's the nature of the npm ecosystem. For long-lived sites this matters; for sites you rebuild weekly it doesn't.

Quarto is a special case: the Quarto binary is single-distributable, but if your `.qmd` files execute Python or R code at render time, you also need to preserve those runtimes and their package versions. Pure-prose Quarto is reproducible; computational Quarto needs the same conda/renv discipline as any scientific project.

When the use case is genuinely open, a blog, a personal site, a reference doc, pick the single-binary tools. 
Hugo, Zola, and mdBook will build in 2036 from a binary and a tarball on disk. 
And as the next section argues, these happen to be the same tools whose communities will leave you alone. 
When two independent axes point at the same names, that's a stronger signal than either axis produces on its own.

## Content durability and the hundred-year horizon

The ten-year test above is a useful floor. The hundred-year question is a different one, and the answer changes the architecture. No SSG on this list has a credible shot at lasting a century, not Hugo, not Sphinx, not Quarto, not any of them. If the project's horizon is actually that long (a reference encyclopedia, a denominational catechism, a dynasty-scale knowledge base), the question stops being "which tool" and becomes "which source format, which storage system, and what's the migration plan when the current tool ages out."

What's proven durable at fifty years or more: plain UTF-8 text, LaTeX (frozen by Knuth on purpose), HTML (backwards-compatible by charter), PDF (ISO-standardized), Unix file conventions, and Git (twenty years and clearly winning as the Schelling point for the next several decades). What hasn't proven durable: any specific SSG, any JavaScript framework, any particular version of a Ruby, Python, or Go tool, any cloud service, any company's product. Gatsby was the frontier five years ago and is effectively dead. Jekyll still runs but is culturally static at sixteen. That's the base rate.

The architecture for a hundred-year, many-thousand-page living work is three decisions, only one of which is about an SSG.

First, source format. Write in MyST-flavored CommonMark. MyST is CommonMark with academic-publishing extensions (roles, directives, cross-references, citations) that also parse cleanly as Pandoc-Markdown, so if the Python ecosystem fades, a Rust or OCaml or whatever-comes-next tool can still read the files. This is the decision that must be right.

Second, storage. Git. Content-addressable, distributed, already embedded in every serious workflow. The Linux kernel has around 80,000 files in git and scales fine; tens of thousands of Markdown files is not a storage problem.

Third, the build tool, which will be replaced several times over a century. For today, Sphinx with MyST is the strongest pick at large scale: an eighteen-year track record building CPython, NumPy, SciPy, pandas, and Django, all themselves decades-old projects. Crucially, Sphinx's semantic cross-references (`:ref:` to a content-addressed label) survive file reorganization; Hugo's text-based `[link](path/to/page.md)` model breaks silently when you rename pages, which becomes catastrophic past roughly 5,000 pages. If the budget exists, a custom Pandoc-based pipeline owned in-house is the only approach where no one can deprecate you. It's what Wikipedia did with MediaWiki and what serious reference works have always done.

Two architectural commitments go with this. First: URL slugs, not file paths, as canonical identifiers. `/v1/topic/subtopic/` style, stable forever, independent of where the source file lives. Second: the build layer is reviewed and possibly replaced every fifteen years, but the source files and their cross-reference labels are never touched destructively.

The Catholic Encyclopedia is the concrete precedent. It started as handwritten manuscripts, moved to typesetting, moved to Word, moved to XML, and is now partly on the web. The content outlived five toolchains because the editorial tradition treated each tool as temporary and each migration as a planned operation. That is the shape of the real answer. If you're asking "which SSG lasts a hundred years", you are asking the wrong question; those who building hundred-year knowledge systems pick durable source formats and replaced their tooling three times.

## Community politics and the vibe test

Another axis most SSG comparisons pretend doesn't exist: the cultural gravity of the community and corporate backer around each tool. The tools themselves don't have politics. The communities, founders, and owners very much do, and that shapes what gets prioritized, what CoC fights you might get pulled into, and how the project behaves under pressure. Roughly sorted right to left:

Right-coded: Hugo, Zola, and mdBook. Go and Rust single-binary ethos, anti-dependency, corporate-pragmatic or institutional-narrow. Hugo and Zola are built on a "ship a binary, own your stack, no drama" value proposition that is about as right-coded as a build tool gets. mdBook sits with them by stack and purpose, though the Rust Foundation's broader CoC posture bleeds in around the edges.

Center: Eleventy, MkDocs with Material, and Jekyll. Technocratic-neutral. Eleventy is run close to the chest by Zach Leatherman. Material for MkDocs is commercially sustainable through Squidfunk's Insiders model and conspicuously absent from political fights. Jekyll is an old GitHub Pages default that just serves everyone equally.

Center-left: Astro, Quartz, and Next.js. Silicon Valley defaults. Astro is Cloudflare-owned, which means Cloudflare's content-moderation and access-restriction posture will flow downstream eventually. Quartz is academic and digital-garden crowd, demographically young and academic-left. Next.js and Vercel are standard VC-backed SV progressive.

Left-coded: Docusaurus, Sphinx, and Quarto. Docusaurus is Meta corporate progressive, with Meta's DEI apparatus attached. Sphinx isn't politically loud as a tool, but it lives inside the Python community, which runs some of the most visible CoC and governance fights in open source. Quarto is Posit and academic data science, quieter than the others but demographically the most uniformly academic-progressive community on the list.

If you want software whose community will leave you alone, Hugo or Zola. If you want software embedded in an explicitly-progressive community, Sphinx, Quarto, or Docusaurus. Everyone else is mostly just trying to render Markdown.

## Astro

An HTML-first framework that ships zero JavaScript by default and lets you mix in React, Vue, Svelte, or Solid components as "islands" only where you need them.

Built in: TypeScript and Node, with a Go-based compiler distributed as WASM.

License: MIT.

Good for: blogs, marketing sites, docs, anything content-heavy. The Starlight theme is a first-class docs setup that now powers docs for Cloudflare, Google, Microsoft, Netlify, OpenAI, and many others.

Bad at: being a no-dependency toolchain. You're buying into Node, Vite, and npm. If your 10-year plan is "I want this site to build on a fresh Debian with zero fuss," Astro is not that. Also: Cloudflare acquired Astro in January 2026, which is net positive for funding but introduces a real risk of Cloudflare-favoritism in future features.

Trajectory: up and to the right. 113 releases in 2025, Astro 6 landing in early 2026 with Server Islands and Live Content Collections. This is the SSG to bet on for a new blog today if you're fine with Node.

Use if: you want the most popular, best-documented static-first option and you don't mind npm.

## Hugo

The fastest mainstream SSG. Single binary, Go-based, zero runtime dependencies, builds measured in milliseconds per page.

Built in: Go. Templates use Go's `text/template` syntax, which most people hate on first contact and tolerate later.

License: Apache 2.0.

Good for: blogs, marketing sites, personal sites, any content where you want to write Markdown, run `hugo`, and deploy a directory. Handles very large sites (5000+ pages) without complaint.

Bad at: the template language. Go templates are unfriendly compared to Jinja, Liquid, or JSX. Customizing a theme deeply usually means fighting with `range`, `with`, and scope rules. This is literally why Zola exists - the Zola author built it because they hated Hugo's template engine.

Trajectory: stable and maintained. Active release cadence through early 2026, with monthly releases typical. Not growing explosively, but not going anywhere either.

Use if: you want maximum build speed, a single binary, and you're willing to tolerate Go templates (or you'll use a stock theme and never touch them).

## Next.js

Not really an SSG, but it can do static generation, and a lot of "static" sites in 2026 are actually Next.js sites with `output: 'export'` or `generateStaticParams`.

Built in: TypeScript, React, heavy Node toolchain.

License: MIT.

Good for: teams already in the React ecosystem who want the option to go dynamic later. Incremental Static Regeneration, API routes, edge rendering, and React Server Components all in one box.

Bad at: being a static site generator. It's a full-stack framework that happens to support static export. The dependency surface is large, build times balloon on big sites, and you're locked into Vercel's direction unless you self-host (which is possible but nontrivial).

Trajectory: dominant in React-land, not really competing for the "I want a fast static blog" slot anymore - Astro ate that lunch.

Use if: your team already writes React all day and you want to keep the option to add a backend later.

## Jekyll

The original. Ruby-based, Markdown + Liquid templates, and the default engine behind GitHub Pages.

Built in: Ruby.

License: MIT.

Good for: a zero-infrastructure personal blog where you push to `gh-pages` and it just works. If you already have a working Jekyll site, there's rarely a good reason to migrate.

Bad at: build speed at scale, Ruby dependency management, and anything modern-JS-flavored. Plugins are limited on GitHub Pages' whitelist.

Trajectory: maintained but culturally static. Nobody is starting new enterprise projects on Jekyll in 2026. It survives on inertia and GitHub Pages' default.

Use if: you want the simplest possible "commit Markdown, get a blog" loop and you're on GitHub Pages. Otherwise, pick something else.

## Eleventy (11ty)

A minimalist JS SSG that's deliberately small in scope. Supports Markdown, Nunjucks, Liquid, Handlebars, and straight JS for templates. No client-side framework, no build bundler by default.

Built in: Node.js.

License: MIT.

Good for: small to medium blogs and marketing sites where you want JS-ecosystem convenience without shipping React or Vue. Used by Netlify and the Chrome Developers site, among others.

Bad at: batteries. You assemble the site yourself. For docs or large structured content, you'll end up writing more glue than with Astro or Hugo.

Trajectory: steady, beloved by a quiet crowd, not growing fast. A solid second-choice after Astro if you want something lighter.

Use if: you want JS SSG without framework weight, and you enjoy building things up from small pieces.

## Zola

A single-binary Rust SSG in the Hugo family tree, using Tera templates (a Jinja2 clone). Sites build in under a second on average, including Sass compilation and syntax highlighting.

Built in: Rust.

License: MIT.

Good for: personal blogs, small-to-medium sites, documentation, landing pages. If you like Hugo's architecture but hate Go templates, Zola is the answer.

Bad at: ecosystem size. Fewer themes than Hugo, fewer plugins than MkDocs, smaller community. If your site has unusual requirements, you'll sometimes hit a wall where you'd just have found a plugin in Hugo or MkDocs. No native i18n workflow as mature as Sphinx's gettext-based pipeline, though basic multilingual support exists.

Trajectory: slow, steady, healthy. Not exploding, not dying. Governance is controlled by a small maintainer team, which is a risk factor worth noting.

Use if: you want a fast, simple, single-binary SSG with a template language that doesn't make you angry. This post is published on Zola.

## Quartz

A static site generator built specifically for publishing Obsidian vaults and digital gardens. Out of the box it handles wikilinks, backlinks, transclusions, an interactive graph view, popover previews on link hover, and full-text search.

Built in: Node.js and TypeScript (v22+ required). Configuration is TypeScript, not YAML or TOML. You fork the Quartz repo, drop your Markdown into `content/`, edit `quartz.config.ts`, and push.

License: MIT.

Good for: anyone with an Obsidian vault who wants the published version to behave like the vault. Digital gardens, second-brain sites, interconnected note collections, lecture notes with heavy cross-linking. The `publish: true` frontmatter convention lets you keep private notes private and only surface the subset you want on the web, which is the workflow most Obsidian users actually want.

Bad at: everything that isn't a digital garden. Traditional blog layouts fight the default theme. Documentation with formal structure (versioning, i18n, strict navigation) is not the target. Node dependency is heavy compared to Hugo or Zola. Wikilinks to notes you haven't created yet render as broken links by default, which is a real UX problem for gardens-in-progress; there are community workarounds but no native fix.

Trajectory: actively maintained with a visible roadmap. One concrete risk worth flagging: Quartz v4 was a from-scratch rewrite that scrapped the v3 Hugo-based codebase and moved to Node.js. The project has already changed foundations once in its short life, and a v5 rewrite is not impossible. If you fork Quartz, you own the fork; upstream changes can be disruptive.

Use if: your source material lives in Obsidian and you want it on the web with the Obsidian experience intact. Almost nothing else on this list does this well.

## Docusaurus

React-based docs framework from Meta. Excellent versioning and internationalization, clean default theme, MDX support.

Built in: React, Node.

License: MIT. Maintained by Meta.

Good for: software project docs with multiple versions, multiple languages, and a need for interactive React components inside Markdown.

Bad at: being simple. It's a React app pretending to be a docs tool. Heavy dependency tree, slower builds than Hugo or Zola, and MDX errors can be painful to debug for writers who don't know React.

Trajectory: still widely used for open-source project docs, but losing ground to Astro's Starlight, which covers most of the same use cases with less weight.

Use if: you need versioned multilingual docs with React islands, and your team is already React-shaped. Otherwise consider Starlight first.

## MkDocs (with Material)

MkDocs is a Python Markdown docs generator. The Material for MkDocs theme, maintained by Squidfunk, is what most people actually mean when they say "MkDocs" - tabs, admonitions, instant search, mobile-first design, dark mode.

Built in: Python.

License: MkDocs is BSD-2-Clause. Material for MkDocs is MIT, with a paid "Insiders" tier that ships new features to sponsors first before they land in the free version (usually after several months to a year). The base theme is fully functional without Insiders. If a tutorial references a Material feature you can't find, check whether it's been released to the public tier yet.

Good for: project documentation. Very good at it. The Material theme is best-in-class for mobile reading experience and search UX. The plugin ecosystem is mature.

Bad at: cross-referencing at scale. No `:ref:` equivalent, no semantic links, no AST-level extensibility. If you rename a page, you fix links by hand. For docs under ~1000 pages this is fine; beyond that, Sphinx starts winning on maintenance.

Trajectory: stable and healthy. Squidfunk makes a living from the Insiders sponsorship model, which makes Material one of the more sustainably-funded open source projects in the SSG space.

Use if: you want pleasant-to-read project docs without ceremony, and your docs fit in one logical set with straightforward navigation.

## Sphinx (with MyST)

The 18-year-old Python documentation workhorse. MyST Markdown is a modern CommonMark-compatible dialect that gives you Sphinx's power (directives, roles, cross-references) without writing reStructuredText.

Built in: Python.

License: BSD-2-Clause.

Good for: large, structured, long-lived technical documentation. Cross-references that survive file moves. Glossaries, indexes, LaTeX output, ePub output, multi-language builds via gettext. Python-ecosystem projects.

Bad at: fast iteration and writer onboarding. Even with MyST, the mental model is heavier than MkDocs. Theme customization is less pleasant than Material. Builds are slower.

Trajectory: stable, foundational, not going anywhere. Jupyter Book and myst-parser keep the ecosystem evolving around it. Sphinx's own documentation at sphinx-doc.org is built with Sphinx, as are the CPython language docs, NumPy, SciPy, pandas, scikit-learn, Django, and most of the scientific Python ecosystem - the clearest concrete evidence for the institutional-backing claim above.

Use if: your docs are big, structured, reference-heavy, or you need multi-format output for academic or compliance reasons. Also: if you're documenting a Python project with lots of autodoc.

## mdBook

The Rust project's own book tool, maintained in the `rust-lang` GitHub organization alongside the Rust compiler itself. Used to render "The Rust Programming Language" and a lot of other programming books. Institutional backing is as strong as any SSG on this list - not a hobby project that can be abandoned by a single maintainer.

Built in: Rust. Single binary.

License: MPL-2.0.

Good for: programming books and linear-reading technical manuals intended for the web. Fast, simple, clean default theme.

Bad at: anything that isn't a linear book. Flat `SUMMARY.md` navigation doesn't scale past a few hundred pages. No semantic cross-references, no content reuse primitives beyond community plugins, no native PDF/ePub output (the plugins that exist are brittle), no i18n story.

Trajectory: stable, narrow-purpose, well-maintained.

Use if: you're writing a programming book or manual that lives on the web, under ~200 pages, and you want it to look like the Rust Book. Outside that niche, pick Quarto or Sphinx.

## Quarto

A scientific and technical publishing system from Posit (formerly RStudio). Built on Pandoc. Renders one Markdown source (`.qmd`) to HTML, PDF, Word, ePub, presentations, websites, books.

Built in: TypeScript, wrapping Pandoc and Knitr/Jupyter.

License: MIT. Maintained by Posit (formerly RStudio); the company has commercial products but Quarto itself is free software.

Good for: books, papers, articles, and any writing that mixes prose with executable code in R, Python, Julia, or Observable. Kieran Healy used Quarto to produce his Data Visualization book end-to-end, with figures generated by live R code in the manuscript and both PDF and web output from a single source.

Bad at: arbitrary web design. You get Quarto's layout conventions; fighting them for custom layouts is possible but unpleasant. Not a replacement for Sphinx when you need deep cross-referencing semantics.

Trajectory: still smaller than Sphinx in deployed-site count, but growing fast. Clearly the right tool for scientific and technical book authors in 2026.

Use if: you're writing a book or long-form technical piece and you want HTML, PDF, and ePub from one source without a LaTeX PhD.