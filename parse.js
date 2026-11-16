// parse.js — turn uploaded files / pasted text into note and quote items.
// Supported: .txt / .md (blank-line or bullet separated), .json, .csv
// Loads as a plain <script> (exposes window.Parse) or via require() in Node,
// so index.html works when opened straight from disk.
(function (root) {
'use strict';

const QUOTE_OPEN = /^\s*(["“”'‘«]|>\s)/;
const ATTRIBUTION = /\n?\s*(?:[—–~]|-{1,2})\s*([A-Z][^\n]{1,80})\s*$/;

function makeItem(raw, source = 'pasted', forced) {
  let text = String(raw).replace(/\r/g, '').trim();
  if (!text) return null;
  let author = '';
  const m = text.match(ATTRIBUTION);
  const looksQuoted = QUOTE_OPEN.test(text);
  if (m && (looksQuoted || m[1].split(/\s+/).length <= 6)) { author = m[1].trim(); text = text.slice(0, m.index).trim(); }
  const type = forced || (looksQuoted || author ? 'quote' : 'note');
  if (type === 'quote') text = text.replace(/^\s*>\s?/gm, '').replace(/^["“'‘«]+|["”'’»]+$/g, '').trim();
  if (!text) return null;
  return { id: uid(), text, author, type, source, added: Date.now() };
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

function parseText(content, source, forced) {
  const blocks = content.replace(/\r/g, '').split(/\n\s*\n+/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => !/^\s*#{1,6}\s/.test(l)); // drop markdown headings
    if (!lines.length) continue;
    const bullets = lines.every(l => /^\s*([-*•]|\d+[.)])\s+/.test(l));
    const chunks = bullets && lines.length > 1 ? lines.map(l => l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')) : [lines.join('\n')];
    for (const c of chunks) { const it = makeItem(c, source, forced); if (it) out.push(it); }
  }
  return out;
}

function parseJSON(content, source) {
  let data = JSON.parse(content);
  if (data && Array.isArray(data.items)) data = data.items; // our own export format
  if (!Array.isArray(data)) data = [data];
  return data.map(d => {
    if (typeof d === 'string') return makeItem(d, source);
    const text = d.text || d.quote || d.note || d.content || d.body || '';
    const it = makeItem(text, source, d.type === 'quote' || d.quote ? 'quote' : d.type === 'note' ? 'note' : undefined);
    if (!it) return null;
    if (d.author) it.author = d.author;
    if (d.userTopic) it.userTopic = d.userTopic;
    return it;
  }).filter(Boolean);
}

function parseCSV(content, source) {
  const rows = csvRows(content);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const ti = head.findIndex(h => ['text', 'quote', 'note', 'content', 'body'].includes(h));
  const ai = head.indexOf('author');
  const yi = head.indexOf('type');
  const body = ti >= 0 ? rows.slice(1) : rows;
  return body.map(r => {
    const it = makeItem(r[ti >= 0 ? ti : 0] || '', source, yi >= 0 && /quote|note/i.test(r[yi] || '') ? r[yi].toLowerCase().trim() : undefined);
    if (it && ai >= 0 && r[ai]) { it.author = r[ai].trim(); it.type = 'quote'; }
    return it;
  }).filter(Boolean);
}

function csvRows(s) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function parseFile(name, content) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'json') return parseJSON(content, name);
  if (ext === 'csv') return parseCSV(content, name);
  return parseText(content, name);
}

const api = { makeItem, parseText, parseJSON, parseCSV, parseFile };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Parse = api;
})(typeof window !== 'undefined' ? window : globalThis);
