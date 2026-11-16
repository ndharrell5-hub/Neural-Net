# Thought Spectrum

A small neural network with a bare-bones 3D interface. You upload your notes and saved quotes,
and it sorts them along a spectrum that runs from **philosophy** to **practical analysis**.

![spine from philosophy to practical analysis, with topic hubs and your notes orbiting them](#)

## Use it

Open `index.html` in a browser. No build step and no server needed (it needs internet once to
load three.js from a CDN). Then:

- **Upload**: drop `.txt`, `.md`, `.csv` or `.json` files onto the page, or click the upload box.
- **Paste**: put one note or quote per line or paragraph. Quotes are detected from quotation marks,
  `>` blockquotes, or an attribution line like `— Marcus Aurelius`. You can also force a type.
- **Explore**: drag to orbit, scroll to zoom. Hover a point to read it and click it for details.
  Click a topic in the list to highlight it, or use the search box.
- **Teach**: in the detail panel, reassign an item to a different topic. The net retrains with
  your correction, which also shifts how it places similar items.
- **Export**: download everything as JSON, with each item's topic and spectrum position.
  You can upload that file again later.

Your items are saved in this browser's local storage. Nothing is uploaded anywhere.

**Shapes:** spheres are notes and diamonds are quotes. Colour shows the topic. Faint lines link
each item to its topic hub.

### File formats

| Format | How it's read |
|---|---|
| `.docx` (Word) | Each paragraph is an entry. An author line under a quote (`— Seneca`) attaches to it, and headings are skipped. Older `.doc` files need saving as `.docx` first. |
| `.txt` / `.md` | With no blank lines, one entry per line. With blank lines, each block is one entry, unless every line in it is a complete sentence or list item, in which case each line is. Author lines attach to the line above, and `#` headings are skipped. |
| `.csv` | Uses a `text` (or `quote`/`note`/`content`) column, plus `author` and `type` columns if present. Otherwise it uses the first column. |
| `.json` | An array of strings, or objects with `text`/`quote`, `author`, `type`. |

### Publishing as a claude.ai page

`python3 build-artifact.py` writes `dist/index.html`, which is the same page without the outer
`<html>` wrapper that claude.ai adds itself. It is published with `nn.js` and `parse.js` beside it.
On claude.ai the page keeps each person's notes in their own private store, so they sync across
devices. Export there asks you to confirm the save. Opened from disk, notes stay in that browser.

## How the network works (`nn.js`)

1. **Features.** Text is tokenised, lightly stemmed and hashed into a 4096-wide sparse
   bag of words and word pairs.
2. **Network.** 4096 inputs → 48 hidden (tanh) → 12 topics (softmax), trained with SGD in the
   browser in under a second.
3. **Topics.** There are 12, placed along the spectrum:
   Metaphysics & Reality · Meaning & Existence · Ethics & Virtue · Mind & Self ·
   Art, Beauty & Creativity · Society & Power · Knowledge & Learning · Relationships & People ·
   Health & Habits · Work & Productivity · Money & Economics · Strategy & Analysis.
4. **Taking liberties.** Training targets are *soft*: each topic leaks a little probability to
   its neighbours on the spectrum, so the net learns the topics form a continuum. An item's
   spectrum position is the probability-weighted average of the topic positions. Mixed
   material therefore lands *between* topics, and the label follows the net's certainty:
   - a confident call gets a single topic (e.g. *Ethics & Virtue*),
   - two strong pulls get a blend (e.g. *Strategy × Money*),
   - a diffuse call is named by where it falls (e.g. *Between Art & Society*).
5. **Learning your vocabulary.** The net starts from seed phrases for each topic. Then it
   *self-trains* on your own notes it is fairly sure about, so your words start to carry
   meaning. Corrections you make count as strong training examples.
6. **3D layout.** An item's x-position is its spectrum position. Around that, it orbits its
   topic hub at an angle taken from its hidden-layer activations, so items the net "thinks
   about" similarly sit on the same side.

To change or add topics, edit `TOPICS` in `nn.js`. Each needs a `pos` between 0 and 1 and some
seed words.

## Tests

```bash
node test.js
```
