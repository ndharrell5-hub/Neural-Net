# Thought Spectrum

A small neural network with a bare-bones 3D interface. You upload your notes and saved quotes,
and it sorts them along a spectrum that runs from **philosophy** to **practical analysis**.

![spine from philosophy to practical analysis, with topic hubs and your notes orbiting them](#)

## Use it

Open `index.html` in a browser. It needs no build step and no server, but it does need internet
once to load three.js from a CDN.

**The map has three levels:**

1. **Universe.** Each galaxy is a white dot among the stars. Hover over one to see its name, and
   click to fly in. A galaxy is a collection, such as Quotes, Notes, or the research for one article.
2. **Galaxy.** Each sun is a sub-category. A galaxy works in one of two ways:
   - **Net-sorted:** the suns are the net's topics, laid out from philosophy (left) to practical
     analysis (right). They appear as items land in them.
   - **Named suns:** you create and name the suns. When you add something without choosing a sun,
     the net suggests one by comparing it with what you've already placed in each.
3. **Solar system.** Each planet is a note or quote. Quotes wear a ring, and longer passages are
   bigger planets. The tighter the orbit, the more surely the item belongs to that sun.

Hover over a planet to read it, and click it for details. Use **Esc** or **←** to go back up a level.

**Working with items:**

- **Add:** paste text or drop files into the panel, choosing a galaxy, and a sun for named-sun galaxies.
- **Teach:** in the detail card, move an item to another sun or galaxy. In net-sorted galaxies
  this retrains the net.
- **Links:** in the detail card, add links to articles, videos or anything else that belongs with an
  idea, each with an optional label. They open in a new tab, and planets with links get a small moon.
- **Search:** finds items in every galaxy, including link labels and addresses, and picking a result
  flies to its planet.
- **Export:** downloads everything as JSON.

### File formats

| Format | How it's read |
|---|---|
| `.txt` / `.md` | Paragraphs separated by blank lines. A block of bullets becomes one item per bullet. `#` headings are ignored. |
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
