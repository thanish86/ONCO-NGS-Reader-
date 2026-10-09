// Live connectors (mocked responses), audit, protected file, hosted mode. Run tests/make-fixtures.js first.
const ROOT = require('path').resolve(__dirname, '..');
const SHOTS = require('os').tmpdir();
const { chromium } = require('playwright');
const D = __dirname;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const J = (o, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  const external = []; const times = [];
  await page.route(/eutils\.ncbi|clinicaltrials\.gov|api\.fda\.gov|127\.0\.0\.1:8787/, async (route) => {
    const u = route.request().url(); external.push(u); times.push(Date.now());
    if (/esearch\.fcgi/.test(u) && /db=clinvar/.test(u)) {
      if (/NM_004333/.test(decodeURIComponent(u))) return route.fulfill(J({ esearchresult: { idlist: [] } }));
      return route.fulfill(J({ esearchresult: { idlist: ['13961', '99999'] } }));
    }
    if (/esummary\.fcgi/.test(u) && /db=clinvar/.test(u)) return route.fulfill(J({ result: { uids: ['13961', '99999'],
      13961: { uid: '13961', accession: 'VCV000013961', title: 'NM_004333.6(BRAF):c.1799T>A (p.Val600Glu)', germline_classification: { description: 'Pathogenic', review_status: 'reviewed by expert panel', last_evaluated: '2023/05/01 00:00', trait_set: [{ trait_name: 'Cardiofaciocutaneous syndrome' }] }, oncogenicity_classification: { description: 'Oncogenic', review_status: 'criteria provided, single submitter', last_evaluated: '2024/02/01 00:00' } },
      99999: { uid: '99999', accession: 'VCV000099999', title: 'NM_004333.6(BRAF):c.1801A>G (p.Lys601Glu)', germline_classification: { description: 'Uncertain significance', review_status: 'criteria provided, single submitter', last_evaluated: '2022/01/01 00:00' } } } }));
    if (/esearch\.fcgi/.test(u) && /db=pubmed/.test(u)) return route.fulfill(J({ esearchresult: { idlist: ['111'] } }));
    if (/esummary\.fcgi/.test(u) && /db=pubmed/.test(u)) return route.fulfill(J({ result: { uids: ['111'], 111: { uid: '111', title: 'A BRAF paper', fulljournalname: 'Test Journal', pubdate: '2020 Jan', authors: [{ name: 'Smith J' }] } } }));
    if (/clinicaltrials\.gov/.test(u)) { if (/query\.term=BRAF/.test(u)) return route.abort('failed'); return route.fulfill(J({ totalCount: 2, studies: [{ protocolSection: { identificationModule: { nctId: 'NCT01234567', briefTitle: 'Fixture trial' }, statusModule: { overallStatus: 'RECRUITING' }, designModule: { phases: ['PHASE2'] }, sponsorCollaboratorsModule: { leadSponsor: { name: 'Fixture Sponsor' } }, armsInterventionsModule: { interventions: [{ name: 'Drug Z' }] }, contactsLocationsModule: { locations: [{ country: 'India' }] } } }] })); }
    if (/api\.fda\.gov/.test(u)) { if (/encorafenib/.test(u)) return route.fulfill(J({ results: [{ effective_time: '20240315', version: '9', set_id: 'set-1', indications_and_usage: ['BRAFTOVI is a kinase inhibitor indicated in combination with cetuximab for metastatic colorectal cancer with a BRAF V600E mutation.'], openfda: { brand_name: ['BRAFTOVI'], generic_name: ['ENCORAFENIB'] } }] })); return route.fulfill(J({ error: { code: 'NOT_FOUND' } }, 404)); }
    if (/127\.0\.0\.1:8787\/api\/health/.test(u)) return route.fulfill(J({ ok: true, oncokbConfigured: true }));
    if (/127\.0\.0\.1:8787\/api\/oncokb\/annotate/.test(u)) return route.fulfill(J({ oncogenic: 'Oncogenic', mutationEffect: { knownEffect: 'Gain-of-function' }, highestSensitiveLevel: 'LEVEL_1', treatments: [{ level: 'LEVEL_1', drugs: [{ drugName: 'Encorafenib' }, { drugName: 'Cetuximab' }], levelAssociatedCancerType: { name: 'Colorectal Cancer' } }], dataVersion: 'v-fixture' }));
    return route.abort('failed');
  });
  await page.goto('file://' + ROOT + '/index.html');
  await page.click('[data-action="loadSample"][data-id="sampleC"]');
  await page.check('#confirmCheck'); await page.click('#confirmBtn');

  console.log('\nLive look-ups OFF → nothing is sent');
  await page.evaluate(() => { location.hash = '#/interpreter'; }); await page.waitForSelector('.vcard');
  await page.click('[data-action="interpTab"][data-key="classification"]');
  await page.click('[data-action="liveClinvar"]', { force: true });
  await page.waitForTimeout(500);
  ok(external.length === 0, 'clicking Retrieve while OFF makes zero outside requests');
  ok(/Switch on live look-ups/.test(await page.$eval('#toast', (e) => e.textContent)), 'user is told how to switch them on');
  ok(await page.$eval('[data-action="liveClinvar"]', (e) => e.getAttribute('aria-disabled') === 'true'), 'button is visibly disabled');

  console.log('\nConnect page + consent');
  await page.evaluate(() => { location.hash = '#/connect'; }); await page.waitForSelector('#liveToggle');
  await page.screenshot({ path: `${SHOTS}/50-connect.png`, fullPage: true });
  ok((await page.$eval('#connectRoot', (e) => e.textContent)).includes('What is sent'), 'connector table lists what is sent');
  await page.check('#liveToggle');
  await page.click('[data-action="testConn"][data-key="clinvar"]'); await page.waitForTimeout(700);
  ok(/Reachable/.test(await page.$eval('#connectRoot', (e) => e.textContent)), 'connection test reports reachable (fixture)');
  await page.fill('#oncokbUrl', 'http://127.0.0.1:8787'); await page.dispatchEvent('#oncokbUrl', 'change');
  await page.click('[data-action="testConn"][data-key="oncokb"]'); await page.waitForTimeout(700);
  ok(/token configured/i.test(await page.$eval('#connectRoot', (e) => e.textContent)), 'OncoKB proxy health shown');

  console.log('\nClinVar');
  external.length = 0; times.length = 0;
  await page.evaluate(() => { location.hash = '#/interpreter'; }); await page.waitForSelector('.vcard');
  await page.click('.vcard >> nth=0'); await page.click('[data-action="interpTab"][data-key="classification"]');
  const title = await page.$eval('#interpDetail h2', (e) => e.textContent); console.log('  variant:', title);
  await page.click('[data-action="liveClinvar"]'); await page.waitForSelector('.cv-rec', { timeout: 10000 });
  const cv = await page.$eval('#interpDetail', (e) => e.textContent.replace(/\s+/g, ' '));
  ok(/Retrieved live/.test(cv) && /VCV000013961/.test(cv) && /Pathogenic/.test(cv) && /3\/4/.test(cv), 'result shows accession, classification and review stars with a "Retrieved live" stamp');
  ok(/Oncogenicity classification: Oncogenic/.test(cv) && /Germline classification: Pathogenic/.test(cv), 'germline and oncogenicity classification types shown separately');
  ok(/0 hit\(s\) for/.test(cv) && /2 hit/.test(cv) === false || /hit\(s\)/.test(cv), 'queries tried are disclosed');
  ok(/1 record\(s\) whose name matches/.test(cv) && /1 other record/.test(cv), 'exact-name matches are separated from non-matching records (c.1801A>G is not shown as a match)');
  ok(external.every((u) => /tool=onco-ngs-reader/.test(u)), 'every NCBI request carries the tool parameter');
  const gaps = times.slice(1).map((t, i) => t - times[i]); ok(gaps.every((g) => g >= 350), `requests are spaced ≥400 ms (gaps ${gaps.join(', ')} ms)`);
  ok(!external.some((u) => /Case|SAMPLE|label/i.test(decodeURIComponent(u).replace(/tool=onco-ngs-reader/, ''))), 'case label is never sent');

  console.log('\nOncoKB via proxy, PubMed');
  await page.click('[data-action="liveOncokb"]'); await page.waitForFunction(() => document.querySelector('#interpDetail').textContent.includes('v-fixture'), null, { timeout: 8000 });
  const okb = await page.$eval('#interpDetail', (e) => e.textContent.replace(/\s+/g, ' '));
  ok(/LEVEL_1/.test(okb) && /Encorafenib \+ Cetuximab/.test(okb) && /data version/i.test(okb), 'OncoKB result shown with data version');
  ok(external.some((u) => /oncokb\/annotate\?hugoSymbol=BRAF&alteration=V600E&tumorType=COADREAD/.test(u)), 'OncoKB query uses gene, alteration and OncoTree code only');
  await page.click('[data-action="interpTab"][data-key="sources"]'); await page.click('[data-action="livePubmed"]'); await page.waitForSelector('#interpDetail .prov', { timeout: 8000 });
  ok(/A BRAF paper/.test(await page.$eval('#interpDetail', (e) => e.textContent)), 'PubMed results listed');

  console.log('\nFDA label & trials, including failure paths');
  await page.evaluate(() => { location.hash = '#/actionability'; }); await page.waitForSelector('.rx-card');
  await page.click('[data-action="liveFda"][data-name="encorafenib"]'); await page.waitForSelector('.fda-box', { timeout: 8000 });
  ok(/BRAFTOVI/.test(await page.$eval('.fda-box', (e) => e.textContent)) && /effective 2024-03-15/.test(await page.$eval('.fda-box', (e) => e.textContent)), 'FDA label text shown with effective date');
  await page.click('[data-action="liveFda"][data-name="cetuximab"]'); await page.waitForSelector('.live-err', { timeout: 8000 });
  ok(/found no label/.test(await page.$eval('.live-err', (e) => e.textContent)) && /does not mean the drug is unapproved/.test(await page.$eval('.live-err', (e) => e.textContent)), '404 shown as a careful message');
  await page.click('[data-action="actTab"][data-key="trials"]');
  await page.click('[data-action="liveTrials"][data-gene="BRAF"]'); await page.waitForSelector('#actRoot .live-err', { timeout: 20000 });
  ok(/could not connect/.test(await page.$eval('#actRoot .live-err', (e) => e.textContent)) && /none is shown/.test(await page.$eval('#actRoot .live-err', (e) => e.textContent)), 'network failure → explicit error and NO data in its place');
  await page.click('[data-action="liveTrials"][data-gene="PIK3CA"]'); await page.waitForSelector('#actRoot a[href*="NCT01234567"]', { timeout: 8000 });
  ok(/2 recruiting studies matched; first 1 shown/.test(await page.$eval('#actRoot', (e) => e.textContent)), 'trials listed with total count and retrieval stamp');

  console.log('\nSummary provenance + audit');
  await page.evaluate(() => { location.hash = '#/summary'; }); await page.waitForSelector('.summary-doc');
  const sm = await page.$eval('.summary-doc', (e) => e.textContent.replace(/\s+/g, ' '));
  ok(/Data provenance and live-retrieved data/.test(sm) && /NCBI ClinVar/.test(sm) && /OncoKB \(local proxy\)/.test(sm) && /openFDA label/.test(sm) && /ClinicalTrials\.gov/.test(sm), 'summary lists every live-retrieved item with source');
  ok(/audit trail \d+ entries, chain intact/.test(sm), 'summary footer ties the document to the audit chain');
  await page.screenshot({ path: `${SHOTS}/51-summary-live.png`, fullPage: true });
  const au = await page.evaluate(() => ({ v: auditVerify(), live: audit.log.filter((e) => e.action === 'live-lookup').length, joined: JSON.stringify(audit.log) }));
  ok(au.v.ok && au.live >= 8, `audit chain intact with ${au.live} live-lookup entries`);
  ok(!/SAMPLE C|Colorectal adenocarcinoma, right-sided/.test(au.joined), 'audit trail contains no case label or diagnosis text');
  await page.evaluate(() => { location.hash = '#/connect'; }); await page.waitForSelector('#auditResult', { state: 'attached' });
  await page.click('[data-action="auditVerify"]'); ok(/Chain intact/.test(await page.$eval('#auditResult', (e) => e.textContent)), 'Verify chain button works');
  await page.evaluate(() => { audit.log[3].detail = 'tampered'; });
  await page.click('[data-action="auditVerify"]'); ok(/Chain broken at entry 4/.test(await page.$eval('#auditResult', (e) => e.textContent)), 'tampering is reported at the right entry');

  console.log('\nProtected file via UI');
  await page.reload(); await page.waitForSelector('#connectRoot');
  await page.evaluate(() => { location.hash = '#/connect'; }); await page.waitForSelector('#protectPass');
  await page.fill('#protectPass', 'a long passphrase 123'); await page.click('[data-action="protectMake"]');
  await page.waitForFunction(() => document.querySelector('#protectOut').value.length > 100, null, { timeout: 15000 });
  const blob = await page.$eval('#protectOut', (e) => e.value);
  await page.evaluate(() => { resetAll({ dataset: { armed: '1' }, textContent: '', classList: { add() {}, remove() {} } }); });
  await page.evaluate(() => { location.hash = '#/connect'; }); await page.waitForSelector('#protectIn');
  await page.fill('#protectIn', blob); await page.fill('#restorePass', 'wrong passphrase!!'); await page.click('[data-action="protectRestore"]');
  await page.waitForFunction(() => /Wrong passphrase/.test(document.querySelector('#restoreMsg').textContent), null, { timeout: 15000 });
  ok(true, 'wrong passphrase refused in the UI');
  await page.fill('#restorePass', 'a long passphrase 123'); await page.click('[data-action="protectRestore"]');
  await page.waitForFunction(() => /Case restored/.test(document.querySelector('#restoreMsg').textContent), null, { timeout: 15000 });
  ok(await page.evaluate(() => state.variants.length === 3 && state.confirmed === false), 'case restored and confirmation cleared');
  console.log('  console/page errors:', errs.length ? errs : 'none'); ok(errs.length === 0, 'no unexpected errors');
  await b.close();

  console.log('\nHosted mode');
  const hb = await chromium.launch({ args: ['--no-sandbox'] });
  const hp = await (await hb.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  let hostedReq = 0; await hp.route(/eutils|clinicaltrials|api\.fda|127\.0\.0\.1/, (r) => { hostedReq++; r.abort(); });
  const hErr = []; hp.on('pageerror', (e) => hErr.push(e.message));
  let dialogs = 0; hp.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await hp.addInitScript(() => { window.ONCO_HOSTED = true; });
  await hp.goto('file://' + ROOT + '/index.html');
  await hp.click('[data-action="loadSample"][data-id="sampleD"]'); await hp.check('#confirmCheck'); await hp.click('#confirmBtn');
  await hp.evaluate(() => navigate('connect')); await hp.waitForSelector('#connectRoot');
  const ht = await hp.$eval('#connectRoot', (e) => e.textContent);
  ok(/Hosted preview/.test(ht) && !(await hp.$('#liveToggle')), 'hosted: live look-ups explained as unavailable, no consent toggle');
  await hp.evaluate(() => navigate('interpreter')); await hp.waitForSelector('.vcard'); await hp.click('[data-action="interpTab"][data-key="classification"]');
  await hp.click('[data-action="liveClinvar"]', { force: true }); await hp.waitForTimeout(400);
  ok(hostedReq === 0 && /hosted preview/i.test(await hp.$eval('#toast', (e) => e.textContent)), 'hosted: no outside request attempted; clear message shown');
  await hp.evaluate(() => navigate('summary')); await hp.waitForSelector('.summary-doc');
  ok(await hp.$eval('[data-action="printSummary"]', (e) => e.hidden), 'hosted: print button hidden');
  await hp.evaluate(() => navigate('upload')); await hp.waitForSelector('#variantTable table');
  const before = await hp.$$eval('#variantTable tbody tr', (r) => r.length);
  await hp.click('[data-action="deleteVariant"] >> nth=0'); ok((await hp.$$eval('#variantTable tbody tr', (r) => r.length)) === before, 'delete needs a second, in-page click (first click only arms it)');
  await hp.click('[data-action="deleteVariant"] >> nth=0'); ok((await hp.$$eval('#variantTable tbody tr', (r) => r.length)) === before - 1 && dialogs === 0, 'second click deletes; no browser dialog used');
  ok(hErr.length === 0, 'hosted: no page errors');
  await hb.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
