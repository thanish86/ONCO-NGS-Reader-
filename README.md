# Onco NGS Reader — Stage 1 frontend prototype

An educational decision-support web app that helps medical oncologists and molecular pathologists work through cancer NGS reports. It is **not a medical device**, does not replace the laboratory report or a molecular tumour board, and does not prescribe.

Principle: **make it clinically trustworthy before making it clinically autonomous.** Every interpretation separates verified evidence from missing or unverified information.

## How to run it (no programming needed)

1. Download or copy these three files into one folder: `index.html`, `style.css`, `script.js`.
2. Double-click **`index.html`**. It opens in your web browser (Chrome, Edge, Safari or Firefox). That is all.
3. Nothing is installed and no internet connection is needed. Nothing you type is sent anywhere.

Tip: start on the **Dashboard**, click **Try a sample case**, tick the confirmation box on the Upload page, then explore the other pages.

## The seven pages

| # | Page | What it does |
|---|------|--------------|
| 1 | Dashboard | Overview, fictional sample cases, pearl of the day, and an honest "what works / what needs a backend" table |
| 2 | Upload NGS Report | Drag-and-drop PDF viewer (local only), manual entry, editable findings, missing/uncertain flags, **clinician confirmation gate** |
| 3 | Variant Interpreter | Gene biology, HGVS decoding, separate pathogenicity / oncogenicity / actionability lenses, AMP/ASCO/CAP, ESCAT, OncoKB, ClinVar, ClinGen/CIViC, FDA/EMA sections |
| 4 | Actionability & Targeted Therapies | Treatment options with an explicit status, a check against your tumour type and disease setting, immunotherapy biomarkers, resistance, trial search links |
| 5 | Molecular Learning Centre | 13 topics (simple → advanced), memory hooks, exam traps, eponyms, 3 calculators, HGVS decoder, 31 flash-cards, 12-question quiz |
| 6 | Evidence Library | 92 sources (76 PubMed-verified papers + 16 websites); your own access-date record |
| 7 | Molecular Tumour Board Summary | Print-ready summary, copy as plain text |

## What works today, and what does not

| Feature | Status |
|---|---|
| Manual case and variant entry, editing, validation | Working |
| PDF drag-and-drop and side-by-side viewing | Working (the file never leaves your browser) |
| Reading variants **out of** the PDF | **Not implemented** — needs a validated parser/OCR on secure infrastructure (Stage 2) |
| Interpretation of ~48 genes / 36 rules | Working (hand-curated; everything else is shown as "not curated") |
| AMP/ASCO/CAP, ESCAT, OncoKB tiers | Partly: curated snapshot only where confident; blank otherwise; **verify at the source** |
| Live ClinVar / ClinGen / CIViC / COSMIC / CGI / OncoKB look-ups | **Not implemented** — the app builds search links and lets you record what you found, with the date |
| FDA status | Curated wording for listed drugs. **EMA is not curated** |
| Guideline-supported status (NCCN/ESMO) | Deliberately not assigned (text is proprietary / changes often) |
| Clinical-trial matching | Search links to ClinicalTrials.gov only |
| AI interpretation | Not built, by design |
| Accounts, audit trail, secure patient storage | Not implemented — required before any real patient data |

## Safety behaviour built into the app

- It never says it queried a database it did not query.
- No entry in the library means "not curated", never a guess.
- Pathogenicity (germline), oncogenicity (somatic) and actionability are shown separately.
- Evidence from another tumour type is labelled as such and "does not automatically apply".
- Some approvals are germline-only (e.g. olaparib in breast and pancreatic cancer): a tumour-only finding is shown as **"actionable only if germline confirmed"**.
- Flags for possible germline origin, possible clonal haematopoiesis (CHIP), low depth, low VAF, missing transcript, and low tumour purity.
- Interpretation pages stay locked until you confirm the findings; **any edit clears the confirmation**.
- Data is kept in session storage only (erased when the tab closes). Use a neutral case label, never patient identifiers.

## How the evidence was checked

- **Papers:** every PMID and DOI in the Evidence Library was matched in PubMed on 2026-10-09 (title, journal, year, volume, first page). Trial numbers quoted in the app (PFS, OS, ORR, hazard ratios) were checked against the PubMed abstracts; figures that could not be confirmed there were removed.
- **Websites:** the organisation addresses were **not live-checked** and are labelled that way.
- **Tier assignments and approvals:** written by hand. ESCAT tiers are included only where the developer was highly confident; OncoKB levels are derived from the published level definitions plus FDA approval and may differ from the current OncoKB listing. A clinician or molecular pathologist should spot-check the curated library (`RULES` in `script.js`) before relying on it.

## Where things live

- `index.html` — the page skeleton (forms, headings, empty areas)
- `style.css` — colours, fonts, spacing; the colours to change are in the `:root` block at the top
- `script.js` — all behaviour, in numbered, commented sections: helpers → evidence library → gene library → interpretation rules → biomarkers → learning content → sample cases → state → logic → page renderers → start-up

## Stage 2 (evidence-connected clinical application)

1. Server-side integrations: ClinVar via NCBI; ClinGen; CIViC; openFDA/Drugs@FDA; PubMed — with caching, versioning and the retrieval date shown beside every item.
2. OncoKB: apply for an API token and licence terms suitable for clinical-reporting use before using its data in any report.
3. Validated PDF extraction (with OCR), with mandatory human verification of every extracted field.
4. Secure patient-data handling: authentication, encryption, consent, audit trail, data-retention policy.
5. Auditable, versioned interpretation workflow with clinician sign-off and a change history.
6. Independent clinical review and validation of the curated rule library.
