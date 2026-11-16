// Run with: node test.js
const assert = require('assert');
const { buildNet, TOPICS } = require('./nn.js');
const { parseText } = require('./parse.js');

const net = buildNet([], { selfTrain: false });
const where = t => TOPICS[net.classify(t).top].id;
const spot = t => net.classify(t).spectrum;

assert.strictEqual(where('What is the soul, and is reality an illusion?'), 'metaphysics');
assert.strictEqual(where('Spent $420 on groceries, need to cut the budget'), 'money');
assert.strictEqual(where('Run 3 miles Tuesday and go to bed by 10:30'), 'health');
assert.ok(spot('The meaning of life is found in suffering') < 0.25, 'meaning sits on the philosophy end');
assert.ok(spot('Score each vendor on price and latency, weight price 50%') > 0.85, 'analysis sits on the practical end');

const items = parseText('"Stay hungry." — Steve Jobs\n\n- buy milk\n- call mom');
assert.deepStrictEqual(items.map(i => i.type), ['quote', 'note', 'note']);
assert.strictEqual(items[0].author, 'Steve Jobs');

// Teaching: a correction moves an item to the chosen topic
const odd = { text: 'Bananas are a metaphor for everything.', userTopic: 'art' };
assert.strictEqual(TOPICS[buildNet([odd]).classify(odd.text).top].id, 'art');
console.log('all tests passed');

// Long quote lists: one per line, authors on the following line, Word paragraphs
const P = require('./parse.js');
const list = P.parseText('The obstacle is the way.\n— Marcus Aurelius\nBe one.\n- Marcus Aurelius\nPlan - Monday');
assert.deepStrictEqual(list.map(i => [i.type, i.author]), [['quote', 'Marcus Aurelius'], ['quote', 'Marcus Aurelius'], ['note', '']]);
const xml = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>My quotes</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Know thyself.</w:t></w:r></w:p><w:p><w:r><w:t>— Socrates</w:t></w:r></w:p><w:p/>' +
  '<w:p><w:r><w:t>Spend less than you earn.</w:t></w:r></w:p>';
assert.deepStrictEqual(P.parseFile('q.docx', xml).map(i => i.text), ['Know thyself.', 'Spend less than you earn.']);
console.log('parser tests passed');
