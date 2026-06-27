+++
title = "hello world"
date = 2026-06-26
updated = 2026-06-27
+++

Lorem ipsum dolor sit amet[^1], consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.

This blog links to its own pages with Zola's internal-link syntax, here is [the second post](@/second-post.md), and to the wider web with ordinary Markdown links, like [the Zola documentation](https://www.getzola.org). Both kinds are explained in the guide.

This post carries an `updated` field in its frontmatter, so the header above shows both a publish date and a "last updated" date. Posts sort by publish date, not by the last-updated date, so revising an old post does not bump it to the top of the home page.

## Heading 2

Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat.

### Heading 3

Pellentesque congue. Ut in risus volutpat libero pharetra tempor. Cras vestibulum bibendum augue.

#### Heading 4

In condimentum facilisis porta. Sed nec diam eu diam mattis viverra.

##### Heading 5

Quis sollicitudin sapien justo in libero. Vestibulum mollis mauris enim.

###### Heading 6

Donec viverra auctor lobortis. Pellentesque eu est a nulla placerat dignissim.

---

## Lists

Unordered with nesting:

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
  - Nested item one
  - Nested item two
    - Deeper nested item
- Sed do eiusmod tempor

Ordered with nesting:

1. First item
2. Second item
   1. Nested first
   2. Nested second
3. Third item

---

## Text formatting

**Bold text**, *italic text*, ***bold italic***, ~~strikethrough~~, `inline code`, and a [link with a title](https://example.com "link title attribute"). An autolink: <https://example.com>.

---

## Blockquote

> Lorem ipsum dolor sit amet, consectetur adipiscing elit.
>
> Integer posuere erat a ante venenatis dapibus posuere velit aliquet.

---

## Table

| Column A   | Column B | Column C |
|------------|----------|----------|
| Lorem      | Ipsum    | Dolor    |
| Sit        | Amet     | Consect  |
| Adipiscing | Elit     | Sed      |

---

## Code blocks

A fenced block tagged with a language gets syntax highlighting:

```python
def lorem_ipsum():
    """Return a sample string."""
    items = ["Dolor", "sit", "amet"]
    return " ".join(items)
```

A shell example, same pattern:

```bash
echo "shell example"
for f in *.md; do
    echo "found: $f"
done
```

Without a language tag, the block is plain monospace with no colour:

```
raw text block
no highlighting
```

You can highlight specific lines with `hl_lines`:

```python,hl_lines=2 4-5
def plain_line():
    return "this line is highlighted"

def another():
    return "so are these two lines"
```

---

## Images

Images reference files in `static/`, which Zola serves at the site root:

![layered gray mountain silhouettes with a faint sun behind them](/demo.svg)

The file above is `static/demo.svg`. Replace or delete it.

---

[^1]: This is the footnote definition. Zola adds a back-reference link so readers can return to where they were.
