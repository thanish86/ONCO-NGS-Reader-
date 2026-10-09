#!/usr/bin/env node
/*
  ONCO NGS READER — local proxy (optional, Stage 2)
  --------------------------------------------------------------------
  WHY THIS EXISTS (plain language)
  OncoKB is licensed. Its access token must never be placed inside a web
  page, because anyone who opens the page could copy it. This small
  program runs on YOUR computer, holds the token in an environment
  variable, and forwards only the one OncoKB question the app needs.
  It also serves the app itself at http://127.0.0.1:8787/ so everything
  is on one local address.

  HOW TO RUN
    1. Install Node.js 18 or newer (https://nodejs.org).
    2. In a terminal, from the project folder:
         ONCOKB_API_TOKEN=your-token node server/server.js          (Mac/Linux)
         set ONCOKB_API_TOKEN=your-token && node server/server.js   (Windows)
    3. Open http://127.0.0.1:8787/ in your browser.
  Without a token the app still runs; only the OncoKB button reports "no token".

  WHAT IT DOES AND DOES NOT DO
    * Listens on 127.0.0.1 only (not reachable from other computers).
    * Rejects requests whose Host header is not localhost (guards against
      DNS-rebinding attacks).
    * Forwards ONLY GET /api/oncokb/annotate with strictly validated
      gene / alteration / tumour-type values. Nothing else is proxied.
    * Never logs or returns the token.
    * Writes a hash-chained audit log (server/audit-log.jsonl) of each
      proxied request: time, gene, alteration, tumour type, outcome.
      No patient data is ever sent to it by the app.
    * It is NOT an authentication system and not a multi-user server.
      Before any shared or patient-facing deployment you need proper
      sign-in, TLS, access control and institutional governance.
  Environment variables: ONCOKB_API_TOKEN, PORT (8787), HOST (127.0.0.1),
  ONCOKB_BASE (https://www.oncokb.org/api/v1), AUDIT_FILE.
*/
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const TOKEN = process.env.ONCOKB_API_TOKEN || '';
const ONCOKB_BASE = (process.env.ONCOKB_BASE || 'https://www.oncokb.org/api/v1').replace(/\/+$/, '');
const ROOT = path.resolve(__dirname, '..');
const AUDIT_FILE = process.env.AUDIT_FILE || path.join(__dirname, 'audit-log.jsonl');
const STATIC_OK = new Set(['index.html', 'style.css', 'script.js', 'README.md']);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

/* ---------- tamper-evident audit log ---------- */
let auditSeq = 0, auditPrev = '0'.repeat(64);
(function loadAudit() {
  try {
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length) { const last = JSON.parse(lines[lines.length - 1]); auditSeq = last.seq; auditPrev = last.hash; }
  } catch (e) { /* new file */ }
})();
function audit(event) {
  const entry = { seq: ++auditSeq, ts: new Date().toISOString(), ...event, prev: auditPrev };
  entry.hash = crypto.createHash('sha256').update(JSON.stringify({ ...entry, hash: undefined })).digest('hex');
  auditPrev = entry.hash;
  try { fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n'); } catch (e) { console.error('Could not write audit log:', e.message); }
}

/* ---------- helpers ---------- */
const send = (res, code, body, headers = {}) => {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(data);
};
function hostAllowed(req) {
  const h = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}
/** The app may be opened from this server (same origin) or from a local file (Origin: null). */
function corsHeaders(req) {
  const o = req.headers.origin;
  if (!o) return {};
  if (o === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return { 'Access-Control-Allow-Origin': o, Vary: 'Origin' };
  return {};
}
const SYMBOL = /^[A-Za-z0-9-]{1,20}$/;
const ALTERATION = /^[A-Za-z0-9_*.>:+\-()]{1,60}$/;
const TUMOR = /^[A-Za-z0-9 _-]{1,40}$/;

function oncokbAnnotate(q, cb) {
  const params = new URLSearchParams({ hugoSymbol: q.hugoSymbol, alteration: q.alteration });
  if (q.tumorType) params.set('tumorType', q.tumorType);
  const target = new URL(`${ONCOKB_BASE}/annotate/mutations/byProteinChange?${params.toString()}`);
  const lib = target.protocol === 'http:' ? http : https;
  const r = lib.request(target, { method: 'GET', timeout: 15000, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'User-Agent': 'onco-ngs-reader-local-proxy' } }, (up) => {
    const chunks = []; up.on('data', (c) => chunks.push(c));
    up.on('end', () => cb(null, up.statusCode, Buffer.concat(chunks).toString('utf8')));
  });
  r.on('timeout', () => { r.destroy(new Error('upstream timeout')); });
  r.on('error', (e) => cb(e));
  r.end();
}

const server = http.createServer((req, res) => {
  if (!hostAllowed(req)) return send(res, 403, { error: 'Host not allowed' });
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return send(res, 204, '', { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' });
  if (req.method !== 'GET') return send(res, 405, { error: 'Only GET is supported' }, cors);
  let url; try { url = new URL(req.url, `http://${req.headers.host}`); } catch (e) { return send(res, 400, { error: 'Bad URL' }, cors); }

  if (url.pathname === '/api/health') return send(res, 200, { ok: true, oncokbConfigured: !!TOKEN, version: '2.0.0' }, cors);

  if (url.pathname === '/api/oncokb/annotate') {
    const q = { hugoSymbol: url.searchParams.get('hugoSymbol') || '', alteration: url.searchParams.get('alteration') || '', tumorType: url.searchParams.get('tumorType') || '' };
    if (!TOKEN) return send(res, 503, { error: 'No OncoKB token is configured on this proxy (set ONCOKB_API_TOKEN).' }, cors);
    if (!SYMBOL.test(q.hugoSymbol) || !ALTERATION.test(q.alteration) || (q.tumorType && !TUMOR.test(q.tumorType))) return send(res, 400, { error: 'Invalid gene, alteration or tumour type.' }, cors);
    return oncokbAnnotate(q, (err, status, body) => {
      audit({ route: 'oncokb/annotate', hugoSymbol: q.hugoSymbol, alteration: q.alteration, tumorType: q.tumorType || null, outcome: err ? 'error: ' + err.message : 'HTTP ' + status });
      if (err) return send(res, 502, { error: 'Could not reach OncoKB: ' + err.message }, cors);
      if (status < 200 || status >= 300) return send(res, status === 401 || status === 403 ? 502 : status, { error: `OncoKB answered HTTP ${status}.` }, cors);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
      res.end(body);
    });
  }

  // static files: the app itself (whitelist + vendor/pdfjs), no directory listing, no path tricks
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (!(STATIC_OK.has(rel) || /^vendor\/pdfjs\/(pdf\.min\.js|pdf\.worker\.min\.js|LICENSE|README\.txt)$/.test(rel))) return send(res, 404, { error: 'Not found' }, cors);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Forbidden' }, cors);
  fs.readFile(file, (e, data) => {
    if (e) return send(res, 404, { error: 'Not found' }, cors);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...cors });
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Onco NGS Reader local proxy listening on http://${HOST}:${PORT}/`);
    console.log(TOKEN ? 'OncoKB token: configured (never logged or returned).' : 'OncoKB token: NOT set — the app works, but OncoKB look-ups will report "no token".');
    console.log(`Audit log: ${AUDIT_FILE}`);
  });
}
module.exports = server;
