// Local proxy tests against a mock upstream. Run: node tests/proxy.test.js
const ROOT = require('path').resolve(__dirname, '..');
const SHOTS = require('os').tmpdir();
const http = require('http'); const { spawn } = require('child_process'); const fs = require('fs'); const crypto = require('crypto'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const AUDIT = path.join(__dirname, 'proxy-audit-test.jsonl'); try { fs.unlinkSync(AUDIT); } catch (e) {}
const seen = [];
const upstream = http.createServer((req, res) => { seen.push({ url: req.url, auth: req.headers.authorization }); if (/hugoSymbol=FAIL/.test(req.url)) { res.writeHead(500); return res.end('boom'); } if (req.headers.authorization !== 'Bearer SECRET-TOKEN') { res.writeHead(401); return res.end('no'); } res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ oncogenic: 'Oncogenic', highestSensitiveLevel: 'LEVEL_1', dataVersion: 'mock' })); });
const raw = (port, p, headers = {}) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, path: p, headers, method: 'GET' }, (x) => { let b = ''; x.on('data', (c) => b += c); x.on('end', () => res({ status: x.statusCode, body: b, headers: x.headers })); }); r.on('error', rej); r.end(); });
(async () => {
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r)); const up = upstream.address().port;
  const start = (env) => new Promise((resolve) => { const p = spawn('node', [require('path').join(ROOT, 'server/server.js')], { env: { ...process.env, ...env, AUDIT_FILE: AUDIT } }); p.stdout.on('data', (d) => { if (/listening/.test(d)) resolve(p); }); p.stderr.on('data', (d) => console.log('stderr', d.toString())); });
  const withTok = await start({ PORT: '8801', ONCOKB_API_TOKEN: 'SECRET-TOKEN', ONCOKB_BASE: `http://127.0.0.1:${up}/api/v1` });
  let r = await raw(8801, '/api/health'); ok(r.status === 200 && JSON.parse(r.body).oncokbConfigured === true && !/SECRET/.test(r.body), 'health reports token configured without revealing it');
  r = await raw(8801, '/api/oncokb/annotate?hugoSymbol=BRAF&alteration=V600E&tumorType=COADREAD', { Origin: 'null' });
  ok(r.status === 200 && JSON.parse(r.body).dataVersion === 'mock', 'annotate forwards and relays JSON'); ok(r.headers['access-control-allow-origin'] === 'null', 'CORS allowed for a file:// page (Origin: null)');
  ok(seen[0].auth === 'Bearer SECRET-TOKEN' && /byProteinChange\?hugoSymbol=BRAF&alteration=V600E&tumorType=COADREAD/.test(seen[0].url), 'upstream received the bearer token and the expected endpoint');
  ok(!/SECRET/.test(r.body) && !/SECRET/.test(JSON.stringify(r.headers)), 'token never appears in the response');
  r = await raw(8801, '/api/oncokb/annotate?hugoSymbol=BRAF&alteration=V600E', { Origin: 'https://evil.example' }); ok(!r.headers['access-control-allow-origin'], 'foreign origin gets no CORS permission');
  for (const bad of ['hugoSymbol=BR%20AF&alteration=V600E', 'hugoSymbol=BRAF&alteration=V600E%3Bdrop', 'hugoSymbol=BRAF&alteration=V600E&tumorType=%3Cscript%3E', 'hugoSymbol=&alteration=V600E', 'hugoSymbol=' + 'A'.repeat(40) + '&alteration=V600E']) { r = await raw(8801, '/api/oncokb/annotate?' + bad); ok(r.status === 400, `rejects invalid input (${bad.slice(0, 40)})`); }
  r = await raw(8801, '/api/oncokb/annotate?hugoSymbol=FAIL&alteration=X1Y'); ok(r.status === 500 && !/boom/.test(r.body) && /HTTP 500/.test(r.body), 'upstream error reported without leaking its body');
  r = await raw(8801, '/api/health', { Host: 'evil.example' }); ok(r.status === 403, 'Host header other than localhost is refused (DNS-rebinding guard)');
  r = await raw(8801, '/api/oncokb/other?x=1'); ok(r.status === 404, 'no other proxy routes exist');
  r = await new Promise((res) => { const q = http.request({ host: '127.0.0.1', port: 8801, path: '/api/health', method: 'POST' }, (x) => res({ status: x.statusCode })); q.end(); }); ok(r.status === 405, 'only GET is accepted');
  r = await raw(8801, '/'); ok(r.status === 200 && /Onco NGS Reader/.test(r.body), 'serves the app at /');
  for (const p of ['/vendor/pdfjs/pdf.min.js', '/script.js', '/style.css']) { r = await raw(8801, p); ok(r.status === 200 && r.body.length > 1000, `serves ${p}`); }
  for (const p of ['/server/server.js', '/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/server/audit-log.jsonl', '/.git/config', '/vendor/pdfjs/../../server/server.js']) { r = await raw(8801, p); ok(r.status === 404 || r.status === 403, `refuses ${p} (${r.status})`); }
  withTok.kill();
  const noTok = await start({ PORT: '8802' }); r = await raw(8802, '/api/oncokb/annotate?hugoSymbol=BRAF&alteration=V600E'); ok(r.status === 503 && /No OncoKB token/.test(r.body), 'without a token: clear 503 message, no upstream call'); r = await raw(8802, '/api/health'); ok(JSON.parse(r.body).oncokbConfigured === false, 'health shows token missing'); noTok.kill();
  const lines = fs.readFileSync(AUDIT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  let prev = '0'.repeat(64), chainOk = true; lines.forEach((e) => { const { hash, ...rest } = e; const h = crypto.createHash('sha256').update(JSON.stringify({ ...rest, hash: undefined })).digest('hex'); if (e.prev !== prev || h !== hash) chainOk = false; prev = hash; });
  ok(lines.length >= 2 && chainOk, `server audit log is a valid hash chain (${lines.length} entries)`); ok(!/SECRET/.test(JSON.stringify(lines)), 'audit log never contains the token');
  ok(lines.every((e) => !('patient' in e)) && lines.every((e) => ['route', 'hugoSymbol', 'alteration', 'tumorType', 'outcome', 'seq', 'ts', 'prev', 'hash'].every((k) => k in e)), 'audit entries hold only route, gene, alteration, tumour type, outcome');
  upstream.close(); try { fs.unlinkSync(AUDIT); } catch (e) {}
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
})();
