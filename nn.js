// nn.js — a small, dependency-free neural network that sorts notes and quotes
// onto a spectrum running from pure philosophy (0) to practical analysis (1).
//
// Pipeline:  text -> tokens -> hashed sparse bag of words/bigrams
//            -> hidden layer (tanh) -> softmax over topics
// The spectrum position of an item is the probability-weighted average of the
// topic positions, so an item the net is unsure about lands *between* topics.
// Works in the browser and in Node (no DOM access in this file).
// Loads as a plain <script> (exposes window.NN) or via require() in Node,
// so index.html works when opened straight from disk.
(function (root) {
'use strict';

// ---------------------------------------------------------------------------
// Topics: ordered from philosophy to practical analysis. `pos` is the spot on
// the spectrum. `seeds` teach the net what each topic sounds like; the net
// generalises from them and then from your own notes (self-training).
// ---------------------------------------------------------------------------
const TOPICS = [
  {
    id: 'metaphysics', name: 'Metaphysics & Reality', pos: 0.0, color: '#b48cff',
    seeds: [
      'ontology cosmology metaphysical transcendent transcendence immanent universe cosmos infinity eternal timeless existence being nonbeing nothingness void substance essence form matter spirit soul god gods divine deity creation creator reality illusion maya appearance noumenon phenomenon determinism fate destiny causation cause necessity contingency possible worlds dimension simulation consciousness panpsychism dualism monism idealism materialism physicalism tao dharma karma brahman sacred mystical mysticism heaven afterlife reincarnation',
      'being existence reality nature of the universe substance essence',
      'time space eternity infinite cosmos god divine soul spirit',
      'what is real consciousness illusion appearance truth absolute',
      'the one and the many being and becoming permanence change',
      'free will determinism fate causality necessity possibility',
      'mystery of existence why is there something rather than nothing',
      'mind and matter dualism idealism materialism ontology',
      'the eternal return the void nothingness emptiness tao',
    ],
  },
  {
    id: 'meaning', name: 'Meaning & Existence', pos: 0.1, color: '#9f8cff',
    seeds: [
      'meaning meaningless purpose absurd absurdity nihilism existential existentialism camus sartre kierkegaard nietzsche dostoevsky death dying mortality finite suffering pain despair dread angst anxiety hope faith longing yearning grief loss joy wonder awe life lived living alive authenticity authentic freedom choice will why destiny calling legacy happiness fulfillment flourishing transience impermanence acceptance surrender',
      'meaning of life purpose absurd death mortality suffering',
      'existential freedom anxiety despair authenticity choice',
      'to live is to suffer to survive is to find meaning in the suffering',
      'we are condemned to be free man creates himself',
      'hope faith longing joy sorrow grief the human condition',
      'what makes a life worth living fulfilment happiness',
      'one must imagine sisyphus happy the struggle itself',
      'impermanence acceptance letting go fear of death',
    ],
  },
  {
    id: 'ethics', name: 'Ethics & Virtue', pos: 0.2, color: '#8ca0ff',
    seeds: [
      'ethics ethical moral morality virtue virtues vice good evil right wrong ought duty obligation justice fair fairness honesty truthfulness integrity courage bravery temperance prudence wisdom humility pride greed envy compassion mercy kindness charity generosity forgiveness guilt conscience responsibility character stoic stoicism aristotle kant utilitarian consequences principle obstacle endure adversity discipline self-control marcus aurelius seneca epictetus',
      'virtue morality good evil right wrong justice duty',
      'character courage honesty integrity wisdom temperance',
      'how should one live the good life ethics moral obligation',
      'compassion kindness forgiveness responsibility conscience',
      'stoic virtue is the only good control what you can',
      'do unto others golden rule respect dignity fairness',
      'the unexamined life is not worth living',
      'humility pride greed vice sin redemption',
    ],
  },
  {
    id: 'mind', name: 'Mind & Self', pos: 0.32, color: '#8cc0ff',
    seeds: [
      'mind mental psychology psychological self ego identity personality consciousness awareness attention perception memory dream dreams thought thinking thoughts emotion emotions feeling feelings mood brain neuroscience subconscious unconscious freud jung therapy trauma healing anxiety depression fear anger shame guilt desire craving mindfulness meditation presence breath calm stillness inner introspection self-awareness ego story narrative identity overthinking rumination',
      'self identity ego consciousness thought emotion feeling',
      'psychology mind attention perception memory dreams',
      'know thyself self awareness introspection inner life',
      'anxiety fear anger desire motivation subconscious',
      'mindfulness meditation presence calm stillness',
      'the mind is everything what you think you become',
      'cognitive bias belief habit of thought mental model of self',
      'emotional intelligence resilience vulnerability shame',
    ],
  },
  {
    id: 'art', name: 'Art, Beauty & Creativity', pos: 0.42, color: '#8cdcff',
    seeds: [
      'art artist artistic beauty beautiful aesthetic aesthetics music song songs melody poem poetry poet painting painter drawing sketch novel novelist fiction story stories writer writing chapter dialogue prose plot character characters film movie cinema photography photo design designer craft style creative creativity imagination inspiration muse originality expression voice draft revise edit rewrite dance theater sculpture museum',
      'art beauty aesthetic music poetry painting literature',
      'creativity imagination inspiration muse craft style',
      'writing a novel story narrative character plot',
      'the artist sees what others overlook design form',
      'creative process originality expression voice',
      'film photography song melody rhythm dance',
      'art is a lie that makes us realize truth',
      'sketch draft revise make things build something beautiful',
    ],
  },
  {
    id: 'society', name: 'Society & Power', pos: 0.5, color: '#8cffe0',
    seeds: [
      'society social politics political power state government law laws rights freedom liberty democracy republic senate parliament vote election citizen citizens nation empire rome roman greek history historical civilization culture tradition revolution war peace army conflict leader leadership authority institution institutions class inequality poverty wealth gap justice reform policy religion church media propaganda technology progress collapse decay rise fall',
      'society politics power state government law freedom',
      'history civilization culture tradition revolution',
      'democracy citizens rights equality class justice',
      'war peace empire nation leader authority',
      'community institutions religion media propaganda',
      'technology changes society social media future of humanity',
      'power tends to corrupt absolute power corrupts absolutely',
      'inequality poverty progress reform policy',
    ],
  },
  {
    id: 'knowledge', name: 'Knowledge & Learning', pos: 0.58, color: '#8cffb0',
    seeds: [
      'knowledge learn learning learned study studying student students teacher school university college education course lecture class notes reading read book books library author summary takeaway idea ideas science scientific evidence theory experiment research curiosity question questions understand understanding ignorance truth epistemology skill skills practice mastery memorize memory flashcards spaced repetition language',
      'knowledge learning education study reading books',
      'science evidence theory experiment hypothesis method',
      'curiosity questions understanding wisdom ignorance',
      'how to learn faster memorize practice spaced repetition',
      'teachers students school university lecture notes',
      'the more i learn the more i realize how much i do not know',
      'reading list book summary key ideas takeaways',
      'skill mastery deliberate practice feedback',
    ],
  },
  {
    id: 'relationships', name: 'Relationships & People', pos: 0.66, color: '#b8ff8c',
    seeds: [
      'love lover friend friends friendship family mom dad mother father parents sister brother kids children son daughter wife husband partner marriage dating relationship relationships communication talk listen listening conversation empathy trust apology apologize forgive argument fight conflict boundaries respect loneliness belonging connection intimacy support gratitude thank call text visit birthday wedding team mentor coworker neighbor',
      'love friendship family relationships marriage partner',
      'communication listening conversation trust empathy',
      'conflict argument apology boundaries respect',
      'parents children friends community belonging loneliness',
      'how to talk to people negotiation persuasion influence',
      'networking mentor team collaboration feedback',
      'be kind for everyone you meet is fighting a hard battle',
      'dating connection intimacy support gratitude',
    ],
  },
  {
    id: 'health', name: 'Health & Habits', pos: 0.74, color: '#e4ff8c',
    seeds: [
      'health healthy exercise workout gym run running miles jog walk steps lift lifting strength cardio yoga stretch fitness sleep bed bedtime nap wake alarm diet nutrition food meal meals eat eating protein vegetables sugar fasting calories weight water hydrate doctor medicine therapy pain injury recovery rest energy tired fatigue burnout stress habit habits routine streak morning evening tuesday thursday',
      'health exercise fitness workout running strength',
      'sleep diet nutrition food eating fasting protein',
      'habits routine morning discipline consistency',
      'stress recovery energy rest burnout',
      'small habits compound atomic habits streak',
      'doctor medicine body weight heart rate steps',
      'meal plan grocery list calories water hydration',
      'quit bad habit replace cue craving response reward',
    ],
  },
  {
    id: 'work', name: 'Work & Productivity', pos: 0.82, color: '#ffd88c',
    seeds: [
      'work job career boss manager coworker office remote meeting meetings agenda email inbox calendar schedule deadline deadlines task tasks todo checklist project projects plan planning milestone deliverable launch ship sprint backlog priority priorities focus productivity productive procrastination efficient workflow system tool app process review weekly goal goals okr promotion resume interview client vendor vendors',
      'productivity focus deep work time management',
      'todo list tasks deadline schedule calendar priorities',
      'career job boss interview promotion resume',
      'project plan milestone deliverable meeting agenda',
      'procrastination getting things done workflow system',
      'goals okr weekly review quarterly plan',
      'email inbox zero notes tool app setup',
      'shipping launch product team sprint backlog',
    ],
  },
  {
    id: 'money', name: 'Money & Economics', pos: 0.9, color: '#ffb48c',
    seeds: [
      'money cash dollar dollars budget budgeting save saving savings spend spending spent expense expenses cost costs price prices pricing cheap expensive groceries bill bills rent mortgage loan debt credit card tax taxes income salary pay paid raise invest investing investment stock stocks bond fund index portfolio retirement interest compound dividend economy economic economics inflation market markets business revenue profit sales customer',
      'money finance investing stocks bonds index fund',
      'budget saving spending expenses income salary',
      'economics market price supply demand inflation',
      'business startup revenue profit customers sales',
      'compound interest retirement portfolio dividend',
      'debt loan mortgage rent tax credit card',
      'cost benefit return on investment margin pricing',
      'wealth rich poor value capital labor',
    ],
  },
  {
    id: 'analysis', name: 'Strategy & Analysis', pos: 1.0, color: '#ff8c8c',
    seeds: [
      'analysis analyze analytics data dataset metric metrics measure measurement number numbers percent percentage rate ratio average mean median statistics statistical probability odds risk risks tradeoff tradeoffs decision decisions decide strategy strategic framework model models estimate forecast projection trend chart graph spreadsheet table calculate calculation compare comparison score scoring weight weighted criteria options pros cons benchmark latency optimize bottleneck root cause first principles hypothesis test',
      'data analysis metrics statistics numbers chart',
      'strategy decision making tradeoff risk probability',
      'framework model first principles root cause',
      'spreadsheet calculate estimate forecast trend',
      'experiment a b test hypothesis measure results',
      'compare options pros cons criteria score',
      'systems thinking feedback loop bottleneck optimize',
      'kpi dashboard percent growth rate average median',
    ],
  },
];

// ---------------------------------------------------------------------------
// Text -> features
// ---------------------------------------------------------------------------
const DIM = 4096;

const STOP = new Set((
  'a an the and or but if then so of to in on at by for with from as is are was were be been being ' +
  'it its this that these those i me my we our you your he she they them his her their there here ' +
  'do does did not no yes can could would should will shall may might must have has had just than ' +
  'into out up down over under about very too also only own same such what which who whom when where ' +
  'how all any both each few more most other some nor s t don now ever every one go get got gets make made ' +
  'really thing things like just finally two three four five first second today tomorrow week weekend'
).split(' '));

function stem(w) {
  if (w.length > 4) {
    for (const [suf, rep] of [['ies', 'y'], ['ness', ''], ['ment', ''], ['ing', ''], ['edly', ''],
      ['ed', ''], ['ly', ''], ['ity', ''], ['es', ''], ['s', '']]) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) { w = w.slice(0, -suf.length) + rep; break; }
    }
  } else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|ff|zz)$/.test(w)) w = w.slice(0, -1); // runn -> run
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);                              // compare -> compar
  return w;
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z']*/g) || [])
    .map(w => w.replace(/'s$|'/g, ''))
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(stem);
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % DIM;
}

// Sparse, L2-normalised vector: { idx: Int32Array, val: Float32Array }
function featurize(text) {
  const toks = tokenize(text);
  const counts = new Map();
  const add = (k, w) => { const i = hash(k); counts.set(i, (counts.get(i) || 0) + w); };
  for (let i = 0; i < toks.length; i++) {
    add(toks[i], 1);
    if (i + 1 < toks.length) add(toks[i] + '_' + toks[i + 1], 0.5);
  }
  const idx = [...counts.keys()];
  const val = idx.map(i => Math.log1p(counts.get(i)));
  const norm = Math.hypot(...val) || 1;
  return { idx: Int32Array.from(idx), val: Float32Array.from(val.map(v => v / norm)), empty: toks.length === 0 };
}

// ---------------------------------------------------------------------------
// Deterministic RNG so the same notes always produce the same map
// ---------------------------------------------------------------------------
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------
// The network: DIM -> H (tanh) -> K (softmax)
// ---------------------------------------------------------------------------
class TopicNet {
  constructor({ hidden = 48, seed = 7 } = {}) {
    this.K = TOPICS.length;
    this.H = hidden;
    this.rand = rng(seed);
    const r = this.rand;
    // Input weights start tiny so words the net has never seen add almost no noise.
    const s1 = 0.02;
    const s2 = Math.sqrt(6 / (hidden + this.K));
    this.W1 = new Float32Array(DIM * hidden).map(() => (r() * 2 - 1) * s1); // [DIM][H]
    this.b1 = new Float32Array(hidden);
    this.W2 = new Float32Array(hidden * this.K).map(() => (r() * 2 - 1) * s2); // [H][K]
    this.b2 = new Float32Array(this.K);
  }

  forward(x) {
    const { H, K, W1, W2 } = this;
    const h = Float32Array.from(this.b1);
    for (let n = 0; n < x.idx.length; n++) {
      const row = x.idx[n] * H, v = x.val[n];
      for (let j = 0; j < H; j++) h[j] += W1[row + j] * v;
    }
    for (let j = 0; j < H; j++) h[j] = Math.tanh(h[j]);
    const z = Float32Array.from(this.b2);
    for (let j = 0; j < H; j++) for (let k = 0; k < K; k++) z[k] += h[j] * W2[j * K + k];
    const m = Math.max(...z);
    let sum = 0;
    const p = z.map(v => { const e = Math.exp(v - m); sum += e; return e; });
    for (let k = 0; k < K; k++) p[k] /= sum;
    return { h, p };
  }

  // One SGD step on a single example. `target` is a probability vector.
  step(x, target, lr = 0.2, weight = 1) {
    const { H, K, W1, W2 } = this;
    const { h, p } = this.forward(x);
    const dz = p.map((v, k) => (v - target[k]) * weight);
    const dh = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let acc = 0;
      for (let k = 0; k < K; k++) { acc += W2[j * K + k] * dz[k]; W2[j * K + k] -= lr * (h[j] * dz[k] + 1e-5 * W2[j * K + k]); }
      dh[j] = acc * (1 - h[j] * h[j]);
    }
    for (let k = 0; k < K; k++) this.b2[k] -= lr * dz[k];
    for (let n = 0; n < x.idx.length; n++) {
      const row = x.idx[n] * H, v = x.val[n];
      for (let j = 0; j < H; j++) W1[row + j] -= lr * dh[j] * v;
    }
    for (let j = 0; j < H; j++) this.b1[j] -= lr * dh[j];
    let loss = 0; for (let k = 0; k < K; k++) if (target[k] > 0) loss -= target[k] * Math.log(p[k] + 1e-9);
    return loss;
  }

  train(examples, { epochs = 30, lr = 0.2 } = {}) {
    const order = examples.map((_, i) => i);
    let loss = 0;
    for (let e = 0; e < epochs; e++) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      loss = 0;
      const a = lr * (1 - 0.7 * e / epochs);
      for (const i of order) loss += this.step(examples[i].x, examples[i].y, a, examples[i].w ?? 1);
      loss /= order.length || 1;
    }
    return loss;
  }

  // Seed examples: the seed phrases plus random keyword mixtures from each topic
  // (augmentation), plus mixtures *across* neighbouring topics so the net learns
  // that in-between material deserves in-between probabilities.
  seedExamples(augPerTopic = 160) {
    const r = this.rand, K = this.K, out = [];
    const oneHot = spectralTarget;
    const words = TOPICS.map(t => t.seeds.join(' ').split(' '));
    const pick = (k, n) => Array.from({ length: n }, () => words[k][Math.floor(r() * words[k].length)]);
    TOPICS.forEach((t, k) => {
      t.seeds.forEach(s => out.push({ x: featurize(s), y: oneHot(k) }));
      for (let a = 0; a < augPerTopic; a++) out.push({ x: featurize(pick(k, 1 + Math.floor(r() * 6)).join(' ')), y: oneHot(k) });
    });
    for (let k = 0; k + 1 < K; k++) for (let a = 0; a < 8; a++) {
      const y = new Float32Array(K); y[k] = 0.5; y[k + 1] = 0.5;
      out.push({ x: featurize([...pick(k, 3), ...pick(k + 1, 3)].join(' ')), y, w: 0.5 });
    }
    return out;
  }

  classify(text) {
    const x = featurize(text);
    const { h, p } = this.forward(x);
    const ranked = [...p].map((v, k) => ({ k, p: v })).sort((a, b) => b.p - a.p);
    const spectrum = p.reduce((s, v, k) => s + v * TOPICS[k].pos, 0);
    const [a, b] = ranked;
    // "Taking liberties": confident -> the topic; two strong pulls -> a blend;
    // diffuse -> named by where it falls on the spectrum.
    let label;
    if (a.p >= 0.5 && b.p < 0.3) label = TOPICS[a.k].name;
    else if (b.p >= 0.2 && a.p + b.p >= 0.55) label = `${short(a.k)} × ${short(b.k)}`;
    else label = `Between ${short(nearest(spectrum, 0))} & ${short(nearest(spectrum, 1))}`;
    return { p: Array.from(p), h: Array.from(h), top: a.k, second: b.k, confidence: a.p, spectrum, label, unknown: x.empty };
  }
}

// Soft target centred on topic k that leaks a little probability to its
// neighbours on the spectrum. This teaches the net that the topics form a
// continuum, so mixed material gets mixed (in-between) predictions.
function spectralTarget(k, sigma = 0.045) {
  const y = new Float32Array(TOPICS.length);
  let s = 0;
  TOPICS.forEach((t, j) => { y[j] = Math.exp(-((t.pos - TOPICS[k].pos) ** 2) / (2 * sigma * sigma)); s += y[j]; });
  for (let j = 0; j < y.length; j++) y[j] /= s;
  return y;
}

function short(k) { return TOPICS[k].name.split(/[ ,&]/)[0]; }
function nearest(pos, rank) {
  return TOPICS.map((t, k) => ({ k, d: Math.abs(t.pos - pos) })).sort((a, b) => a.d - b.d)[rank].k;
}

// ---------------------------------------------------------------------------
// Build a trained net for a collection of items.
//   items: [{ text, userTopic? }]   userTopic = a topic id the user assigned
// 1. learn from the seeds, 2. learn from the user's corrections (strongly),
// 3. self-train: absorb the user's own vocabulary from items it is fairly
//    sure about, so words it never saw in the seeds start to carry meaning.
// ---------------------------------------------------------------------------
function buildNet(items, { selfTrain = true, rounds = 2 } = {}) {
  const net = new TopicNet();
  const K = TOPICS.length;
  const base = net.seedExamples();
  const corrections = items.filter(it => it.userTopic).map(it => {
    return { x: featurize(it.text), y: spectralTarget(TOPICS.findIndex(t => t.id === it.userTopic)), w: 3 };
  });
  let loss = net.train([...base, ...corrections, ...corrections], { epochs: 30 });
  if (selfTrain) {
    for (let r = 0; r < rounds; r++) {
      const pseudo = items.filter(it => !it.userTopic).map(it => {
        const x = featurize(it.text); if (x.empty) return null;
        const { p } = net.forward(x);
        const conf = Math.max(...p);
        if (conf < 0.45) return null;
        // soft target: sharpen the net's own guess
        const sh = p.map(v => v ** 2); const s = sh.reduce((a, b) => a + b, 0);
        return { x, y: sh.map(v => v / s), w: 0.4 * conf };
      }).filter(Boolean);
      if (!pseudo.length) break;
      loss = net.train([...base, ...corrections, ...pseudo], { epochs: 6, lr: 0.08 });
    }
  }
  net.loss = loss;
  return net;
}

const api = { TOPICS, DIM, tokenize, featurize, TopicNet, buildNet };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.NN = api;
})(typeof window !== 'undefined' ? window : globalThis);
