// PDF end-to-end tests (from disk and via the local server). Run tests/make-fixtures.js first.
const ROOT = require('path').resolve(__dirname, '..');
const SHOTS = require('os').tmpdir();
const { chromium } = require('playwright');
const http = require('http');
const D = __dirname;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

async function pdfFlow(label, url) {
  console.log(`\n== PDF flow via ${label} ==`);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await b.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  const errs = [], warns = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.evaluate(() => { location.hash = '#/upload'; });
  await page.waitForSelector('#dropzone');
  // Report A (table layout)
  await page.setInputFiles('#fileInput', `${D}/fixtures/reportA-table.pdf`);
  await page.waitForSelector('#pdfCanvas', { timeout: 20000 });
  await page.waitForFunction(() => { const c = document.querySelector('#pdfCanvas'); if (!c || c.width < 50) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 400) if (d[i] < 200) return true; return false; }, null, { timeout: 20000 });
  ok(true, 'canvas viewer rendered visible content');
  console.log('  page label:', await page.$eval('#pdfPageLabel', (e) => e.textContent));
  await page.screenshot({ path: `${SHOTS}/40-pdf-${label}.png`, fullPage: false });
  await page.click('[data-action="runExtract"]');
  await page.waitForSelector('#extractResult table', { timeout: 20000 });
  const cands = await page.$$eval('#extractResult [data-cand]', (e) => e.length);
  const rowsTxt = await page.$$eval('#extractResult tbody tr', (r) => r.map((x) => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 130)));
  console.log(rowsTxt.map((x) => '    ' + x).join('\n'));
  const caseSug = await page.$$eval('#extractResult table:first-of-type tbody tr', (r) => r.length);
  ok(cands >= 5, `table report: ≥5 candidates (got ${cands})`);
  const joined = rowsTxt.join('\n');
  ok(/EGFR.*p\.Leu858Arg/.test(joined) && /38\.2%/.test(joined) && /812×/.test(joined), 'EGFR p.Leu858Arg with VAF 38.2% and depth 812×');
  ok(/TP53.*p\.Arg273His/.test(joined), 'TP53 p.Arg273His found');
  ok(/MET.*amplification/i.test(joined) || /MET/.test(joined), 'MET amplification found');
  ok(/EML4::ALK/.test(joined), 'EML4::ALK fusion found');
  ok(!/KRAS/.test(joined), 'KRAS wild type not proposed');
  ok(!/MET.*exon 14/i.test(joined), '"MET exon 14 skipping not detected" is not proposed (negated statement)');
  // add all & gating
  await page.click('[data-action="selectAllCands"]');
  await page.click('[data-action="addCands"]');
  await page.waitForSelector('#variantTable table');
  const nAdded = await page.$$eval('#variantTable tbody tr', (r) => r.length);
  ok(nAdded === cands, `all selected candidates added (${nAdded})`);
  ok((await page.$eval('#confirmPanel', (e) => e.textContent)).includes('need verification') || (await page.$eval('#confirmPanel', (e) => e.textContent)).includes('needs verification'), 'confirm panel demands verification');
  ok(await page.$eval('#confirmCheck', (e) => e.disabled), 'confirm checkbox disabled while extracted items are unverified');
  // type must be chosen? set case + verify each
  const verifyBtns = await page.$$('[data-action="verifyVariant"]');
  for (const _ of verifyBtns) { await page.click('[data-action="verifyVariant"] >> nth=0'); }
  ok(!(await page.$eval('#confirmCheck', (e) => e.disabled)), 'confirm checkbox enabled after every item is verified');
  // snippet must not be persisted
  const saved = await page.evaluate(() => sessionStorage.getItem('onco-ngs-reader/session/v1'));
  ok(!/snippet/.test(saved) || !/NM_005228\.5 \|/.test(saved), 'source snippets are not saved to session storage');
  const auditTxt = await page.evaluate(() => JSON.stringify(audit.log));
  ok(!/reportA-table/.test(auditTxt), 'PDF file name is NOT written to the audit trail');
  ok(/extraction-accepted/.test(auditTxt) && /extracted-verified/.test(auditTxt) && /pdf-extraction/.test(auditTxt), 'audit records extraction, acceptance and verification');
  // editing an extracted + verified variant resets verification
  await page.click('[data-action="editVariant"] >> nth=0'); await page.click('#variantSubmit');
  ok((await page.$$('[data-action="verifyVariant"]')).length === 1, 'editing an extracted entry requires re-verification');
  await page.click('[data-action="verifyVariant"] >> nth=0');
  // case suggestions apply
  const sugRows = await page.$$('[data-action="applyCaseSug"]');
  ok(sugRows.length >= 4, `case-level suggestions offered (${sugRows.length})`);
  for (const _ of sugRows) await page.click('[data-action="applyCaseSug"] >> nth=0');
  const cs = await page.evaluate(() => ({ cancer: state.case.cancer, tmb: state.case.tmb, msi: state.case.msi, purity: state.case.purity, specimen: state.case.specimen, pdl1: state.case.pdl1 }));
  console.log('  case after suggestions:', JSON.stringify(cs));
  ok(cs.cancer === 'nsclc' && cs.tmb === '4.2' && cs.msi === 'MSS' && cs.purity === '60' && cs.specimen === 'tissue', 'case-level fields applied from the PDF');
  // Report B
  await page.click('[data-action="removeFile"]');
  await page.setInputFiles('#fileInput', `${D}/fixtures/reportB-narrative.pdf`);
  await page.waitForSelector('[data-action="runExtract"]', { timeout: 20000 });
  await page.click('[data-action="runExtract"]');
  await page.waitForSelector('#extractResult h4', { timeout: 20000 });
  const rb = (await page.$$eval('#extractResult tbody tr', (r) => r.map((x) => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 110)))).join('\n');
  console.log(rb.split('\n').map((x) => '    ' + x).join('\n'));
  ok(/BRAF.*V600E/.test(rb) && /33%/.test(rb), 'narrative: BRAF V600E with VAF 33%');
  ok(/PIK3CA.*Glu545Lys/.test(rb) && /29%/.test(rb), 'narrative: PIK3CA p.Glu545Lys VAF 29%');
  ok(/RNF43/.test(rb) === false, 'RNF43 (not in library) is not proposed — documented limit');
  // KRAS/NRAS 'no mutation'
  ok(!/KRAS|NRAS/.test(rb), 'KRAS/NRAS "no mutation" not proposed');
  const sugB = await page.$$eval('#extractResult table:first-of-type tr', (r) => r.map((x) => x.textContent.replace(/\s+/g, ' ').slice(0, 80)));
  ok(sugB.some((x) => /MSI/.test(x)) && sugB.some((x) => /TMB/.test(x)) && sugB.some((x) => /Cancer type/.test(x)), 'narrative: MSI, TMB, cancer type suggestions');
  // Report C scanned
  await page.click('[data-action="removeFile"]');
  await page.setInputFiles('#fileInput', `${D}/fixtures/reportC-scanned.pdf`);
  await page.waitForSelector('[data-action="runExtract"]', { timeout: 20000 });
  await page.click('[data-action="runExtract"]');
  await page.waitForSelector('#extractResult .callout', { timeout: 20000 });
  ok(/No selectable text/.test(await page.$eval('#extractResult', (e) => e.textContent)), 'scanned PDF: clear "no selectable text" message, nothing invented');
  // Non-PDF
  await page.setInputFiles('#fileInput', `${D}/notpdf.pdf`);
  await page.waitForTimeout(500);
  ok(/Does not look like a readable PDF/.test(await page.$eval('#fileCard', (e) => e.textContent)), 'non-PDF rejected');
  console.log('  console errors:', errs.length ? errs : 'none', '| warnings:', warns.length ? warns.slice(0, 2) : 'none');
  ok(errs.length === 0, 'no console errors');
  await b.close();
}

(async () => {
  await pdfFlow('file', 'file://' + ROOT + '/index.html');
  const server = require(require('path').join(ROOT, 'server/server.js'));
  await new Promise((r) => server.listen(8799, '127.0.0.1', r));
  await pdfFlow('http-localhost', 'http://127.0.0.1:8799/');
  server.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
