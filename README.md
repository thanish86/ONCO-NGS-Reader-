# Onco NGS Reader — Stage 2 evidence-connected prototype

An educational decision-support web app that helps medical oncologists and molecular pathologists work through cancer NGS reports. It is **not a medical device**, does not replace the laboratory report or a molecular tumour board, and does not prescribe.

Principle: **make it clinically trustworthy before making it clinically autonomous.** Every interpretation separates verified evidence from missing or unverified information, and every outside fact carries its source, time and question.

## Three ways to run it (no programming needed for the first)

**1. Simplest — open the file.** Keep the whole project folder together and double-click `index.html`. Everything works from disk, including the live look-ups if you switch them on (except OncoKB, which also needs the proxy below). Nothing is sent anywhere unless you switch on live look-ups.

**2. With the local proxy (needed only for OncoKB).** Install Node.js 18+, then in a terminal in the project folder:

```
ONCOKB_API_TOKEN=your-token node server/server.js          # Mac / Linux
set ONCOKB_API_TOKEN=your-token && node server/server.js   # Windows
```

Open `http://127.0.0.1:8787/`. The proxy keeps your licensed OncoKB token on your computer, never in the web page, and serves the app from the same address. Without a token the app still runs.

**3. Hosted preview (a single page).** `python3 tools/make_hosted.py` builds one file, `hosted/onco-ngs-reader-hosted.html`. A hosting page blocks outside connections, printing and downloads, so in that mode live look-ups, Print and Download are switched off with a clear message. Everything else works.

## The eight pages

| # | Page | What it does |
|---|------|--------------|
| 1 | Dashboard | Overview, fictional sample cases, pearl of the day, and an honest "what works / what needs a back end" table |
| 2 | Upload NGS Report | PDF viewer (canvas, local only), **experimental text extraction that only proposes**, manual entry, missing/uncertain flags, per-item verification, **clinician confirmation gate** |
| 3 | Variant Interpreter | Gene biology, HGVS decoding, separate pathogenicity / oncogenicity / actionability lenses, AMP/ASCO/CAP, ESCAT, OncoKB, ClinVar (curated and optionally live), FDA/EMA |
| 4 | Actionability & Targeted Therapies | Options with explicit status, tumour-type and setting fit, on-demand FDA label text, live trial search, immunotherapy biomarkers, resistance |
| 5 | Molecular Learning Centre | 13 topics (simple → advanced), memory hooks, exam traps, eponyms, calculators, HGVS decoder, 31 flash-cards, 12-question quiz |
| 6 | Evidence Library | 97 sources (76 PubMed-verified papers + 21 websites); your own access-date record |
| 7 | Molecular Tumour Board Summary | Print-ready summary with a data-provenance section and audit-chain reference; copy as text |
| 8 | Connections & Audit | Opt-in live look-ups (what is sent is listed), connection tests, OncoKB proxy setting, tamper-evident audit trail, passphrase-protected case files |

## What Stage 2 added

- **Live look-ups (opt-in, local use):** NCBI ClinVar (each classification type shown separately: germline, somatic clinical impact, oncogenicity; review stars; only records whose *name* matches the entered variant are shown as matches), NCBI PubMed, ClinicalTrials.gov (recruiting studies), openFDA label text with effective date, and OncoKB through the local proxy. Every result shows the retrieval time and the exact question asked. If a service cannot be reached, the app says so and shows nothing in its place. Library tiers, clinician-entered records and live results are always labelled separately.
- **PDF extraction (experimental):** reads selectable text with the bundled pdf.js, proposes genes, variants, VAF, depth, fusions, copy number and case-level items (TMB, MSI/MMR, HRD, PD-L1, tumour content, specimen, cancer type). Negated statements ("not detected", "wild type", "no mutation") are never proposed. You choose what to add; each added item stays "extracted — verify" until you mark it checked, and findings cannot be confirmed until all are verified. Text is held in memory only; file names and source lines are never saved or logged.
- **Audit trail:** hash-chained (SHA-256) record of actions, with a Verify button that detects altered, removed or re-linked entries. No patient identifiers, no file names. Exportable.
- **Protected case files:** AES-256-GCM with a PBKDF2-SHA-256 key from a passphrase you choose (cannot be recovered). Restoring a file always clears the confirmation.
- **Hosted-safe behaviours:** in-page two-step confirmation for deletes and clearing (browser pop-ups are blocked in some hosts), in-memory navigation, canvas PDF rendering.

## What works, what was tested, what is not done

| Area | State |
|---|---|
| Manual entry, interpretation (48 genes, 36 rules), summary, learning content | Working; tested end to end on six fictional cases |
| PDF extraction | Tested on **three synthetic fictional PDFs** (table, narrative, scanned image) and on pure-text cases including negation. **Real-world sensitivity and error rate are unknown.** No OCR: scanned reports yield a "no text found" message |
| Live connectors | Built and tested against **recorded response shapes written from documentation**. The real services were **not reachable** where this was built, so **they have not been run against ClinVar, PubMed, ClinicalTrials.gov, openFDA or OncoKB themselves.** Run `tests/` against the live services and check results before relying on them |
| OncoKB | Proxy tested against a mock upstream; needs your own token and licence terms |
| CIViC, ClinGen, COSMIC, Cancer Genome Interpreter | No connector. Search links and a record-your-own-look-up form |
| EMA status; guideline (NCCN/ESMO) status | Not curated, by design |
| Accounts, central database, role-based access, institutional retention, OCR, clinical validation | **Not built.** These need hosting, identity and governance. Do not use real patient data until they exist and your institution has approved the setup |

## Safety behaviour

- Never claims a database was queried unless it actually was, and shows when.
- No curated entry means "not curated", never a guess. ESCAT tiers are shown only where the developer was highly confident; OncoKB levels in the library are derived from published level definitions plus FDA approval and may differ from the live listing.
- Pathogenicity (germline), oncogenicity (somatic) and actionability are shown separately; evidence from another tumour type is labelled "does not automatically apply"; germline-only approvals show as "actionable only if germline confirmed".
- Interpretation stays locked until you confirm the findings; any edit clears the confirmation.
- Session storage only (erased when the tab closes). Use a neutral case label. Never type patient identifiers.

## Where things live

- `index.html` — the page skeleton · `style.css` — the look (colours at the top) · `script.js` — all behaviour, in numbered, commented sections
- `vendor/pdfjs/` — bundled PDF library (Apache-2.0); keep the folder next to `index.html`
- `server/server.js` — optional local proxy (no dependencies)
- `tools/make_hosted.py` — builds the single-file hosted page
- `tests/` — developer checks (see `tests/README.md`)

## Still to do before any clinical use

1. Spot-check the curated rule library with a molecular pathologist; validate extraction on real, de-identified reports with measured sensitivity and error rates.
2. Run the live connectors against the real services, add caching, versioning and change monitoring.
3. Obtain OncoKB access and agree its terms for clinical-reporting use.
4. Add OCR, CIViC/ClinGen connectors, and a server-side, access-controlled, audited store with sign-in and institutional governance.
5. Independent clinical validation and a documented change-control process.
