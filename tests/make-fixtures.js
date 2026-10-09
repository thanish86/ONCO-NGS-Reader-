// Creates the synthetic (fictional) PDF test reports in tests/fixtures. Run: node tests/make-fixtures.js
const fs = require('fs'); fs.mkdirSync(__dirname + '/fixtures', { recursive: true }); fs.writeFileSync(__dirname + '/notpdf.pdf', 'hello world');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  const css = 'body{font-family:Arial,sans-serif;font-size:11pt;margin:24px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #888;padding:4px 8px;text-align:left} h2{margin:8px 0}';
  // Report 1: table layout, 2 pages
  await p.setContent(`<style>${css}</style><h2>SYNTHETIC TEST REPORT A — FICTIONAL, NOT A REAL PATIENT</h2>
  <p>Specimen: FFPE tissue. Diagnosis: Lung adenocarcinoma (non-small cell lung cancer). Tumor content: 60%.</p>
  <p>Biomarkers: TMB 4.2 mut/Mb. Microsatellite stable (MSS). PD-L1 TPS 10%.</p>
  <h3>Somatic variants</h3>
  <table><tr><th>Gene</th><th>Variant</th><th>Transcript</th><th>VAF (%)</th><th>Depth</th></tr>
  <tr><td>EGFR</td><td>p.Leu858Arg c.2573T&gt;G</td><td>NM_005228.5</td><td>38.2%</td><td>812x</td></tr>
  <tr><td>TP53</td><td>p.Arg273His c.818G&gt;A</td><td>NM_000546.6</td><td>41.0%</td><td>655x</td></tr>
  <tr><td>KRAS</td><td>wild type — no alteration detected</td><td></td><td></td><td></td></tr></table>
  <p style="page-break-before:always"></p><h3>Copy-number and rearrangements</h3>
  <p>MET amplification (copy number 9)</p><p>CDKN2A homozygous deletion</p><p>EML4::ALK fusion (E13;A20) detected by RNA sequencing.</p>
  <p>MET exon 14 skipping not detected.</p>`);
  await p.pdf({ path: __dirname + '/fixtures/reportA-table.pdf', format: 'A4' });
  // Report 2: narrative
  await p.setContent(`<style>${css}</style><h2>SYNTHETIC TEST REPORT B — FICTIONAL</h2>
  <p>Diagnosis: Colorectal adenocarcinoma, right-sided. The tumour is microsatellite instability-high (MSI-H) and shows MMR deficiency (dMMR). TMB 41 mutations/Mb.
  Sequencing of the tissue sample detected a BRAF V600E mutation (variant allele fraction 33%, depth 745x) and a PIK3CA p.Glu545Lys alteration (VAF 29%). RNF43 p.Gly659ValfsTer41 was also observed. KRAS and NRAS: no mutation.</p>`);
  await p.pdf({ path: __dirname + '/fixtures/reportB-narrative.pdf', format: 'A4' });
  // Report 3: image-only ("scanned")
  await p.setContent(`<style>${css} #t{width:520px;padding:12px;font-size:16px;background:#fff}</style><div id="t"><b>SCANNED SYNTHETIC REPORT</b><br>EGFR p.Leu858Arg VAF 38%</div>`);
  const png = await (await p.$('#t')).screenshot({ type: 'png' });
  await p.setContent(`<style>body{margin:24px}</style><img src="data:image/png;base64,${png.toString('base64')}">`);
  await p.pdf({ path: __dirname + '/fixtures/reportC-scanned.pdf', format: 'A4' });
  await b.close();
})();
