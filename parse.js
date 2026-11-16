// parse.js — turn uploaded files / pasted text into note and quote items.
// Supported: .txt / .md, .docx (as the text of word/document.xml), .json, .csv
//
// Splitting a long list into separate items:
// - If blank lines separate the entries, each blank-line block is one item
//   (so a quote can run over several lines, with its author on the last).
// - If there are (almost) no blank lines, each line is one item.
// - Either way, a line that is only an attribution ("— Seneca") joins the
//   item before it, and bullet / numbered lists become one item per entry.
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
  if (m) {
    // An author credit is on its own line, or follows a quotation or a finished sentence:
    // "Plan - Monday" stays a note, "Be one. — Marcus Aurelius" is a quote.
    const before = text.slice(0, m.index).trim(), dash = m[0].trim()[0];
    const placed = m[0].includes('\n') || looksQuoted || /["”’»]$/.test(before) || (dash !== '-' && /[.!?…]$/.test(before));
    if (placed && (looksQuoted || m[1].split(/\s+/).length <= 6)) { author = m[1].trim(); text = before; }
  }
  const type = forced || (looksQuoted || author ? 'quote' : 'note');
  if (type === 'quote') text = text.replace(/^\s*>\s?/gm, '').replace(/^["“'‘«]+|["”'’»]+$/g, '').trim();
  if (!text) return null;
  return { id: uid(), text, author, type, source, added: Date.now() };
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

const BULLET = /^\s*([-*•▪◦]|\d+[.)])\s+/;
const ENDS_ENTRY = /[.!?…"”’'»)\]]\s*$/;

// "— Seneca", "~ Seneca", or "- Seneca" / "-- Seneca" when it reads like a short name
function isAttribution(line) {
  if (/^\s*[—–~]\s*\S/.test(line)) return true;
  const m = line.match(/^\s*-{1,2}\s*([A-Z][^.!?]*)$/);
  return !!m && m[1].trim().split(/\s+/).length <= 6;
}

function parseText(content, source, forced) {
  return splitEntries(content.replace(/\r/g, '').split('\n'), source, forced);
}

// lines: the document's lines or paragraphs, with '' for blank ones
function splitEntries(lines, source, forced) {
  lines = lines.map(l => l.replace(/\s+$/, '')).filter(l => !/^\s*#{1,6}\s/.test(l)); // drop markdown headings
  const hasBlanks = lines.some(l => !l.trim());
  const blocks = [];
  let cur = [];
  for (const l of lines) { if (l.trim()) cur.push(l); else if (cur.length) { blocks.push(cur); cur = []; } }
  if (cur.length) blocks.push(cur);

  const chunks = [];
  for (const block of blocks) {
    const entries = joinAttributions(block);
    // Keep a block whole when its lines are one wrapped paragraph; split it when
    // every line is a complete entry (ends like a sentence, or is a list item).
    const separate = !hasBlanks || entries.every((e, n) =>
      BULLET.test(block.find(l => l.includes(e.split('\n')[0].trim())) || '') || ENDS_ENTRY.test(e.split('\n')[0]) || n === entries.length - 1);
    if (separate && entries.length > 1) chunks.push(...entries); else chunks.push(block.join('\n'));
  }
  const out = [];
  for (const c of chunks) { const it = makeItem(c.replace(BULLET, ''), source, forced); if (it) out.push(it); }
  return out;
}

// One entry per line, except attribution lines, which attach to the line above.
function joinAttributions(lines) {
  const out = [];
  for (const l of lines) {
    if (isAttribution(l) && out.length && !out[out.length - 1].includes('\n')) out[out.length - 1] += '\n' + l.trim();
    else out.push(l.replace(BULLET, ''));
  }
  return out;
}

// Word .docx: pass the text of word/document.xml (the app unzips the file).
// Each paragraph becomes a line; empty paragraphs become blank lines.
function docxParagraphs(xml) {
  const body = xml.replace(/<w:(del|instrText)\b[\s\S]*?<\/w:\1>/g, ''); // skip tracked deletions, field codes
  const paras = body.match(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  const decode = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
  const lines = [];
  for (const p of paras) {
    let text = '';
    const runs = p.match(/<w:t\b[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>/g) || [];
    for (const r of runs) text += r.startsWith('<w:t') ? decode(r.replace(/<[^>]+>/g, '')) : r.startsWith('<w:tab') ? ' ' : '\n';
    if (/<w:pStyle w:val="(Heading|Title|Subtitle|TOC)/i.test(p)) continue; // section headings aren't entries
    const isList = /<w:numPr\b/.test(p);
    lines.push(...(isList && text.trim() ? '• ' + text : text).split('\n'));
  }
  return lines;
}

function parseDocx(xml, source, forced) { return splitEntries(docxParagraphs(xml), source, forced); }

function parseJSON(content, source, forced) {
  let data = JSON.parse(content);
  if (data && Array.isArray(data.items)) data = data.items; // our own export format
  if (!Array.isArray(data)) data = [data];
  return data.map(d => {
    if (typeof d === 'string') return makeItem(d, source, forced);
    const text = d.text || d.quote || d.note || d.content || d.body || '';
    const it = makeItem(text, source, forced || (d.type === 'quote' || d.quote ? 'quote' : d.type === 'note' ? 'note' : undefined));
    if (!it) return null;
    if (d.author) it.author = d.author;
    if (d.userTopic) it.userTopic = d.userTopic;
    return it;
  }).filter(Boolean);
}

function parseCSV(content, source, forced) {
  const rows = csvRows(content);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const ti = head.findIndex(h => ['text', 'quote', 'note', 'content', 'body'].includes(h));
  const ai = head.indexOf('author');
  const yi = head.indexOf('type');
  const body = ti >= 0 ? rows.slice(1) : rows;
  return body.map(r => {
    const it = makeItem(r[ti >= 0 ? ti : 0] || '', source, forced || yi >= 0 && /quote|note/i.test(r[yi] || '') ? r[yi].toLowerCase().trim() : undefined);
    if (it && ai >= 0 && r[ai]) { it.author = r[ai].trim(); if (!forced) it.type = 'quote'; }
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

// content: text, or for .docx the text of word/document.xml
function parseFile(name, content, forced) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'json') return parseJSON(content, name, forced);
  if (ext === 'csv') return parseCSV(content, name, forced);
  if (ext === 'docx') return parseDocx(content, name, forced);
  return parseText(content, name, forced);
}

const api = { makeItem, parseText, parseJSON, parseCSV, parseDocx, docxParagraphs, parseFile };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Parse = api;
})(typeof window !== 'undefined' ? window : globalThis);
