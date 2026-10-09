// Logic tests: SHA-256, audit chain, encryption, response parsers, extraction heuristics. Run: node tests/logic.test.js
const ROOT = require('path').resolve(__dirname, '..');
const SHOTS = require('os').tmpdir();
const { chromium } = require('playwright');
const crypto = require('crypto');
const D = __dirname;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + ROOT + '/index.html');
  await page.waitForSelector('#dashboardRoot .hero');

  console.log('SHA-256 / audit');
  const samples = ['', 'abc', 'The quick brown fox jumps over the lazy dog', 'ünïcödé ✓ 日本語', 'x'.repeat(1000), 'a|b|c|1|2'];
  const hashes = await page.evaluate((s) => s.map((x) => sha256(x)), samples);
  samples.forEach((s, i) => ok(hashes[i] === crypto.createHash('sha256').update(s).digest('hex'), `sha256 matches node for sample ${i}`));
  const au = await page.evaluate(() => {
    const out = {};
    auditAdd('t1', 'a'); auditAdd('t2', 'b'); auditAdd('t3', 'c');
    out.intact = auditVerify().ok;
    const copy = JSON.parse(JSON.stringify(audit.log));
    copy[1].detail = 'altered'; out.tamper = auditVerify(copy).ok;
    const del = copy.slice(); const c2 = JSON.parse(JSON.stringify(audit.log)); c2.splice(1, 1); out.deleted = auditVerify(c2).ok;
    const c3 = JSON.parse(JSON.stringify(audit.log)); c3[2].prev = '0'.repeat(64); out.relinked = auditVerify(c3).ok;
    out.count = audit.log.length; return out;
  });
  ok(au.intact, 'untouched chain verifies'); ok(!au.tamper, 'altered entry detected'); ok(!au.deleted, 'removed entry detected'); ok(!au.relinked, 'relinked entry detected');

  console.log('Protected file');
  const enc = await page.evaluate(async () => {
    state.case.label = 'Case X'; state.variants = [Object.assign(emptyVariant(), { gene: 'EGFR', variant: 'p.Leu858Arg', type: 'missense', vaf: '38' })]; state.confirmed = true;
    const t = await protectEncrypt('correct horse battery');
    const out = { hasPlain: /EGFR|Case X/.test(t), len: t.length };
    try { await protectDecrypt(t, 'wrong passphrase!!'); out.wrong = 'decrypted'; } catch (e) { out.wrong = e.message; }
    const tampered = JSON.parse(t); const raw = b64.dec(tampered.data); raw[10] ^= 1; tampered.data = b64.enc(raw);
    try { await protectDecrypt(JSON.stringify(tampered), 'correct horse battery'); out.tamper = 'decrypted'; } catch (e) { out.tamper = e.message; }
    const p = await protectDecrypt(t, 'correct horse battery'); out.roundtrip = p.case.label === 'Case X' && p.variants[0].gene === 'EGFR';
    try { await protectEncrypt('short'); out.short = 'allowed'; } catch (e) { out.short = e.message; }
    state.confirmed = true; restorePayload(p); out.confirmedAfterRestore = state.confirmed;
    try { await protectDecrypt('not json', 'x'); } catch (e) { out.junk = e.message; }
    return out;
  });
  ok(!enc.hasPlain, 'ciphertext contains no plaintext case data'); ok(/Wrong passphrase/.test(enc.wrong), 'wrong passphrase rejected'); ok(/Wrong passphrase|altered/.test(enc.tamper), 'tampered ciphertext rejected');
  ok(enc.roundtrip, 'round trip restores the case'); ok(/at least 10/.test(enc.short), 'short passphrase refused'); ok(enc.confirmedAfterRestore === false, 'confirmation cleared after restore'); ok(/not a protected case file/.test(enc.junk), 'junk input refused cleanly');

  console.log('Parsers (fixtures)');
  const par = await page.evaluate(() => {
    const o = {};
    o.stars = ['reviewed by expert panel', 'criteria provided, multiple submitters, no conflicts', 'criteria provided, single submitter', 'criteria provided, conflicting classifications', 'no assertion criteria provided', 'practice guideline', 'something odd'].map(reviewStars);
    const doc = { uid: '13961', accession: 'VCV000013961', title: 'NM_004333.6(BRAF):c.1799T>A (p.Val600Glu)', obj_type: 'single nucleotide variant', germline_classification: { description: 'Pathogenic', review_status: 'reviewed by expert panel', last_evaluated: '2023/05/01 00:00', trait_set: [{ trait_name: 'Cardiofaciocutaneous syndrome' }] }, oncogenicity_classification: { description: 'Oncogenic', review_status: 'criteria provided, single submitter', last_evaluated: '2024/02/01 00:00' }, genes: [{ symbol: 'BRAF' }] };
    o.cv = parseClinvarDoc(doc);
    o.legacy = parseClinvarDoc({ uid: '1', title: 'x', clinical_significance: { description: 'Benign', review_status: 'no assertion criteria provided' } }).classifications[0];
    o.q = clinvarQueries(Object.assign(emptyVariant(), { gene: 'BRAF', variant: 'p.Val600Glu', hgvsC: 'c.1799T>A', transcript: 'NM_004333.6', type: 'missense' }));
    o.names = ['Osimertinib + platinum–pemetrexed', 'Gefitinib, erlotinib, afatinib, dacomitinib', 'Encorafenib + cetuximab + mFOLFOX6', 'PARP inhibitor + androgen-receptor-pathway inhibitor combinations (olaparib + abiraterone, niraparib + abiraterone)'].map(genericNames);
    o.trials = parseTrials({ totalCount: 31, studies: [{ protocolSection: { identificationModule: { nctId: 'NCT00000001', briefTitle: 'A test study' }, statusModule: { overallStatus: 'RECRUITING' }, designModule: { phases: ['PHASE2'] }, sponsorCollaboratorsModule: { leadSponsor: { name: 'Sponsor X' } }, conditionsModule: { conditions: ['NSCLC'] }, armsInterventionsModule: { interventions: [{ name: 'Drug A' }] }, contactsLocationsModule: { locations: [{ country: 'India' }, { country: 'India' }, { country: 'Japan' }] } } }] });
    o.fda = parseFda({ results: [{ effective_time: '20200101', indications_and_usage: ['old'], openfda: { brand_name: ['A'] } }, { effective_time: '20240801', version: '12', set_id: 'abc', indications_and_usage: ['Newer   text  here'], openfda: { brand_name: ['TAGRISSO'], generic_name: ['OSIMERTINIB'] } }] });
    o.okb = parseOncokb({ oncogenic: 'Oncogenic', mutationEffect: { knownEffect: 'Gain-of-function' }, highestSensitiveLevel: 'LEVEL_1', treatments: [{ level: 'LEVEL_1', drugs: [{ drugName: 'Osimertinib' }], levelAssociatedCancerType: { name: 'Non-Small Cell Lung Cancer' } }], dataVersion: 'v4.20' });
    return o;
  });
  ok(JSON.stringify(par.stars) === JSON.stringify([3, 2, 1, 1, 0, 4, null]), 'ClinVar review-status → stars mapping');
  ok(par.cv.classifications.length === 2 && par.cv.classifications[0].stars === 3 && par.cv.classifications[1].type === 'Oncogenicity classification', 'ClinVar doc parsed with separate classification types');
  ok(par.legacy.description === 'Benign' && par.legacy.stars === 0, 'legacy clinical_significance field also parsed');
  ok(par.q.queries[0].term === 'NM_004333.6:c.1799T>A' && par.q.needles.includes('p.val600glu'), 'ClinVar query builder (HGVS first; 3-letter needle)');
  ok(JSON.stringify(par.names[0]) === '["osimertinib"]' && par.names[1].length === 4 && par.names[2].includes('encorafenib') && par.names[2].includes('cetuximab'), 'generic-name extraction: ' + JSON.stringify(par.names));
  ok(par.trials.total === 31 && par.trials.studies[0].countries.length === 2 && par.trials.studies[0].interventions[0] === 'Drug A', 'ClinicalTrials.gov v2 parse');
  ok(par.fda.effective === '20240801' && par.fda.indications === 'Newer text here' && par.fda.brand === 'TAGRISSO', 'openFDA picks newest label and normalises text');
  ok(par.okb.sensitive === 'LEVEL_1' && par.okb.treatments[0].drugs === 'Osimertinib' && par.okb.dataVersion === 'v4.20', 'OncoKB response parse');

  console.log('Extraction heuristics (pure text)');
  const ex = await page.evaluate(() => {
    const pages = [{ n: 1, lines: [
      'Gene | Variant | Transcript | VAF (%) | Depth',
      'EGFR | p.Leu858Arg c.2573T>G | NM_005228.5 | 38.2% | 812x',
      'TP53 | p.Arg273His | NM_000546.6 | 41.0%',
      'BRAF V600E mutation detected (VAF 33%); PIK3CA p.Glu545Lys VAF 29%',
      'EML4::ALK fusion (E13;A20) detected',
      'MET amplification (copy number 9)',
      'CDKN2A homozygous deletion',
      'MET exon 14 skipping detected',
      'KRAS wild type',
      'NPM1 c.860_863dup',
      'MET', 'p.Arg1Gln NM_000245.4'
    ] }];
    return proposeVariants(pages).map((c) => `${c.partner ? c.partner + '::' : ''}${c.gene}|${c.variant}|${c.hgvsC}|${c.type}|vaf=${c.vaf}|d=${c.depth}|cn=${c.cn}|${c.conf}|${c.transcript}`);
  });
  console.log(ex.map((x) => '    ' + x).join('\n'));
  ok(ex.some((x) => x.startsWith('EGFR|p.Leu858Arg|c.2573T>G|missense|vaf=38.2|d=812')), 'table row parsed (EGFR)');
  ok(ex.some((x) => x.startsWith('TP53|p.Arg273His') && x.includes('vaf=41.0')), 'table row parsed (TP53, header-labelled percent)');
  ok(ex.some((x) => x.startsWith('BRAF|p.V600E|') && x.includes('vaf=33')), 'narrative one-letter BRAF V600E with labelled VAF');
  ok(ex.some((x) => x.startsWith('PIK3CA|p.Glu545Lys') && x.includes('vaf=29')), 'second gene in the same sentence parsed separately');
  ok(ex.some((x) => x.startsWith('EML4::ALK|E13;A20|') && x.includes('|fusion|')), 'fusion with partner and breakpoint text');
  ok(ex.some((x) => x.startsWith('MET||') && x.includes('|amplification|') && x.includes('cn=9')), 'amplification with copy number');
  ok(ex.some((x) => x.startsWith('CDKN2A||') && x.includes('|deletion|') && x.includes('cn=0')), 'homozygous deletion → CN 0');
  ok(ex.some((x) => x.startsWith('MET|exon 14 skipping|') && x.includes('|splice|')), 'exon 14 skipping → splice type');
  ok(!ex.some((x) => x.startsWith('KRAS')), '"KRAS wild type" is NOT proposed as a variant');
  ok(ex.some((x) => x.startsWith('NPM1||c.860_863dup|inframe')), 'cDNA-only duplication row');
  ok(ex.some((x) => x.startsWith('MET|p.Arg1Gln') && x.includes('NM_000245.4')), 'variant wrapped onto the next line is borrowed with its transcript');

  console.log('Errors collected:', errors.length ? errors : 'none');
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
