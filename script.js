/* =====================================================================
   ONCO NGS READER  —  script.js   (Stage 1: frontend prototype)
   ---------------------------------------------------------------------
   WHAT THIS FILE DOES (in plain language)
   This file is the "brain" of the web page. HTML (index.html) is the
   skeleton, CSS (style.css) is the look, and this JavaScript makes the
   buttons, forms, tabs, search boxes and interpretation cards work.

   Everything runs INSIDE YOUR BROWSER. Nothing you type or upload is
   sent to any server. There is no database and no backend.

   HOW THE FILE IS ORGANISED (search for the big banner comments)
     1. Helpers .................... small utility functions
     2. Evidence Library data ...... the reference list (PubMed-verified)
     3. Gene library ............... gene function / pathway / germline notes
     4. Interpretation rules ....... the small curated "knowledge base"
     5. Biomarker rules ............ MSI, TMB, HRD
     6. Learning Centre content .... topics, flash-cards, quiz, tools
     7. Sample (fictional) cases ... for demonstration only
     8. App state & storage ........ what is remembered, and where
     9. Matching & checking logic .. how a variant finds its rule
    10. Page renderers ............. what each of the 7 pages shows
    11. Start-up ................... wires everything together

   MEDICAL-SAFETY RULES BUILT INTO THE CODE
   * The app NEVER claims it queried ClinVar, OncoKB, CIViC, ClinGen,
     COSMIC, CGI, FDA or EMA live. It has no such connection yet.
   * Where the curated library has no entry, the app says so instead of
     guessing. "Not curated here" never means "does not exist".
   * Evidence tiers shown are a hand-curated educational snapshot with
     the source cited; they must be verified at the source before use.
   * Findings must be confirmed by the clinician before interpretation.
   ===================================================================== */
'use strict';

/* =====================================================================
   1. HELPERS
   ===================================================================== */

/** Short names for finding elements on the page. */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Make any text safe before putting it into the page (prevents HTML injection). */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = () => 'v' + Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const num = (x) => (x === '' || x === null || x === undefined || isNaN(Number(x)) ? null : Number(x));

/** Date the curated library below was written and its PubMed references verified. */
const KB_SNAPSHOT = '2026-10-09';

/** Safe wrappers around browser storage (it can be blocked in private windows). */
const store = {
  get(area, key, fallback = null) {
    try { const v = window[area].getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(area, key, value) {
    try { window[area].setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
  remove(area, key) { try { window[area].removeItem(key); } catch (e) { /* ignore */ } }
};

/* =====================================================================
   2. EVIDENCE LIBRARY DATA
   ---------------------------------------------------------------------
   kind:'paper'  -> PMID and DOI were matched against PubMed on
                    2026-10-09 (title, journal, year, volume, first page).
   kind:'site'   -> organisation web address. These addresses were NOT
                    opened or live-checked by the app or by its developer
                    session, so a link might have moved. The app says so.
   Only first-page numbers are shown for papers (what was verified).
   ===================================================================== */
const REF_CATS = [
  'Classification frameworks',
  'Guidelines & consensus',
  'Knowledge bases & databases',
  'Regulatory & trial registries',
  'NGS methods & biomarkers',
  'Landmark trials',
  'Foundations & nomenclature'
];

const REFS = [
  /* ---- Classification frameworks ---- */
  { id: 'amp2017', cat: 'Classification frameworks', kind: 'paper', title: 'Standards and Guidelines for the Interpretation and Reporting of Sequence Variants in Cancer: A Joint Consensus Recommendation of AMP, ASCO and CAP', by: 'Li MM et al.', src: 'J Mol Diagn', year: 2017, vol: '19', page: '4', pmid: '27993330', doi: '10.1016/j.jmoldx.2016.10.002', version: 'Published Jan 2017 (4-tier system: Tier I–IV; evidence Levels A–D)', note: 'Defines clinical-significance Tiers I–IV for somatic variants. Says clinical significance must be re-evaluated on an ongoing basis.' },
  { id: 'acmg2015', cat: 'Classification frameworks', kind: 'paper', title: 'Standards and guidelines for the interpretation of sequence variants (ACMG/AMP)', by: 'Richards S et al.', src: 'Genet Med', year: 2015, vol: '17', page: '405', pmid: '25741868', doi: '10.1038/gim.2015.30', version: 'Published Mar 2015 (5 classes: pathogenic → benign)', note: 'The GERMLINE pathogenicity framework. Not designed for tumour-only somatic oncogenicity.' },
  { id: 'vicc2022', cat: 'Classification frameworks', kind: 'paper', title: 'Standards for the classification of pathogenicity of somatic variants in cancer (oncogenicity): ClinGen, CGC and VICC joint recommendations', by: 'Horak P et al.', src: 'Genet Med', year: 2022, vol: '24', page: '986', pmid: '35101336', doi: '10.1016/j.gim.2022.01.001', version: 'Published Jan 2022 (SOP; validated on 94 variants in 10 genes)', note: 'The SOMATIC ONCOGENICITY framework (oncogenic → benign). Separate from clinical actionability.' },
  { id: 'escat2018', cat: 'Classification frameworks', kind: 'paper', title: 'A framework to rank genomic alterations as targets for cancer precision medicine: the ESMO Scale for Clinical Actionability of molecular Targets (ESCAT)', by: 'Mateo J et al.', src: 'Ann Oncol', year: 2018, vol: '29', page: '1895', pmid: '30137196', doi: '10.1093/annonc/mdy263', version: 'First version, Sept 2018 (Tiers I, II, III, IV, V, X)', note: 'Ranks alterations by evidence for use as a drug target. Tiers are tumour-type-specific and have been revised since 2018.' },

  /* ---- Guidelines & consensus ---- */
  { id: 'esmo_ngs2024', cat: 'Guidelines & consensus', kind: 'paper', title: 'Recommendations for the use of next-generation sequencing (NGS) for patients with advanced cancer in 2024: a report from the ESMO Precision Medicine Working Group', by: 'Mosele F et al.', src: 'Ann Oncol', year: 2024, vol: '35', page: '588', pmid: '38834388', doi: '10.1016/j.annonc.2024.04.005', version: '2024 update', note: 'Which tumours to sequence routinely and which genes matter.' },
  { id: 'esmo_ngs2020', cat: 'Guidelines & consensus', kind: 'paper', title: 'Recommendations for the use of next-generation sequencing (NGS) for patients with metastatic cancers: a report from the ESMO Precision Medicine Working Group', by: 'Mosele F et al.', src: 'Ann Oncol', year: 2020, vol: '31', page: '1491', pmid: '32853681', doi: '10.1016/j.annonc.2020.07.014', version: '2020 (superseded in part by the 2024 update)', note: 'Earlier ESMO NGS recommendations; kept for historical comparison.' },
  { id: 'esmo_ctdna2022', cat: 'Guidelines & consensus', kind: 'paper', title: 'ESMO recommendations on the use of circulating tumour DNA assays for patients with cancer', by: 'Pascual J et al.', src: 'Ann Oncol', year: 2022, vol: '33', page: '750', pmid: '35809752', doi: '10.1016/j.annonc.2022.05.520', version: '2022', note: 'Tissue remains preferred for many patients (fusions and copy-number are harder in plasma); reflex tissue testing after a non-informative ctDNA result.' },
  { id: 'asco_pco2022', cat: 'Guidelines & consensus', kind: 'paper', title: 'Somatic Genomic Testing in Patients With Metastatic or Advanced Cancer: ASCO Provisional Clinical Opinion', by: 'Chakravarty D et al.', src: 'J Clin Oncol', year: 2022, vol: '40', page: '1231', pmid: '35175857', doi: '10.1200/JCO.21.02767', version: '2022', note: 'ASCO position on who should have somatic genomic testing.' },
  { id: 'mandelker2019', cat: 'Guidelines & consensus', kind: 'paper', title: 'Germline-focussed analysis of tumour-only sequencing: recommendations from the ESMO Precision Medicine Working Group', by: 'Mandelker D et al.', src: 'Ann Oncol', year: 2019, vol: '30', page: '1221', pmid: '31050713', doi: '10.1093/annonc/mdz136', version: '2019', note: 'How to recognise and handle possible germline findings in tumour-only reports.' },
  { id: 'eln2022', cat: 'Guidelines & consensus', kind: 'paper', title: 'Diagnosis and management of AML in adults: 2022 recommendations from an international expert panel on behalf of the ELN', by: 'Döhner H et al.', src: 'Blood', year: 2022, vol: '140', page: '1345', pmid: '35797463', doi: '10.1182/blood.2022016867', version: 'ELN 2022', note: 'AML genetic risk groups (favourable / intermediate / adverse).' },
  { id: 'nccn', cat: 'Guidelines & consensus', kind: 'site', title: 'NCCN Clinical Practice Guidelines in Oncology', by: 'National Comprehensive Cancer Network', src: 'nccn.org', url: 'https://www.nccn.org/guidelines/category_1', version: 'Versioned and updated frequently', note: 'Free registration required. Content is proprietary: this app does NOT reproduce NCCN recommendations. Always cite the NCCN version and date you consulted.' },
  { id: 'esmo_guidelines', cat: 'Guidelines & consensus', kind: 'site', title: 'ESMO Clinical Practice Guidelines', by: 'European Society for Medical Oncology', src: 'esmo.org', url: 'https://www.esmo.org/guidelines', version: 'Per-guideline publication date', note: 'Tumour-specific guidelines; ESCAT tiers are applied inside several of them.' },
  { id: 'asco_guidelines', cat: 'Guidelines & consensus', kind: 'site', title: 'ASCO Guidelines', by: 'American Society of Clinical Oncology', src: 'asco.org', url: 'https://www.asco.org/practice-patients/guidelines', version: 'Per-guideline publication date', note: 'Guidelines, rapid recommendation updates and provisional clinical opinions.' },

  /* ---- Knowledge bases & databases ---- */
  { id: 'oncokb_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'OncoKB: A Precision Oncology Knowledge Base', by: 'Chakravarty D et al.', src: 'JCO Precis Oncol', year: 2017, vol: '2017', page: 'PO.17.00011', pmid: '28890946', doi: '10.1200/PO.17.00011', version: 'Original description, 2017', note: 'Describes how OncoKB levels link alterations to FDA labels, NCCN, expert recommendations and literature.' },
  { id: 'oncokb', cat: 'Knowledge bases & databases', kind: 'site', title: 'OncoKB™ Precision Oncology Knowledge Base', by: 'Memorial Sloan Kettering Cancer Center', src: 'oncokb.org', url: 'https://www.oncokb.org/', version: 'Continuously updated; record the data version shown on the site', note: 'Free for research/educational use; a licence is required for commercial use and for clinical-reporting use. API access needs a token. Stage 2 must respect this.' },
  { id: 'clinvar_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'ClinVar: improving access to variant interpretations and supporting evidence', by: 'Landrum MJ et al.', src: 'Nucleic Acids Res', year: 2018, vol: '46', page: 'D1062', pmid: '29165669', doi: '10.1093/nar/gkx1153', version: '2018 database paper', note: 'Describes ClinVar submissions and review status.' },
  { id: 'clinvar', cat: 'Knowledge bases & databases', kind: 'site', title: 'ClinVar', by: 'NCBI, National Library of Medicine', src: 'ncbi.nlm.nih.gov/clinvar', url: 'https://www.ncbi.nlm.nih.gov/clinvar/', version: 'Continuously updated; classifications are submitter-asserted', note: 'Mostly germline-oriented archive. Always read the review status (0–4 stars) and the classification TYPE. Programmatic access via NCBI is planned for Stage 2.' },
  { id: 'clingen_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'ClinGen — the Clinical Genome Resource', by: 'Rehm HL et al.', src: 'N Engl J Med', year: 2015, vol: '372', page: '2235', pmid: '26014595', doi: '10.1056/NEJMsr1406261', version: '2015 overview', note: 'Overview of ClinGen expert panels (VCEPs), gene–disease validity and dosage sensitivity.' },
  { id: 'clingen', cat: 'Knowledge bases & databases', kind: 'site', title: 'ClinGen (Clinical Genome Resource)', by: 'ClinGen consortium', src: 'clinicalgenome.org', url: 'https://clinicalgenome.org/', version: 'Continuously updated', note: 'Expert-panel variant curation and the Somatic Cancer Clinical Domain Working Group.' },
  { id: 'civic_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'CIViC is a community knowledgebase for expert crowdsourcing the clinical interpretation of variants in cancer', by: 'Griffith M et al.', src: 'Nat Genet', year: 2017, vol: '49', page: '170', pmid: '28138153', doi: '10.1038/ng.3774', version: '2017 description', note: 'Open, community-curated evidence items with evidence levels and direction.' },
  { id: 'civic', cat: 'Knowledge bases & databases', kind: 'site', title: 'CIViC — Clinical Interpretation of Variants in Cancer', by: 'Washington University School of Medicine & community', src: 'civicdb.org', url: 'https://civicdb.org/', version: 'Continuously updated', note: 'Open-access; check the evidence level and whether the item is accepted.' },
  { id: 'cosmic_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'COSMIC: a curated database of somatic variants and clinical data for cancer', by: 'Sondka Z et al.', src: 'Nucleic Acids Res', year: 2024, vol: '52', page: 'D1210', pmid: '38183204', doi: '10.1093/nar/gkad986', version: '2024 database paper', note: 'Somatic variant frequencies across tumour types; useful for hotspot recurrence.' },
  { id: 'cosmic', cat: 'Knowledge bases & databases', kind: 'site', title: 'COSMIC — Catalogue Of Somatic Mutations In Cancer', by: 'Wellcome Sanger Institute', src: 'cancer.sanger.ac.uk/cosmic', url: 'https://cancer.sanger.ac.uk/cosmic', version: 'Release-versioned', note: 'Free for academic non-commercial use after registration; a commercial licence is required otherwise.' },
  { id: 'cgi_paper', cat: 'Knowledge bases & databases', kind: 'paper', title: 'Cancer Genome Interpreter annotates the biological and clinical relevance of tumor alterations', by: 'Tamborero D et al.', src: 'Genome Med', year: 2018, vol: '10', page: '25', pmid: '29592813', doi: '10.1186/s13073-018-0531-8', version: '2018 description', note: 'Annotates driver status and biomarker evidence of tumour alterations.' },
  { id: 'cgi', cat: 'Knowledge bases & databases', kind: 'site', title: 'Cancer Genome Interpreter (CGI)', by: 'Barcelona Biomedical Genomics Lab / IRB Barcelona', src: 'cancergenomeinterpreter.org', url: 'https://www.cancergenomeinterpreter.org/', version: 'Check the site for the current version', note: 'Web tool; upload of identifiable patient data to third-party tools needs consent and governance.' },
  { id: 'ncbi_eutils', cat: 'Knowledge bases & databases', kind: 'site', title: 'NCBI E-utilities (programmatic access to ClinVar and PubMed)', by: 'NCBI, National Library of Medicine', src: 'ncbi.nlm.nih.gov/books', url: 'https://www.ncbi.nlm.nih.gov/books/NBK25497/', version: 'Documentation page', note: 'Used by the optional live look-ups (esearch / esummary). Asks for modest request rates (the app waits ≥0.4 s between calls) and a tool name.' },
  { id: 'gnomad', cat: 'Knowledge bases & databases', kind: 'site', title: 'gnomAD — Genome Aggregation Database', by: 'Broad Institute & collaborators', src: 'gnomad.broadinstitute.org', url: 'https://gnomad.broadinstitute.org/', version: 'Release-versioned', note: 'Population allele frequencies; a variant common in healthy populations is unlikely to be a high-penetrance cancer variant.' },

  /* ---- Regulatory & trial registries ---- */
  { id: 'fda_daf', cat: 'Regulatory & trial registries', kind: 'site', title: 'Drugs@FDA — approved drug labels', by: 'US Food and Drug Administration', src: 'accessdata.fda.gov', url: 'https://www.accessdata.fda.gov/scripts/cder/daf/', version: 'Label-specific revision dates', note: 'The authoritative source for the exact approved indication, biomarker wording and test requirement.' },
  { id: 'fda_cdx', cat: 'Regulatory & trial registries', kind: 'site', title: 'List of Cleared or Approved Companion Diagnostic Devices', by: 'US Food and Drug Administration', src: 'fda.gov', url: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools', version: 'Updated by FDA', note: 'Which tests are approved for which biomarker–drug pairs.' },
  { id: 'fda_pgx', cat: 'Regulatory & trial registries', kind: 'site', title: 'Table of Pharmacogenomic Biomarkers in Drug Labeling', by: 'US Food and Drug Administration', src: 'fda.gov', url: 'https://www.fda.gov/drugs/science-and-research-drugs/table-pharmacogenomic-biomarkers-drug-labeling', version: 'Updated by FDA', note: 'Biomarker statements in FDA labels.' },
  { id: 'ema', cat: 'Regulatory & trial registries', kind: 'site', title: 'EMA — Medicines (EPAR product information)', by: 'European Medicines Agency', src: 'ema.europa.eu', url: 'https://www.ema.europa.eu/en/medicines', version: 'Product-specific', note: 'EU approval status and indications can differ from the FDA. This prototype does NOT curate EMA status: check the EPAR.' },
  { id: 'ctgov_api', cat: 'Regulatory & trial registries', kind: 'site', title: 'ClinicalTrials.gov API (v2) documentation', by: 'US National Library of Medicine', src: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/data-api/api', version: 'API v2', note: 'Used by the optional live trial search (recruiting studies only). No eligibility matching is done.' },
  { id: 'openfda', cat: 'Regulatory & trial registries', kind: 'site', title: 'openFDA drug label API', by: 'US Food and Drug Administration', src: 'open.fda.gov', url: 'https://open.fda.gov/apis/drug/label/', version: 'Label-specific effective dates are shown with each result', note: 'Used by the optional on-demand label check. Label text is shown verbatim, with its effective date.' },
  { id: 'oncokb_api', cat: 'Regulatory & trial registries', kind: 'site', title: 'OncoKB API access and licensing', by: 'Memorial Sloan Kettering Cancer Center', src: 'oncokb.org', url: 'https://www.oncokb.org/api-access', version: 'Terms are set by OncoKB', note: 'A token and licence terms are required for API use and for clinical reporting. The app reaches OncoKB only through your own local proxy.' },
  { id: 'pdfjs', cat: 'Foundations & nomenclature', kind: 'site', title: 'pdf.js — PDF rendering and text extraction library', by: 'Mozilla and contributors (Apache-2.0)', src: 'mozilla.github.io/pdf.js', url: 'https://mozilla.github.io/pdf.js/', version: 'Bundled version 3.11.174', note: 'Opens PDFs inside your browser and returns the selectable text used by the experimental extraction.' },
  { id: 'ctgov', cat: 'Regulatory & trial registries', kind: 'site', title: 'ClinicalTrials.gov', by: 'US National Library of Medicine', src: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/', version: 'Live registry', note: 'The app builds search links only; it does not retrieve or match trials.' },

  /* ---- NGS methods & biomarkers ---- */
  { id: 'msk_impact', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'MSK-IMPACT: a hybridization capture-based NGS clinical assay for solid tumor molecular oncology', by: 'Cheng DT et al.', src: 'J Mol Diagn', year: 2015, vol: '17', page: '251', pmid: '25801821', doi: '10.1016/j.jmoldx.2014.12.006', version: '2015', note: 'Example of how a clinical hybrid-capture tumour panel is validated.' },
  { id: 'tmb_harm', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Establishing guidelines to harmonize tumor mutational burden (TMB): Friends of Cancer Research TMB Harmonization Project, phase I', by: 'Merino DM et al.', src: 'J Immunother Cancer', year: 2020, vol: '8', page: 'e000147', pmid: '32217756', doi: '10.1136/jitc-2019-000147', version: '2020', note: 'Panel-based TMB varies by panel size, genes and pipeline; variability rises at higher TMB.' },
  { id: 'kn158_tmb', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Association of tumour mutational burden with outcomes in patients with advanced solid tumours treated with pembrolizumab: KEYNOTE-158', by: 'Marabelle A et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '1353', pmid: '32919526', doi: '10.1016/S1470-2045(20)30445-9', version: '2020', note: 'Basis of the TMB-high (≥10 mut/Mb) tumour-agnostic pembrolizumab indication (see the FDA label for exact wording).' },
  { id: 'kn158_msi', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Efficacy of pembrolizumab in patients with noncolorectal high MSI/MMR-deficient cancer: KEYNOTE-158', by: 'Marabelle A et al.', src: 'J Clin Oncol', year: 2020, vol: '38', page: '1', pmid: '31682550', doi: '10.1200/JCO.19.02105', version: '2020', note: 'Pembrolizumab activity across non-colorectal MSI-H/dMMR cancers.' },
  { id: 'le2017', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Mismatch repair deficiency predicts response of solid tumors to PD-1 blockade', by: 'Le DT et al.', src: 'Science', year: 2017, vol: '357', page: '409', pmid: '28596308', doi: '10.1126/science.aan6733', version: '2017', note: 'Foundational dMMR / PD-1 data across tumour types.' },
  { id: 'alexandrov2013', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Signatures of mutational processes in human cancer', by: 'Alexandrov LB et al.', src: 'Nature', year: 2013, vol: '500', page: '415', pmid: '23945592', doi: '10.1038/nature12477', version: '2013', note: 'Origin of COSMIC mutational signatures (e.g. UV, tobacco, APOBEC, HRD).' },
  { id: 'paola', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Olaparib plus bevacizumab as first-line maintenance in ovarian cancer (PAOLA-1)', by: 'Ray-Coquard I et al.', src: 'N Engl J Med', year: 2019, vol: '381', page: '2416', pmid: '31851799', doi: '10.1056/NEJMoa1911361', version: '2019', note: 'HRD-positive subgroup benefit (BRCA-mutated or genomic-instability-positive).' },
  { id: 'jaiswal2014', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Age-related clonal hematopoiesis associated with adverse outcomes', by: 'Jaiswal S et al.', src: 'N Engl J Med', year: 2014, vol: '371', page: '2488', pmid: '25426837', doi: '10.1056/NEJMoa1408617', version: '2014', note: 'Landmark clonal haematopoiesis (CHIP) paper.' },
  { id: 'steensma2015', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Clonal hematopoiesis of indeterminate potential and its distinction from myelodysplastic syndromes', by: 'Steensma DP et al.', src: 'Blood', year: 2015, vol: '126', page: '9', pmid: '25931582', doi: '10.1182/blood-2015-03-631747', version: '2015', note: 'Defines CHIP (somatic mutation in blood cells at VAF ≥2% without haematological malignancy).' },
  { id: 'coombs2017', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'Therapy-related clonal hematopoiesis in patients with non-hematologic cancers is common and associated with adverse clinical outcomes', by: 'Coombs CC et al.', src: 'Cell Stem Cell', year: 2017, vol: '21', page: '374', pmid: '28803919', doi: '10.1016/j.stem.2017.07.010', version: '2017', note: 'Chemotherapy/radiotherapy enrich CHIP, notably in DNA-damage-response genes.' },
  { id: 'razavi2019', cat: 'NGS methods & biomarkers', kind: 'paper', title: 'High-intensity sequencing reveals the sources of plasma circulating cell-free DNA variants', by: 'Razavi P et al.', src: 'Nat Med', year: 2019, vol: '25', page: '1928', pmid: '31768066', doi: '10.1038/s41591-019-0652-7', version: '2019', note: 'Many plasma variants derive from white blood cells (CHIP), not the tumour.' },

  /* ---- Landmark trials ---- */
  { id: 'flaura', cat: 'Landmark trials', kind: 'paper', title: 'Osimertinib in Untreated EGFR-Mutated Advanced NSCLC (FLAURA)', by: 'Soria J-C et al.', src: 'N Engl J Med', year: 2018, vol: '378', page: '113', pmid: '29151359', doi: '10.1056/NEJMoa1713137', version: '2018', note: 'Median PFS 18.9 vs 10.2 months (HR 0.46) vs gefitinib/erlotinib.' },
  { id: 'flaura_os', cat: 'Landmark trials', kind: 'paper', title: 'Overall Survival with Osimertinib in Untreated, EGFR-Mutated Advanced NSCLC (FLAURA OS)', by: 'Ramalingam SS et al.', src: 'N Engl J Med', year: 2020, vol: '382', page: '41', pmid: '31751012', doi: '10.1056/NEJMoa1913662', version: '2020', note: 'Median OS 38.6 vs 31.8 months (HR 0.80).' },
  { id: 'flaura2', cat: 'Landmark trials', kind: 'paper', title: 'Osimertinib with or without Chemotherapy in EGFR-Mutated Advanced NSCLC (FLAURA2)', by: 'Planchard D et al.', src: 'N Engl J Med', year: 2023, vol: '389', page: '1935', pmid: '37937763', doi: '10.1056/NEJMoa2306434', version: '2023', note: 'Progression-free at 24 months: 57% vs 41% (HR 0.62) vs osimertinib alone.' },
  { id: 'mariposa', cat: 'Landmark trials', kind: 'paper', title: 'Amivantamab plus Lazertinib in Previously Untreated EGFR-Mutated Advanced NSCLC (MARIPOSA)', by: 'Cho BC et al.', src: 'N Engl J Med', year: 2024, vol: '391', page: '1486', pmid: '38924756', doi: '10.1056/NEJMoa2403614', version: '2024', note: 'Median PFS 23.7 vs 16.6 months (HR 0.70) vs osimertinib.' },
  { id: 'adaura', cat: 'Landmark trials', kind: 'paper', title: 'Osimertinib in Resected EGFR-Mutated NSCLC (ADAURA)', by: 'Wu Y-L et al.', src: 'N Engl J Med', year: 2020, vol: '383', page: '1711', pmid: '32955177', doi: '10.1056/NEJMoa2027071', version: '2020', note: 'Adjuvant osimertinib after resection (stage IB–IIIA).' },
  { id: 'laura', cat: 'Landmark trials', kind: 'paper', title: 'Osimertinib after Chemoradiotherapy in Stage III EGFR-Mutated NSCLC (LAURA)', by: 'Lu S et al.', src: 'N Engl J Med', year: 2024, vol: '391', page: '585', pmid: '38828946', doi: '10.1056/NEJMoa2402614', version: '2024', note: 'Consolidation after chemoradiotherapy in unresectable stage III.' },
  { id: 'aura3', cat: 'Landmark trials', kind: 'paper', title: 'Osimertinib or Platinum–Pemetrexed in EGFR T790M-Positive Lung Cancer (AURA3)', by: 'Mok TS et al.', src: 'N Engl J Med', year: 2017, vol: '376', page: '629', pmid: '27959700', doi: '10.1056/NEJMoa1612674', version: '2017', note: 'T790M-positive disease after first-line EGFR TKI.' },
  { id: 'papillon', cat: 'Landmark trials', kind: 'paper', title: 'Amivantamab plus Chemotherapy in NSCLC with EGFR Exon 20 Insertions (PAPILLON)', by: 'Zhou C et al.', src: 'N Engl J Med', year: 2023, vol: '389', page: '2039', pmid: '37870976', doi: '10.1056/NEJMoa2306441', version: '2023', note: 'First-line EGFR exon 20 insertion NSCLC.' },
  { id: 'alex', cat: 'Landmark trials', kind: 'paper', title: 'Alectinib versus Crizotinib in Untreated ALK-Positive NSCLC (ALEX)', by: 'Peters S et al.', src: 'N Engl J Med', year: 2017, vol: '377', page: '829', pmid: '28586279', doi: '10.1056/NEJMoa1704795', version: '2017', note: 'Investigator-assessed PFS HR 0.47 vs crizotinib.' },
  { id: 'crown', cat: 'Landmark trials', kind: 'paper', title: 'Lorlatinib Versus Crizotinib in Advanced ALK-Positive NSCLC: 5-Year Outcomes From the Phase III CROWN Study', by: 'Solomon BJ et al.', src: 'J Clin Oncol', year: 2024, vol: '42', page: '3400', pmid: '38819031', doi: '10.1200/JCO.24.00581', version: '2024', note: '5-year PFS 60% with lorlatinib vs 8% with crizotinib (HR 0.19).' },
  { id: 'entrectinib', cat: 'Landmark trials', kind: 'paper', title: 'Entrectinib in ROS1 fusion-positive NSCLC: integrated analysis of three phase 1–2 trials', by: 'Drilon A et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '261', pmid: '31838015', doi: '10.1016/S1470-2045(19)30690-4', version: '2020', note: 'Single-arm integrated analysis in ROS1-fusion NSCLC.' },
  { id: 'libretto', cat: 'Landmark trials', kind: 'paper', title: 'Efficacy of Selpercatinib in RET Fusion-Positive NSCLC (LIBRETTO-001)', by: 'Drilon A et al.', src: 'N Engl J Med', year: 2020, vol: '383', page: '813', pmid: '32846060', doi: '10.1056/NEJMoa2005653', version: '2020', note: 'ORR 64% in previously platinum-treated patients.' },
  { id: 'geometry', cat: 'Landmark trials', kind: 'paper', title: 'Capmatinib in MET Exon 14-Mutated or MET-Amplified NSCLC (GEOMETRY mono-1)', by: 'Wolf J et al.', src: 'N Engl J Med', year: 2020, vol: '383', page: '944', pmid: '32877583', doi: '10.1056/NEJMoa2002787', version: '2020', note: 'MET exon 14: ORR 68% (treatment-naïve) and 41% (previously treated).' },
  { id: 'codebreak100', cat: 'Landmark trials', kind: 'paper', title: 'Sotorasib for Lung Cancers with KRAS p.G12C Mutation (CodeBreaK 100)', by: 'Skoulidis F et al.', src: 'N Engl J Med', year: 2021, vol: '384', page: '2371', pmid: '34096690', doi: '10.1056/NEJMoa2103695', version: '2021', note: 'ORR 37.1%, median PFS 6.8 months (previously treated NSCLC).' },
  { id: 'krystal1', cat: 'Landmark trials', kind: 'paper', title: 'Adagrasib in NSCLC Harboring a KRAS G12C Mutation (KRYSTAL-1)', by: 'Jänne PA et al.', src: 'N Engl J Med', year: 2022, vol: '387', page: '120', pmid: '35658005', doi: '10.1056/NEJMoa2204619', version: '2022', note: 'Phase 1–2 data in previously treated KRAS G12C NSCLC.' },
  { id: 'destiny_lung02', cat: 'Landmark trials', kind: 'paper', title: 'Trastuzumab Deruxtecan in HER2 (ERBB2)-Mutant Metastatic NSCLC: DESTINY-Lung02', by: 'Goto K et al.', src: 'J Clin Oncol', year: 2023, vol: '41', page: '4852', pmid: '37694347', doi: '10.1200/JCO.23.01361', version: '2023', note: 'ORR 49% at 5.4 mg/kg in HER2-mutant NSCLC.' },
  { id: 'braf_nsclc', cat: 'Landmark trials', kind: 'paper', title: 'Dabrafenib plus trametinib in previously treated BRAF V600E-mutant metastatic NSCLC', by: 'Planchard D et al.', src: 'Lancet Oncol', year: 2016, vol: '17', page: '984', pmid: '27283860', doi: '10.1016/S1470-2045(16)30146-2', version: '2016', note: 'Phase 2 basis for BRAF V600E NSCLC.' },
  { id: 'combi_d', cat: 'Landmark trials', kind: 'paper', title: 'Combined BRAF and MEK inhibition versus BRAF inhibition alone in melanoma (COMBI-d)', by: 'Long GV et al.', src: 'N Engl J Med', year: 2014, vol: '371', page: '1877', pmid: '25265492', doi: '10.1056/NEJMoa1406037', version: '2014', note: 'Dabrafenib + trametinib vs dabrafenib in BRAF V600E/K melanoma.' },
  { id: 'beacon', cat: 'Landmark trials', kind: 'paper', title: 'Encorafenib, Binimetinib, and Cetuximab in BRAF V600E-Mutated Colorectal Cancer (BEACON)', by: 'Kopetz S et al.', src: 'N Engl J Med', year: 2019, vol: '381', page: '1632', pmid: '31566309', doi: '10.1056/NEJMoa1908075', version: '2019', note: 'Triplet: ORR 26% vs 2%; median OS 9.0 vs 5.4 months (HR 0.52).' },
  { id: 'kn177', cat: 'Landmark trials', kind: 'paper', title: 'Pembrolizumab in Microsatellite-Instability-High Advanced Colorectal Cancer (KEYNOTE-177)', by: 'André T et al.', src: 'N Engl J Med', year: 2020, vol: '383', page: '2207', pmid: '33264544', doi: '10.1056/NEJMoa2017699', version: '2020', note: 'Median PFS 16.5 vs 8.2 months (HR 0.60) vs chemotherapy.' },
  { id: 'cercek2022', cat: 'Landmark trials', kind: 'paper', title: 'PD-1 Blockade in Mismatch Repair–Deficient, Locally Advanced Rectal Cancer', by: 'Cercek A et al.', src: 'N Engl J Med', year: 2022, vol: '386', page: '2363', pmid: '35660797', doi: '10.1056/NEJMoa2201445', version: '2022', note: 'Single-centre phase 2 (dostarlimab). Practice-changing signal; confirm regulatory/guideline status before use.' },
  { id: 'solar1', cat: 'Landmark trials', kind: 'paper', title: 'Alpelisib for PIK3CA-Mutated, Hormone Receptor–Positive Advanced Breast Cancer (SOLAR-1)', by: 'André F et al.', src: 'N Engl J Med', year: 2019, vol: '380', page: '1929', pmid: '31091374', doi: '10.1056/NEJMoa1813904', version: '2019', note: 'PIK3CA-mutated cohort: median PFS 11.0 vs 5.7 months (HR 0.65).' },
  { id: 'capitello291', cat: 'Landmark trials', kind: 'paper', title: 'Capivasertib in Hormone Receptor–Positive Advanced Breast Cancer (CAPItello-291)', by: 'Turner NC et al.', src: 'N Engl J Med', year: 2023, vol: '388', page: '2058', pmid: '37256976', doi: '10.1056/NEJMoa2214131', version: '2023', note: 'Benefit with PIK3CA/AKT1/PTEN pathway alterations (and overall population).' },
  { id: 'inavo120', cat: 'Landmark trials', kind: 'paper', title: 'Overall Survival with Inavolisib in PIK3CA-Mutated Advanced Breast Cancer (INAVO120)', by: 'Jhaveri KL et al.', src: 'N Engl J Med', year: 2025, vol: '393', page: '151', pmid: '40454641', doi: '10.1056/NEJMoa2501796', version: '2025', note: 'Overall-survival report of the INAVO120 trial.' },
  { id: 'emerald', cat: 'Landmark trials', kind: 'paper', title: 'Elacestrant versus Standard Endocrine Therapy for ER+/HER2– Advanced Breast Cancer: EMERALD', by: 'Bidard F-C et al.', src: 'J Clin Oncol', year: 2022, vol: '40', page: '3246', pmid: '35584336', doi: '10.1200/JCO.22.00338', version: '2022', note: 'ESR1-mutated subgroup: PFS HR 0.55 (95% CI 0.39–0.77) vs standard endocrine therapy.' },
  { id: 'olympiad', cat: 'Landmark trials', kind: 'paper', title: 'Olaparib for Metastatic Breast Cancer in Patients with a Germline BRCA Mutation (OlympiAD)', by: 'Robson M et al.', src: 'N Engl J Med', year: 2017, vol: '377', page: '523', pmid: '28578601', doi: '10.1056/NEJMoa1706450', version: '2017', note: 'Median PFS 7.0 vs 4.2 months (HR 0.58). Germline-defined population.' },
  { id: 'olympia', cat: 'Landmark trials', kind: 'paper', title: 'Adjuvant Olaparib for Patients with BRCA1- or BRCA2-Mutated Breast Cancer (OlympiA)', by: 'Tutt ANJ et al.', src: 'N Engl J Med', year: 2021, vol: '384', page: '2394', pmid: '34081848', doi: '10.1056/NEJMoa2105215', version: '2021', note: 'Adjuvant setting; germline BRCA1/2.' },
  { id: 'solo1', cat: 'Landmark trials', kind: 'paper', title: 'Maintenance Olaparib in Patients with Newly Diagnosed Advanced Ovarian Cancer (SOLO-1)', by: 'Moore K et al.', src: 'N Engl J Med', year: 2018, vol: '379', page: '2495', pmid: '30345884', doi: '10.1056/NEJMoa1810858', version: '2018', note: 'BRCA-mutated ovarian cancer; PFS HR 0.30.' },
  { id: 'polo', cat: 'Landmark trials', kind: 'paper', title: 'Maintenance Olaparib for Germline BRCA-Mutated Metastatic Pancreatic Cancer (POLO)', by: 'Golan T et al.', src: 'N Engl J Med', year: 2019, vol: '381', page: '317', pmid: '31157963', doi: '10.1056/NEJMoa1903387', version: '2019', note: 'Median PFS 7.4 vs 3.8 months (HR 0.53).' },
  { id: 'profound', cat: 'Landmark trials', kind: 'paper', title: 'Olaparib for Metastatic Castration-Resistant Prostate Cancer (PROfound)', by: 'de Bono J et al.', src: 'N Engl J Med', year: 2020, vol: '382', page: '2091', pmid: '32343890', doi: '10.1056/NEJMoa1911440', version: '2020', note: 'Cohort A (BRCA1/2/ATM): rPFS 7.4 vs 3.6 months (HR 0.34).' },
  { id: 'larotrectinib', cat: 'Landmark trials', kind: 'paper', title: 'Efficacy of Larotrectinib in TRK Fusion–Positive Cancers in Adults and Children', by: 'Drilon A et al.', src: 'N Engl J Med', year: 2018, vol: '378', page: '731', pmid: '29466156', doi: '10.1056/NEJMoa1714448', version: '2018', note: 'Tumour-agnostic NTRK-fusion activity.' },
  { id: 'hong2020', cat: 'Landmark trials', kind: 'paper', title: 'Larotrectinib in patients with TRK fusion-positive solid tumours: a pooled analysis of three phase 1/2 trials', by: 'Hong DS et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '531', pmid: '32105622', doi: '10.1016/S1470-2045(19)30856-3', version: '2020', note: 'Pooled ORR 79%.' },
  { id: 'clarid_hy', cat: 'Landmark trials', kind: 'paper', title: 'Ivosidenib in IDH1-mutant, chemotherapy-refractory cholangiocarcinoma (ClarIDHy)', by: 'Abou-Alfa GK et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '796', pmid: '32416072', doi: '10.1016/S1470-2045(20)30157-1', version: '2020', note: 'Median PFS 2.7 vs 1.4 months (HR 0.37).' },
  { id: 'indigo', cat: 'Landmark trials', kind: 'paper', title: 'Vorasidenib in IDH1- or IDH2-Mutant Low-Grade Glioma (INDIGO)', by: 'Mellinghoff IK et al.', src: 'N Engl J Med', year: 2023, vol: '389', page: '589', pmid: '37272516', doi: '10.1056/NEJMoa2304194', version: '2023', note: 'Grade 2 IDH-mutant glioma after surgery.' },
  { id: 'agile', cat: 'Landmark trials', kind: 'paper', title: 'Ivosidenib and Azacitidine in IDH1-Mutated Acute Myeloid Leukemia (AGILE)', by: 'Montesinos P et al.', src: 'N Engl J Med', year: 2022, vol: '386', page: '1519', pmid: '35443108', doi: '10.1056/NEJMoa2117344', version: '2022', note: 'Newly diagnosed IDH1-mutated AML unfit for intensive chemotherapy.' },
  { id: 'idhentify', cat: 'Landmark trials', kind: 'paper', title: 'Enasidenib vs conventional care in older patients with late-stage mutant-IDH2 relapsed/refractory AML (IDHENTIFY)', by: 'de Botton S et al.', src: 'Blood', year: 2023, vol: '141', page: '156', pmid: '35714312', doi: '10.1182/blood.2021014901', version: '2023', note: 'Randomised phase 3; overall survival was not significantly improved.' },
  { id: 'ratify', cat: 'Landmark trials', kind: 'paper', title: 'Midostaurin plus Chemotherapy for AML with a FLT3 Mutation (RATIFY)', by: 'Stone RM et al.', src: 'N Engl J Med', year: 2017, vol: '377', page: '454', pmid: '28644114', doi: '10.1056/NEJMoa1614359', version: '2017', note: 'FLT3-ITD or TKD; OS benefit with midostaurin.' },
  { id: 'quantum', cat: 'Landmark trials', kind: 'paper', title: 'Quizartinib plus chemotherapy in newly diagnosed FLT3-ITD-positive AML (QuANTUM-First)', by: 'Erba HP et al.', src: 'Lancet', year: 2023, vol: '401', page: '1571', pmid: '37116523', doi: '10.1016/S0140-6736(23)00464-6', version: '2023', note: 'ITD-positive disease only; median OS 31.9 vs 15.1 months.' },
  { id: 'admiral', cat: 'Landmark trials', kind: 'paper', title: 'Gilteritinib or Chemotherapy for Relapsed or Refractory FLT3-Mutated AML (ADMIRAL)', by: 'Perl AE et al.', src: 'N Engl J Med', year: 2019, vol: '381', page: '1728', pmid: '31665578', doi: '10.1056/NEJMoa1902688', version: '2019', note: 'Median OS 9.3 vs 5.6 months (HR 0.64).' },
  { id: 'iris', cat: 'Landmark trials', kind: 'paper', title: 'Imatinib compared with interferon and low-dose cytarabine for newly diagnosed chronic-phase CML (IRIS)', by: "O'Brien SG et al.", src: 'N Engl J Med', year: 2003, vol: '348', page: '994', pmid: '12637609', doi: '10.1056/NEJMoa022457', version: '2003', note: 'Established BCR::ABL1 targeting in CML.' },
  { id: 'pace', cat: 'Landmark trials', kind: 'paper', title: 'A phase 2 trial of ponatinib in Philadelphia chromosome-positive leukemias (PACE)', by: 'Cortes JE et al.', src: 'N Engl J Med', year: 2013, vol: '369', page: '1783', pmid: '24180494', doi: '10.1056/NEJMoa1306494', version: '2013', note: 'Activity in resistant disease including T315I.' },
  { id: 'fight202', cat: 'Landmark trials', kind: 'paper', title: 'Pemigatinib for previously treated, locally advanced or metastatic cholangiocarcinoma (FIGHT-202)', by: 'Abou-Alfa GK et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '671', pmid: '32203698', doi: '10.1016/S1470-2045(20)30109-1', version: '2020', note: 'FGFR2 fusion/rearrangement cohort ORR 35.5%.' },
  { id: 'blc2001', cat: 'Landmark trials', kind: 'paper', title: 'Erdafitinib in Locally Advanced or Metastatic Urothelial Carcinoma', by: 'Loriot Y et al.', src: 'N Engl J Med', year: 2019, vol: '381', page: '338', pmid: '31340094', doi: '10.1056/NEJMoa1817323', version: '2019', note: 'FGFR-altered urothelial carcinoma.' },
  { id: 'invictus', cat: 'Landmark trials', kind: 'paper', title: 'Ripretinib in patients with advanced GIST (INVICTUS)', by: 'Blay J-Y et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '923', pmid: '32511981', doi: '10.1016/S1470-2045(20)30168-6', version: '2020', note: 'Fourth-line and later GIST.' },
  { id: 'navigator', cat: 'Landmark trials', kind: 'paper', title: 'Avapritinib in advanced PDGFRA D842V-mutant GIST (NAVIGATOR)', by: 'Heinrich MC et al.', src: 'Lancet Oncol', year: 2020, vol: '21', page: '935', pmid: '32615108', doi: '10.1016/S1470-2045(20)30269-2', version: '2020', note: 'Imatinib-resistant PDGFRA D842V.' },

  /* ---- Foundations & nomenclature ---- */
  { id: 'hgvs2016', cat: 'Foundations & nomenclature', kind: 'paper', title: 'HGVS Recommendations for the Description of Sequence Variants: 2016 Update', by: 'den Dunnen JT et al.', src: 'Hum Mutat', year: 2016, vol: '37', page: '564', pmid: '26931183', doi: '10.1002/humu.22981', version: '2016 update', note: 'How to write c., p., g. and n. variant descriptions.' },
  { id: 'hgvs_site', cat: 'Foundations & nomenclature', kind: 'site', title: 'HGVS Nomenclature (online)', by: 'HGVS / Human Genome Variation Society', src: 'hgvs-nomenclature.org', url: 'https://hgvs-nomenclature.org/', version: 'Check the site for the current version', note: 'Online reference for variant nomenclature.' },
  { id: 'hallmarks2011', cat: 'Foundations & nomenclature', kind: 'paper', title: 'Hallmarks of cancer: the next generation', by: 'Hanahan D, Weinberg RA', src: 'Cell', year: 2011, vol: '144', page: '646', pmid: '21376230', doi: '10.1016/j.cell.2011.02.013', version: '2011', note: 'The Hanahan–Weinberg hallmarks.' },
  { id: 'knudson1971', cat: 'Foundations & nomenclature', kind: 'paper', title: 'Mutation and cancer: statistical study of retinoblastoma', by: 'Knudson AG', src: 'Proc Natl Acad Sci USA', year: 1971, vol: '68', page: '820', pmid: '5279523', doi: '10.1073/pnas.68.4.820', version: '1971', note: 'The Knudson two-hit hypothesis.' },
  { id: 'bethesda2004', cat: 'Foundations & nomenclature', kind: 'paper', title: 'Revised Bethesda Guidelines for hereditary nonpolyposis colorectal cancer (Lynch syndrome) and microsatellite instability', by: 'Umar A et al.', src: 'J Natl Cancer Inst', year: 2004, vol: '96', page: '261', pmid: '14970275', doi: '10.1093/jnci/djh034', version: '2004', note: 'The revised Bethesda guidelines and MSI marker panel.' }
];

const REF_BY_ID = Object.fromEntries(REFS.map((r) => [r.id, r]));

/** Build the best link for a reference (PubMed for papers, the organisation for sites). */
function refLink(r) {
  if (r.kind === 'paper') return `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
  return r.url;
}
function refCitation(r) {
  if (r.kind === 'paper') {
    return `${r.by} ${r.src} ${r.year};${r.vol}:${r.page}. PMID ${r.pmid}. doi:${r.doi}`;
  }
  return `${r.by}. ${r.title}. ${r.url}`;
}

/* =====================================================================
   3. GENE LIBRARY
   ---------------------------------------------------------------------
   Plain biology only: what the normal gene does, which pathway it sits
   in, and whether germline (inherited) variants matter. No drug claims
   live here. Genes missing from this list are reported as
   "not in the prototype library" — the app never guesses.
   role: how the gene usually contributes to cancer
   ===================================================================== */
const GENES = {
  EGFR:   { name: 'Epidermal growth factor receptor', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Transmembrane receptor tyrosine kinase. Ligand binding (EGF, TGF-α, amphiregulin) causes dimerisation and trans-autophosphorylation, driving proliferation, survival and migration of epithelial cells.', pathway: 'RAS–RAF–MEK–ERK; PI3K–AKT–mTOR; JAK–STAT', germline: 'Germline EGFR variants are rare. Germline T790M has been described in rare lung-cancer-prone families.' },
  ALK:    { name: 'Anaplastic lymphoma kinase', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor tyrosine kinase of the insulin-receptor superfamily with a role in nervous-system development; barely expressed in normal adult tissue. Gene fusions (e.g. EML4::ALK) cause ligand-independent dimerisation.', pathway: 'RAS–MAPK; PI3K–AKT; JAK–STAT', germline: 'Rare germline activating ALK variants (e.g. F1174L, R1275Q) cause familial neuroblastoma predisposition.' },
  ROS1:   { name: 'ROS proto-oncogene 1, receptor tyrosine kinase', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Orphan receptor tyrosine kinase related to ALK/insulin-receptor family; physiological role is incompletely defined. Fusions (e.g. CD74::ROS1) retain the kinase domain and signal constitutively.', pathway: 'RAS–MAPK; PI3K–AKT; JAK–STAT', germline: 'No established hereditary cancer syndrome.' },
  RET:    { name: 'RET proto-oncogene', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor tyrosine kinase for GDNF-family ligands; essential for development of the enteric nervous system and kidney.', pathway: 'RAS–MAPK; PI3K–AKT; PLCγ', germline: 'Germline activating RET variants cause MEN2A/MEN2B and familial medullary thyroid carcinoma; germline loss-of-function causes Hirschsprung disease. Somatic fusions are a different mechanism.' },
  MET:    { name: 'MET proto-oncogene, receptor tyrosine kinase (HGF receptor)', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor for hepatocyte growth factor; regulates epithelial–mesenchymal transition, tissue repair and embryogenesis. Exon 14 encodes the juxtamembrane region that carries the CBL ubiquitin-ligase binding site (Y1003).', pathway: 'RAS–MAPK; PI3K–AKT; STAT3', germline: 'Germline activating kinase-domain variants cause hereditary papillary renal carcinoma.' },
  ERBB2:  { name: 'Erb-b2 receptor tyrosine kinase 2 (HER2)', role: 'Oncogene (receptor tyrosine kinase)', fn: 'EGFR-family receptor with no known ligand; the preferred dimerisation partner of other HER-family members, amplifying their signalling.', pathway: 'PI3K–AKT; RAS–MAPK', germline: 'No established hereditary cancer syndrome.' },
  KRAS:   { name: 'KRAS proto-oncogene, GTPase', role: 'Oncogene (small GTPase)', fn: 'Small GTPase that cycles between inactive GDP-bound and active GTP-bound states, relaying growth-factor signals. Oncogenic variants (codons 12, 13, 61) impair GTP hydrolysis so the protein stays "on".', pathway: 'RAF–MEK–ERK; PI3K–AKT; RAL-GEF', germline: 'Germline KRAS variants (different from tumour hotspots) cause RASopathies such as Noonan syndrome.' },
  NRAS:   { name: 'NRAS proto-oncogene, GTPase', role: 'Oncogene (small GTPase)', fn: 'RAS-family GTPase with the same on/off cycle as KRAS; codon 61 variants are typical in melanoma.', pathway: 'RAF–MEK–ERK; PI3K–AKT', germline: 'Germline NRAS variants cause RASopathy (Noonan syndrome).' },
  BRAF:   { name: 'B-Raf proto-oncogene, serine/threonine kinase', role: 'Oncogene (kinase)', fn: 'RAF-family kinase directly downstream of RAS; phosphorylates MEK1/2. The V600E variant mimics activation-loop phosphorylation and signals as an active monomer independent of RAS.', pathway: 'RAS–RAF–MEK–ERK (MAPK)', germline: 'Germline BRAF variants cause cardio-facio-cutaneous syndrome (a RASopathy).' },
  NTRK1:  { name: 'Neurotrophic receptor tyrosine kinase 1 (TRKA)', role: 'Oncogene when fused (receptor tyrosine kinase)', fn: 'Neurotrophin receptor important for neuronal development and survival. Fusions join the kinase domain to a partner gene, producing constitutive signalling.', pathway: 'RAS–MAPK; PI3K–AKT; PLCγ', germline: 'No established hereditary cancer syndrome.' },
  NTRK2:  { name: 'Neurotrophic receptor tyrosine kinase 2 (TRKB)', role: 'Oncogene when fused (receptor tyrosine kinase)', fn: 'Neurotrophin (BDNF) receptor; fusions create constitutively active kinases.', pathway: 'RAS–MAPK; PI3K–AKT; PLCγ', germline: 'No established hereditary cancer syndrome.' },
  NTRK3:  { name: 'Neurotrophic receptor tyrosine kinase 3 (TRKC)', role: 'Oncogene when fused (receptor tyrosine kinase)', fn: 'Neurotrophin-3 receptor. ETV6::NTRK3 is the classic fusion (secretory carcinoma, infantile fibrosarcoma).', pathway: 'RAS–MAPK; PI3K–AKT; PLCγ', germline: 'No established hereditary cancer syndrome.' },
  NRG1:   { name: 'Neuregulin 1', role: 'Ligand; oncogenic when fused', fn: 'Growth-factor ligand for ERBB3 (HER3)/ERBB4. NRG1 fusions retain the EGF-like domain and drive ERBB3-dependent signalling.', pathway: 'ERBB3–PI3K–AKT; MAPK', germline: 'No established hereditary cancer syndrome.' },
  PIK3CA: { name: 'Phosphatidylinositol-4,5-bisphosphate 3-kinase catalytic subunit alpha', role: 'Oncogene (lipid kinase)', fn: 'Catalytic p110α subunit of class IA PI3K; converts PIP2 to PIP3, which activates AKT. Common hotspots: E542K and E545K (helical domain), H1047R (kinase domain).', pathway: 'PI3K–AKT–mTOR', germline: 'Post-zygotic (mosaic) PIK3CA variants cause PIK3CA-related overgrowth spectrum; not a classic germline cancer-predisposition gene.' },
  AKT1:   { name: 'AKT serine/threonine kinase 1', role: 'Oncogene (kinase)', fn: 'Central kinase of the PI3K pathway. The E17K variant in the PH domain promotes membrane localisation and constitutive activation.', pathway: 'PI3K–AKT–mTOR', germline: 'Mosaic AKT1 E17K causes Proteus syndrome.' },
  PTEN:   { name: 'Phosphatase and tensin homolog', role: 'Tumour suppressor', fn: 'Lipid phosphatase that converts PIP3 back to PIP2, opposing PI3K signalling. Loss (mutation or deletion) raises AKT activity.', pathway: 'PI3K–AKT–mTOR', germline: 'Germline PTEN pathogenic variants cause PTEN hamartoma tumour syndrome (Cowden syndrome): breast, thyroid and endometrial cancer risk.' },
  ESR1:   { name: 'Estrogen receptor 1 (ERα)', role: 'Hormone receptor / lineage driver', fn: 'Ligand-activated nuclear transcription factor mediating oestrogen signalling in breast and uterine tissue. Ligand-binding-domain mutations (e.g. Y537S, D538G) give ligand-independent activity and are typically acquired under aromatase-inhibitor therapy.', pathway: 'Oestrogen-receptor signalling; crosstalk with PI3K/MAPK and CDK4/6–cyclin D', germline: 'Not a hereditary cancer gene; ESR1 ligand-binding-domain mutations are acquired.' },
  BRCA1:  { name: 'BRCA1 DNA repair associated', role: 'Tumour suppressor (DNA repair)', fn: 'Key factor in homologous-recombination repair of double-strand DNA breaks, also checkpoint signalling and replication-fork protection. Loss of both copies causes homologous-recombination deficiency (HRD) and PARP-inhibitor sensitivity.', pathway: 'Homologous-recombination repair (BRCA1–PALB2–BRCA2–RAD51)', germline: 'Germline pathogenic variants cause hereditary breast and ovarian cancer (HBOC); tumour findings can be germline — confirm with germline testing and genetic counselling.' },
  BRCA2:  { name: 'BRCA2 DNA repair associated', role: 'Tumour suppressor (DNA repair)', fn: 'Loads RAD51 onto single-stranded DNA during homologous-recombination repair and protects stalled replication forks.', pathway: 'Homologous-recombination repair', germline: 'Germline pathogenic variants: HBOC, plus prostate, pancreatic and male breast cancer risk. Biallelic germline loss causes Fanconi anaemia (FANCD1). Tumour findings can be germline.' },
  PALB2:  { name: 'Partner and localizer of BRCA2', role: 'Tumour suppressor (DNA repair)', fn: 'Bridges BRCA1 and BRCA2 in homologous-recombination repair.', pathway: 'Homologous-recombination repair', germline: 'Germline pathogenic variants raise breast and pancreatic cancer risk.' },
  ATM:    { name: 'ATM serine/threonine kinase', role: 'Tumour suppressor (DNA-damage response)', fn: 'Master kinase that senses double-strand breaks and activates checkpoints and repair.', pathway: 'DNA-damage response', germline: 'Heterozygous germline variants modestly raise breast cancer risk; biallelic loss causes ataxia-telangiectasia. ATM is also a common clonal-haematopoiesis gene.' },
  CHEK2:  { name: 'Checkpoint kinase 2', role: 'Tumour suppressor (DNA-damage response)', fn: 'Kinase downstream of ATM that enforces cell-cycle checkpoints.', pathway: 'DNA-damage response', germline: 'Germline variants (e.g. c.1100delC) raise breast and colorectal cancer risk. Also a common clonal-haematopoiesis gene.' },
  TP53:   { name: 'Tumour protein p53', role: 'Tumour suppressor', fn: '"Guardian of the genome": a tetrameric transcription factor activated by DNA damage and oncogenic stress that induces cell-cycle arrest, DNA repair, senescence or apoptosis. DNA-binding-domain hotspots (R175, G245, R248, R249, R273, R282) are common.', pathway: 'p53–MDM2 axis; DNA-damage response', germline: 'Germline pathogenic variants cause Li–Fraumeni syndrome. In blood or plasma, TP53 variants are also common in clonal haematopoiesis, so a low-VAF TP53 variant in plasma is not automatically tumour-derived.' },
  CDKN2A: { name: 'Cyclin-dependent kinase inhibitor 2A', role: 'Tumour suppressor', fn: 'Encodes p16INK4A (inhibits CDK4/6, keeping RB active) and p14ARF (stabilises p53 by blocking MDM2). Homozygous deletion at 9p21 is a frequent event.', pathway: 'CDK4/6–RB; p14ARF–MDM2–p53', germline: 'Germline pathogenic variants cause familial melanoma–pancreatic cancer syndrome (FAMMM).' },
  RB1:    { name: 'RB transcriptional corepressor 1', role: 'Tumour suppressor', fn: 'Restrains the G1/S transition by binding E2F transcription factors; inactivated by CDK4/6 phosphorylation.', pathway: 'CDK4/6–RB–E2F', germline: 'Germline variants cause hereditary retinoblastoma (the basis of Knudson\'s two-hit hypothesis).' },
  STK11:  { name: 'Serine/threonine kinase 11 (LKB1)', role: 'Tumour suppressor', fn: 'Master kinase that activates AMPK and related kinases, regulating cell polarity and energy sensing, and restraining mTOR.', pathway: 'LKB1–AMPK–mTOR', germline: 'Germline pathogenic variants cause Peutz–Jeghers syndrome.' },
  APC:    { name: 'APC regulator of WNT signaling pathway', role: 'Tumour suppressor', fn: 'Part of the β-catenin destruction complex; loss activates WNT signalling.', pathway: 'WNT–β-catenin', germline: 'Germline pathogenic variants cause familial adenomatous polyposis (FAP).' },
  SMAD4:  { name: 'SMAD family member 4', role: 'Tumour suppressor', fn: 'Common mediator of TGF-β/BMP signalling.', pathway: 'TGF-β / BMP', germline: 'Germline variants cause juvenile polyposis syndrome (with hereditary haemorrhagic telangiectasia overlap).' },
  CDH1:   { name: 'Cadherin 1 (E-cadherin)', role: 'Tumour suppressor', fn: 'Cell–cell adhesion molecule of epithelia.', pathway: 'Cell adhesion; β-catenin', germline: 'Germline truncating variants cause hereditary diffuse gastric cancer and lobular breast cancer risk.' },
  NF1:    { name: 'Neurofibromin 1', role: 'Tumour suppressor (RAS-GAP)', fn: 'RAS GTPase-activating protein that switches RAS off; loss increases RAS–MAPK signalling.', pathway: 'RAS–MAPK', germline: 'Germline variants cause neurofibromatosis type 1 (von Recklinghausen disease).' },
  VHL:    { name: 'Von Hippel–Lindau tumour suppressor', role: 'Tumour suppressor', fn: 'E3-ligase component that targets HIF-α for degradation; loss causes pseudohypoxic signalling (VEGF, etc.).', pathway: 'HIF–VEGF', germline: 'Germline variants cause von Hippel–Lindau disease.' },
  MLH1:   { name: 'MutL homolog 1 (mismatch repair)', role: 'Tumour suppressor (mismatch repair)', fn: 'Forms MutLα with PMS2 to execute DNA mismatch repair. Somatic MLH1 promoter hypermethylation is the commonest cause of sporadic MSI-high colorectal and endometrial cancer, often alongside BRAF V600E.', pathway: 'DNA mismatch repair', germline: 'Germline pathogenic variants cause Lynch syndrome.' },
  MSH2:   { name: 'MutS homolog 2 (mismatch repair)', role: 'Tumour suppressor (mismatch repair)', fn: 'Forms MutSα with MSH6 to detect mismatches. EPCAM 3′ deletions can silence MSH2 by promoter methylation.', pathway: 'DNA mismatch repair', germline: 'Germline pathogenic variants cause Lynch syndrome.' },
  MSH6:   { name: 'MutS homolog 6 (mismatch repair)', role: 'Tumour suppressor (mismatch repair)', fn: 'Partner of MSH2 in MutSα.', pathway: 'DNA mismatch repair', germline: 'Germline pathogenic variants cause Lynch syndrome (often later onset, endometrial-predominant).' },
  PMS2:   { name: 'PMS1 homolog 2 (mismatch repair)', role: 'Tumour suppressor (mismatch repair)', fn: 'Partner of MLH1 in MutLα. Germline testing is technically hard because of pseudogenes.', pathway: 'DNA mismatch repair', germline: 'Germline pathogenic variants cause Lynch syndrome.' },
  IDH1:   { name: 'Isocitrate dehydrogenase (NADP+) 1', role: 'Oncogene (metabolic enzyme)', fn: 'Cytoplasmic enzyme converting isocitrate to α-ketoglutarate. Hotspot R132 variants gain a neomorphic activity producing D-2-hydroxyglutarate (an oncometabolite), which inhibits α-KG-dependent dioxygenases (e.g. TET2, histone demethylases) and causes hypermethylation and a differentiation block.', pathway: 'Epigenetic regulation / cellular metabolism', germline: 'Not a hereditary predisposition gene (mosaic IDH1/IDH2 variants occur in Ollier disease and Maffucci syndrome).' },
  IDH2:   { name: 'Isocitrate dehydrogenase (NADP+) 2', role: 'Oncogene (metabolic enzyme)', fn: 'Mitochondrial counterpart of IDH1. Hotspots are R140 and R172; the mechanism (D-2-hydroxyglutarate production) is the same.', pathway: 'Epigenetic regulation / cellular metabolism', germline: 'Not a hereditary predisposition gene.' },
  FLT3:   { name: 'FMS-like tyrosine kinase 3', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Class III receptor tyrosine kinase on haematopoietic stem and progenitor cells. Internal tandem duplications (ITD) in the juxtamembrane domain and tyrosine-kinase-domain (TKD, e.g. D835) variants cause constitutive activity.', pathway: 'STAT5; PI3K–AKT; RAS–MAPK', germline: 'Somatic only in leukaemia.' },
  NPM1:   { name: 'Nucleophosmin 1', role: 'Context-dependent (AML-defining gene)', fn: 'Nucleolar chaperone shuttling between nucleolus and cytoplasm (ribosome biogenesis, centrosome duplication, ARF–p53 regulation). Exon 12 frameshifts (e.g. type A, c.860_863dup) add a nuclear-export signal and cause aberrant cytoplasmic localisation.', pathway: 'ARF–MDM2–p53 axis; ribosome biogenesis', germline: 'Somatic only.' },
  DNMT3A: { name: 'DNA methyltransferase 3 alpha', role: 'Epigenetic regulator (tumour suppressor in haematopoiesis)', fn: 'De novo CpG methyltransferase. R882 is the hotspot. One of the commonest clonal-haematopoiesis (CHIP) genes.', pathway: 'DNA methylation / epigenetic regulation', germline: 'Rare germline DNMT3A variants cause Tatton-Brown–Rahman overgrowth syndrome (with leukaemia risk).' },
  TET2:   { name: 'Tet methylcytosine dioxygenase 2', role: 'Epigenetic regulator (tumour suppressor in haematopoiesis)', fn: 'Oxidises 5-methylcytosine (active DNA demethylation). Among the most common CHIP genes.', pathway: 'DNA demethylation / epigenetic regulation', germline: 'Mostly somatic.' },
  ASXL1:  { name: 'ASXL transcriptional regulator 1', role: 'Chromatin regulator', fn: 'Polycomb-associated chromatin regulator. Common CHIP gene; in AML, ASXL1 mutation is an adverse-risk marker under ELN 2022.', pathway: 'Polycomb / chromatin regulation', germline: 'Germline truncating variants cause Bohring–Opitz syndrome (not a cancer-predisposition syndrome).' },
  JAK2:   { name: 'Janus kinase 2', role: 'Oncogene (cytoplasmic tyrosine kinase)', fn: 'Kinase downstream of cytokine receptors (EPO-R, TPO-R, G-CSF-R). V617F in the pseudokinase domain causes constitutive JAK–STAT signalling (myeloproliferative neoplasms; also a CHIP gene).', pathway: 'JAK–STAT', germline: 'Rare germline JAK2 variants predispose to MPN.' },
  ABL1:   { name: 'ABL proto-oncogene 1, non-receptor tyrosine kinase', role: 'Oncogene when fused (BCR::ABL1)', fn: 'Non-receptor tyrosine kinase involved in cell-cycle control, DNA-damage response and cytoskeletal dynamics. The Philadelphia chromosome t(9;22)(q34;q11) creates BCR::ABL1, a constitutively active kinase.', pathway: 'RAS–MAPK; PI3K–AKT; STAT5', germline: 'Somatic translocation only.' },
  KIT:    { name: 'KIT proto-oncogene, receptor tyrosine kinase', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor for stem cell factor: haematopoiesis, melanocytes, interstitial cells of Cajal, germ cells.', pathway: 'RAS–MAPK; PI3K–AKT; STAT', germline: 'Rare germline activating KIT variants cause familial GIST.' },
  PDGFRA: { name: 'Platelet-derived growth factor receptor alpha', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor tyrosine kinase for PDGF; the exon 18 D842V variant is the commonest PDGFRA variant in GIST.', pathway: 'RAS–MAPK; PI3K–AKT', germline: 'Rare germline variants cause familial GIST.' },
  FGFR2:  { name: 'Fibroblast growth factor receptor 2', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor tyrosine kinase for FGF ligands. FGFR2 fusions/rearrangements are characteristic of intrahepatic cholangiocarcinoma.', pathway: 'RAS–MAPK; PI3K–AKT; PLCγ', germline: 'Germline gain-of-function variants cause craniosynostosis syndromes (Crouzon, Apert) — not cancer predisposition.' },
  FGFR3:  { name: 'Fibroblast growth factor receptor 3', role: 'Oncogene (receptor tyrosine kinase)', fn: 'Receptor tyrosine kinase; activating mutations (R248C, S249C, Y373C…) and FGFR3::TACC3 fusions occur in urothelial carcinoma.', pathway: 'RAS–MAPK; PI3K–AKT', germline: 'Germline gain-of-function variants cause skeletal dysplasias (e.g. achondroplasia) — not cancer predisposition.' }
};

/** Common alternative names people type, mapped to the official gene symbol. */
const GENE_ALIASES = {
  HER2: 'ERBB2', 'HER-2': 'ERBB2', NEU: 'ERBB2', CMET: 'MET', 'C-MET': 'MET', P53: 'TP53', LKB1: 'STK11',
  TRKA: 'NTRK1', TRKB: 'NTRK2', TRKC: 'NTRK3', 'ERΑ': 'ESR1', ER: 'ESR1', P16: 'CDKN2A', 'P16INK4A': 'CDKN2A',
  BCR: 'ABL1', 'BCR-ABL1': 'ABL1', 'BCR::ABL1': 'ABL1', 'BCR-ABL': 'ABL1', EGFRVIII: 'EGFR'
};

/** Genes where a tumour finding can be a hereditary (germline) finding. */
const GERMLINE_PRONE = ['BRCA1', 'BRCA2', 'PALB2', 'ATM', 'CHEK2', 'TP53', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'EPCAM',
  'APC', 'PTEN', 'STK11', 'CDH1', 'RET', 'VHL', 'NF1', 'RB1', 'CDKN2A', 'SMAD4'];

/** Genes frequently altered by clonal haematopoiesis (CHIP) — important in blood/plasma tests. */
const CHIP_PRONE = ['DNMT3A', 'TET2', 'ASXL1', 'JAK2', 'PPM1D', 'TP53', 'CHEK2', 'ATM', 'SF3B1', 'SRSF2'];

/** Eponymous cancer-predisposition syndromes ↔ genes (high-yield exam table). */
const SYNDROMES = [
  ['Lynch syndrome (HNPCC)', 'MLH1, MSH2, MSH6, PMS2, EPCAM', 'Colorectal, endometrial, ovarian, gastric, urothelial…', 'Amsterdam II criteria / revised Bethesda guidelines; MSI-H/dMMR tumours'],
  ['Li–Fraumeni syndrome', 'TP53', 'Sarcoma, breast, brain, adrenocortical, leukaemia', 'Chompret criteria for testing'],
  ['Hereditary breast & ovarian cancer (HBOC)', 'BRCA1, BRCA2 (also PALB2)', 'Breast, ovarian, prostate, pancreatic', 'PARP-inhibitor sensitivity; cascade testing'],
  ['Cowden syndrome (PTEN hamartoma tumour syndrome)', 'PTEN', 'Breast, thyroid, endometrial', 'Macrocephaly, trichilemmomas'],
  ['Peutz–Jeghers syndrome', 'STK11', 'GI hamartomas, GI, breast, pancreas', 'Mucocutaneous pigmentation'],
  ['MEN1 (Wermer syndrome)', 'MEN1', 'Parathyroid, pancreatic NET, pituitary', '3 Ps: parathyroid, pancreas, pituitary'],
  ['MEN2A / MEN2B (Sipple syndrome = MEN2A)', 'RET', 'Medullary thyroid carcinoma, phaeochromocytoma, ±parathyroid', 'Codon-specific risk guides timing of prophylactic thyroidectomy'],
  ['Von Hippel–Lindau disease', 'VHL', 'Clear-cell RCC, haemangioblastoma, phaeochromocytoma', 'HIF pathway; belzutifan targets HIF-2α'],
  ['Familial adenomatous polyposis (FAP)', 'APC', 'Colorectal (100s–1000s polyps)', 'Gardner syndrome = FAP + extra-colonic features'],
  ['Hereditary diffuse gastric cancer', 'CDH1', 'Diffuse gastric, lobular breast', 'Consider prophylactic gastrectomy'],
  ['Neurofibromatosis type 1 (von Recklinghausen disease)', 'NF1', 'Neurofibromas, MPNST, optic glioma', 'Café-au-lait macules'],
  ['Hereditary retinoblastoma', 'RB1', 'Retinoblastoma, osteosarcoma', 'Basis of Knudson\'s two-hit hypothesis'],
  ['Familial melanoma–pancreatic cancer (FAMMM)', 'CDKN2A', 'Melanoma, pancreatic', 'p16 / p14ARF'],
  ['Gorlin syndrome (basal cell naevus)', 'PTCH1', 'Basal cell carcinoma, medulloblastoma', 'Avoid radiotherapy where possible'],
  ['Birt–Hogg–Dubé syndrome', 'FLCN', 'Chromophobe/oncocytic RCC, fibrofolliculomas, pneumothorax', ''],
  ['Hereditary leiomyomatosis & RCC', 'FH', 'Papillary RCC type 2, leiomyomas', 'Fumarate hydratase deficiency']
];

/* =====================================================================
   4. INTERPRETATION RULES  (the small curated knowledge base)
   ---------------------------------------------------------------------
   HOW TO READ THIS SECTION
   Each RULE describes one well-established biomarker. A rule has:
     * test(v)   : decides whether a variant belongs to this rule
     * biology   : what the variant does to the protein
     * onco      : educational oncogenicity statement (NOT a formal
                   ClinGen/CGC/VICC points score)
     * contexts  : tumour-specific clinical meaning. Each context lists
                   - tier  : AMP/ASCO/CAP tier suggested by the rule
                   - escat : ESCAT tier ONLY where the developer was sure
                   - oncokb: OncoKB level ONLY where the developer was sure
                   - rx    : treatment options, each with an honest STATUS
                   - res   : resistance-associated alterations
   If a field is empty (null) the app prints "not curated in this
   prototype". That is NOT the same as "no tier exists".

   STATUS VOCABULARY (one place, used everywhere)
     approved        regulator-approved (FDA wording) for this biomarker
                     in THIS tumour type
     agnostic        approved for the biomarker regardless of tumour type
     approved-other  approved for the biomarker in a DIFFERENT tumour type
     guideline       supported by guidelines (the prototype does not
                     reproduce guideline text, so it assigns none)
     verify          regulatory status is changing quickly — look it up
     investigational clinical-trial / experimental
     unsupported     evidence says it should not be expected to work
     EMA status is NOT curated; always check the EPAR.
   ===================================================================== */
const STATUS = {
  approved:          { label: 'Approved (FDA) · this tumour type', tone: 'mint' },
  agnostic:          { label: 'Approved (FDA) · tumour-agnostic', tone: 'blue' },
  'approved-other':  { label: 'Approved in a different tumour type', tone: 'lav' },
  guideline:         { label: 'Guideline-supported', tone: 'lav' },
  verify:            { label: 'Status evolving — verify', tone: 'peach' },
  investigational:   { label: 'Investigational', tone: 'peach' },
  unsupported:       { label: 'Not supported / avoid', tone: 'rose' }
};

/** Disease settings used to judge whether evidence matches the patient. */
const SETTINGS = [
  ['unspecified', 'Not specified'],
  ['early', 'Early-stage / resectable (adjuvant or neoadjuvant question)'],
  ['locally-advanced', 'Locally advanced / unresectable (curative intent)'],
  ['first-line', 'Advanced or newly diagnosed — before first systemic therapy'],
  ['later-line', 'Advanced — after prior therapy / relapsed-refractory']
];
const SETTING_LABEL = Object.fromEntries(SETTINGS);
const SETTING_SHORT = { unspecified: 'not specified', early: 'early-stage / resectable', 'locally-advanced': 'locally advanced / unresectable', 'first-line': 'first-line (before first systemic therapy)', 'later-line': 'later-line / relapsed-refractory' };

/** Cancer types the rules know about. Anything else is "other". */
const CANCERS = [
  ['', 'Select cancer type…'],
  ['nsclc', 'Non-small-cell lung cancer (NSCLC)'],
  ['sclc', 'Small-cell lung cancer'],
  ['breast', 'Breast cancer'],
  ['crc', 'Colorectal cancer'],
  ['melanoma', 'Melanoma'],
  ['ovarian', 'Ovarian / fallopian tube / primary peritoneal'],
  ['prostate', 'Prostate cancer'],
  ['pancreatic', 'Pancreatic adenocarcinoma'],
  ['gastric', 'Gastric / gastro-oesophageal junction'],
  ['biliary', 'Biliary tract cancer (cholangiocarcinoma)'],
  ['urothelial', 'Urothelial carcinoma'],
  ['thyroid', 'Thyroid cancer'],
  ['gist', 'Gastrointestinal stromal tumour (GIST)'],
  ['glioma', 'Glioma'],
  ['aml', 'Acute myeloid leukaemia (AML)'],
  ['cml', 'Chronic myeloid leukaemia (CML)'],
  ['heme-other', 'Other haematological malignancy'],
  ['solid-other', 'Other solid tumour']
];
const CANCER_LABEL = Object.fromEntries(CANCERS);
const IS_HEME = (c) => ['aml', 'cml', 'heme-other'].includes(c);

/** Build one treatment entry. */
const Rx = (drug, cls, status, indication, o = {}) => ({
  drug, cls, status, indication,
  settings: o.settings || null,   // which disease settings the approval/evidence covers
  refs: o.refs || [],             // ids from REFS
  key: o.key || '',               // key published result (only where verified)
  caution: o.caution || ''
});

/** Mutation-type groups used by rule tests. */
const TRUNCATING = ['nonsense', 'frameshift', 'splice'];

/** The curated rules. Order matters: the FIRST matching rule wins, so specific rules come first. */
const RULES = [

  /* ----------------------------- EGFR ----------------------------- */
  {
    id: 'EGFR_T790M', gene: 'EGFR', title: 'EGFR T790M (gatekeeper)',
    test: (v) => v.gene === 'EGFR' && v.p === 'T790M',
    effect: 'Acquired resistance variant (gatekeeper)', roles: ['predictive', 'resistance'],
    onco: 'Resistance-associated variant with strong functional evidence',
    biology: `Substitution of threonine by the bulkier methionine at the "gatekeeper" position raises the receptor's affinity for ATP and sterically hinders first- and second-generation EGFR TKIs. It is the commonest mechanism of acquired resistance to those drugs (roughly half of cases). Third-generation TKIs were designed to inhibit T790M.`,
    somgerm: `Usually acquired (somatic) under TKI pressure. A T790M found at VAF ≈ 50% in a TKI-naïve sample raises the possibility of the rare germline EGFR T790M predisposition — confirm in a non-tumour sample.`,
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from osimertinib after progression on a first- or second-generation EGFR TKI; predicts resistance to those earlier TKIs.',
      rx: [
        Rx('Osimertinib', 'Third-generation EGFR TKI', 'approved', 'EGFR T790M-positive NSCLC that progressed on or after EGFR-TKI therapy.', { settings: ['later-line'], refs: ['aura3'], key: 'AURA3: median PFS 10.1 vs 4.4 months (HR 0.30) vs platinum–pemetrexed.', caution: 'T790M can be lost after osimertinib exposure; a T790M-negative plasma result should be followed by tissue testing.' })
      ],
      res: ['Resistance to first/second-generation EGFR TKIs (gefitinib, erlotinib, afatinib, dacomitinib).']
    }],
    other: 'Seen almost exclusively in EGFR-mutant NSCLC.',
    refs: ['aura3']
  },
  {
    id: 'EGFR_C797S', gene: 'EGFR', title: 'EGFR C797S (osimertinib resistance)',
    test: (v) => v.gene === 'EGFR' && v.p === 'C797S',
    effect: 'Acquired resistance variant', roles: ['resistance'],
    onco: 'Resistance-associated variant with strong functional evidence',
    biology: `Cysteine 797 is the residue to which osimertinib binds covalently. Replacing it with serine prevents covalent binding, causing resistance to osimertinib (and other irreversible third-generation TKIs). Whether C797S lies in cis or trans relative to T790M (allelic phase) changes the theoretical options but needs specialised phasing to determine.`,
    somgerm: 'Acquired (somatic) under third-generation TKI therapy.',
    contexts: [{
      c: ['nsclc'], tier: null, escat: null, oncokb: null,
      pred: 'Marks resistance to osimertinib. No approved targeted therapy is curated for this finding.',
      rx: [
        Rx('Fourth-generation / mutant-selective EGFR inhibitors', 'Investigational class', 'investigational', 'Clinical-trial setting only.', { caution: 'Search ClinicalTrials.gov; confirm eligibility criteria including prior therapy and allelic configuration.' }),
        Rx('Combination of first- and third-generation EGFR TKIs (only if C797S is in trans with T790M)', 'Experimental strategy', 'investigational', 'Preclinical rationale and small case series only.', { caution: 'Requires allelic-phase assessment; not an established standard.' })
      ],
      res: ['Resistance to osimertinib and other covalent third-generation EGFR TKIs.']
    }],
    other: 'Seen in EGFR-mutant NSCLC after osimertinib.',
    refs: []
  },
  {
    id: 'EGFR_EX20INS', gene: 'EGFR', title: 'EGFR exon 20 insertion',
    test: (v) => v.gene === 'EGFR' && (/^[A-Z](76[1-9]|77[0-5])(_[A-Z]\d{3})?(INS|DUP|DELINS)/.test(v.p) || /(EXON ?20|EX20)/.test(v.text.toUpperCase()) && /(INS|DUP)/.test(v.text.toUpperCase())),
    effect: 'Gain of function (activating); poor sensitivity to classic TKIs', roles: ['predictive'],
    onco: 'Oncogenic (recurrent activating insertion class)',
    biology: `In-frame insertions or duplications after the αC-helix (codons ~762–775) activate the kinase but leave the ATP pocket largely unchanged, so most are poorly sensitive to first- to third-generation EGFR TKIs.`,
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'Predicts benefit from an EGFR–MET bispecific antibody-based approach; classic EGFR TKIs are generally ineffective.',
      rx: [
        Rx('Amivantamab + carboplatin–pemetrexed', 'EGFR–MET bispecific antibody + chemotherapy', 'approved', 'First-line advanced NSCLC with EGFR exon 20 insertion.', { settings: ['first-line'], refs: ['papillon'], key: 'PAPILLON: median PFS 11.4 vs 6.7 months (HR 0.40) vs chemotherapy.', caution: 'Infusion reactions, venous thromboembolism and skin/nail toxicity are class effects.' }),
        Rx('Amivantamab (monotherapy)', 'EGFR–MET bispecific antibody', 'approved', 'EGFR exon 20 insertion NSCLC after platinum-based chemotherapy (accelerated approval).', { settings: ['later-line'] }),
        Rx('Exon-20-selective TKIs', 'Targeted therapy', 'verify', 'Regulatory status of exon-20-directed TKIs has changed over time (including a withdrawal).', { caution: 'Check current FDA/EMA labels before considering.' }),
        Rx('Osimertinib, erlotinib, gefitinib, afatinib at standard doses', 'Classic EGFR TKIs', 'unsupported', 'Most exon 20 insertions confer poor sensitivity.', { caution: 'A few variants (e.g. A763_Y764insFQEA) are TKI-sensitive — interpret the exact variant.' })
      ],
      res: ['Intrinsic resistance of most exon 20 insertions to classic EGFR TKIs.']
    }],
    other: 'EGFR exon 20 insertions are best characterised in NSCLC.',
    refs: ['papillon']
  },
  {
    id: 'EGFR_SENS', gene: 'EGFR', title: 'EGFR exon 19 deletion / L858R (classic sensitising)',
    test: (v) => v.gene === 'EGFR' && (v.p === 'L858R' || /^(I740|K745|E746|L747|L749|A750|T751|S752|P753)[A-Z0-9_]*DEL/.test(v.p) || (/(EXON ?19|EX19)/.test(v.text.toUpperCase()) && /DEL/.test(v.text.toUpperCase()))),
    effect: 'Gain of function (activating)', roles: ['predictive'],
    onco: 'Oncogenic (established hotspot class)',
    biology: `Exon 19 in-frame deletions (around the LREA motif, codons 746–750) and the exon 21 L858R substitution stabilise the active kinase conformation, giving ligand-independent signalling through RAS–RAF–MEK–ERK and PI3K–AKT, and increased sensitivity to ATP-competitive EGFR TKIs. Together they account for roughly 80–90% of EGFR mutations in NSCLC.`,
    somgerm: 'Somatic in virtually all cases.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: 'I-A', oncokb: 'Level 1',
      pred: 'Strongly predicts sensitivity to EGFR tyrosine-kinase inhibitors; predicts lack of benefit from single-agent PD-(L)1 blockade as a substitute for an EGFR TKI.',
      prog: 'EGFR-mutant NSCLC is a distinct molecular subtype with a high incidence of brain metastases. The dominant clinical consequence of the finding is predictive rather than prognostic.',
      rx: [
        Rx('Osimertinib', 'Third-generation EGFR TKI', 'approved', 'First-line advanced NSCLC; adjuvant after complete resection (stage IB–IIIA); unresectable stage III after chemoradiotherapy.', { settings: ['early', 'locally-advanced', 'first-line'], refs: ['flaura', 'flaura_os', 'adaura', 'laura'], key: 'FLAURA: median PFS 18.9 vs 10.2 months (HR 0.46); median OS 38.6 vs 31.8 months (HR 0.80) vs gefitinib/erlotinib.' }),
        Rx('Osimertinib + platinum–pemetrexed', 'Third-generation TKI + chemotherapy', 'approved', 'First-line advanced NSCLC.', { settings: ['first-line'], refs: ['flaura2'], key: 'FLAURA2: PFS HR 0.62; 24-month progression-free rate 57% vs 41% vs osimertinib alone.', caution: 'More haematological toxicity than osimertinib alone.' }),
        Rx('Amivantamab + lazertinib', 'EGFR–MET bispecific antibody + third-generation TKI', 'approved', 'First-line advanced NSCLC.', { settings: ['first-line'], refs: ['mariposa'], key: 'MARIPOSA: median PFS 23.7 vs 16.6 months (HR 0.70) vs osimertinib.', caution: 'Infusion reactions, venous thromboembolism and skin/nail toxicity need active management.' }),
        Rx('Gefitinib, erlotinib, afatinib, dacomitinib', 'First/second-generation EGFR TKIs', 'approved', 'First-line advanced NSCLC with exon 19 deletion or L858R.', { settings: ['first-line'], caution: 'Choice among approved options is a clinical and guideline decision (not curated here).' }),
        Rx('Single-agent PD-(L)1 inhibitor in place of an EGFR TKI', 'Immunotherapy', 'unsupported', 'Limited benefit reported in EGFR-mutant NSCLC; do not select treatment on PD-L1 alone.', { caution: 'Evidence-limited statement. Reports describe increased immune-related toxicity when osimertinib follows PD-(L)1 blockade.' })
      ],
      res: [
        'EGFR T790M — about half of acquired resistance to first/second-generation TKIs (osimertinib is active).',
        'EGFR C797S — after osimertinib (no approved targeted option).',
        'MET amplification — bypass signalling.',
        'ERBB2 amplification — bypass signalling.',
        'Histological transformation (e.g. to small-cell carcinoma) — needs re-biopsy.',
        'Loss of EGFR dependence through other drivers (e.g. KRAS, BRAF, PIK3CA alterations, kinase fusions).'
      ]
    }],
    other: 'EGFR kinase-domain mutations are uncommon outside NSCLC. The NSCLC TKI evidence does not automatically transfer, and no tumour-agnostic EGFR-TKI indication exists.',
    refs: ['flaura', 'adaura']
  },
  {
    id: 'EGFR_UNCOMMON', gene: 'EGFR', title: 'EGFR G719X / L861Q / S768I (uncommon sensitising)',
    test: (v) => v.gene === 'EGFR' && /^(G719[ACSD]|L861Q|S768I)$/.test(v.p),
    effect: 'Gain of function (activating); moderate TKI sensitivity', roles: ['predictive'],
    onco: 'Oncogenic (recurrent activating variants; uncommon class)',
    biology: 'Uncommon activating missense variants in the kinase domain (exons 18, 20, 21) that retain sensitivity to EGFR TKIs, generally less than exon 19 deletion or L858R.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'Predicts sensitivity to afatinib (on-label). Other TKIs have supportive non-randomised data only.',
      rx: [
        Rx('Afatinib', 'Second-generation EGFR TKI', 'approved', 'NSCLC with non-resistant EGFR mutations including L861Q, G719X and S768I (FDA label expansion).', { settings: ['first-line'], caution: 'Check current guidelines for osimertinib and other options, which rest on non-randomised evidence.' })
      ],
      res: []
    }],
    other: 'Best characterised in NSCLC.',
    refs: []
  },

  /* ----------------------------- ALK / ROS1 / RET / NTRK / NRG1 fusions ----------------------------- */
  {
    id: 'ALK_FUSION', gene: 'ALK', title: 'ALK fusion / rearrangement',
    test: (v) => v.gene === 'ALK' && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (constitutive kinase activation by fusion)', roles: ['predictive'],
    onco: 'Oncogenic (established driver fusion)',
    biology: `Fusion with a partner (EML4 most often) places the ALK kinase domain under a constitutive dimerisation domain, producing ligand-independent signalling. The fusion must be in-frame and retain the kinase domain; the exact partner/variant rarely changes first-line drug choice.`,
    somgerm: 'Somatic. (Rare germline ALK activating variants cause familial neuroblastoma — different mechanism.)',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: 'I-A', oncokb: 'Level 1',
      pred: 'Strongly predicts benefit from ALK tyrosine-kinase inhibitors.',
      rx: [
        Rx('Alectinib', 'Second-generation ALK TKI', 'approved', 'First-line metastatic ALK-positive NSCLC; adjuvant after resection (stage IB–IIIA).', { settings: ['early', 'first-line'], refs: ['alex'], key: 'ALEX: investigator-assessed PFS HR 0.47 vs crizotinib.' }),
        Rx('Lorlatinib', 'Third-generation ALK TKI', 'approved', 'First-line metastatic ALK-positive NSCLC; also after progression on other ALK TKIs.', { settings: ['first-line', 'later-line'], refs: ['crown'], key: 'CROWN 5-year PFS: 60% vs 8% (HR 0.19) vs crizotinib.', caution: 'CNS adverse effects (mood, cognition, speech) and hyperlipidaemia need monitoring.' }),
        Rx('Brigatinib', 'Second-generation ALK TKI', 'approved', 'First-line metastatic ALK-positive NSCLC.', { settings: ['first-line'] }),
        Rx('Ceritinib, crizotinib', 'Earlier-generation ALK TKIs', 'approved', 'ALK-positive metastatic NSCLC.', { settings: ['first-line', 'later-line'], caution: 'Generally superseded by newer-generation agents in first line.' })
      ],
      res: [
        'ALK G1202R (solvent-front) — resistant to first/second-generation TKIs; lorlatinib is active.',
        'Compound ALK kinase-domain mutations after lorlatinib.',
        'Bypass tracks (e.g. MET amplification, EGFR activation).'
      ],
      note: 'Detection: IHC (e.g. D5F3), FISH, DNA-NGS or RNA-NGS. DNA panels can miss fusions; a negative DNA result in a driver-negative adenocarcinoma should prompt RNA-based or IHC confirmation.'
    }],
    other: 'ALK-rearranged inflammatory myofibroblastic tumour has an FDA-labelled ALK-TKI (crizotinib); ALK fusions also occur in ALCL (NPM1::ALK) and neuroblastoma-related biology differs. NSCLC evidence does not automatically transfer.',
    refs: ['alex', 'crown']
  },
  {
    id: 'ROS1_FUSION', gene: 'ROS1', title: 'ROS1 fusion / rearrangement',
    test: (v) => v.gene === 'ROS1' && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (constitutive kinase activation by fusion)', roles: ['predictive'],
    onco: 'Oncogenic (established driver fusion)',
    biology: 'Fusions (CD74, SLC34A2, EZR and others) retain the ROS1 kinase domain and signal constitutively through MAPK and PI3K–AKT.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from ROS1-directed tyrosine-kinase inhibitors.',
      rx: [
        Rx('Crizotinib', 'ROS1/ALK/MET TKI', 'approved', 'Metastatic ROS1-positive NSCLC.', { settings: ['first-line', 'later-line'] }),
        Rx('Entrectinib', 'ROS1/TRK/ALK TKI (CNS-active)', 'approved', 'Metastatic ROS1-positive NSCLC.', { settings: ['first-line', 'later-line'], refs: ['entrectinib'], key: 'Single-arm integrated analysis of three phase 1–2 trials (CNS-penetrant).' }),
        Rx('Repotrectinib', 'Next-generation ROS1/TRK TKI', 'approved', 'Locally advanced or metastatic ROS1-positive NSCLC (FDA, 2023).', { settings: ['first-line', 'later-line'], caution: 'Recent approval — confirm the current label.' }),
        Rx('Taletrectinib', 'Next-generation ROS1 TKI', 'verify', 'Recent regulatory action (2025).', { caution: 'Very recent: confirm the current label and region.' })
      ],
      res: ['ROS1 G2032R (solvent-front) — resistant to crizotinib; next-generation agents have activity.', 'Bypass pathway activation (e.g. KIT, EGFR, KRAS).'],
      note: 'RNA-based assays detect ROS1 fusions more reliably than DNA panels (large intronic breakpoint regions).'
    }],
    other: 'ROS1 fusions also occur in other tumours (e.g. inflammatory myofibroblastic tumour, glioma, cholangiocarcinoma); NSCLC approvals do not automatically transfer.',
    refs: ['entrectinib']
  },
  {
    id: 'RET_FUSION', gene: 'RET', title: 'RET fusion / rearrangement',
    test: (v) => v.gene === 'RET' && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (constitutive kinase activation by fusion)', roles: ['predictive'],
    onco: 'Oncogenic (established driver fusion)',
    biology: 'Fusions (KIF5B::RET and CCDC6::RET are common) keep the RET kinase domain and drive ligand-independent MAPK/PI3K signalling. Somatic fusions differ from germline activating RET point mutations (MEN2).',
    somgerm: 'Fusions are somatic. Do not confuse with germline RET point mutations (MEN2).',
    contexts: [
      {
        c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts benefit from selective RET inhibitors.',
        rx: [Rx('Selpercatinib', 'Selective RET inhibitor', 'approved', 'Metastatic RET fusion-positive NSCLC.', { settings: ['first-line', 'later-line'], refs: ['libretto'], key: 'LIBRETTO-001: ORR 64% in previously platinum-treated patients.' })],
        res: ['RET solvent-front mutations (e.g. G810X) on selective RET inhibitors.', 'Bypass activation (e.g. MET amplification).']
      },
      {
        c: ['thyroid'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts benefit from selective RET inhibitors.',
        rx: [Rx('Selpercatinib', 'Selective RET inhibitor', 'approved', 'RET fusion-positive thyroid cancer requiring systemic therapy (radioiodine-refractory where applicable).', { settings: ['first-line', 'later-line'] })],
        res: []
      },
      {
        c: ['*'], tier: 'Tier I · Level A (tumour-agnostic approval)', escat: null, oncokb: 'Level 1',
        pred: 'Tumour-agnostic benefit from selective RET inhibition has been shown.',
        rx: [Rx('Selpercatinib', 'Selective RET inhibitor', 'agnostic', 'Advanced solid tumours with a RET gene fusion that progressed after prior systemic treatment with no satisfactory alternatives (FDA wording — check).', { settings: ['later-line'] })],
        res: []
      }
    ],
    other: '',
    refs: ['libretto']
  },
  {
    id: 'NTRK_FUSION', gene: ['NTRK1', 'NTRK2', 'NTRK3'], title: 'NTRK1/2/3 fusion',
    test: (v) => ['NTRK1', 'NTRK2', 'NTRK3'].includes(v.gene) && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (constitutive kinase activation by fusion)', roles: ['predictive'],
    onco: 'Oncogenic (established driver fusion)',
    biology: 'Fusions join the TRK kinase domain to a partner (e.g. ETV6::NTRK3) giving ligand-independent signalling. Common (>90%) in secretory carcinoma of breast/salivary gland and infantile fibrosarcoma; rare (<1%) in common adult cancers.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['*'], tier: 'Tier I · Level A (tumour-agnostic approval)', escat: 'I-C', oncokb: 'Level 1',
      pred: 'Predicts tumour-agnostic benefit from TRK inhibitors.',
      rx: [
        Rx('Larotrectinib', 'Selective TRK inhibitor', 'agnostic', 'Solid tumours with an NTRK gene fusion (without known acquired resistance mutation), metastatic or where resection would cause severe morbidity, with no satisfactory alternative (FDA wording — check).', { settings: ['first-line', 'later-line'], refs: ['larotrectinib', 'hong2020'], key: 'Pooled analysis ORR 79% across tumour types.' }),
        Rx('Entrectinib', 'TRK/ROS1/ALK inhibitor (CNS-active)', 'agnostic', 'NTRK fusion-positive solid tumours (age restrictions apply — check label).', { settings: ['first-line', 'later-line'] }),
        Rx('Repotrectinib', 'Next-generation TRK/ROS1 inhibitor', 'agnostic', 'NTRK fusion-positive solid tumours (FDA, 2024; check age and prior-therapy criteria).', { settings: ['first-line', 'later-line'], caution: 'Recent approval — confirm the current label.' })
      ],
      res: ['TRK solvent-front and xDFG kinase-domain mutations on first-generation inhibitors; next-generation agents may overcome some.'],
      note: 'The fusion must retain the kinase domain and be in-frame. RNA-based assays detect NTRK fusions more reliably than DNA panels (very large introns). Pan-TRK IHC is a screening tool only.'
    }],
    other: '',
    refs: ['larotrectinib', 'hong2020']
  },
  {
    id: 'NRG1_FUSION', gene: 'NRG1', title: 'NRG1 fusion',
    test: (v) => v.gene === 'NRG1' && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (ERBB3-dependent signalling)', roles: ['predictive'],
    onco: 'Oncogenic (driver fusion class)',
    biology: 'NRG1 fusions retain the EGF-like domain of the ligand and activate ERBB3 (HER3)–HER2 signalling in an autocrine/paracrine fashion. Enriched in invasive mucinous lung adenocarcinoma and KRAS-wild-type pancreatic adenocarcinoma.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc', 'pancreatic'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'Predicts benefit from the HER2/HER3 bispecific antibody zenocutuzumab.',
      rx: [Rx('Zenocutuzumab', 'HER2/HER3 bispecific antibody', 'approved', 'NRG1 fusion-positive NSCLC or pancreatic adenocarcinoma after prior systemic therapy (accelerated approval, Dec 2024).', { settings: ['later-line'], caution: 'Accelerated approval — confirm the current label.' })],
      res: []
    }],
    other: 'NRG1 fusions are rare; RNA-based testing is the sensitive method.',
    refs: []
  },

  /* ----------------------------- BRAF / RAS ----------------------------- */
  {
    id: 'BRAF_V600', gene: 'BRAF', title: 'BRAF V600 mutation',
    test: (v) => v.gene === 'BRAF' && /^V600[EKDR]$/.test(v.p),
    effect: 'Gain of function (constitutive monomeric kinase activity)', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (established hotspot)',
    biology: 'Substitution at V600 mimics activation-loop phosphorylation, so BRAF signals as an active RAS-independent monomer, driving MEK–ERK. V600E is the commonest form. Non-V600 BRAF variants (class II/III) behave differently and are NOT covered by this rule.',
    somgerm: 'Somatic. In colorectal cancer, BRAF V600E together with MLH1 loss points toward a sporadic (MLH1-promoter-hypermethylated) rather than Lynch aetiology — it does not exclude testing when clinical suspicion is high.',
    contexts: [
      {
        c: ['melanoma'], tier: 'Tier I · Level A', escat: 'I-A', oncokb: 'Level 1', restrict: /^V600[EK]$/,
        pred: 'Predicts benefit from combined BRAF + MEK inhibition (V600E and V600K).',
        rx: [
          Rx('Dabrafenib + trametinib', 'BRAF + MEK inhibitors', 'approved', 'BRAF V600E/K melanoma: adjuvant (stage III), unresectable or metastatic.', { settings: ['early', 'first-line', 'later-line'], refs: ['combi_d'], key: 'COMBI-d: combined BRAF + MEK inhibition improved outcomes vs BRAF inhibitor alone.' }),
          Rx('Vemurafenib + cobimetinib', 'BRAF + MEK inhibitors', 'approved', 'BRAF V600E/K unresectable or metastatic melanoma.', { settings: ['first-line', 'later-line'] }),
          Rx('Encorafenib + binimetinib', 'BRAF + MEK inhibitors', 'approved', 'BRAF V600E/K unresectable or metastatic melanoma.', { settings: ['first-line', 'later-line'] })
        ],
        res: ['MAPK reactivation (NRAS/KRAS, MEK1/2 mutations, BRAF amplification or splice variants).'],
        note: 'Immune checkpoint inhibitors are also first-line options in BRAF-mutant melanoma; sequencing is a clinical decision that this prototype does not curate.'
      },
      {
        c: ['crc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1', restrict: /^V600E$/,
        pred: 'Predicts benefit from BRAF inhibition only when combined with EGFR blockade; BRAF inhibitor monotherapy is ineffective.',
        prog: 'BRAF V600E in microsatellite-stable metastatic colorectal cancer is a strong adverse prognostic marker. In MSI-high tumours the prognostic effect is attenuated.',
        rx: [
          Rx('Encorafenib + cetuximab', 'BRAF inhibitor + anti-EGFR antibody', 'approved', 'BRAF V600E metastatic colorectal cancer after prior therapy.', { settings: ['later-line'], refs: ['beacon'], key: 'BEACON (triplet arm with binimetinib): ORR 26% vs 2%; median OS 9.0 vs 5.4 months (HR 0.52). The FDA-labelled doublet (encorafenib + cetuximab) had median OS 8.4 months.' }),
          Rx('Encorafenib + cetuximab + mFOLFOX6', 'BRAF inhibitor + anti-EGFR antibody + chemotherapy', 'approved', 'First-line BRAF V600E metastatic colorectal cancer (FDA accelerated approval, Dec 2024).', { settings: ['first-line'], caution: 'Accelerated approval — confirm the current label.' }),
          Rx('BRAF inhibitor monotherapy (vemurafenib, dabrafenib)', 'BRAF inhibitor', 'unsupported', 'Ineffective in BRAF V600E colorectal cancer (rapid EGFR feedback reactivation).')
        ],
        res: ['EGFR-mediated feedback reactivation of MAPK limits BRAF-inhibitor monotherapy.', 'Acquired RAS or MEK alterations.'],
        note: 'If the tumour is also MSI-high/dMMR, immune checkpoint blockade is a separate (and often preferred) option — see the biomarker section.'
      },
      {
        c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1', restrict: /^V600E$/,
        pred: 'Predicts benefit from BRAF + MEK inhibition.',
        rx: [
          Rx('Dabrafenib + trametinib', 'BRAF + MEK inhibitors', 'approved', 'Metastatic NSCLC with BRAF V600E.', { settings: ['first-line', 'later-line'], refs: ['braf_nsclc'] }),
          Rx('Encorafenib + binimetinib', 'BRAF + MEK inhibitors', 'approved', 'Metastatic NSCLC with BRAF V600E (FDA, 2023).', { settings: ['first-line', 'later-line'] })
        ],
        res: ['MAPK reactivation or bypass alterations.']
      },
      {
        c: ['thyroid'], tier: 'Tier I · Level A', escat: null, oncokb: null, restrict: /^V600E$/,
        pred: 'In anaplastic thyroid cancer, predicts benefit from BRAF + MEK inhibition.',
        rx: [Rx('Dabrafenib + trametinib', 'BRAF + MEK inhibitors', 'approved', 'BRAF V600E anaplastic thyroid cancer with no satisfactory locoregional treatment options.', { settings: ['first-line', 'later-line'], caution: 'The approval is specific to ANAPLASTIC thyroid cancer.' })],
        res: []
      },
      {
        c: ['*'], tier: 'Tier I · Level A (tumour-agnostic approval, V600E)', escat: null, oncokb: null, restrict: /^V600E$/,
        pred: 'Tumour-agnostic benefit from BRAF + MEK inhibition has been shown for V600E (not colorectal cancer).',
        rx: [Rx('Dabrafenib + trametinib', 'BRAF + MEK inhibitors', 'agnostic', 'Unresectable or metastatic solid tumours with BRAF V600E that progressed after prior treatment with no satisfactory alternatives; the label states it is not indicated for colorectal cancer.', { settings: ['later-line'] })],
        res: []
      }
    ],
    other: 'BRAF V600E is also near-universal in hairy cell leukaemia and common in Langerhans cell histiocytosis and Erdheim–Chester disease; vemurafenib has an FDA indication in Erdheim–Chester disease.',
    refs: ['beacon', 'combi_d']
  },
  {
    id: 'KRAS_G12C', gene: 'KRAS', title: 'KRAS G12C',
    test: (v) => v.gene === 'KRAS' && v.p === 'G12C',
    effect: 'Gain of function (impaired GTP hydrolysis)', roles: ['predictive'],
    onco: 'Oncogenic (established hotspot)',
    biology: 'The G12C substitution traps KRAS in the GTP-bound "on" state. The mutant cysteine allows covalent inhibitors to lock KRAS G12C in its inactive GDP-bound form. G12C accounts for roughly 12–14% of lung adenocarcinomas and about 3–4% of colorectal cancers.',
    somgerm: 'Somatic.',
    contexts: [
      {
        c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts benefit from covalent KRAS G12C inhibitors after prior therapy.',
        rx: [
          Rx('Sotorasib', 'KRAS G12C inhibitor', 'approved', 'KRAS G12C-mutated NSCLC after at least one prior systemic therapy (accelerated approval).', { settings: ['later-line'], refs: ['codebreak100'], key: 'CodeBreaK 100: ORR 37.1%; median PFS 6.8 months.', caution: 'The confirmatory randomised trial showed a PFS benefit over docetaxel without an overall-survival benefit.' }),
          Rx('Adagrasib', 'KRAS G12C inhibitor', 'approved', 'KRAS G12C-mutated NSCLC after at least one prior systemic therapy (accelerated approval).', { settings: ['later-line'], refs: ['krystal1'], key: 'KRYSTAL-1: ORR 42.9% in previously treated patients.' })
        ],
        res: ['Acquired resistance: secondary KRAS variants, MET amplification and other RAS–MAPK bypass alterations.']
      },
      {
        c: ['crc'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'KRAS G12C inhibitors are used with an anti-EGFR antibody in colorectal cancer; monotherapy is less active (EGFR feedback).',
        rx: [
          Rx('Sotorasib + panitumumab', 'KRAS G12C inhibitor + anti-EGFR antibody', 'approved', 'KRAS G12C-mutated metastatic colorectal cancer after prior fluoropyrimidine-, oxaliplatin- and irinotecan-based chemotherapy.', { settings: ['later-line'] }),
          Rx('Adagrasib + cetuximab', 'KRAS G12C inhibitor + anti-EGFR antibody', 'approved', 'KRAS G12C-mutated metastatic colorectal cancer after prior therapy (accelerated approval).', { settings: ['later-line'], caution: 'Accelerated approval — confirm the current label.' })
        ],
        res: ['Acquired KRAS or MAPK-pathway alterations; EGFR feedback activation.']
      }
    ],
    other: 'In this curated snapshot, KRAS G12C inhibitors have approved indications only in NSCLC and colorectal cancer. For other tumours (for example pancreatic cancer) no approved G12C-directed therapy is curated — consider a clinical trial and check current labels.',
    refs: ['codebreak100', 'krystal1']
  },
  {
    id: 'RAS_OTHER', gene: ['KRAS', 'NRAS'], title: 'KRAS / NRAS activating mutation (non-G12C)',
    test: (v) => (v.gene === 'KRAS' || v.gene === 'NRAS') && v.type !== 'amplification' && /^(G12|G13|Q61|A146|K117)/.test(v.p),
    effect: 'Gain of function (impaired GTP hydrolysis)', roles: ['predictive', 'resistance'],
    onco: 'Oncogenic (established hotspot class)',
    biology: 'Codon 12/13 (exon 2), 61 (exon 3) and 117/146 (exon 4) substitutions keep RAS in the GTP-bound state, activating RAF–MEK–ERK and PI3K. The downstream pathway is already "on", so blocking the upstream EGFR receptor is ineffective.',
    somgerm: 'Somatic.',
    contexts: [
      {
        c: ['crc'], tier: 'Tier I · Level A (negative predictive)', escat: null, oncokb: 'R1 (resistance to anti-EGFR antibodies)',
        pred: 'Predicts lack of benefit from cetuximab and panitumumab: anti-EGFR antibodies require RAS-wild-type status (KRAS/NRAS exons 2, 3 and 4).',
        rx: [Rx('Cetuximab, panitumumab', 'Anti-EGFR antibodies', 'unsupported', 'Not indicated when a KRAS or NRAS activating mutation is present.', { caution: 'Confirm that the full RAS panel (exons 2, 3, 4 of KRAS and NRAS) was tested.' })],
        res: ['Primary resistance to anti-EGFR antibodies.']
      },
      {
        c: ['nsclc'], tier: 'Tier II (potential significance)', escat: null, oncokb: null,
        pred: 'No approved targeted therapy for non-G12C KRAS variants is curated here; mutant-selective and pan-RAS inhibitors are investigational.',
        rx: [Rx('Mutant-selective (non-G12C) and pan-RAS inhibitors', 'Investigational class', 'investigational', 'Clinical-trial setting.', { caution: 'Search ClinicalTrials.gov for the exact variant.' })],
        res: []
      },
      {
        c: ['pancreatic'], tier: 'Tier III (unknown / not targetable)', escat: null, oncokb: null,
        pred: 'KRAS mutations occur in >90% of pancreatic adenocarcinomas and are not directly targetable in this snapshot. KRAS-wild-type pancreatic cancer deserves extended testing for kinase fusions (e.g. NRG1, NTRK, RET) and BRAF alterations.',
        rx: [],
        res: []
      }
    ],
    other: 'RAS mutations are generally not directly targetable outside G12C in this curated snapshot.',
    refs: []
  },
  {
    id: 'PIK3CA_HOT', gene: 'PIK3CA', title: 'PIK3CA hotspot mutation (E542K, E545X, H1047X)',
    test: (v) => v.gene === 'PIK3CA' && /^(E542K|E545[KGAD]|H1047[RLY])$/.test(v.p),
    effect: 'Gain of function (constitutive PI3K activity)', roles: ['predictive'],
    onco: 'Oncogenic (established hotspot)',
    biology: 'Helical-domain (E542K, E545K) and kinase-domain (H1047R) hotspots increase PIP3 production and AKT–mTOR signalling. Non-hotspot PIK3CA variants need individual functional evidence.',
    somgerm: 'Somatic. Mosaic PIK3CA variants cause overgrowth syndromes; not a typical germline cancer-predisposition gene.',
    contexts: [{
      c: ['breast'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'In HR-positive/HER2-negative advanced breast cancer, predicts benefit from PI3Kα inhibition (and AKT inhibition with capivasertib).',
      rx: [
        Rx('Alpelisib + fulvestrant', 'PI3Kα inhibitor + SERD', 'approved', 'PIK3CA-mutated HR+/HER2– advanced breast cancer after endocrine therapy.', { settings: ['later-line'], refs: ['solar1'], key: 'SOLAR-1 (PIK3CA-mutated cohort): median PFS 11.0 vs 5.7 months (HR 0.65).', caution: 'Hyperglycaemia, rash and diarrhoea need proactive management.' }),
        Rx('Capivasertib + fulvestrant', 'AKT inhibitor + SERD', 'approved', 'HR+/HER2– advanced breast cancer with ≥1 PIK3CA/AKT1/PTEN alteration after progression on an endocrine-based regimen.', { settings: ['later-line'], refs: ['capitello291'] }),
        Rx('Inavolisib + palbociclib + fulvestrant', 'PI3Kα inhibitor + CDK4/6 inhibitor + SERD', 'approved', 'PIK3CA-mutated, endocrine-resistant HR+/HER2– advanced breast cancer (FDA, 2024; check exact label wording).', { settings: ['first-line'], refs: ['inavo120'] })
      ],
      res: ['PTEN loss and other PI3K-pathway alterations may modify PI3K-inhibitor benefit.'],
      note: 'The alteration can be detected in tissue or plasma; if plasma is negative, tissue testing is advised.'
    }],
    other: 'PIK3CA hotspot mutations are common in colorectal, endometrial and other cancers, but the breast-cancer drug evidence does NOT transfer to other tumour types.',
    refs: ['solar1', 'capitello291', 'inavo120']
  },
  {
    id: 'AKT1_E17K', gene: 'AKT1', title: 'AKT1 E17K',
    test: (v) => v.gene === 'AKT1' && v.p === 'E17K',
    effect: 'Gain of function (membrane localisation, constitutive activity)', roles: ['predictive'],
    onco: 'Oncogenic (recurrent hotspot)',
    biology: 'Glutamate-17 lies in the pleckstrin-homology domain; E17K enhances PIP2/PIP3 binding and membrane localisation, activating AKT constitutively.',
    somgerm: 'Somatic (mosaic AKT1 E17K causes Proteus syndrome).',
    contexts: [{
      c: ['breast'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'In HR+/HER2– advanced breast cancer, predicts benefit from capivasertib + fulvestrant.',
      rx: [Rx('Capivasertib + fulvestrant', 'AKT inhibitor + SERD', 'approved', 'HR+/HER2– advanced breast cancer with PIK3CA/AKT1/PTEN alterations after progression on an endocrine-based regimen.', { settings: ['later-line'], refs: ['capitello291'] })],
      res: []
    }],
    other: 'Evidence is tumour-type-specific; check other tumour types individually.',
    refs: ['capitello291']
  },
  {
    id: 'ESR1_LBD', gene: 'ESR1', title: 'ESR1 ligand-binding-domain mutation',
    test: (v) => v.gene === 'ESR1' && /^(Y537[SNC]|D538G|E380Q|L536[HRPQ]|S463P|V534E|P535H)$/.test(v.p),
    effect: 'Gain of function (ligand-independent ER activity)', roles: ['predictive', 'resistance'],
    onco: 'Oncogenic / endocrine-resistance variant (established hotspots)',
    biology: 'Mutations in the ligand-binding domain (Y537S/N/C, D538G, E380Q…) stabilise the active receptor conformation without oestrogen. They are rare in primary tumours and enriched after aromatase-inhibitor exposure; they confer relative resistance to aromatase inhibitors.',
    somgerm: 'Acquired (somatic). Best detected in plasma ctDNA or a recent biopsy at progression.',
    contexts: [{
      c: ['breast'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'In ER+/HER2– advanced breast cancer previously treated with endocrine therapy, predicts benefit from the oral SERD elacestrant.',
      rx: [
        Rx('Elacestrant', 'Oral selective ER degrader (SERD)', 'approved', 'ER+/HER2– advanced or metastatic breast cancer with ESR1 mutation after at least one line of endocrine therapy.', { settings: ['later-line'], refs: ['emerald'], key: 'EMERALD (ESR1-mutated): PFS HR 0.55 (95% CI 0.39–0.77) vs standard endocrine therapy.' }),
        Rx('Other oral SERDs / next-generation endocrine agents', 'Evolving class', 'verify', 'Regulatory status is changing quickly.', { caution: 'Check current FDA/EMA labels.' })
      ],
      res: ['Relative resistance to aromatase inhibitors (ligand-independent receptor activity).']
    }],
    other: 'ESR1 ligand-binding-domain mutations are clinically relevant mainly in ER-positive breast cancer.',
    refs: ['emerald']
  },
  {
    id: 'PTEN_LOSS', gene: 'PTEN', title: 'PTEN inactivating alteration',
    test: (v) => v.gene === 'PTEN' && (TRUNCATING.includes(v.type) || v.type === 'deletion'),
    effect: 'Loss of function', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (loss-of-function in a tumour suppressor)',
    biology: 'Truncating variants, canonical splice variants and homozygous deletions inactivate PTEN, removing the brake on PI3K–AKT signalling.',
    somgerm: 'May be germline: PTEN hamartoma tumour syndrome (Cowden syndrome). Consider genetic counselling when the clinical picture fits.',
    contexts: [{
      c: ['breast'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'In HR+/HER2– advanced breast cancer, PTEN alterations are part of the capivasertib + fulvestrant label.',
      rx: [Rx('Capivasertib + fulvestrant', 'AKT inhibitor + SERD', 'approved', 'HR+/HER2– advanced breast cancer with PIK3CA/AKT1/PTEN alterations after progression on an endocrine-based regimen.', { settings: ['later-line'], refs: ['capitello291'] })],
      res: []
    }],
    other: 'PTEN loss has prognostic/biological relevance in several cancers but no tumour-agnostic therapy is curated.',
    refs: ['capitello291']
  },

  /* ----------------------------- MET / ERBB2 ----------------------------- */
  {
    id: 'MET_EX14', gene: 'MET', title: 'MET exon 14 skipping alteration',
    test: (v) => v.gene === 'MET' && v.type !== 'amplification' && (v.type === 'splice' || /(EX14|EXON ?14|SKIP)/.test(v.text.toUpperCase())),
    effect: 'Gain of function (loss of CBL-mediated degradation)', roles: ['predictive'],
    onco: 'Oncogenic (established alteration class)',
    biology: 'Splice-site variants around exon 14 (including intronic and deep-intronic changes) cause exon skipping and loss of the juxtamembrane Y1003 CBL-binding site, so MET escapes ubiquitin-mediated degradation and signals for longer. Because the lesion acts at the RNA level, RNA-based assays detect it more reliably than DNA panels.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from MET inhibitors.',
      rx: [
        Rx('Capmatinib', 'MET inhibitor', 'approved', 'Metastatic NSCLC with MET exon 14 skipping.', { settings: ['first-line', 'later-line'], refs: ['geometry'], key: 'GEOMETRY mono-1: ORR 68% (treatment-naïve) and 41% (previously treated).', caution: 'Peripheral oedema and hepatotoxicity.' }),
        Rx('Tepotinib', 'MET inhibitor', 'approved', 'Metastatic NSCLC with MET exon 14 skipping.', { settings: ['first-line', 'later-line'] })
      ],
      res: ['Secondary MET kinase-domain mutations (e.g. D1228, Y1230); bypass activation (e.g. EGFR, KRAS).']
    }],
    other: 'MET exon 14 skipping also occurs in other tumours (e.g. sarcomatoid carcinoma); the NSCLC approvals do not automatically transfer.',
    refs: ['geometry']
  },
  {
    id: 'MET_AMP', gene: 'MET', title: 'MET amplification',
    test: (v) => v.gene === 'MET' && v.type === 'amplification',
    effect: 'Gain of function (increased gene dosage)', roles: ['resistance', 'predictive'],
    onco: 'Context-dependent: driver when high-level; bypass-resistance mechanism after EGFR-TKI',
    biology: 'MET amplification increases receptor dose and can activate PI3K–AKT via ERBB3. In EGFR-mutant NSCLC it is a recognised bypass resistance mechanism to EGFR TKIs. Thresholds for "high-level" amplification are assay-specific and not universally agreed.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier II (potential significance)', escat: null, oncokb: null,
      pred: 'In EGFR-mutant NSCLC progressing on a TKI, MET amplification points to bypass resistance. In EGFR-wild-type disease, MET inhibitors show modest activity with high-level amplification but this is not an approved indication.',
      rx: [
        Rx('MET inhibitor + EGFR TKI combinations', 'Combination strategy', 'verify', 'Investigational in most regions; regulatory status varies by country.', { caution: 'Check ClinicalTrials.gov and current labels.' }),
        Rx('MET inhibitor monotherapy for MET amplification without a driver', 'MET inhibitor', 'investigational', 'Not an approved indication; evidence is modest.', { refs: ['geometry'] })
      ],
      res: ['Bypass resistance to EGFR TKIs (EGFR-mutant NSCLC).']
    }],
    other: 'Interpretation depends on tumour type, copy-number threshold and assay. Plasma assays detect copy-number gains less reliably than tissue.',
    refs: ['geometry']
  },
  {
    id: 'ERBB2_AMP', gene: 'ERBB2', title: 'ERBB2 (HER2) amplification',
    test: (v) => v.gene === 'ERBB2' && v.type === 'amplification',
    effect: 'Gain of function (receptor overexpression)', roles: ['predictive'],
    onco: 'Oncogenic (established driver amplification)',
    biology: 'High-level ERBB2 amplification causes receptor overexpression, ligand-independent homo/heterodimerisation and strong PI3K–AKT and MAPK signalling.',
    somgerm: 'Somatic.',
    contexts: [
      {
        c: ['breast'], tier: 'Tier I · Level A', escat: 'I-A', oncokb: 'Level 1',
        pred: 'HER2-positive breast cancer (IHC 3+ or ISH-amplified per ASCO/CAP) predicts benefit from HER2-directed therapy.',
        rx: [
          Rx('Trastuzumab-based regimens (± pertuzumab, T-DM1, trastuzumab deruxtecan, tucatinib)', 'HER2-directed antibodies / ADCs / TKI', 'approved', 'HER2-positive breast cancer across early and advanced settings; specific regimen depends on setting.', { settings: ['early', 'locally-advanced', 'first-line', 'later-line'] })
        ],
        res: ['Loss of HER2 expression, PIK3CA/PTEN alterations and other mechanisms.'],
        note: 'Clinical HER2 positivity is defined by IHC/ISH (ASCO/CAP). NGS copy-number calls are assay-dependent and must be reconciled with IHC/ISH, especially for borderline results.'
      },
      {
        c: ['gastric'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'HER2-positive gastric/GEJ adenocarcinoma predicts benefit from trastuzumab-based therapy.',
        rx: [
          Rx('Trastuzumab + chemotherapy', 'Anti-HER2 antibody + chemotherapy', 'approved', 'HER2-positive (IHC 3+ or IHC 2+/ISH+) metastatic gastric or GEJ adenocarcinoma.', { settings: ['first-line'] }),
          Rx('Trastuzumab deruxtecan', 'HER2-directed ADC', 'approved', 'HER2-positive gastric/GEJ adenocarcinoma after a trastuzumab-based regimen.', { settings: ['later-line'] })
        ],
        res: [], note: 'Gastric HER2 status is defined by IHC/ISH; heterogeneity is common.'
      },
      {
        c: ['crc'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'In RAS-wild-type HER2-positive metastatic colorectal cancer, HER2 blockade is an option after prior therapy.',
        rx: [
          Rx('Tucatinib + trastuzumab', 'HER2 TKI + antibody', 'approved', 'RAS-wild-type HER2-positive metastatic colorectal cancer after fluoropyrimidine-, oxaliplatin- and irinotecan-based chemotherapy (accelerated approval).', { settings: ['later-line'], caution: 'Accelerated approval — confirm the current label.' }),
          Rx('Trastuzumab deruxtecan', 'HER2-directed ADC', 'agnostic', 'Unresectable or metastatic HER2-positive (IHC 3+) solid tumours after prior treatment with no satisfactory alternatives (FDA accelerated approval).', { settings: ['later-line'] })
        ],
        res: []
      },
      {
        c: ['biliary'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'HER2-positive (IHC 3+) biliary tract cancer may benefit from HER2-directed therapy after prior treatment.',
        rx: [
          Rx('Zanidatamab', 'HER2 bispecific antibody', 'approved', 'Previously treated unresectable or metastatic HER2-positive (IHC 3+) biliary tract cancer (accelerated approval, 2024).', { settings: ['later-line'], caution: 'Accelerated approval — confirm the current label.' }),
          Rx('Trastuzumab deruxtecan', 'HER2-directed ADC', 'agnostic', 'HER2 IHC 3+ solid tumours after prior treatment with no satisfactory alternatives (FDA accelerated approval).', { settings: ['later-line'] })
        ],
        res: []
      },
      {
        c: ['*'], tier: 'Tier II (tumour-agnostic ADC approval depends on IHC 3+)', escat: null, oncokb: null,
        pred: 'Trastuzumab deruxtecan has a tumour-agnostic FDA accelerated approval for HER2 IHC 3+ solid tumours — the criterion is protein overexpression (IHC), not NGS amplification alone.',
        rx: [Rx('Trastuzumab deruxtecan', 'HER2-directed ADC', 'agnostic', 'Unresectable or metastatic HER2-positive (IHC 3+) solid tumours after prior treatment with no satisfactory alternatives.', { settings: ['later-line'], caution: 'Confirm HER2 IHC 3+ before considering.' })],
        res: []
      }
    ],
    other: '',
    refs: []
  },
  {
    id: 'ERBB2_MUT', gene: 'ERBB2', title: 'ERBB2 (HER2) activating mutation',
    test: (v) => v.gene === 'ERBB2' && v.type !== 'amplification',
    effect: 'Gain of function (kinase- or extracellular-domain activating)', roles: ['predictive'],
    onco: 'Oncogenic when a recognised activating variant (e.g. exon 20 insertions, S310F, L755S); other variants need review',
    biology: 'Kinase-domain exon 20 insertions (e.g. p.A775_G776insYVMA), L755S and extracellular S310F/Y variants activate HER2 signalling without amplification.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['nsclc'], tier: 'Tier I · Level A', escat: null, oncokb: null,
      pred: 'In NSCLC, predicts benefit from HER2-directed antibody–drug conjugate therapy.',
      rx: [
        Rx('Trastuzumab deruxtecan', 'HER2-directed ADC', 'approved', 'Unresectable or metastatic NSCLC with an activating HER2 (ERBB2) mutation after prior systemic therapy (accelerated approval).', { settings: ['later-line'], refs: ['destiny_lung02'], key: 'DESTINY-Lung02: ORR 49% at 5.4 mg/kg.', caution: 'Interstitial lung disease/pneumonitis is a key toxicity.' }),
        Rx('HER2-selective TKIs', 'Evolving class', 'verify', 'Regulatory status is changing quickly.', { caution: 'Check current FDA/EMA labels.' })
      ],
      res: []
    }],
    other: 'Activating ERBB2 mutations in other tumours (e.g. breast) are investigational targets in this snapshot; confirm the variant is a recognised activating one.',
    refs: ['destiny_lung02']
  },

  /* ----------------------------- DNA repair / HRD ----------------------------- */
  {
    id: 'BRCA', gene: ['BRCA1', 'BRCA2'], title: 'BRCA1 / BRCA2 alteration',
    test: (v) => v.gene === 'BRCA1' || v.gene === 'BRCA2',
    effect: 'Loss of function (when truncating / deleterious)', roles: ['predictive', 'prognostic', 'germline'],
    onco: 'Truncating variants (nonsense, frameshift, canonical splice) and large deletions are typically loss-of-function; missense/in-frame variants REQUIRE separate classification (e.g. ClinVar, ClinGen ENIGMA expert panel)',
    biology: 'BRCA1/2 are required for homologous-recombination repair. Biallelic loss produces homologous-recombination deficiency (HRD) with sensitivity to platinum agents and PARP inhibitors (synthetic lethality).',
    somgerm: 'A BRCA1/2 finding on tumour-only testing may be GERMLINE (VAF near 50%, or ~100% with LOH). Germline confirmation, consent and genetic counselling are needed; this also matters for family cascade testing. Some FDA indications (e.g. breast cancer, pancreatic cancer) specify GERMLINE variants.',
    contexts: [
      {
        c: ['breast'], germlineOnly: true, tier: 'Tier I · Level A (germline pathogenic variant)', escat: null, oncokb: 'Level 1',
        pred: 'Germline BRCA1/2 pathogenic variants in HER2-negative breast cancer predict benefit from PARP inhibitors.',
        rx: [
          Rx('Olaparib', 'PARP inhibitor', 'approved', 'Germline BRCA-mutated HER2-negative breast cancer: metastatic (previously treated with chemotherapy) and high-risk early breast cancer (adjuvant).', { settings: ['early', 'first-line', 'later-line'], refs: ['olympiad', 'olympia'], key: 'OlympiAD: median PFS 7.0 vs 4.2 months (HR 0.58) vs chemotherapy.', caution: 'The FDA breast-cancer indication requires a GERMLINE BRCA variant; a somatic-only finding does not by itself satisfy it.' }),
          Rx('Talazoparib', 'PARP inhibitor', 'approved', 'Germline BRCA-mutated HER2-negative locally advanced or metastatic breast cancer.', { settings: ['first-line', 'later-line'], caution: 'Requires a germline BRCA variant.' })
        ],
        res: ['BRCA1/2 reversion (secondary) mutations restoring the reading frame; loss of 53BP1–shieldin function; increased drug efflux.']
      },
      {
        c: ['ovarian'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'BRCA1/2-mutated (germline or somatic) ovarian cancer predicts marked benefit from PARP-inhibitor maintenance after platinum response.',
        rx: [
          Rx('Olaparib (maintenance)', 'PARP inhibitor', 'approved', 'Advanced ovarian cancer with deleterious/suspected deleterious germline or somatic BRCA mutation in response to first-line platinum chemotherapy.', { settings: ['first-line'], refs: ['solo1'], key: 'SOLO-1: HR 0.30 for progression or death.' }),
          Rx('Olaparib + bevacizumab (maintenance)', 'PARP inhibitor + anti-VEGF', 'approved', 'Advanced ovarian cancer in response to first-line platinum-based chemotherapy with bevacizumab, HRD-positive (BRCA-mutated or genomic-instability-positive).', { settings: ['first-line'], refs: ['paola'] }),
          Rx('Niraparib (maintenance)', 'PARP inhibitor', 'approved', 'Advanced ovarian cancer in response to first-line platinum-based chemotherapy (label not restricted to BRCA status).', { settings: ['first-line'] })
        ],
        res: ['BRCA1/2 reversion mutations; loss of 53BP1–shieldin function.']
      },
      {
        c: ['prostate'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'In metastatic castration-resistant prostate cancer, BRCA1/2 alterations predict benefit from PARP inhibition.',
        rx: [
          Rx('Olaparib', 'PARP inhibitor', 'approved', 'HRR-gene-mutated mCRPC progressing after enzalutamide or abiraterone.', { settings: ['later-line'], refs: ['profound'], key: 'PROfound cohort A (BRCA1/2/ATM): radiographic PFS 7.4 vs 3.6 months (HR 0.34).' }),
          Rx('PARP inhibitor + androgen-receptor-pathway inhibitor combinations (olaparib + abiraterone, niraparib + abiraterone, talazoparib + enzalutamide)', 'Combination', 'approved', 'mCRPC; labels differ (BRCA-mutated vs broader HRR-mutated).', { settings: ['first-line'], caution: 'Read the specific label: biomarker requirements and settings differ between products.' })
        ],
        res: ['BRCA2 reversion mutations; other HRR rescue mechanisms.']
      },
      {
        c: ['pancreatic'], germlineOnly: true, tier: 'Tier I · Level A (germline pathogenic variant)', escat: null, oncokb: 'Level 1',
        pred: 'Germline BRCA1/2-mutated metastatic pancreatic cancer predicts benefit from maintenance olaparib after platinum.',
        rx: [Rx('Olaparib (maintenance)', 'PARP inhibitor', 'approved', 'Germline BRCA-mutated metastatic pancreatic adenocarcinoma without progression on at least 16 weeks of first-line platinum-based chemotherapy.', { settings: ['first-line'], refs: ['polo'], key: 'POLO: median PFS 7.4 vs 3.8 months (HR 0.53).', caution: 'Requires a GERMLINE BRCA variant.' })],
        res: ['BRCA reversion mutations.']
      }
    ],
    other: 'BRCA1/2 alterations in other tumours: PARP-inhibitor evidence is tumour-specific and no tumour-agnostic PARP-inhibitor approval is curated. The germline implications still apply.',
    refs: ['olympiad', 'solo1', 'profound', 'polo', 'mandelker2019']
  },
  {
    id: 'MMR_GENES', gene: ['MLH1', 'MSH2', 'MSH6', 'PMS2'], title: 'Mismatch-repair gene alteration',
    test: (v) => ['MLH1', 'MSH2', 'MSH6', 'PMS2'].includes(v.gene),
    effect: 'Loss of function (when truncating / deleterious)', roles: ['predictive', 'germline'],
    onco: 'Truncating variants and deletions are typically loss-of-function; missense variants need separate classification',
    biology: 'Loss of mismatch repair leaves replication errors uncorrected, producing microsatellite instability (MSI-high) and a high mutation burden that makes tumours immunogenic.',
    somgerm: 'May be GERMLINE (Lynch syndrome). Tumour MLH1 loss is most often due to promoter hypermethylation (sporadic), often with BRAF V600E in colorectal cancer; a pathogenic MMR variant at VAF ≈ 50% suggests germline. Confirm with germline testing and genetic counselling; Lynch syndrome affects the family.',
    contexts: [{
      c: ['*'], tier: 'Tier I · Level A (via MSI-H / dMMR biomarker)', escat: null, oncokb: null,
      pred: 'The treatment relevance is carried by the MSI-H/dMMR phenotype, not by the individual gene variant — see the biomarker section on the Actionability page.',
      rx: [],
      res: []
    }],
    other: '',
    refs: ['le2017', 'bethesda2004']
  },
  {
    id: 'TP53_ANY', gene: 'TP53', title: 'TP53 alteration',
    test: (v) => v.gene === 'TP53',
    effect: 'Typically loss of function (± dominant-negative / gain-of-function for DNA-binding-domain missense)', roles: ['prognostic', 'germline'],
    onco: 'Truncating variants and recurrent DNA-binding-domain hotspots (e.g. R175H, G245S, R248Q/W, R249S, R273H/C, R282W) are generally considered oncogenic; other missense variants need functional evidence (e.g. IARC TP53 database, ClinGen TP53 expert panel)',
    biology: 'p53 loss removes cell-cycle arrest, DNA-repair and apoptosis control. Many missense hotspots produce a mutant protein that is nonfunctional and can inhibit wild-type p53 in the tetramer (dominant-negative effect).',
    somgerm: 'THREE possible origins for the same TP53 variant: (1) somatic tumour mutation; (2) germline (Li–Fraumeni syndrome — consider Chompret criteria, VAF ≈ 50%/100% across tissues); (3) clonal haematopoiesis (CHIP), especially a low-VAF variant in plasma or blood. Always ask which one applies.',
    contexts: [{
      c: ['*'], tier: 'Tier II/III depending on tumour — not assigned by the prototype', escat: null, oncokb: null,
      pred: 'No approved TP53-directed therapy. TP53 status informs prognosis and some treatment decisions (e.g. del(17p)/TP53-mutated CLL favours BTK-inhibitor-based therapy over chemoimmunotherapy; TP53 mutation is adverse-risk in AML under ELN 2022).',
      prog: 'Generally adverse or modifying; magnitude depends on tumour type, variant and co-mutations. In EGFR-mutant NSCLC, TP53 co-mutation has been associated with shorter benefit from EGFR TKIs in several series.',
      rx: [],
      res: []
    }],
    other: '',
    refs: ['eln2022', 'razavi2019']
  },
  {
    id: 'CDKN2A_DEL', gene: 'CDKN2A', title: 'CDKN2A deletion / loss of function',
    test: (v) => v.gene === 'CDKN2A' && (v.type === 'deletion' || TRUNCATING.includes(v.type)),
    effect: 'Loss of function', roles: ['prognostic', 'germline'],
    onco: 'Oncogenic (loss-of-function in a tumour suppressor); homozygous deletion is the usual mechanism',
    biology: 'CDKN2A encodes p16INK4A and p14ARF. Loss of p16 removes the brake on CDK4/6–RB; loss of p14ARF weakens p53 stabilisation. Homozygous 9p21 deletion often co-deletes CDKN2B and MTAP.',
    somgerm: 'Somatic homozygous deletion is typical in tumours. Germline CDKN2A pathogenic variants cause familial melanoma–pancreatic cancer syndrome — consider if truncating/missense at VAF ≈ 50%.',
    contexts: [{
      c: ['*'], tier: 'Tier III (unknown clinical significance for therapy)', escat: null, oncokb: null,
      pred: 'No approved therapy is selected on CDKN2A loss alone; CDK4/6 inhibitors have not been validated for this purpose.',
      rx: [], res: []
    }],
    other: '', refs: []
  },

  /* ----------------------------- Heme / metabolic ----------------------------- */
  {
    id: 'IDH1_R132', gene: 'IDH1', title: 'IDH1 R132 mutation',
    test: (v) => v.gene === 'IDH1' && /^R132/.test(v.p),
    effect: 'Neomorphic gain of function (D-2-hydroxyglutarate production)', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (established hotspot)',
    biology: 'R132 substitutions give IDH1 a neomorphic activity converting α-ketoglutarate to D-2-hydroxyglutarate, which inhibits α-KG-dependent dioxygenases (TET2, histone demethylases) causing hypermethylation and a block in differentiation.',
    somgerm: 'Somatic (mosaic IDH1 variants occur in Ollier disease and Maffucci syndrome).',
    contexts: [
      {
        c: ['aml'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts benefit from IDH1 inhibitors.',
        rx: [
          Rx('Ivosidenib (± azacitidine)', 'IDH1 inhibitor', 'approved', 'IDH1-mutated AML: newly diagnosed in patients unable to receive intensive chemotherapy (with azacitidine) and relapsed/refractory.', { settings: ['first-line', 'later-line'], refs: ['agile'], caution: 'Differentiation syndrome and QT prolongation need monitoring.' }),
          Rx('Olutasidenib', 'IDH1 inhibitor', 'approved', 'Relapsed or refractory IDH1-mutated AML.', { settings: ['later-line'], caution: 'Differentiation syndrome; hepatotoxicity.' })
        ],
        res: ['Isoform switching (acquired IDH2 mutation), RAS-pathway mutations.']
      },
      {
        c: ['biliary'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts benefit from ivosidenib in previously treated IDH1-mutant cholangiocarcinoma.',
        rx: [Rx('Ivosidenib', 'IDH1 inhibitor', 'approved', 'Previously treated, locally advanced or metastatic IDH1-mutated cholangiocarcinoma.', { settings: ['later-line'], refs: ['clarid_hy'], key: 'ClarIDHy: median PFS 2.7 vs 1.4 months (HR 0.37) vs placebo.' })],
        res: []
      },
      {
        c: ['glioma'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'IDH mutation is diagnostic (WHO CNS5) and favourable prognostic; vorasidenib is approved for grade 2 IDH-mutant astrocytoma/oligodendroglioma after surgery.',
        prog: 'Favourable prognosis relative to IDH-wild-type glioma.',
        rx: [Rx('Vorasidenib', 'Brain-penetrant IDH1/2 inhibitor', 'approved', 'Grade 2 astrocytoma or oligodendroglioma with susceptible IDH1/IDH2 mutation after surgery (FDA, 2024).', { settings: ['early'], refs: ['indigo'], key: 'INDIGO: median PFS 27.7 vs 11.1 months (HR 0.39) vs placebo.' })],
        res: []
      }
    ],
    other: 'IDH1 R132 occurs in chondrosarcoma and other tumours; approvals above are tumour-specific.',
    refs: ['agile', 'clarid_hy', 'indigo']
  },
  {
    id: 'IDH2_R', gene: 'IDH2', title: 'IDH2 R140 / R172 mutation',
    test: (v) => v.gene === 'IDH2' && /^R(140|172)/.test(v.p),
    effect: 'Neomorphic gain of function (D-2-hydroxyglutarate production)', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (established hotspot)',
    biology: 'Mitochondrial IDH2 hotspot variants (R140Q most common in AML; R172K) produce D-2-hydroxyglutarate, with the same epigenetic consequences as IDH1 R132.',
    somgerm: 'Somatic.',
    contexts: [
      {
        c: ['aml'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
        pred: 'Predicts response to the IDH2 inhibitor enasidenib in relapsed/refractory AML.',
        rx: [Rx('Enasidenib', 'IDH2 inhibitor', 'approved', 'Relapsed or refractory AML with an IDH2 mutation.', { settings: ['later-line'], refs: ['idhentify'], caution: 'The randomised IDHENTIFY trial did not show an overall-survival improvement over conventional care in older relapsed/refractory patients. Differentiation syndrome needs monitoring. Ivosidenib acts on IDH1 only.' })],
        res: []
      },
      {
        c: ['glioma'], tier: 'Tier I · Level A', escat: null, oncokb: null,
        pred: 'IDH mutation is diagnostic and favourable prognostic; vorasidenib covers IDH1 and IDH2.',
        rx: [Rx('Vorasidenib', 'Brain-penetrant IDH1/2 inhibitor', 'approved', 'Grade 2 astrocytoma or oligodendroglioma with susceptible IDH1/IDH2 mutation after surgery.', { settings: ['early'], refs: ['indigo'] })],
        res: []
      }
    ],
    other: '', refs: ['idhentify', 'indigo']
  },
  {
    id: 'FLT3_AML', gene: 'FLT3', title: 'FLT3 mutation (ITD or TKD)',
    test: (v) => v.gene === 'FLT3',
    effect: 'Gain of function (constitutive kinase activity)', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (established driver in AML)',
    biology: 'Internal tandem duplications (ITD) in the juxtamembrane domain and point mutations in the activation loop (TKD, e.g. D835) cause ligand-independent FLT3 signalling through STAT5, PI3K–AKT and MAPK.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['aml'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from FLT3 inhibitors added to chemotherapy (first-line) or given alone (relapsed/refractory).',
      prog: 'ELN 2022: FLT3-ITD allelic ratio is no longer used. NPM1-mutated WITH FLT3-ITD and NPM1-wild-type WITH FLT3-ITD (without adverse-risk lesions) are intermediate risk.',
      rx: [
        Rx('Midostaurin + intensive chemotherapy', 'FLT3 inhibitor', 'approved', 'Newly diagnosed FLT3-mutated AML (ITD or TKD) with 7+3 induction.', { settings: ['first-line'], refs: ['ratify'], key: 'RATIFY: overall-survival benefit with midostaurin (HR 0.78).' }),
        Rx('Quizartinib + intensive chemotherapy', 'FLT3-ITD-selective inhibitor', 'approved', 'Newly diagnosed FLT3-ITD-positive AML.', { settings: ['first-line'], refs: ['quantum'], key: 'QuANTUM-First: median OS 31.9 vs 15.1 months.', caution: 'ITD-only indication; QT prolongation.' }),
        Rx('Gilteritinib', 'FLT3 inhibitor', 'approved', 'Relapsed or refractory FLT3-mutated AML.', { settings: ['later-line'], refs: ['admiral'], key: 'ADMIRAL: median OS 9.3 vs 5.6 months (HR 0.64) vs salvage chemotherapy.', caution: 'Differentiation syndrome.' })
      ],
      res: ['FLT3 TKD mutations (e.g. D835, F691L) and RAS-pathway mutations in resistance to FLT3 inhibitors.'],
      note: 'ITD detection: long ITDs are under-called by routine short-read NGS pipelines. Use a validated ITD-aware method or fragment analysis, and report allelic burden as the laboratory defines it.'
    }],
    other: 'FLT3 alterations outside AML are not curated.',
    refs: ['ratify', 'quantum', 'admiral', 'eln2022']
  },
  {
    id: 'NPM1_AML', gene: 'NPM1', title: 'NPM1 mutation',
    test: (v) => v.gene === 'NPM1',
    effect: 'Aberrant cytoplasmic localisation of nucleophosmin', roles: ['prognostic'],
    onco: 'Oncogenic (AML-defining lesion; type A c.860_863dup is the commonest)',
    biology: 'Exon 12 frameshift insertions (most often a 4-base duplication, type A: c.860_863dupTCTG, p.Trp288CysfsTer12) add a nuclear-export signal and remove the nucleolar-localisation signal, relocating NPM1 to the cytoplasm.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['aml'], tier: 'Tier I · Level A (prognostic, ELN)', escat: null, oncokb: null,
      pred: 'Mainly prognostic: favourable genetic risk when no FLT3-ITD is present (ELN 2022). A useful molecular marker for measurable residual disease (RT-qPCR of NPM1 mutant transcripts).',
      prog: 'ELN 2022: NPM1-mutated without FLT3-ITD = favourable risk; with FLT3-ITD = intermediate risk (adverse-risk lesions override).',
      rx: [Rx('Menin inhibitors', 'Evolving class (KMT2A-rearranged and NPM1-mutated leukaemias)', 'verify', 'Regulatory actions have occurred recently in selected settings.', { caution: 'Check current FDA/EMA labels for the exact indication.' })],
      res: []
    }],
    other: '', refs: ['eln2022']
  },
  {
    id: 'CHIP_GENES', gene: ['DNMT3A', 'TET2', 'ASXL1'], title: 'DNMT3A / TET2 / ASXL1 mutation (clonal-haematopoiesis-prone gene)',
    test: (v) => ['DNMT3A', 'TET2', 'ASXL1'].includes(v.gene),
    effect: 'Loss of function (epigenetic regulators)', roles: ['prognostic'],
    onco: 'Oncogenic/recurrent in myeloid neoplasms, BUT these are the commonest clonal-haematopoiesis (CHIP) genes — interpretation depends on specimen and clinical context',
    biology: 'DNMT3A (de novo methylation), TET2 (demethylation) and ASXL1 (Polycomb chromatin regulation) mutations give haematopoietic stem cells a clonal advantage. They accumulate with age.',
    somgerm: 'In a PLASMA or BLOOD specimen from a patient with a solid tumour, a low-VAF variant in these genes is most likely CHIP, not tumour-derived. Matched white-blood-cell sequencing resolves this.',
    contexts: [{
      c: ['aml'], tier: 'Tier III (no therapy; prognostic only for ASXL1)', escat: null, oncokb: null,
      pred: 'No approved gene-directed therapy. ASXL1 is an adverse-risk (myelodysplasia-related) gene in ELN 2022. DNMT3A and TET2 variants often persist in remission and are not suitable MRD markers.',
      rx: [], res: []
    }],
    other: 'In solid-tumour liquid biopsy, treat DNMT3A/TET2/ASXL1 variants as presumptive CHIP unless proven otherwise.',
    refs: ['razavi2019', 'steensma2015', 'eln2022']
  },
  {
    id: 'ABL1_T315I', gene: 'ABL1', title: 'ABL1 T315I (gatekeeper)',
    test: (v) => v.gene === 'ABL1' && v.p === 'T315I',
    effect: 'Acquired resistance variant (gatekeeper)', roles: ['resistance', 'predictive'],
    onco: 'Resistance-associated variant with strong functional and clinical evidence',
    biology: 'Threonine-315 is the BCR::ABL1 gatekeeper. T315I removes a hydrogen-bonding site and blocks access to the pocket, conferring resistance to imatinib, dasatinib, nilotinib and bosutinib.',
    somgerm: 'Acquired (somatic) in the leukaemic clone.',
    contexts: [{
      c: ['cml'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts resistance to imatinib, dasatinib, nilotinib and bosutinib; sensitivity to ponatinib and asciminib.',
      rx: [
        Rx('Ponatinib', 'Third-generation BCR::ABL1 TKI', 'approved', 'CML resistant to prior TKIs, including T315I-positive disease.', { settings: ['later-line'], refs: ['pace'], caution: 'Arterial occlusive events and venous thromboembolism: dose and cardiovascular risk need individualisation.' }),
        Rx('Asciminib', 'STAMP (allosteric) inhibitor', 'approved', 'Ph+ CML in chronic phase with T315I; and after ≥2 prior TKIs.', { settings: ['later-line'] }),
        Rx('Imatinib, dasatinib, nilotinib, bosutinib', 'ATP-competitive TKIs', 'unsupported', 'T315I confers resistance to these agents.')
      ],
      res: ['Compound BCR::ABL1 mutations, and BCR::ABL1-independent mechanisms.']
    }],
    other: 'Relevant mainly to Ph-positive CML and Ph-positive ALL; discuss allogeneic transplantation candidacy and trials in advanced phase.',
    refs: ['pace', 'iris']
  },
  {
    id: 'BCR_ABL1', gene: 'ABL1', title: 'BCR::ABL1 fusion (Philadelphia chromosome)',
    test: (v) => v.gene === 'ABL1' && (['fusion', 'rearrangement'].includes(v.type) || /BCR/.test(v.partner.toUpperCase())),
    effect: 'Gain of function (constitutive tyrosine kinase)', roles: ['predictive', 'prognostic'],
    onco: 'Oncogenic (disease-defining fusion)',
    biology: 'The Philadelphia chromosome, t(9;22)(q34;q11) (Nowell and Hungerford), joins BCR to ABL1. The p210 transcript is typical of CML; p190 is typical of Ph-positive ALL. The fusion kinase is constitutively active (RAS–MAPK, PI3K–AKT, STAT5).',
    somgerm: 'Somatic translocation.',
    contexts: [{
      c: ['cml'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Defines CML; predicts response to BCR::ABL1 tyrosine-kinase inhibitors. Response is monitored by BCR::ABL1 transcript levels (RT-qPCR, International Scale).',
      rx: [
        Rx('Imatinib', 'First-generation BCR::ABL1 TKI', 'approved', 'Newly diagnosed Ph+ CML in chronic phase and later phases.', { settings: ['first-line', 'later-line'], refs: ['iris'] }),
        Rx('Dasatinib, nilotinib, bosutinib', 'Second-generation BCR::ABL1 TKIs', 'approved', 'Ph+ CML; first-line and after prior TKI (label-specific).', { settings: ['first-line', 'later-line'] })
      ],
      res: ['Kinase-domain mutations (e.g. T315I) — mutation analysis is indicated on TKI failure or warning.']
    }],
    other: 'In Ph-positive ALL, TKIs are combined with chemotherapy; confirm the regimen and current labels for newly diagnosed Ph-positive ALL.',
    refs: ['iris']
  },

  /* ----------------------------- Other solid tumour drivers ----------------------------- */
  {
    id: 'FGFR2_FUSION', gene: 'FGFR2', title: 'FGFR2 fusion / rearrangement',
    test: (v) => v.gene === 'FGFR2' && ['fusion', 'rearrangement'].includes(v.type),
    effect: 'Gain of function (constitutive kinase activation)', roles: ['predictive'],
    onco: 'Oncogenic (driver fusion class)',
    biology: 'FGFR2 fusions (more than 100 partners described; e.g. FGFR2::BICC1) are characteristic of intrahepatic cholangiocarcinoma and drive constitutive FGFR signalling. Gene amplification and point mutations are different alteration classes.',
    somgerm: 'Somatic.',
    contexts: [{
      c: ['biliary'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from FGFR inhibitors in previously treated cholangiocarcinoma.',
      rx: [
        Rx('Pemigatinib', 'FGFR1–3 inhibitor', 'approved', 'Previously treated unresectable locally advanced or metastatic cholangiocarcinoma with FGFR2 fusion or rearrangement.', { settings: ['later-line'], refs: ['fight202'], key: 'FIGHT-202: ORR 35.5% in the FGFR2 fusion/rearrangement cohort.', caution: 'Hyperphosphataemia and ocular toxicity.' }),
        Rx('Futibatinib', 'Irreversible FGFR1–4 inhibitor', 'approved', 'Previously treated cholangiocarcinoma with FGFR2 fusion or other rearrangement.', { settings: ['later-line'] })
      ],
      res: ['Secondary FGFR2 kinase-domain mutations (e.g. gatekeeper V565, molecular brake N550).']
    }],
    other: '', refs: ['fight202']
  },
  {
    id: 'FGFR3_UC', gene: 'FGFR3', title: 'FGFR3 activating mutation / fusion',
    test: (v) => v.gene === 'FGFR3' && (['fusion', 'rearrangement'].includes(v.type) || /^(R248C|S249C|G370C|Y373C)$/.test(v.p)),
    effect: 'Gain of function (constitutive kinase activation)', roles: ['predictive'],
    onco: 'Oncogenic (established hotspots and FGFR3::TACC3 fusion)',
    biology: 'Extracellular-domain cysteine substitutions (R248C, S249C, G370C, Y373C) drive ligand-independent dimerisation; FGFR3::TACC3 fusions activate the kinase constitutively.',
    somgerm: 'Somatic (germline FGFR3 gain-of-function causes skeletal dysplasias, not cancer).',
    contexts: [{
      c: ['urothelial'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from the FGFR inhibitor erdafitinib in locally advanced or metastatic urothelial carcinoma.',
      rx: [Rx('Erdafitinib', 'Pan-FGFR inhibitor', 'approved', 'Locally advanced or metastatic urothelial carcinoma with susceptible FGFR3 alterations, after prior therapy (check the current label wording).', { settings: ['later-line'], refs: ['blc2001'], caution: 'Hyperphosphataemia, ocular and nail toxicity.' })],
      res: []
    }],
    other: '', refs: ['blc2001']
  },
  {
    id: 'KIT_GIST', gene: 'KIT', title: 'KIT mutation',
    test: (v) => v.gene === 'KIT',
    effect: 'Gain of function (constitutive kinase activity)', roles: ['predictive'],
    onco: 'Oncogenic when an activating exon 9/11/13/17 variant in GIST; variants elsewhere need review',
    biology: 'Activating KIT mutations occur in about 70–80% of GIST: exon 11 (juxtamembrane) is most common; exon 9 (extracellular) is next; exons 13 and 17 variants are typically secondary (resistance) lesions.',
    somgerm: 'Mostly somatic; rare germline activating KIT variants cause familial GIST.',
    contexts: [{
      c: ['gist'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts benefit from imatinib; exon 9 may need a higher dose or an alternative agent per guidelines. Secondary exon 13/14/17/18 mutations explain progression.',
      rx: [
        Rx('Imatinib', 'KIT/PDGFRA/ABL inhibitor', 'approved', 'KIT-positive GIST: adjuvant after resection (higher-risk) and unresectable/metastatic.', { settings: ['early', 'first-line'], caution: 'Dose adjustment for exon 9 is a guideline-level decision (not curated).' }),
        Rx('Ripretinib', 'Broad-spectrum KIT/PDGFRA switch-control inhibitor', 'approved', 'Advanced GIST after at least three prior kinase inhibitors including imatinib.', { settings: ['later-line'], refs: ['invictus'] })
      ],
      res: ['Secondary KIT exon 13/14/17/18 mutations — the commonest mechanism of imatinib resistance.']
    }],
    other: 'KIT mutations also occur in melanoma (acral/mucosal) and systemic mastocytosis (D816V) where different agents and evidence apply.',
    refs: ['invictus']
  },
  {
    id: 'PDGFRA_D842V', gene: 'PDGFRA', title: 'PDGFRA D842V',
    test: (v) => v.gene === 'PDGFRA' && v.p === 'D842V',
    effect: 'Gain of function; primary resistance to imatinib', roles: ['predictive', 'resistance'],
    onco: 'Oncogenic (established activating variant in GIST)',
    biology: 'D842V in the activation loop (exon 18) stabilises the active kinase conformation and is intrinsically resistant to imatinib.',
    somgerm: 'Somatic (rare germline PDGFRA variants cause familial GIST).',
    contexts: [{
      c: ['gist'], tier: 'Tier I · Level A', escat: null, oncokb: 'Level 1',
      pred: 'Predicts resistance to imatinib and sensitivity to avapritinib.',
      rx: [
        Rx('Avapritinib', 'KIT/PDGFRA inhibitor', 'approved', 'Unresectable or metastatic GIST harbouring a PDGFRA exon 18 mutation including D842V.', { settings: ['first-line', 'later-line'], refs: ['navigator'], caution: 'Cognitive effects and intracranial haemorrhage have been reported; monitor.' }),
        Rx('Imatinib', 'KIT/PDGFRA/ABL inhibitor', 'unsupported', 'D842V is intrinsically imatinib-resistant.')
      ],
      res: ['Primary resistance to imatinib.']
    }],
    other: '', refs: ['navigator']
  }
];

/* =====================================================================
   5. BIOMARKER RULES  (MSI / dMMR, TMB, HRD, PD-L1)
   ---------------------------------------------------------------------
   These are case-level biomarkers, not single variants. The function
   below turns the biomarker boxes on the Upload page into cards.
   `onlyIn` lists tumour types for which the approval is specific; for a
   different tumour the status automatically becomes "approved in a
   different tumour type".
   ===================================================================== */
function biomarkerFindings(c) {
  const out = [];
  const cancer = c.cancer;
  /** Mark status relative to the patient's tumour when an approval is tumour-specific. */
  const place = (rx) => rx.map((r) => {
    if (r.onlyIn && r.status === 'approved' && cancer && !r.onlyIn.includes(cancer)) {
      return { ...r, status: 'approved-other' };
    }
    return r;
  });

  // ---- MSI-high / dMMR ----
  const msiHigh = c.msi === 'MSI-H' || c.mmr === 'dMMR';
  if (msiHigh) {
    out.push({
      id: 'msi', title: 'MSI-high / mismatch-repair-deficient (dMMR)', state: 'positive',
      text: 'Microsatellite instability reflects loss of DNA mismatch repair. It predicts benefit from immune checkpoint blockade across tumour types and prompts a Lynch syndrome work-up in colorectal and endometrial cancer.',
      rx: place([
        { ...Rx('Pembrolizumab', 'Anti-PD-1 antibody', 'agnostic', 'Unresectable or metastatic MSI-H/dMMR solid tumours that progressed after prior treatment with no satisfactory alternatives; and first-line MSI-H/dMMR colorectal cancer (FDA wording — check).', { settings: ['first-line', 'later-line'], refs: ['kn177', 'kn158_msi', 'le2017'], key: 'KEYNOTE-177 (MSI-H colorectal, first line): median PFS 16.5 vs 8.2 months (HR 0.60) vs chemotherapy.' }) },
        { ...Rx('Dostarlimab', 'Anti-PD-1 antibody', 'agnostic', 'dMMR recurrent or advanced solid tumours after prior treatment with no satisfactory alternatives (FDA, 2021); also dMMR endometrial cancer.', { settings: ['later-line'] }) },
        { ...Rx('Nivolumab ± ipilimumab', 'Anti-PD-1 ± anti-CTLA-4', 'approved', 'MSI-H/dMMR metastatic colorectal cancer (label settings differ; check).', { settings: ['first-line', 'later-line'] }), onlyIn: ['crc'] },
        { ...Rx('Neoadjuvant PD-1 blockade for dMMR rectal cancer', 'Anti-PD-1 antibody', 'verify', 'Single-centre phase 2 (n=12): all patients had a clinical complete response. Practice-changing signal, but check guideline and regulatory status.', { settings: ['early', 'locally-advanced'], refs: ['cercek2022'] }), onlyIn: ['crc'] }
      ]).filter((r) => !r.onlyIn || r.status !== 'verify' || cancer === 'crc'),
      notes: [
        'Colorectal/endometrial: for MLH1 loss, BRAF V600E or MLH1 promoter hypermethylation favours a sporadic origin; otherwise arrange germline MMR testing and genetic counselling (Lynch syndrome).',
        'MSI by NGS, PCR (Bethesda/pentaplex markers) and MMR IHC agree in most cases but not all; discordant results warrant an orthogonal test.'
      ],
      refs: ['kn177', 'kn158_msi', 'le2017', 'bethesda2004']
    });
  } else if (c.msi === 'MSS' || c.mmr === 'pMMR') {
    out.push({
      id: 'msi', title: 'Microsatellite-stable / MMR-proficient', state: 'negative',
      text: 'No MSI-H/dMMR-based immunotherapy indication is triggered. This does not exclude benefit from checkpoint inhibitors approved on other grounds (for example PD-L1 or histology-based indications).',
      rx: [], notes: [], refs: ['le2017']
    });
  }

  // ---- TMB ----
  const tmb = num(c.tmb);
  if (tmb !== null) {
    if (tmb >= 10) {
      out.push({
        id: 'tmb', title: `TMB-high (${tmb} mutations/Mb, threshold ≥10)`, state: 'positive',
        text: 'High tumour mutational burden is a tumour-agnostic biomarker for pembrolizumab in previously treated solid tumours without satisfactory alternatives. TMB is assay-dependent, so check that your value comes from a validated assay.',
        rx: [Rx('Pembrolizumab', 'Anti-PD-1 antibody', 'agnostic', 'Unresectable or metastatic TMB-high (≥10 mutations/Mb) solid tumours, as determined by an FDA-approved test, that progressed after prior treatment with no satisfactory alternatives (FDA wording — check).', { settings: ['later-line'], refs: ['kn158_tmb', 'tmb_harm'], key: 'KEYNOTE-158: objective response 29% in tTMB-high vs 6% in non-TMB-high patients.', caution: 'The ≥10 mut/Mb cut-off was validated on one assay; panel TMB varies with panel size, genes and pipeline.' })],
        notes: ['High TMB frequently co-occurs with MSI-H/dMMR, POLE exonuclease-domain mutations, UV exposure (melanoma) or tobacco (lung). Consider which mechanism applies.'],
        refs: ['kn158_tmb', 'tmb_harm']
      });
    } else {
      out.push({
        id: 'tmb', title: `TMB ${tmb} mutations/Mb (below the 10 threshold)`, state: 'negative',
        text: 'Does not meet the tumour-agnostic TMB-high criterion. It does not exclude benefit from checkpoint inhibitors approved on other grounds.',
        rx: [], notes: [], refs: ['tmb_harm']
      });
    }
  }

  // ---- HRD ----
  if (c.hrd === 'positive') {
    out.push({
      id: 'hrd', title: 'HRD-positive (homologous-recombination deficiency)', state: 'positive',
      text: 'HRD (BRCA1/2 mutation and/or genomic-instability score above the assay cut-off) predicts PARP-inhibitor benefit, best established in ovarian cancer.',
      rx: place([
        { ...Rx('Olaparib + bevacizumab (maintenance)', 'PARP inhibitor + anti-VEGF', 'approved', 'First-line maintenance for HRD-positive (BRCA-mutated or genomic-instability-positive) advanced ovarian cancer responding to platinum.', { settings: ['first-line'], refs: ['paola'] }), onlyIn: ['ovarian'] },
        { ...Rx('Niraparib (maintenance)', 'PARP inhibitor', 'approved', 'First-line maintenance in advanced ovarian cancer responding to platinum (label not restricted by HRD status).', { settings: ['first-line'] }), onlyIn: ['ovarian'] }
      ]),
      notes: [
        'Genomic-instability scores (LOH, telomeric allelic imbalance, large-scale state transitions) are assay-specific; the PAOLA-1 trial used a score of 42 or higher on one commercial assay. Do not apply a score from one assay to another.',
        cancer !== 'ovarian' ? 'Outside ovarian cancer, HRD scores are not curated here as treatment selectors. BRCA1/2 and PALB2 status (see variant results) is the better-established predictor.' : ''
      ].filter(Boolean),
      refs: ['paola', 'alexandrov2013']
    });
  } else if (c.hrd === 'negative') {
    out.push({
      id: 'hrd', title: 'HRD-negative', state: 'negative',
      text: 'Smaller expected PARP-inhibitor benefit in ovarian cancer; some labels (for example niraparib maintenance) are not restricted by HRD status.',
      rx: [], notes: [], refs: ['paola']
    });
  }

  // ---- PD-L1 (recorded only) ----
  if ((c.pdl1 || '').trim()) {
    out.push({
      id: 'pdl1', title: `PD-L1 recorded: ${c.pdl1.trim()}`, state: 'info',
      text: 'PD-L1 is measured by immunohistochemistry, not by NGS. The scoring system (TPS, CPS or immune-cell score), antibody clone and cut-off differ by drug and tumour type, so this prototype records the value but does not evaluate thresholds.',
      rx: [], notes: [], refs: []
    });
  }
  return out;
}

/* =====================================================================
   7. SAMPLE CASES  —  ALL FICTIONAL, FOR DEMONSTRATION ONLY
   ---------------------------------------------------------------------
   These are invented teaching cases. They are not real patients and not
   real reports. They are written to show how the app handles typical
   situations: a clean actionable report, a resistance report, a tumour-
   type mismatch, a probable germline finding, a probable CHIP finding,
   and a haematological report. Deliberately missing fields (for example
   a transcript left blank) are included to show the "missing" flags.
   ===================================================================== */
const SAMPLES = [
  {
    id: 'sampleA', icon: '🫁', tone: 'mint',
    title: 'A · EGFR-mutant lung adenocarcinoma',
    blurb: 'Treatment-naïve stage IV disease. Clean actionable finding, plus a TP53 co-mutation and a CDKN2A deletion.',
    teaches: 'Actionable driver, co-mutation, deletion',
    case: { label: 'SAMPLE A (fictional)', cancer: 'nsclc', histology: 'Lung adenocarcinoma', stage: 'IV', setting: 'first-line', priorTx: 'None', specimen: 'tissue', assay: 'Fictional 500-gene DNA + RNA panel', purity: '60', msi: 'MSS', mmr: 'unknown', tmb: '4', hrd: 'unknown', pdl1: 'TPS 10%', her2: '', germline: 'not-tested', notes: 'Fictional teaching case.' },
    variants: [
      { gene: 'EGFR', variant: 'p.Glu746_Ala750del', hgvsC: 'c.2235_2249del', transcript: 'NM_005228.5', type: 'inframe', vaf: '38', depth: '812', origin: 'somatic', partner: '', cn: '', reported: 'Tier I (as stated on fictional report)' },
      { gene: 'TP53', variant: 'p.Arg273His', hgvsC: 'c.818G>A', transcript: 'NM_000546.6', type: 'missense', vaf: '41', depth: '655', origin: 'unknown', partner: '', cn: '', reported: '' },
      { gene: 'CDKN2A', variant: '', hgvsC: '', transcript: '', type: 'deletion', vaf: '', depth: '', origin: 'somatic', partner: '', cn: '0', reported: '', uncertain: ['vaf'] }
    ]
  },
  {
    id: 'sampleB', icon: '🧪', tone: 'peach',
    title: 'B · Progression on osimertinib (plasma)',
    blurb: 'Liquid biopsy after 18 months of osimertinib: persistent driver, C797S and a MET copy-number call of uncertain quality.',
    teaches: 'Resistance markers, ctDNA limits, uncertain copy number',
    case: { label: 'SAMPLE B (fictional)', cancer: 'nsclc', histology: 'Lung adenocarcinoma', stage: 'IV', setting: 'later-line', priorTx: 'Osimertinib first-line for 18 months', specimen: 'liquid', assay: 'Fictional 70-gene plasma ctDNA panel', purity: '', msi: 'unknown', mmr: 'unknown', tmb: '', hrd: 'unknown', pdl1: '', her2: '', germline: 'not-tested', notes: 'Fictional teaching case. Allelic phase of C797S relative to other EGFR variants not determined.' },
    variants: [
      { gene: 'EGFR', variant: 'p.Glu746_Ala750del', hgvsC: 'c.2235_2249del', transcript: 'NM_005228.5', type: 'inframe', vaf: '11.4', depth: '3120', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'EGFR', variant: 'p.Cys797Ser', hgvsC: 'c.2390G>C', transcript: 'NM_005228.5', type: 'missense', vaf: '3.2', depth: '3050', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'MET', variant: '', hgvsC: '', transcript: '', type: 'amplification', vaf: '', depth: '', origin: 'somatic', partner: '', cn: '9', reported: '', uncertain: ['cn'] }
    ]
  },
  {
    id: 'sampleC', icon: '🧬', tone: 'lav',
    title: 'C · MSI-high, BRAF V600E colorectal cancer',
    blurb: 'Metastatic colorectal cancer. Immunotherapy biomarker plus BRAF V600E, a PIK3CA hotspot whose evidence does NOT transfer from breast cancer, and a gene outside the library.',
    teaches: 'MSI-H, BRAF in CRC, tumour-type mismatch, unknown gene',
    case: { label: 'SAMPLE C (fictional)', cancer: 'crc', histology: 'Colorectal adenocarcinoma, right-sided', stage: 'IV', setting: 'first-line', priorTx: 'None', specimen: 'tissue', assay: 'Fictional 500-gene DNA panel', purity: '70', msi: 'MSI-H', mmr: 'dMMR', tmb: '41', hrd: 'unknown', pdl1: '', her2: '', germline: 'not-tested', notes: 'Fictional teaching case. MLH1 promoter methylation: not reported.' },
    variants: [
      { gene: 'BRAF', variant: 'p.Val600Glu', hgvsC: 'c.1799T>A', transcript: 'NM_004333.6', type: 'missense', vaf: '33', depth: '745', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'PIK3CA', variant: 'p.Glu545Lys', hgvsC: 'c.1633G>A', transcript: 'NM_006218.4', type: 'missense', vaf: '29', depth: '690', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'RNF43', variant: 'p.Gly659ValfsTer41', hgvsC: '', transcript: '', type: 'frameshift', vaf: '36', depth: '702', origin: 'somatic', partner: '', cn: '', reported: '' }
    ]
  },
  {
    id: 'sampleD', icon: '🎗️', tone: 'blue',
    title: 'D · HR+ breast cancer (plasma) — germline and CHIP traps',
    blurb: 'Plasma ctDNA at progression. ESR1 and PIK3CA are actionable; BRCA2 at VAF ≈ 50% looks germline; a low-VAF DNMT3A hotspot looks like clonal haematopoiesis.',
    teaches: 'ESR1, PIK3CA, probable germline, probable CHIP',
    case: { label: 'SAMPLE D (fictional)', cancer: 'breast', histology: 'Invasive ductal carcinoma, ER+/HER2-negative', stage: 'IV', setting: 'later-line', priorTx: 'Aromatase inhibitor + CDK4/6 inhibitor', specimen: 'liquid', assay: 'Fictional 70-gene plasma ctDNA panel (no matched white-cell sequencing)', purity: '', msi: 'unknown', mmr: 'unknown', tmb: '', hrd: 'unknown', pdl1: '', her2: 'IHC 0 (fictional)', germline: 'not-tested', notes: 'Fictional teaching case. No matched white-blood-cell sequencing.' },
    variants: [
      { gene: 'ESR1', variant: 'p.Tyr537Ser', hgvsC: 'c.1610A>C', transcript: 'NM_000125.4', type: 'missense', vaf: '6.1', depth: '2950', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'PIK3CA', variant: 'p.His1047Arg', hgvsC: 'c.3140A>G', transcript: 'NM_006218.4', type: 'missense', vaf: '9.8', depth: '3010', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'BRCA2', variant: 'p.Ser1982ArgfsTer22', hgvsC: 'c.5946del', transcript: 'NM_000059.4', type: 'frameshift', vaf: '49.5', depth: '2880', origin: 'unknown', partner: '', cn: '', reported: 'Reported as "pathogenic" (fictional; no database cited)' },
      { gene: 'DNMT3A', variant: 'p.Arg882His', hgvsC: 'c.2645G>A', transcript: 'NM_022552.5', type: 'missense', vaf: '1.4', depth: '', origin: 'unknown', partner: '', cn: '', reported: '', uncertain: ['depth'] }
    ]
  },
  {
    id: 'sampleE', icon: '🩸', tone: 'peach',
    title: 'E · NPM1-mutated AML with FLT3-ITD and IDH2',
    blurb: 'Newly diagnosed AML from bone marrow. Shows a haematological report, ITD detection caveats, and the IDH1 vs IDH2 drug-matching trap.',
    teaches: 'AML genetics, FLT3-ITD, IDH2, ELN risk statement',
    case: { label: 'SAMPLE E (fictional)', cancer: 'aml', histology: 'Acute myeloid leukaemia', stage: 'Newly diagnosed', setting: 'first-line', priorTx: 'None', specimen: 'marrow', assay: 'Fictional 60-gene myeloid panel + fragment analysis for FLT3-ITD', purity: '', msi: 'unknown', mmr: 'unknown', tmb: '', hrd: 'unknown', pdl1: '', her2: '', germline: 'not-tested', notes: 'Fictional teaching case. FLT3-ITD allelic ratio 0.4 by fragment analysis (laboratory-defined).' },
    variants: [
      { gene: 'NPM1', variant: 'p.Trp288CysfsTer12', hgvsC: 'c.860_863dup', transcript: 'NM_002520.7', type: 'frameshift', vaf: '41', depth: '1204', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'FLT3', variant: 'ITD (≈45 bp)', hgvsC: '', transcript: '', type: 'inframe', vaf: '', depth: '', origin: 'somatic', partner: '', cn: '', reported: '', uncertain: ['vaf'] },
      { gene: 'DNMT3A', variant: 'p.Arg882His', hgvsC: 'c.2645G>A', transcript: 'NM_022552.5', type: 'missense', vaf: '43', depth: '1150', origin: 'somatic', partner: '', cn: '', reported: '' },
      { gene: 'IDH2', variant: 'p.Arg140Gln', hgvsC: 'c.419G>A', transcript: 'NM_002168.4', type: 'missense', vaf: '38', depth: '1320', origin: 'somatic', partner: '', cn: '', reported: '' }
    ]
  },
  {
    id: 'sampleF', icon: '🔀', tone: 'mint',
    title: 'F · ALK-rearranged lung adenocarcinoma',
    blurb: 'A fusion-driven tumour reported by RNA sequencing. Shows how fusions are entered (partner + gene) and interpreted.',
    teaches: 'Fusion entry, ALK TKIs, resistance mutations',
    case: { label: 'SAMPLE F (fictional)', cancer: 'nsclc', histology: 'Lung adenocarcinoma', stage: 'IV', setting: 'first-line', priorTx: 'None', specimen: 'tissue', assay: 'Fictional RNA fusion panel', purity: '50', msi: 'MSS', mmr: 'unknown', tmb: '2', hrd: 'unknown', pdl1: 'TPS <1%', her2: '', germline: 'not-tested', notes: 'Fictional teaching case.' },
    variants: [
      { gene: 'ALK', variant: 'E13;A20 (variant 1)', hgvsC: '', transcript: '', type: 'fusion', vaf: '', depth: '', origin: 'somatic', partner: 'EML4', cn: '', reported: '', uncertain: [] }
    ]
  }
];

/* =====================================================================
   6. MOLECULAR LEARNING CENTRE CONTENT
   ---------------------------------------------------------------------
   Every topic has a SIMPLE explanation first, then an ADVANCED one,
   a memory hook and an "exam trap". Diagrams are drawn in code (SVG),
   so there are no external images to break or to load from the web.
   ===================================================================== */

/** Draw a left-to-right row of labelled boxes joined by arrows. */
function flowSvg(steps, opts = {}) {
  const w = opts.boxW || 130, h = opts.boxH || 54, gap = opts.gap || 34, pad = 12;
  const perRow = opts.perRow || steps.length;
  const rows = Math.ceil(steps.length / perRow);
  const width = pad * 2 + perRow * w + (perRow - 1) * gap;
  const height = pad * 2 + rows * h + (rows - 1) * 46;
  let s = `<svg class="diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(opts.label || 'Process diagram')}">`;
  s += `<defs><marker id="arr${opts.id || 0}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="d-arrow-head"/></marker></defs>`;
  steps.forEach((st, i) => {
    const r = Math.floor(i / perRow), col = i % perRow;
    const x = pad + col * (w + gap), y = pad + r * (h + 46);
    const tone = st.tone || ['lav', 'blue', 'mint', 'peach'][i % 4];
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" class="d-box d-${tone}"/>`;
    const lines = String(st.t).split('\n');
    lines.forEach((ln, k) => {
      const ty = y + h / 2 + (k - (lines.length - 1) / 2) * 15 + 4;
      s += `<text x="${x + w / 2}" y="${ty}" text-anchor="middle" class="d-text${k === 0 ? ' d-bold' : ''}">${esc(ln)}</text>`;
    });
    if (st.sub) s += `<text x="${x + w / 2}" y="${y + h + 16}" text-anchor="middle" class="d-sub">${esc(st.sub)}</text>`;
    if (col < perRow - 1 && i < steps.length - 1) {
      s += `<line x1="${x + w + 4}" y1="${y + h / 2}" x2="${x + w + gap - 6}" y2="${y + h / 2}" class="d-arrow" marker-end="url(#arr${opts.id || 0})"/>`;
    }
  });
  s += '</svg>';
  return s;
}

/** Cartoon: tumour purity vs expected VAF. */
function purityDiagram() {
  let cells = '';
  for (let i = 0; i < 10; i++) {
    const tumour = i < 4;
    const cx = 36 + (i % 5) * 52, cy = 40 + Math.floor(i / 5) * 52;
    cells += `<circle cx="${cx}" cy="${cy}" r="20" class="${tumour ? 'd-lav' : 'd-mint'} d-box"/>`;
    if (tumour) cells += `<circle cx="${cx}" cy="${cy}" r="6" class="d-mut"/>`;
  }
  return `<svg class="diagram" viewBox="0 0 560 130" role="img" aria-label="Ten cells, four tumour cells: tumour purity 40 percent, expected variant allele fraction about 20 percent">
    ${cells}
    <text x="300" y="34" class="d-text d-bold">10 cells in the sample</text>
    <text x="300" y="54" class="d-text">4 tumour cells (lavender) carry the variant on 1 of 2 copies</text>
    <text x="300" y="74" class="d-text">Tumour purity = 4 / 10 = 40 %</text>
    <text x="300" y="94" class="d-text">Mutant copies = 4 of 20 total copies</text>
    <text x="300" y="116" class="d-text d-bold">Expected VAF ≈ 20 %  (= purity ÷ 2)</text>
  </svg>`;
}

const DIAGRAMS = {
  dogma: () => flowSvg([
    { t: 'DNA\n(genes)', sub: 'mutations, copy number', tone: 'lav' },
    { t: 'RNA\n(transcript)', sub: 'splicing, fusions', tone: 'blue' },
    { t: 'Protein\n(function)', sub: 'kinase, repair, brake', tone: 'mint' }
  ], { id: 1, gap: 80, label: 'Central dogma: DNA to RNA to protein' }),
  workflow: () => flowSvg([
    { t: 'Sample\ntissue · plasma · marrow', tone: 'lav' },
    { t: 'Extract\nDNA / RNA', tone: 'blue' },
    { t: 'Library prep\ncapture or amplicon', tone: 'mint' },
    { t: 'Sequence\nmillions of reads', tone: 'peach' },
    { t: 'Align to\nreference genome', tone: 'peach' },
    { t: 'Call variants\nSNV · indel · CNA · fusion', tone: 'mint' },
    { t: 'Annotate\n+ filter', tone: 'blue' },
    { t: 'Interpret\n+ report', tone: 'lav' }
  ], { id: 2, perRow: 4, boxW: 150, label: 'NGS workflow from sample to report' }),
  purity: purityDiagram
};

const TOPICS = [
  {
    id: 'dogma', cat: 'Foundations', title: 'DNA, RNA, genes and cancer biology',
    eponyms: ['Knudson two-hit hypothesis', 'Hanahan–Weinberg hallmarks'], diagram: 'dogma',
    simple: `<p>DNA is the instruction manual of a cell. A <strong>gene</strong> is one chapter. The cell copies a gene into <strong>RNA</strong> (a working copy) and then builds a <strong>protein</strong> (the machine that does the work).</p>
      <p>Cancer is a disease of damaged genes. Three groups matter most:</p>
      <ul><li><strong>Oncogenes</strong> – accelerators stuck "on" (e.g. EGFR, KRAS, BRAF).</li>
      <li><strong>Tumour suppressor genes</strong> – brakes that stop working (e.g. TP53, RB1, PTEN).</li>
      <li><strong>DNA-repair genes</strong> – mechanics who stop fixing damage (e.g. BRCA1/2, MLH1), so mutations pile up.</li></ul>
      <p><strong>Somatic</strong> changes arise in the tumour only; <strong>germline</strong> changes are inherited and present in every cell.</p>`,
    advanced: `<p><strong>Activation mechanisms.</strong> Oncogenes are activated by point mutation (BRAF V600E), amplification (ERBB2), or translocation/fusion (BCR::ABL1, EML4::ALK). Usually one altered allele is enough (dominant at cell level).</p>
      <p><strong>Tumour suppressors</strong> classically need two hits (<em>Knudson, 1971</em>, from retinoblastoma): a germline first hit followed by a somatic second hit (mutation, loss of heterozygosity, or promoter methylation) in hereditary cancer; two somatic hits in sporadic cancer. Exceptions: haploinsufficiency, and dominant-negative TP53 missense alleles that poison the p53 tetramer.</p>
      <p><strong>Driver vs passenger.</strong> Drivers give a selective advantage; most mutations are passengers. Recurrence at hotspots, functional data and clonal prevalence help separate them. Mutational processes (ageing, UV, tobacco, APOBEC, HRD, mismatch-repair loss) leave characteristic <em>signatures</em> (Alexandrov 2013).</p>
      <p><strong>Hallmarks of cancer</strong> (Hanahan &amp; Weinberg, 2011) provide the conceptual frame: sustained proliferative signalling, evasion of growth suppressors, resisting cell death, replicative immortality, angiogenesis, invasion/metastasis, plus genome instability and tumour-promoting inflammation as enabling characteristics.</p>`,
    hook: 'Oncogene = stuck accelerator (one hit). Tumour suppressor = broken brake (two hits). Repair gene = absent mechanic (mutations accumulate).',
    trap: 'TP53 is a tumour suppressor, yet many missense hotspots act dominant-negatively, so a single altered allele can already matter.',
    refs: ['knudson1971', 'hallmarks2011', 'alexandrov2013']
  },
  {
    id: 'ngs', cat: 'Foundations', title: 'Fundamentals of NGS',
    eponyms: ['Sanger sequencing'], diagram: 'workflow',
    simple: `<p>Next-generation sequencing (NGS) reads millions of tiny DNA fragments at the same time. Software lines each fragment up against the human reference genome and lists the places where the tumour differs.</p>
      <ul><li><strong>Targeted panel</strong> – a few dozen to hundreds of cancer genes, deep and affordable (most clinical tests).</li>
      <li><strong>Whole-exome (WES)</strong> – all protein-coding genes.</li>
      <li><strong>Whole-genome (WGS)</strong> – everything, including non-coding regions and structural changes.</li></ul>
      <p>The result is only as good as the sample, the panel design and the analysis pipeline.</p>`,
    advanced: `<p><strong>Library preparation.</strong> Hybrid capture (probes pull down target regions; good uniformity, detects larger indels and copy number) versus amplicon (PCR-based; works with low input; prone to amplification bias and allele dropout). Short-read sequencing-by-synthesis (e.g. Illumina) is dominant; long-read platforms help with phasing and structural variants.</p>
      <p><strong>Bioinformatics.</strong> Alignment → duplicate marking → variant calling (separate callers for SNVs/indels, copy number, structural variants/fusions) → annotation (transcript, consequence, population frequency such as gnomAD, databases) → filtering → classification. Always know the <strong>genome build</strong> (GRCh37/hg19 vs GRCh38) and <strong>transcript version</strong>; coordinates and some HGVS names differ between them.</p>
      <p><strong>Validation.</strong> Clinical assays report analytic sensitivity, specificity, limit of detection (LOD) and minimum tumour content per variant class. A "negative" is valid only for the regions and variant types the assay was validated to detect.</p>
      <p><strong>Sanger sequencing</strong> (Frederick Sanger) is the older chain-termination method; it remains an orthogonal confirmation tool but has a relatively high LOD (often cited around 15–20% VAF), far less sensitive than NGS.</p>`,
    hook: 'Sample → Extract → Library → Sequence → Align → Call → Annotate → Interpret. "Garbage in, garbage out" applies at step 1.',
    trap: 'Absence of a variant in a report means "not detected by this assay in these regions", not "absent from the tumour".',
    refs: ['msk_impact', 'esmo_ngs2024']
  },
  {
    id: 'dna-rna', cat: 'Methods', title: 'DNA versus RNA sequencing',
    eponyms: [],
    simple: `<p><strong>DNA sequencing</strong> reads the genes themselves and is good for point mutations and copy number. <strong>RNA sequencing</strong> reads the gene copies that are actually being used, which makes it better at spotting <strong>fusions</strong> and <strong>splicing changes</strong>.</p>
      <p>Some fusions (for example involving NTRK, ROS1 and NRG1) are easy to miss on DNA panels. If a lung adenocarcinoma has no driver on a DNA panel, RNA testing is worth considering.</p>`,
    advanced: `<p><strong>Why DNA misses fusions.</strong> Breakpoints often lie in very large introns or repetitive regions that targeted DNA panels do not tile, so a rearrangement can be present but undetected. RNA assays read the exon–exon junction of the expressed fusion transcript, regardless of the intronic breakpoint, and also report whether the fusion is in-frame and expressed.</p>
      <p><strong>Splice alterations.</strong> MET exon 14 skipping arises from intronic or splice-site variants of many shapes; RNA directly shows the skipped transcript.</p>
      <p><strong>Limits of RNA.</strong> RNA degrades in FFPE, needs adequate tumour content and expression, and cannot show copy number directly. Many laboratories therefore combine DNA + RNA panels. Expression-based signatures (e.g. gene-expression profiles) are separate from the variant-calling use described here.</p>`,
    hook: 'DNA = the library; RNA = the books actually being read. Fusions and splice changes show up in the "reading".',
    trap: 'A negative DNA-only panel does not exclude NTRK, ROS1, RET or NRG1 fusions or MET exon 14 skipping.',
    refs: ['esmo_ngs2024']
  },
  {
    id: 'liquid', cat: 'Methods', title: 'Tissue versus liquid biopsy',
    eponyms: [],
    simple: `<p>A <strong>liquid biopsy</strong> looks for tumour DNA (ctDNA) floating in blood plasma. It is quick and avoids a biopsy, but only some tumours shed enough DNA.</p>
      <ul><li><strong>Positive result</strong> – usually reliable and actionable.</li>
      <li><strong>Negative result</strong> – may be a false negative; if a tumour sheds little DNA, nothing is seen. Test the tissue.</li></ul>
      <p>Blood also contains DNA from healthy blood cells, which can look like a tumour mutation (see CHIP).</p>`,
    advanced: `<p>ESMO ctDNA recommendations state that validated, sufficiently sensitive plasma assays can identify actionable mutations in advanced cancer, but <strong>tissue remains preferred</strong> for many patients because plasma is less reliable for <strong>fusions and copy-number changes</strong>; reflex tumour testing is advised after a non-informative ctDNA result because of false negatives.</p>
      <p><strong>Determinants of ctDNA yield:</strong> tumour burden and site (bone/liver vs brain/lung-only), proliferation rate, recent therapy, and assay depth with error-suppression chemistry (unique molecular identifiers). Circulating tumour fraction below the assay LOD gives false negatives.</p>
      <p><strong>Interpretation traps.</strong> (1) CHIP variants in DNMT3A, TET2, ASXL1, TP53, PPM1D, CHEK2 and others; high-intensity sequencing found that over half of plasma variants in patients with cancer had features of clonal haematopoiesis (Razavi 2019). Matched white-cell sequencing resolves this. (2) VAF in plasma reflects tumour fraction, not clonality in the same way as in tissue. (3) Timing: baseline versus progression samples answer different questions.</p>`,
    hook: 'Plasma positive = act (after CHIP check). Plasma negative = tissue next.',
    trap: 'A negative ctDNA result is not proof that the driver is absent; and a ctDNA TP53 variant is not necessarily from the tumour.',
    refs: ['esmo_ctdna2022', 'razavi2019']
  },
  {
    id: 'vaf', cat: 'Methods', title: 'VAF, sequencing depth and coverage',
    eponyms: [], tool: 'depth',
    simple: `<p><strong>VAF</strong> (variant allele fraction) = the share of reads that carry the change. If 40 of 100 reads at a position show a mutation, VAF = 40%.</p>
      <p><strong>Depth</strong> = how many reads cover a position (for example 500×). <strong>Coverage</strong> = how much of the target region is read well enough. Higher depth lets us trust low-VAF variants.</p>
      <p>Rule of thumb: for a clonal, heterozygous mutation in a pure tumour, VAF is about 50%. Impure samples give lower numbers.</p>`,
    advanced: `<p><strong>VAF</strong> = alternate reads ÷ total reads at the locus. It depends on tumour purity, copy number at the locus, the fraction of tumour cells carrying the variant (clonality) and, in plasma, ctDNA fraction.</p>
      <p><strong>Depth versus breadth.</strong> Mean depth hides uniformity: report the fraction of target bases above a minimum depth (e.g. ≥100×). With unique molecular identifiers (UMIs), "raw" reads are collapsed into unique molecules, and the effective depth for error-corrected calling is the unique-molecule depth.</p>
      <p><strong>Detection probability.</strong> Seeing at least <em>k</em> mutant reads at depth <em>D</em> with true VAF <em>f</em> follows a binomial distribution. Try the calculator below: a 2% variant at 500× has an expected 10 mutant reads, yet a fixed rule of "≥5 reads" still misses it in some runs.</p>
      <p><strong>Clinical use of VAF.</strong> Near 50% or near 100% in a tumour-only test may signal a germline variant; a variant at far lower VAF than the dominant driver is likely subclonal or artefactual; falling plasma VAF tracks response.</p>`,
    hook: 'VAF = mutant reads ÷ all reads. 50 / 100 = think germline. Tiny VAF = think artefact, subclone or CHIP.',
    trap: 'High depth does not make a low-VAF FFPE-artefact (e.g. C>T deamination) real; and a low VAF is not automatically unimportant.',
    refs: ['msk_impact', 'mandelker2019']
  },
  {
    id: 'purity', cat: 'Methods', title: 'Tumour purity and assay limitations',
    eponyms: [], tool: 'purity', diagram: 'purity',
    simple: `<p>A biopsy contains tumour cells <em>and</em> normal cells (immune cells, fibroblasts, normal tissue). <strong>Tumour purity</strong> is the percentage of cells that are cancer.</p>
      <p>If purity is low, tumour mutations are diluted and VAF falls: a clonal heterozygous mutation in a 40%-pure sample appears at roughly 20%. Very low purity can cause false negatives, so the report should state tumour content and the assay's minimum.</p>`,
    advanced: `<p>For a locus with total copy number <em>CN</em> and <em>m</em> mutated copies per tumour cell, at purity <em>p</em>:</p>
      <p><code>expected VAF = (p × m) ÷ (p × CN + 2 × (1 − p))</code></p>
      <p>Heterozygous clonal SNV in a diploid region: m = 1, CN = 2 → VAF = p ÷ 2. Loss of heterozygosity with duplication of the mutant allele (m = 2, CN = 2) doubles this, so a VAF well above p ÷ 2 can indicate allelic imbalance, not a different clone. A VAF below p ÷ 2 suggests a subclonal variant.</p>
      <p><strong>Pre-analytic limits.</strong> Necrosis and inflammation lower purity; decalcification (bone biopsies) degrades DNA; FFPE fixation induces cytosine-deamination artefacts (C&gt;T / G&gt;A, usually low VAF) and RNA fragmentation; small biopsies limit input. <strong>Copy-number and LOH calls need purity- and ploidy-aware algorithms.</strong> Homozygous deletions are hard to call in low-purity samples because normal cells contribute retained copies.</p>`,
    hook: 'Clonal heterozygous SNV: VAF ≈ purity ÷ 2.',
    trap: 'A "missing" driver in a low-purity sample may be a false negative. Always read the tumour-content statement.',
    refs: ['msk_impact']
  },
  {
    id: 'signatures', cat: 'Biomarkers', title: 'TMB, MSI, HRD and genomic signatures',
    eponyms: ['Bethesda panel', 'Amsterdam II criteria'],
    simple: `<ul><li><strong>TMB</strong> (tumour mutational burden) = number of mutations per megabase. High TMB makes tumours look "foreign" to the immune system.</li>
      <li><strong>MSI-high / dMMR</strong> = the cell cannot correct copying errors (mismatch repair). Strong marker for immunotherapy and for Lynch syndrome.</li>
      <li><strong>HRD</strong> = the cell cannot repair double-strand breaks properly (homologous recombination). Suggests PARP-inhibitor sensitivity.</li></ul>`,
    advanced: `<p><strong>TMB.</strong> Counted as mutations/Mb of coding sequence. FDA's tumour-agnostic pembrolizumab indication uses ≥10 mutations/Mb on an approved assay (KEYNOTE-158: objective response 29% in TMB-high vs 6% in non-TMB-high). Panel TMB varies with panel size, genes included, germline filtering and pipeline; the Friends of Cancer Research harmonisation project showed that variability increases at higher TMB. Hypermutation arises from MMR deficiency, POLE exonuclease-domain mutations, UV and tobacco.</p>
      <p><strong>MSI / dMMR.</strong> Three methods: MMR immunohistochemistry (MLH1, PMS2, MSH2, MSH6), PCR of microsatellite markers (original <em>Bethesda panel</em>: BAT25, BAT26, D5S346, D2S123, D17S250; many labs use a mononucleotide pentaplex) and NGS. In Lynch syndrome triage: MLH1 loss + MLH1 promoter hypermethylation or BRAF V600E → sporadic; otherwise germline testing. <em>Amsterdam II criteria</em> and <em>revised Bethesda guidelines</em> are clinical tools for suspecting Lynch syndrome.</p>
      <p><strong>HRD.</strong> Defined by pathogenic BRCA1/2 (or other HR gene) alteration and/or a genomic "scar" score (LOH, telomeric allelic imbalance, large-scale state transitions). PAOLA-1 used a score threshold of 42 on one commercial assay; scores are not interchangeable between assays.</p>
      <p><strong>Mutational signatures</strong> (COSMIC SBS): SBS1 clock-like ageing; SBS4 tobacco; SBS7 UV; SBS2/13 APOBEC; SBS3 HRD; SBS6/15/21/26/44 mismatch-repair deficiency; SBS10 POLE.</p>`,
    hook: 'T-M-B counts mutations; M-S-I is copy-error blindness; H-R-D is break-repair failure. Signatures: SBS7 = Sun (UV), SBS4 = 4 cigarettes (tobacco).',
    trap: 'TMB ≥10 is not a universal cut-off for every assay or every tumour; and HRD scores from different assays cannot be swapped.',
    refs: ['kn158_tmb', 'tmb_harm', 'le2017', 'bethesda2004', 'paola', 'alexandrov2013']
  },
  {
    id: 'cna-fusions', cat: 'Biomarkers', title: 'Copy-number alterations and gene fusions',
    eponyms: ['Philadelphia chromosome (Nowell & Hungerford; t(9;22) identified by Rowley)'],
    simple: `<p><strong>Copy-number alteration (CNA):</strong> the tumour has too many copies of a gene (<em>amplification</em>, e.g. ERBB2/HER2) or has lost both copies (<em>homozygous deletion</em>, e.g. CDKN2A).</p>
      <p><strong>Gene fusion:</strong> two genes are glued together by a chromosome rearrangement, creating a new, always-active protein (e.g. EML4::ALK, BCR::ABL1).</p>`,
    advanced: `<p><strong>CNAs.</strong> "Amplification" has no universal numeric threshold; it depends on assay, purity, ploidy and gene (focal high-level amplification versus arm-level gain). Reports should give copy number and the method. HER2 positivity for treatment is defined by IHC/ISH (ASCO/CAP); an NGS call should be reconciled with those. Homozygous deletion calls need adequate purity; plasma copy-number calls are less sensitive than tissue.</p>
      <p><strong>Fusions.</strong> Most clinically relevant are <em>kinase fusions</em> that retain the kinase domain and are in-frame (ALK, ROS1, RET, NTRK1/2/3, FGFR2/3, NRG1). Others are transcription-factor fusions (EWSR1::FLI1, TMPRSS2::ERG, PML::RARA). Check: partner, breakpoints, reading frame, preserved functional domain, and the supporting reads/junction count.</p>
      <p><strong>Philadelphia chromosome.</strong> Described by Nowell and Hungerford (1960) in CML; Rowley (1973) identified it as t(9;22)(q34;q11), creating <strong>BCR::ABL1</strong>. p210 is typical of CML; p190 of Ph-positive ALL. Imatinib targets the fusion kinase; the T315I gatekeeper variant causes resistance to older TKIs.</p>`,
    hook: 'Amplify = too many copies; Delete = both copies gone; Fuse = two genes glued.',
    trap: 'Fusions are written 5′ partner::3′ partner (EML4::ALK). A fusion that does not keep the kinase domain, or is out of frame, is not necessarily actionable.',
    refs: ['esmo_ctdna2022']
  },
  {
    id: 'chip', cat: 'Biomarkers', title: 'Clonal haematopoiesis (CHIP)',
    eponyms: [],
    simple: `<p>As we age, some blood stem cells acquire mutations and expand into a clone. This is <strong>CHIP</strong> (clonal haematopoiesis of indeterminate potential). It is common, usually harmless in the short term, and increases with age.</p>
      <p>Why it matters for NGS: in a blood or plasma test, these mutations can be mistaken for tumour mutations. Typical CHIP genes: <strong>DNMT3A, TET2, ASXL1</strong>.</p>`,
    advanced: `<p><strong>Definition (Steensma 2015).</strong> A somatic mutation in a leukaemia-associated gene in blood or marrow cells at VAF ≥2% in a person without a haematological malignancy. Prevalence rises with age (Jaiswal/Genovese 2014). It is associated with a higher risk of haematological malignancy and of cardiovascular disease.</p>
      <p><strong>Therapy-related CHIP.</strong> Cytotoxic chemotherapy, radiotherapy and PARP inhibitors select clones in DNA-damage-response genes (PPM1D, TP53, CHEK2, ATM) (Coombs 2017).</p>
      <p><strong>Pitfalls.</strong> Plasma TP53, ATM, CHEK2, BRCA1/2, KRAS, JAK2 or splicing-factor variants at low VAF may be CHIP. Resolve by sequencing matched white blood cells, by checking whether the variant is present in tissue, and by considering gene, hotspot and VAF. CHIP calls in a tumour-informed or MRD assay can create false positives.</p>`,
    hook: 'DTA = DNMT3A, TET2, ASXL1: the "usual suspects" in blood.',
    trap: 'A TP53 or ATM variant at low VAF in plasma may belong to a blood clone, not the tumour.',
    refs: ['jaiswal2014', 'steensma2015', 'coombs2017', 'razavi2019']
  },
  {
    id: 'germline', cat: 'Biomarkers', title: 'Germline implications of tumour sequencing',
    eponyms: ['Lynch syndrome', 'Li–Fraumeni syndrome', 'Cowden syndrome', 'Peutz–Jeghers syndrome', 'Chompret criteria'], tool: 'syndromes',
    simple: `<p>Tumour sequencing sometimes finds a variant that was <strong>inherited</strong>. That matters for the patient (some drugs are labelled for germline variants) and for relatives (cascade testing).</p>
      <p>Clues: the gene is a known hereditary-cancer gene (BRCA1/2, MLH1, TP53…), the VAF is near 50% (or near 100%), or the family/clinical history fits. A tumour-only result can <em>suggest</em> but cannot <em>prove</em> a germline variant: confirm on a non-tumour sample with consent and genetic counselling.</p>`,
    advanced: `<p>The ESMO Precision Medicine Working Group recommends that tumour-only reports flag variants with a high prior probability of being germline and that laboratories and clinicians have a pathway for confirmation. Features that raise suspicion: pathogenic/likely pathogenic variant in a high-penetrance gene, VAF ≈50% (heterozygous) or ≈100% with LOH, the same variant across multiple specimens, and a compatible phenotype.</p>
      <p><strong>Pathogenicity vs oncogenicity.</strong> A germline variant is judged by ACMG/AMP criteria (pathogenic → benign); a somatic variant by oncogenicity criteria (ClinGen/CGC/VICC). The same gene can need both lenses (e.g. BRCA2).</p>
      <p><strong>Treatment links.</strong> Several FDA labels are germline-specific (e.g. olaparib or talazoparib in HER2-negative breast cancer; olaparib maintenance in pancreatic cancer), others accept germline or somatic (e.g. olaparib maintenance in BRCA-mutated ovarian cancer).</p>
      <p><strong>Reverse problem.</strong> Panels without germline filtering may miss germline variants that the laboratory classifies as "polymorphisms"; large rearrangements and pseudogene-affected genes (PMS2) need specific methods.</p>`,
    hook: '50 or 100? Ask: "Is this the family\'s?"',
    trap: 'Do not tell a patient that a tumour-only finding is hereditary (or not) without confirmatory germline testing and counselling.',
    refs: ['mandelker2019', 'acmg2015', 'vicc2022', 'bethesda2004']
  },
  {
    id: 'classification', cat: 'Interpretation', title: 'Pathogenic ≠ oncogenic ≠ actionable',
    eponyms: [], tool: 'tiers',
    simple: `<p>Three different questions are often confused:</p>
      <ol><li><strong>Pathogenic?</strong> Does this <em>inherited</em> variant cause disease?</li>
      <li><strong>Oncogenic?</strong> Is this <em>tumour</em> variant a cancer driver?</li>
      <li><strong>Actionable?</strong> Does it change <em>treatment</em> in this tumour type and setting?</li></ol>
      <p>A variant can answer "yes" to the second but "no" to the third (TP53 R175H is a driver, but no TP53-directed drug is approved). Each question has its own scale, and they should not be mixed.</p>`,
    advanced: `<table class="mini"><thead><tr><th>Question</th><th>Framework</th><th>Output</th><th>Applies to</th></tr></thead><tbody>
      <tr><td>Is the inherited variant disease-causing?</td><td>ACMG/AMP 2015 (Richards)</td><td>Pathogenic · Likely pathogenic · VUS · Likely benign · Benign</td><td>Germline</td></tr>
      <tr><td>Is the somatic variant oncogenic?</td><td>ClinGen/CGC/VICC 2022 (Horak)</td><td>Oncogenic · Likely oncogenic · VUS · Likely benign · Benign</td><td>Somatic</td></tr>
      <tr><td>Does it matter clinically?</td><td>AMP/ASCO/CAP 2017 (Li)</td><td>Tier I (strong) · II (potential) · III (unknown) · IV (benign/likely benign); evidence Levels A–D</td><td>Somatic, tumour-specific</td></tr>
      <tr><td>How ready is it as a drug target?</td><td>ESMO ESCAT 2018 (Mateo)</td><td>Tier I, II, III, IV, V, X</td><td>Tumour-specific</td></tr>
      <tr><td>Evidence level for a therapy?</td><td>OncoKB</td><td>Levels 1, 2, 3A, 3B, 4, R1, R2 (versioned; check the live site)</td><td>Tumour-specific</td></tr></tbody></table>
      <p><strong>AMP/ASCO/CAP evidence levels.</strong> A: FDA-approved therapy or included in professional guidelines for that tumour type; B: well-powered studies with expert consensus; C: FDA-approved in a different tumour type, or investigational with multiple small studies; D: preclinical or case reports.</p>
      <p><strong>ESCAT (primary definitions).</strong> I: ready for routine clinical decisions; II: investigational, likely to define a benefiting population but more data needed; III: clinical benefit shown in other tumour types or for similar targets; IV: preclinical evidence; V: supports co-targeting; X: lack of evidence. Tier I is subdivided A–C by strength and type of trial evidence (I-C = benefit demonstrated across tumour types, e.g. NTRK fusions).</p>
      <p><strong>ClinVar review status.</strong> 0 stars: no assertion criteria/classification; 1 star: criteria provided, single submitter or conflicting; 2 stars: criteria provided, multiple submitters, no conflict; 3 stars: reviewed by expert panel; 4 stars: practice guideline. ClinVar is largely germline-oriented; always read the classification <em>type</em>.</p>
      <p><strong>OncoKB (as published; verify live).</strong> Level 1: FDA-recognised biomarker predictive of response to an FDA-approved drug in that indication; Level 2: standard-care biomarker; Level 3A/3B: compelling clinical evidence in that or another indication; Level 4: compelling biological evidence; R1/R2: resistance to a standard-care therapy.</p>`,
    hook: 'P-O-A: Pathogenic (inherited) · Oncogenic (driver) · Actionable (treatable).',
    trap: 'AMP Tier IV means benign, not "weakest evidence". ESCAT and OncoKB tiers are tumour-type-specific: the same variant can be Tier I in one cancer and Tier III in another.',
    refs: ['acmg2015', 'vicc2022', 'amp2017', 'escat2018', 'oncokb_paper', 'clinvar_paper']
  },
  {
    id: 'hgvs', cat: 'Interpretation', title: 'Reading variant names (HGVS)',
    eponyms: ['HGVS nomenclature'], tool: 'hgvs',
    simple: `<p>A variant name says <strong>where</strong> and <strong>what</strong>:</p>
      <ul><li><code>c.2573T&gt;G</code> – DNA (coding) change: position 2573, T became G.</li>
      <li><code>p.Leu858Arg</code> (or <code>p.L858R</code>) – protein change: leucine 858 became arginine.</li>
      <li><code>NM_005228.5</code> – the reference transcript, which must be stated.</li></ul>
      <p>Always make sure the report names the transcript, because numbering can change between transcripts.</p>`,
    advanced: `<p>Prefixes: <code>c.</code> coding DNA (from the A of ATG = c.1), <code>g.</code> genomic, <code>n.</code> non-coding RNA, <code>r.</code> RNA, <code>p.</code> protein, <code>m.</code> mitochondrial. Protein: 3-letter codes are preferred (<code>p.Gly12Cys</code>); <code>*</code> or <code>Ter</code> = stop; <code>fs</code> = frameshift (<code>p.Ser1982ArgfsTer22</code>); <code>del</code>, <code>dup</code>, <code>ins</code>, <code>delins</code>; <code>ext</code> = extension. Parentheses <code>p.(Leu858Arg)</code> indicate a predicted, not experimentally confirmed, consequence.</p>
      <p>Intronic/splice positions use offsets: <code>c.2188-2A&gt;G</code> (acceptor, 2 bases before exon) and <code>c.2187+1G&gt;A</code> (donor). Canonical ±1/±2 positions usually abolish splicing; effect should still be confirmed.</p>
      <p><strong>Examples:</strong> EGFR <code>NM_005228.5:c.2573T&gt;G p.(Leu858Arg)</code>; BRAF <code>c.1799T&gt;A p.Val600Glu</code>; KRAS <code>c.34G&gt;T p.Gly12Cys</code>; BRCA2 <code>c.5946del</code> (legacy name "6174delT").</p>
      <p><strong>Pitfalls.</strong> Legacy names, different transcript versions and genome builds, and 1-letter vs 3-letter codes are the usual causes of mismatches between reports and databases.</p>`,
    hook: 'c. = cDNA, p. = protein. No transcript, no trust.',
    trap: 'The same variant can carry different c. numbers in different transcripts; legacy names (e.g. 6174delT) may not match HGVS names.',
    refs: ['hgvs2016', 'hgvs_site']
  },
  {
    id: 'pitfalls', cat: 'Interpretation', title: 'Common NGS interpretation pitfalls',
    eponyms: [],
    simple: `<ul><li>Treating a <strong>VUS</strong> as actionable.</li>
      <li>Reading "not detected" as "not present" – check that the gene and variant type were covered.</li>
      <li>Applying evidence from <strong>another tumour type</strong> (e.g. breast PIK3CA data to colorectal cancer).</li>
      <li>Overlooking <strong>germline</strong> and <strong>CHIP</strong> possibilities.</li>
      <li>Ignoring low <strong>tumour purity</strong> or poor quality metrics.</li>
      <li>Forgetting that <strong>databases and drug approvals change</strong>.</li></ul>`,
    advanced: `<ol><li><strong>Wrong transcript/genome build</strong> → wrong HGVS and database mismatches.</li>
      <li><strong>Variant class not assayed</strong> (fusions on a DNA-only panel; copy number in plasma).</li>
      <li><strong>Confusing oncogenic with actionable</strong>, or tumour-agnostic with tumour-specific evidence.</li>
      <li><strong>Setting mismatch</strong>: evidence from first-line metastatic trials is not automatically valid for adjuvant or later-line use, and the reverse.</li>
      <li><strong>Co-alterations</strong>: BRAF V600E in colorectal cancer behaves differently from melanoma; RAS mutation negates anti-EGFR therapy; KRAS G12C needs an anti-EGFR partner in colorectal cancer.</li>
      <li><strong>Resistance mechanisms</strong> mistaken for drivers (T790M, C797S, ESR1 LBD mutations).</li>
      <li><strong>FFPE artefacts</strong> and low-level calls reported as true variants.</li>
      <li><strong>TMB/MSI/HRD cut-offs</strong> transferred between assays.</li>
      <li><strong>Reporting frameworks mixed</strong> (using ACMG terms for a somatic variant).</li>
      <li><strong>Stale knowledge</strong>: record the version and date of every database you consult.</li></ol>`,
    hook: 'Ask five things: Which tumour? Which setting? Which assay? Which origin (somatic / germline / CHIP)? Which evidence level, and when was it checked?',
    trap: 'Never rely on one source. Cross-check ClinVar, ClinGen, CIViC, OncoKB and the FDA label, and record dates.',
    refs: ['amp2017', 'esmo_ngs2024', 'mandelker2019']
  }
];

/* ---------------------------------------------------------------------
   Flash-cards: 30 high-yield points with memory hacks
   --------------------------------------------------------------------- */
const FLASHCARDS = [
  { cat: 'Basics', q: 'What is VAF and what is "normal" for a clonal heterozygous mutation in a pure tumour?', a: 'VAF = mutant reads ÷ total reads. About 50% in a diploid region of a 100%-pure tumour; in general ≈ purity ÷ 2.', hack: 'VAF ≈ purity ÷ 2' },
  { cat: 'Basics', q: 'Which VAF values should make you consider a germline variant on a tumour-only report?', a: 'About 50% (heterozygous) or about 100% (homozygous / LOH), especially in a hereditary-cancer gene (BRCA1/2, MLH1, TP53…). Confirm on a non-tumour sample.', hack: '50 or 100 → think germline' },
  { cat: 'Classification', q: 'What are the three different questions behind classification?', a: 'Pathogenic (germline disease-causing; ACMG/AMP 2015), Oncogenic (somatic driver; ClinGen/CGC/VICC 2022), Actionable (changes treatment; AMP/ASCO/CAP, ESCAT, OncoKB).', hack: 'P-O-A' },
  { cat: 'Classification', q: 'AMP/ASCO/CAP 2017 tiers?', a: 'Tier I strong · II potential · III unknown · IV benign/likely benign. Evidence levels: A FDA/guideline in that tumour; B well-powered studies + consensus; C other-tumour approval or investigational; D preclinical/case reports.', hack: 'I strong, II potential, III unknown, IV benign' },
  { cat: 'Classification', q: 'ESCAT tiers (Mateo 2018)?', a: 'I ready for routine use · II investigational, likely benefit · III benefit in other tumour types/similar targets · IV preclinical · V co-targeting · X no evidence. I-C = across tumour types (e.g. NTRK).', hack: 'Roman numerals climb from "ready" to "none"' },
  { cat: 'Classification', q: 'ClinVar review status stars?', a: '0 = no criteria/classification · 1 = criteria, single submitter or conflicting · 2 = multiple submitters, no conflict · 3 = expert panel · 4 = practice guideline.', hack: '3 = panel, 4 = guideline' },
  { cat: 'Classification', q: 'Which eponymous trial/paper defined the concept of two hits for tumour suppressors?', a: 'Knudson (1971), retinoblastoma. Germline first hit + somatic second hit in hereditary cancer.', hack: 'Knudson = two hits' },
  { cat: 'Biology', q: 'Oncogene versus tumour suppressor?', a: 'Oncogene: gain of function, one allele is enough (accelerator). Tumour suppressor: loss of function, usually both alleles (brake). TP53 missense can be dominant-negative.', hack: 'Accelerator vs brake' },
  { cat: 'Lung', q: 'Classic EGFR sensitising mutations and best first-line options?', a: 'Exon 19 deletion and L858R (about 80–90% of EGFR mutations). Osimertinib (FLAURA: PFS 18.9 vs 10.2 mo), osimertinib + chemotherapy (FLAURA2), amivantamab + lazertinib (MARIPOSA).', hack: '19del + L858R → "-tinib"' },
  { cat: 'Lung', q: 'EGFR T790M vs C797S?', a: 'T790M = gatekeeper; acquired resistance to 1st/2nd-gen TKIs (~half), osimertinib works. C797S = resistance to osimertinib (covalent-binding site lost); cis/trans with T790M matters.', hack: 'T790M → osimertinib; C797S → trouble' },
  { cat: 'Lung', q: 'EGFR exon 20 insertions?', a: 'Poorly sensitive to classic TKIs. Amivantamab + carboplatin–pemetrexed first line (PAPILLON: PFS 11.4 vs 6.7 mo). A few variants (e.g. A763_Y764insFQEA) remain TKI-sensitive.', hack: 'Ex20ins → bispecific, not TKI' },
  { cat: 'Lung', q: 'ALK-positive NSCLC: which trials and which resistance mutation?', a: 'ALEX (alectinib vs crizotinib, PFS HR 0.47); CROWN (lorlatinib 5-year PFS 60% vs 8%). G1202R solvent-front mutation → lorlatinib active.', hack: 'ALEX → alectinib; CROWN → lorlatinib' },
  { cat: 'Lung', q: 'KRAS G12C: where is it approved and what is the CRC twist?', a: 'NSCLC (sotorasib, adagrasib; later line). CRC: with an anti-EGFR antibody (sotorasib + panitumumab; adagrasib + cetuximab) because monotherapy triggers EGFR feedback.', hack: 'G12C in CRC needs an EGFR partner' },
  { cat: 'Lung', q: 'MET exon 14 skipping: mechanism, detection and drugs?', a: 'Splice-site variants drop exon 14 (loss of CBL binding Y1003 → reduced degradation). RNA detects best. Capmatinib/tepotinib (GEOMETRY mono-1 ORR 68% naïve, 41% pretreated).', hack: 'Splice-site, not "missense" — use RNA' },
  { cat: 'Lung', q: 'Why might a driver-negative DNA panel be incomplete in adenocarcinoma?', a: 'DNA panels can miss fusions (NTRK, ROS1, RET, NRG1) and MET exon 14 skipping. Add RNA-based testing.', hack: 'DNA misses fusions; RNA reads them' },
  { cat: 'GI', q: 'BRAF V600E colorectal cancer?', a: 'Poor prognosis in MSS disease. Encorafenib + cetuximab (BEACON: triplet OS 9.0 vs 5.4 mo; doublet 8.4). BRAF inhibitor alone fails (EGFR feedback). First-line with mFOLFOX6 has accelerated approval.', hack: 'BRAF + EGFR together' },
  { cat: 'GI', q: 'RAS mutation in metastatic CRC?', a: 'KRAS/NRAS exons 2, 3, 4 mutation predicts no benefit from cetuximab/panitumumab. RAS wild-type is required.', hack: 'RAS mutant = no anti-EGFR' },
  { cat: 'GI', q: 'MSI-H/dMMR colorectal cancer first-line?', a: 'Pembrolizumab beat chemotherapy (KEYNOTE-177: PFS 16.5 vs 8.2 mo, HR 0.60). Tumour-agnostic indication also exists after prior treatment.', hack: 'MSI-H → PD-1 first' },
  { cat: 'GI', q: 'Lynch triage logic when tumour MLH1 is lost?', a: 'BRAF V600E or MLH1 promoter hypermethylation → sporadic. If absent, germline MMR testing. Tools: Amsterdam II criteria, revised Bethesda guidelines.', hack: 'MLH1 loss + BRAF V600E = sporadic' },
  { cat: 'Breast', q: 'ESR1 mutations in ER+ breast cancer?', a: 'Ligand-binding-domain mutations (Y537S, D538G, E380Q) are acquired under aromatase-inhibitor therapy; best detected in ctDNA; elacestrant (EMERALD, ESR1m PFS HR 0.55).', hack: 'AI pressure → ESR1' },
  { cat: 'Breast', q: 'PIK3CA in HR+/HER2– breast cancer: drugs?', a: 'Alpelisib + fulvestrant (SOLAR-1, PFS 11.0 vs 5.7 mo), capivasertib for PIK3CA/AKT1/PTEN alterations (CAPItello-291), inavolisib + palbociclib + fulvestrant in endocrine-resistant disease.', hack: 'PI3K → alpelisib, inavolisib; AKT → capivasertib' },
  { cat: 'DNA repair', q: 'PARP-inhibitor label trap for breast and pancreatic cancer?', a: 'Breast (olaparib/talazoparib) and pancreatic (olaparib maintenance) labels require a GERMLINE BRCA variant; ovarian accepts germline or somatic BRCA.', hack: 'Breast & pancreas = germline' },
  { cat: 'DNA repair', q: 'PARP-inhibitor resistance mechanisms?', a: 'BRCA reversion (secondary) mutations restoring reading frame; loss of 53BP1–shieldin function; drug efflux.', hack: 'Reversion = the gene "heals"' },
  { cat: 'Biomarkers', q: 'FDA TMB-high cut-off and the supporting trial?', a: '≥10 mutations/Mb on an approved assay (KEYNOTE-158: ORR 29% vs 6%). Panel TMB varies; harmonisation matters.', hack: 'Ten per Mb' },
  { cat: 'Biomarkers', q: 'HRD scoring threshold used in PAOLA-1?', a: 'Genomic-instability score ≥42 on one commercial assay; not interchangeable between assays. HRD-positive = BRCA mutation and/or score above cut-off.', hack: '42 on that assay' },
  { cat: 'Biomarkers', q: 'NTRK fusions: what is special?', a: 'Tumour-agnostic indications (larotrectinib, entrectinib, repotrectinib); ESCAT I-C; pooled larotrectinib ORR 79%; RNA-based detection preferred; resistance via solvent-front/xDFG mutations.', hack: 'NTRK = tumour-agnostic, RNA' },
  { cat: 'Biomarkers', q: 'Clonal haematopoiesis: definition and genes?', a: 'Somatic mutation in blood cells at VAF ≥2% without haematological malignancy (Steensma). DNMT3A, TET2, ASXL1 most common; PPM1D/TP53/CHEK2 after chemo/radiation.', hack: 'DTA + treatment genes' },
  { cat: 'Haematology', q: 'IDH1 vs IDH2 drug matching?', a: 'Ivosidenib and olutasidenib target IDH1 (AML; ivosidenib also cholangiocarcinoma); enasidenib targets IDH2; vorasidenib covers IDH1/2 in grade 2 glioma. Differentiation syndrome is a class toxicity.', hack: 'Ivo = IDH1; Ena = IDH2' },
  { cat: 'Haematology', q: 'FLT3 inhibitors: who gets which?', a: 'Midostaurin (ITD or TKD, with 7+3, RATIFY OS HR 0.78); quizartinib (ITD only, QuANTUM-First); gilteritinib (relapsed/refractory, ADMIRAL OS 9.3 vs 5.6 mo). Long ITDs can be missed by standard NGS pipelines.', hack: 'Quiz = ITD only' },
  { cat: 'Haematology', q: 'Philadelphia chromosome and T315I?', a: 't(9;22) BCR::ABL1 (Nowell & Hungerford; Rowley). T315I gatekeeper resists imatinib, dasatinib, nilotinib, bosutinib; ponatinib and asciminib work.', hack: 'T315I → pona / asciminib' },
  { cat: 'Syndromes', q: 'Name the syndrome–gene pairs: Lynch, Li–Fraumeni, Cowden, Peutz–Jeghers.', a: 'Lynch = MLH1/MSH2/MSH6/PMS2/EPCAM; Li–Fraumeni = TP53; Cowden = PTEN; Peutz–Jeghers = STK11. Also MEN2 = RET, VHL = VHL, FAP = APC, HDGC = CDH1.', hack: 'L-MMR, LF-p53, C-PTEN, PJ-STK11' }
];

/* ---------------------------------------------------------------------
   Quiz: single-best-answer items with explanations
   --------------------------------------------------------------------- */
const QUIZ = [
  { q: 'A tumour-only tissue report lists BRCA2 c.5946del (frameshift) at VAF 49% in a patient with HER2-negative breast cancer. What is the best next step?', opts: ['Start olaparib on the basis of the somatic result', 'Regard it as a sequencing artefact', 'Consider a germline origin and arrange confirmatory germline testing with counselling', 'Order RNA sequencing'], ans: 2, why: 'VAF ≈ 50% in a hereditary-cancer gene raises germline possibility. The breast-cancer PARP-inhibitor labels require a germline BRCA variant, and relatives may be affected.' },
  { q: 'DNMT3A p.Arg882His at VAF 1.4% on a plasma ctDNA test in a patient with lung cancer is most likely…', opts: ['An actionable lung-cancer driver', 'Clonal haematopoiesis (CHIP)', 'A germline variant', 'A resistance mutation'], ans: 1, why: 'DNMT3A R882 is a classic CHIP hotspot; low VAF in plasma without tissue confirmation points to a blood clone. Matched white-cell sequencing resolves it.' },
  { q: 'Which ESCAT tier is defined as "clinical benefit previously demonstrated in other tumour types or for similar molecular targets"?', opts: ['Tier I', 'Tier II', 'Tier III', 'Tier V'], ans: 2, why: 'ESCAT tier III. Tier II is investigational targets that likely define a benefiting population; tier V is co-targeting.' },
  { q: 'A patient with BRAF V600E metastatic colorectal cancer has progressed on chemotherapy. Which approach is evidence-based?', opts: ['Vemurafenib monotherapy', 'Encorafenib plus cetuximab', 'Cetuximab alone', 'Dabrafenib alone'], ans: 1, why: 'BEACON: BRAF inhibition works only with EGFR blockade, because EGFR feedback reactivates MAPK signalling.' },
  { q: 'Which result argues AGAINST cetuximab or panitumumab in metastatic colorectal cancer?', opts: ['KRAS exon 3 (Q61H) mutation', 'BRAF V600E in a right-sided tumour with MSI-H', 'EGFR amplification', 'TP53 R273H'], ans: 0, why: 'KRAS/NRAS mutations (exons 2, 3, 4) predict no benefit from anti-EGFR antibodies.' },
  { q: 'Which framework classifies the ONCOGENICITY of somatic variants?', opts: ['ACMG/AMP 2015', 'ClinGen/CGC/VICC 2022', 'ESCAT 2018', 'ClinVar star rating'], ans: 1, why: 'Horak et al. 2022. ACMG/AMP is germline pathogenicity; ESCAT and AMP/ASCO/CAP are about clinical significance; ClinVar stars show review status.' },
  { q: 'A clonal heterozygous SNV in a diploid region with tumour purity 40% is expected at a VAF of about…', opts: ['10%', '20%', '40%', '80%'], ans: 1, why: 'VAF ≈ purity ÷ 2 for a clonal heterozygous variant: 0.40 ÷ 2 = 20%.' },
  { q: 'A driver-negative lung adenocarcinoma on a DNA-only panel. Which is the best additional step?', opts: ['Declare the tumour driver-negative', 'Add RNA-based fusion testing', 'Repeat the same DNA panel', 'Use PD-L1 only'], ans: 1, why: 'DNA panels can miss NTRK, ROS1, RET and NRG1 fusions and MET exon 14 skipping; RNA-based testing is more sensitive for these.' },
  { q: 'ClinVar shows a variant classified by an expert panel. How many review-status stars is that?', opts: ['1', '2', '3', '4'], ans: 2, why: '3 stars = reviewed by expert panel. 4 stars = practice guideline.' },
  { q: 'Why might routine NGS miss a long FLT3-ITD?', opts: ['FLT3 is not in myeloid panels', 'Long insertions are under-called by standard short-read pipelines', 'ITDs only occur in RNA', 'ITDs are always germline'], ans: 1, why: 'ITDs are large in-frame duplications; use an ITD-aware method or fragment analysis.' },
  { q: 'The FDA tumour-agnostic TMB-high threshold for pembrolizumab is…', opts: ['≥5 mutations/Mb', '≥10 mutations/Mb', '≥20 mutations/Mb', '≥50 mutations/Mb'], ans: 1, why: '≥10 mutations/Mb on an approved assay (KEYNOTE-158), with a caution that panel TMB varies.' },
  { q: 'A PIK3CA E545K variant is found in colorectal cancer. Which statement is correct?', opts: ['Alpelisib is indicated as in breast cancer', 'Breast-cancer PIK3CA evidence does not automatically apply to colorectal cancer', 'It makes anti-EGFR therapy effective', 'It is a germline variant'], ans: 1, why: 'Evidence is tumour-type-specific. The PI3K-inhibitor data come from HR+/HER2– breast cancer.' }
];

/* =====================================================================
   8. APP STATE & STORAGE
   ---------------------------------------------------------------------
   "State" = what the app currently remembers: the case details, the
   variants you typed, and whether you confirmed them.
   * It is kept in sessionStorage: it survives a page refresh but is
     erased when you close the tab. Nothing is sent anywhere.
   * Do NOT type patient names, hospital numbers, dates of birth or other
     identifiers. Use a neutral label such as "Case 1".
   * Changing any case or variant detail clears the "confirmed" tick, so
     an interpretation can never be based on unreviewed edits.
   ===================================================================== */
const SESSION_KEY = 'onco-ngs-reader/session/v1';
const THEME_KEY = 'onco-ngs-reader/theme';
const ACCESS_KEY = 'onco-ngs-reader/access-log';

const emptyCase = () => ({
  label: '', cancer: '', histology: '', stage: '', setting: 'unspecified', priorTx: '',
  specimen: '', assay: '', purity: '', msi: 'unknown', mmr: 'unknown', tmb: '', hrd: 'unknown',
  pdl1: '', her2: '', germline: 'not-tested', notes: ''
});
const emptyLookups = () => ({
  clinvar: { cls: '', stars: '', date: '' },
  clingen: { cls: '', date: '' },
  civic: { cls: '', date: '' },
  oncokb: { level: '', date: '' }
});
const emptyVariant = () => ({
  id: uid(), gene: '', variant: '', hgvsC: '', transcript: '', type: '', vaf: '', depth: '',
  origin: 'unknown', partner: '', cn: '', reported: '', uncertain: [], lookups: emptyLookups(),
  src: 'manual', verified: true, page: '', snippet: ''   // src 'extracted' = proposed from a PDF; must be verified by a clinician
});

const state = {
  case: emptyCase(),
  variants: [],
  confirmed: false, confirmedAt: null,
  sampleId: null,
  boardNotes: '', preparedBy: '', reviewedBy: '',
  editingId: null,
  ui: {
    interpSearch: '', interpFilter: 'all', interpType: '', selectedId: null, interpTab: 'biology',
    actFilter: 'all', actGene: '', actSettingOnly: false, actTab: 'therapies',
    learnTab: 'topics', learnCat: 'All', learnSearch: '', cardCat: 'All', cardSearch: '',
    evSearch: '', evCat: 'All', evUsed: false
  },
  file: { name: '', size: 0, valid: null, url: '', pages: 0 },
  live: { enabled: false, oncokbUrl: '', status: {}, results: {} },   // Stage 2: live look-ups (opt-in, per session)
  extract: null                                                         // Stage 2: PDF proposals (memory only, never saved)
};

function saveState() {
  store.set('sessionStorage', SESSION_KEY, {
    case: state.case, variants: state.variants.map((v) => { const c = Object.assign({}, v); delete c.snippet; return c; }),
    confirmed: state.confirmed, confirmedAt: state.confirmedAt, liveResults: state.live.results,
    sampleId: state.sampleId, boardNotes: state.boardNotes, preparedBy: state.preparedBy, reviewedBy: state.reviewedBy
  });
}
function loadState() {
  const s = store.get('sessionStorage', SESSION_KEY);
  if (!s || !s.case) return;
  state.case = Object.assign(emptyCase(), s.case);
  state.variants = Array.isArray(s.variants)
    ? s.variants.map((v) => Object.assign(emptyVariant(), v, { lookups: Object.assign(emptyLookups(), v.lookups || {}) }))
    : [];
  state.confirmed = !!s.confirmed; state.confirmedAt = s.confirmedAt || null;
  state.sampleId = s.sampleId || null;
  state.live.results = s.liveResults && typeof s.liveResults === 'object' ? s.liveResults : {};
  state.boardNotes = s.boardNotes || ''; state.preparedBy = s.preparedBy || ''; state.reviewedBy = s.reviewedBy || '';
}
/** Any change to report data must clear the confirmation. */
function dataChanged() {
  const was = state.confirmed;
  state.confirmed = false; state.confirmedAt = null;
  saveState(); renderCaseStrip();
  auditThrottled('edit', 'case-edited', was ? 'details changed; confirmation cleared' : 'details changed', 20000);
}

/* =====================================================================
   9. MATCHING & CHECKING LOGIC
   ===================================================================== */

/** Mutation types offered in the form, with a plain-language explanation. */
const TYPES = [
  ['', 'Select type…'],
  ['missense', 'Missense (single amino-acid change)'],
  ['nonsense', 'Nonsense (premature stop)'],
  ['frameshift', 'Frameshift (small insertion/deletion)'],
  ['splice', 'Splice-site'],
  ['inframe', 'In-frame insertion / deletion / duplication'],
  ['amplification', 'Amplification (copy-number gain)'],
  ['deletion', 'Gene or exon deletion (copy-number loss)'],
  ['fusion', 'Gene fusion'],
  ['rearrangement', 'Other rearrangement'],
  ['other', 'Other / not sure']
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const TYPE_INFO = {
  missense: 'One amino acid is replaced by another. Effect ranges from none to strongly activating or inactivating, so position and functional evidence matter (hotspots vs unknown significance).',
  nonsense: 'A premature stop codon truncates the protein. In a tumour suppressor this is usually loss of function (check the position: very late truncations may escape nonsense-mediated decay).',
  frameshift: 'A small insertion or deletion not divisible by three shifts the reading frame and usually truncates the protein (loss of function). In some oncogenes/genes (e.g. NPM1) a specific frameshift has a gain-of-function-like effect.',
  splice: 'A change at a splice donor/acceptor can cause exon skipping or intron retention. Canonical ±1/±2 positions usually abolish splicing; MET exon 14 skipping is a classic actionable example.',
  inframe: 'A deletion/insertion/duplication of a multiple of three bases keeps the frame. Hotspot examples: EGFR exon 19 deletions (activating); EGFR exon 20 insertions; FLT3-ITD.',
  amplification: 'Extra copies of a gene (focal, high-level). Meaning depends on gene, copy-number threshold, tumour purity and method.',
  deletion: 'Loss of one or both gene copies (or an exon). Homozygous deletion of a tumour suppressor (e.g. CDKN2A, PTEN) is typically loss of function.',
  fusion: 'Two genes joined by a rearrangement, written 5′::3′ (e.g. EML4::ALK). Check that the kinase domain is retained and the fusion is in-frame.',
  rearrangement: 'A structural rearrangement affecting the gene whose consequence (fusion, truncation, enhancer hijacking) must be confirmed.',
  other: 'Type not specified. Select the closest category so the correct rules are applied.'
};
const ORIGINS = [
  ['unknown', 'Not stated / unknown'],
  ['somatic', 'Reported somatic (e.g. matched normal tested)'],
  ['germline', 'Reported germline']
];
const SPECIMENS = [
  ['', 'Select specimen…'], ['tissue', 'Tumour tissue (FFPE or fresh)'], ['liquid', 'Plasma (ctDNA / liquid biopsy)'],
  ['marrow', 'Bone marrow / peripheral blood (haematological)'], ['other', 'Other']
];
const GERMLINE_STATUS = [
  ['not-tested', 'Germline testing not done'], ['pending', 'Germline testing pending'],
  ['negative', 'Germline tested — no relevant finding'], ['positive', 'Germline tested — relevant finding']
];

/* ---- gene / protein normalisation ---- */
const AA3 = { ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V', TER: '*' };
const AA1TO3 = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Ter' };

function normGene(g) {
  const t = String(g || '').toUpperCase().replace(/\s+/g, '');
  return GENE_ALIASES[t] || t;
}
/** "p.Leu858Arg", "L858R", "(p.L858R)" -> "L858R" */
function normProtein(s) {
  let t = String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[()]/g, '');
  t = t.replace(/^[A-Z]{2}_?\d+\.\d+:/, '').replace(/^P\./, '');
  t = t.replace(/(ALA|ARG|ASN|ASP|CYS|GLN|GLU|GLY|HIS|ILE|LEU|LYS|MET|PHE|PRO|SER|THR|TRP|TYR|VAL|TER)/g, (m) => AA3[m]);
  return t;
}
/** If someone typed "EML4::ALK" in the gene box, split it into partner + gene. */
function splitFusionName(raw) {
  const s = String(raw || '').trim();
  const parts = s.split(/::|\/|–|—|-/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const known = parts.map((p) => !!GENES[normGene(p)]);
  if (known[0] && !known[1]) return { gene: normGene(parts[0]), partner: parts[1].toUpperCase() };
  if (!known[0] && known[1]) return { gene: normGene(parts[1]), partner: parts[0].toUpperCase() };
  if (known[0] && known[1]) return { gene: normGene(parts[1]), partner: normGene(parts[0]) };
  return null;
}
function normVariant(v) {
  return {
    gene: normGene(v.gene),
    p: normProtein(v.variant),
    c: String(v.hgvsC || '').toUpperCase().replace(/\s+/g, ''),
    type: v.type,
    partner: String(v.partner || ''),
    cn: num(v.cn),
    text: `${v.variant || ''} ${v.hgvsC || ''} ${v.partner || ''}`.toLowerCase()
  };
}

/** Plain label for lists and tables. */
function varLabel(v) {
  const nv = normVariant(v);
  const g = nv.gene || '(gene?)';
  if (v.type === 'fusion' || v.type === 'rearrangement') {
    return `${v.partner ? v.partner.toUpperCase() + '::' : ''}${g} ${v.type === 'fusion' ? 'fusion' : 'rearrangement'}${v.variant ? ' (' + v.variant + ')' : ''}`;
  }
  if (v.type === 'amplification') return `${g} amplification${v.cn !== '' ? ' (CN ' + v.cn + ')' : ''}`;
  if (v.type === 'deletion' && !v.variant && !v.hgvsC) return `${g} deletion${v.cn !== '' ? ' (CN ' + v.cn + ')' : ''}`;
  return `${g} ${v.variant || v.hgvsC || '(no description)'}`.trim();
}

/* ---- HGVS decoder (educational) ---- */
function parseHGVS(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const out = { raw, rows: [], warnings: [], ok: false };
  let s = raw, ref = '';
  const m0 = s.match(/^([A-Za-z]{2,4}_?\d+(?:\.\d+)?)(?:\([A-Za-z0-9-]+\))?:\s*(.*)$/);
  if (m0) { ref = m0[1]; s = m0[2]; out.rows.push(['Reference sequence', ref + (/\.\d+$/.test(ref) ? '' : ' (version missing)')]); }
  else out.warnings.push('No reference transcript/protein is named. Numbering depends on the transcript — add it (for example NM_005228.5).');
  let kind = '';
  const mp = s.match(/^([cgmnrp])\.\s*(.*)$/i);
  if (mp) { kind = mp[1].toLowerCase(); s = mp[2]; }
  else if (/^[A-Za-z]{1,3}\d+[A-Za-z*=?]{1,3}/.test(s)) { kind = 'p'; out.warnings.push('The "p." prefix is missing; interpreted as a protein change.'); }
  else if (/^\d+/.test(s)) { kind = 'c'; out.warnings.push('The "c." prefix is missing; interpreted as a coding-DNA change.'); }
  if (!kind) { out.warnings.push('Not recognised as an HGVS description (expected something like c.2573T>G or p.Leu858Arg).'); return out; }
  const stripped = s.replace(/^\(|\)$/g, '');
  const aa = (x) => {
    const t = String(x || '');
    if (t.length === 1) return AA1TO3[t.toUpperCase()] ? `${AA1TO3[t.toUpperCase()]} (${t.toUpperCase()})` : t;
    const k = t.charAt(0).toUpperCase() + t.slice(1, 3).toLowerCase();
    return k;
  };
  if (kind === 'p') {
    out.rows.push(['Level', 'Protein (p.)']);
    let m;
    if ((m = stripped.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|=|\?)fs(?:Ter|\*)?(\d+|\?)?$/i)) || (m = stripped.match(/^([A-Za-z]{1,3})(\d+)fs(?:Ter|\*)?(\d+|\?)?$/i))) {
      out.ok = true; out.rows.push(['Position', `${aa(m[1])} at residue ${m[2]}`]);
      out.rows.push(['Consequence', 'Frameshift (reading frame changes; truncation follows)']);
      const tail = m[m.length - 1]; if (tail && tail !== '?') out.rows.push(['New stop', `A stop codon is reached at position ${tail} of the new reading frame (the first changed residue counts as position 1)`]);
    } else if ((m = stripped.match(/^([A-Za-z]{1,3})(\d+)(?:_([A-Za-z]{1,3})(\d+))?(delins|del|dup|ins)([A-Za-z]*)$/i))) {
      out.ok = true;
      const span = m[3] ? `${aa(m[1])}${m[2]} to ${aa(m[3])}${m[4]}` : `${aa(m[1])}${m[2]}`;
      out.rows.push(['Position', span]);
      const names = { del: 'Deletion', dup: 'Duplication', ins: 'Insertion', delins: 'Deletion-insertion' };
      out.rows.push(['Consequence', `${names[m[5].toLowerCase()]} (in-frame at protein level unless “fs” is stated)`]);
    } else if ((m = stripped.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|=|\?)$/))) {
      out.ok = true;
      const alt = m[3];
      out.rows.push(['Position', `${aa(m[1])} at residue ${m[2]}`]);
      if (alt === '*' || /^ter$/i.test(alt)) out.rows.push(['Consequence', 'Nonsense (premature stop codon)']);
      else if (alt === '=') out.rows.push(['Consequence', 'Synonymous (no amino-acid change)']);
      else if (alt === '?') out.rows.push(['Consequence', 'Unknown effect']);
      else out.rows.push(['Consequence', `Missense: ${aa(m[1])} → ${aa(alt)}`]);
    } else out.warnings.push('Protein description not recognised. Check spelling, e.g. p.Leu858Arg or p.Glu746_Ala750del.');
    if (out.ok && /^[A-Z]\d/.test(stripped)) out.warnings.push('One-letter amino-acid codes are widely used, but HGVS prefers three-letter codes (e.g. p.Leu858Arg).');
    return out;
  }
  if (kind === 'c') {
    out.rows.push(['Level', 'Coding DNA (c.) — position counted from the A of the ATG start codon (c.1)']);
    let m;
    const pos = (n, off) => `c.${n}${off || ''}`;
    if ((m = stripped.match(/^(\*?-?\d+)([+-]\d+)?([ACGT])>([ACGT])$/i))) {
      out.ok = true; out.rows.push(['Position', pos(m[1], m[2])]); out.rows.push(['Change', `${m[3].toUpperCase()} → ${m[4].toUpperCase()} (single-nucleotide substitution)`]);
      if (m[2]) {
        const off = Math.abs(parseInt(m[2], 10));
        out.rows.push(['Region', `Intronic position ${m[2]} relative to an exon boundary`]);
        out.rows.push(['Likely consequence', off <= 2 ? 'Canonical splice-site position (±1/±2): splicing is usually abolished — confirm' : 'Possible splice effect; needs prediction/functional evidence']);
      } else if (m[1].startsWith('*')) out.rows.push(['Region', "3′ untranslated region"]);
      else if (m[1].startsWith('-')) out.rows.push(['Region', "5′ untranslated region / upstream"]);
      else {
        const n = parseInt(m[1], 10); out.rows.push(['Codon', `Codon ${Math.ceil(n / 3)}, position ${((n - 1) % 3) + 1} of the codon`]);
      }
    } else if ((m = stripped.match(/^(\*?-?\d+)([+-]\d+)?(?:_(\*?-?\d+)([+-]\d+)?)?(delins|del|dup|ins)([ACGT0-9]*)$/i))) {
      out.ok = true;
      const names = { del: 'Deletion', dup: 'Duplication', ins: 'Insertion', delins: 'Deletion-insertion' };
      const t = m[5].toLowerCase();
      out.rows.push(['Position', m[3] ? `${pos(m[1], m[2])} to ${pos(m[3], m[4])}` : pos(m[1], m[2])]);
      out.rows.push(['Change', names[t]]);
      let len = null;
      if ((t === 'del' || t === 'dup') && !m[2] && !m[4]) {
        const a = parseInt(m[1].replace('*', ''), 10), b = m[3] ? parseInt(m[3].replace('*', ''), 10) : a;
        if (!isNaN(a) && !isNaN(b)) len = Math.abs(b - a) + 1;
      } else if (t === 'ins' && m[6]) len = m[6].length;
      if (len !== null) {
        out.rows.push(['Length', `${len} base${len > 1 ? 's' : ''}`]);
        if (t !== 'delins') out.rows.push(['Reading frame', len % 3 === 0 ? 'Multiple of 3 → in-frame (if within coding sequence)' : 'Not a multiple of 3 → frameshift (if within coding sequence)']);
      }
    } else out.warnings.push('Coding-DNA description not recognised. Examples: c.2573T>G, c.2235_2249del, c.5946del, c.2188-2A>G.');
    return out;
  }
  out.rows.push(['Level', { g: 'Genomic (g.)', m: 'Mitochondrial (m.)', n: 'Non-coding RNA (n.)', r: 'RNA (r.)' }[kind]]);
  out.ok = true; out.warnings.push('This helper only decodes c. and p. descriptions in detail.');
  return out;
}

/* ---- rule matching ---- */
function findRule(nv) {
  for (const r of RULES) {
    try { if (r.test(nv)) return r; } catch (e) { /* ignore a broken rule */ }
  }
  return null;
}
const IS_AGNOSTIC_OK = (cancer) => !IS_HEME(cancer);

/** Core: interpret one variant for the current case. */
function interpret(v, cs = state.case) {
  const nv = normVariant(v);
  const gene = GENES[nv.gene] || null;
  const rule = findRule(nv);
  const cancer = cs.cancer;
  const res = { v, nv, gene, rule, ctx: null, match: 'norule', category: gene ? 'norule' : 'nogene', warn: '', otherCtx: [] };
  if (!rule) return res;
  let exact = rule.contexts.find((c) => c.c.includes(cancer));
  let agn = IS_AGNOSTIC_OK(cancer) ? rule.contexts.find((c) => c.c.includes('*')) : null;
  if (exact) { res.ctx = exact; res.match = 'exact'; }
  else if (agn) { res.ctx = agn; res.match = 'agnostic'; }
  else { res.match = 'other'; }
  res.otherCtx = rule.contexts.filter((c) => c !== res.ctx && !c.c.includes('*'));
  if (res.ctx && res.ctx.restrict && !res.ctx.restrict.test(nv.p)) {
    res.warn = `The evidence in this context was established for a specific variant (${res.ctx.restrict.source.replace(/[\^$]/g, '')}); the reported variant (${v.variant || v.hgvsC || '—'}) is different. Verify before applying.`;
  }
  const rx = res.ctx ? res.ctx.rx : [];
  const hasApproved = rx.some((r) => r.status === 'approved' || r.status === 'agnostic');
  const needsGermline = !!(res.ctx && res.ctx.germlineOnly && v.origin !== 'germline' && cs.germline !== 'positive');
  if (needsGermline) res.warn = (res.warn ? res.warn + ' ' : '') + 'The approved indication in this tumour type requires a confirmed GERMLINE variant. This finding has not been shown to be germline, so treat it as conditional until germline testing confirms it.';
  const hasInvestigational = rule.roles.includes('predictive') && rx.some((r) => r.status === 'investigational' || r.status === 'verify');
  const isResistanceRole = rule.roles.includes('resistance');
  if (res.match === 'other') {
    const otherApproved = rule.contexts.some((c) => c.rx.some((r) => r.status === 'approved'));
    res.category = otherApproved ? 'other-tumour' : 'informational';
  } else if (hasApproved && needsGermline) res.category = 'conditional';
  else if (hasApproved && !res.warn) res.category = 'actionable';
  else if (hasApproved && res.warn) res.category = 'informational';
  else if (isResistanceRole || (res.ctx && res.ctx.rx.some((r) => r.status === 'unsupported'))) res.category = 'resistance';
  else if (hasInvestigational) res.category = 'investigational';
  else res.category = 'informational';
  return res;
}
const CATEGORY_LABEL = {
  actionable: ['Actionable in this tumour', 'mint'],
  conditional: ['Actionable only if germline confirmed', 'peach'],
  resistance: ['Resistance / negative predictor', 'rose'],
  'other-tumour': ['Evidence in other tumour types', 'lav'],
  investigational: ['Investigational / evolving', 'peach'],
  informational: ['Informational (no therapy match)', 'blue'],
  norule: ['Gene known · variant not curated', 'grey'],
  nogene: ['Gene not in prototype library', 'grey']
};

/* ---- flags: warnings about the quality and meaning of one variant ---- */
const FIELD_LABEL = { vaf: 'VAF', depth: 'read depth', cn: 'copy number', transcript: 'transcript', hgvsC: 'cDNA (c.) description', variant: 'protein change', partner: 'fusion partner' };
function variantFlags(v, cs = state.case) {
  const flags = [];
  const nv = normVariant(v);
  const vaf = num(v.vaf), depth = num(v.depth), purity = num(cs.purity);
  const isCNA = ['amplification', 'deletion'].includes(v.type);
  const isSV = ['fusion', 'rearrangement'].includes(v.type);
  if (!nv.gene) flags.push({ level: 'missing', text: 'Gene symbol missing.' });
  if (!v.type) flags.push({ level: 'missing', text: 'Mutation type not selected: the correct rules cannot be applied.' });
  if (!isCNA && !isSV) {
    if (!v.variant && !v.hgvsC) flags.push({ level: 'missing', text: 'No variant description (neither protein nor cDNA).' });
    if (!v.hgvsC) flags.push({ level: 'missing', text: 'cDNA (HGVS c.) description not stated.' });
    if (!v.transcript) flags.push({ level: 'missing', text: 'Reference transcript not stated: numbering cannot be verified.' });
    if (vaf === null) flags.push({ level: 'missing', text: 'VAF not stated.' });
    if (depth === null) flags.push({ level: 'missing', text: 'Read depth not stated.' });
  }
  if (isCNA && num(v.cn) === null) flags.push({ level: 'missing', text: 'Copy number not stated (needed to judge amplification/deletion).' });
  if (isSV && !v.partner) flags.push({ level: 'missing', text: 'Fusion partner not stated.' });
  (v.uncertain || []).forEach((f) => flags.push({ level: 'uncertain', text: `The ${FIELD_LABEL[f] || f} was marked uncertain/unreadable on the source report.` }));
  if (depth !== null && depth < 100) flags.push({ level: 'warn', text: `Low read depth (${depth}×). Calls at low depth are less reliable.` });
  if (cs.specimen === 'tissue' && vaf !== null && vaf < 5 && !isCNA && !isSV) flags.push({ level: 'warn', text: `VAF ${vaf}% in tissue is low: could be subclonal or an FFPE artefact. Compare with the assay’s limit of detection.` });
  if (cs.specimen === 'tissue' && purity !== null && vaf !== null && !isCNA && !isSV && purity > 0 && vaf > purity * 0.75) {
    flags.push({ level: 'info', text: `VAF (${vaf}%) is higher than expected for a clonal heterozygous change at ${purity}% tumour purity (≈ ${(purity / 2).toFixed(0)}%). Possible allelic imbalance, copy gain or germline origin.` });
  }
  if (GERMLINE_PRONE.includes(nv.gene) && vaf !== null && !isCNA && !isSV && v.origin !== 'somatic') {
    if ((vaf >= 40 && vaf <= 60) || vaf >= 90) {
      flags.push({ level: 'warn', text: `Possible GERMLINE variant: ${nv.gene} is a hereditary-cancer gene and VAF ${vaf}% is near 50% or 100%. A tumour-only result cannot prove origin; consider confirmatory germline testing with counselling.` });
    }
  }
  if (v.origin === 'germline') flags.push({ level: 'info', text: 'Reported as germline: ensure consent, genetic counselling and a cascade-testing plan.' });
  if (cs.specimen === 'liquid' && CHIP_PRONE.includes(nv.gene) && vaf !== null && vaf < 10) {
    flags.push({ level: 'warn', text: `Possible clonal haematopoiesis (CHIP): ${nv.gene} variants at low VAF in plasma are often derived from blood cells, not the tumour. Matched white-blood-cell sequencing would resolve this.` });
  }
  if (cs.specimen === 'liquid' && (isCNA || isSV)) flags.push({ level: 'info', text: 'Plasma assays detect copy-number changes and fusions less sensitively than tissue; confirm in tissue if the result would change management.' });
  if (v.src === 'extracted') flags.push({ level: v.verified ? 'info' : 'warn', text: v.verified ? 'Extracted from the PDF and verified by the clinician.' : `Extracted from the PDF by a heuristic${v.page ? ' (page ' + v.page + ')' : ''} and NOT yet verified. Compare it with the source page.` });
  if (v.reported) flags.push({ level: 'info', text: `Report-stated classification (typed by you, not verified by this app): “${v.reported}”.` });
  return flags;
}

/** Case-level completeness checks. */
function caseChecks(cs = state.case, variants = state.variants) {
  const items = [];
  const add = (level, text) => items.push({ level, text });
  if (!cs.cancer) add('missing', 'Cancer type not selected: tumour-specific evidence cannot be applied.');
  if (!cs.stage) add('missing', 'Stage / disease extent not entered.');
  if (!cs.setting || cs.setting === 'unspecified') add('missing', 'Disease setting not specified: approvals and trials are setting-specific.');
  if (!cs.specimen) add('missing', 'Specimen type not selected (tissue, plasma or marrow).');
  if (!cs.assay) add('missing', 'Assay / panel name not entered: coverage of genes and variant classes is unknown.');
  if (cs.specimen === 'tissue' && !cs.purity) add('missing', 'Tumour purity not entered.');
  if (cs.specimen === 'tissue' && num(cs.purity) !== null && num(cs.purity) < 20) add('warn', `Tumour purity ${cs.purity}% is low: false negatives are possible (check the assay’s minimum tumour content).`);
  if (cs.germline === 'not-tested' && variants.some((v) => GERMLINE_PRONE.includes(normGene(v.gene)))) add('warn', 'A hereditary-cancer gene is reported but germline testing status is “not done”.');
  if (!variants.length) add('missing', 'No variants entered yet.');
  const unver = variants.filter((v) => v.src === 'extracted' && !v.verified).length;
  if (unver) add('warn', `${unver} extracted entr${unver === 1 ? 'y has' : 'ies have'} not yet been verified against the PDF. Verify each one before confirming.`);
  const unknownGenes = variants.filter((v) => normGene(v.gene) && !GENES[normGene(v.gene)]);
  if (unknownGenes.length) add('info', `${unknownGenes.length} variant(s) are in genes outside the prototype library: they are listed but not interpreted.`);
  const flagged = variants.filter((v) => variantFlags(v, cs).some((f) => f.level === 'missing' || f.level === 'uncertain' || f.level === 'warn')).length;
  if (flagged) add('warn', `${flagged} of ${variants.length} variant(s) carry missing, uncertain or warning flags — review them before confirming.`);
  return items;
}

/** All interpretations for the current case. */
function interpretAll() { return state.variants.map((v) => interpret(v)); }

/** Collect the reference ids used by the current case (for the summary and library filter). */
function usedRefIds() {
  const ids = new Set(['amp2017', 'acmg2015', 'vicc2022', 'escat2018', 'oncokb', 'clinvar', 'clingen', 'civic', 'fda_daf', 'ema']);
  interpretAll().forEach((it) => {
    if (it.rule) {
      (it.rule.refs || []).forEach((r) => ids.add(r));
      it.rule.contexts.forEach((c) => c.rx.forEach((r) => (r.refs || []).forEach((x) => ids.add(x))));
    }
    if (it.v.type === 'fusion') ids.add('esmo_ngs2024');
  });
  biomarkerFindings(state.case).forEach((b) => (b.refs || []).forEach((r) => ids.add(r)));
  if (state.case.specimen === 'liquid') { ids.add('esmo_ctdna2022'); ids.add('razavi2019'); }
  return Array.from(ids).filter((id) => REF_BY_ID[id]);
}

/* ---- statistical helpers for the learning tools ---- */
/** Probability of seeing at least k mutant reads when depth = D and true VAF = f (binomial tail). */
function detectionProbability(D, f, k) {
  if (f <= 0) return k <= 0 ? 1 : 0;
  if (f >= 1) return 1;
  if (k <= 0) return 1;
  let logp = D * Math.log1p(-f);          // log P(X = 0)
  let cum = 0;
  const lr = Math.log(f / (1 - f));
  for (let i = 0; i < k; i++) {
    cum += Math.exp(logp);
    logp += Math.log((D - i) / (i + 1)) + lr;
    if (!isFinite(logp)) break;
  }
  return Math.max(0, Math.min(1, 1 - cum));
}
/** Smallest VAF that gives >= target detection probability (bisection). */
function lodVaf(D, k, target = 0.95) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (detectionProbability(D, mid, k) >= target) hi = mid; else lo = mid;
  }
  return hi;
}

/* =====================================================================
   12. STAGE 2 — AUDIT TRAIL, LIVE LOOK-UPS, EVIDENCE CONNECTORS
   ---------------------------------------------------------------------
   PLAIN-LANGUAGE GUIDE
   * AUDIT TRAIL: every important action (loading a case, editing a
     variant, confirming, running a look-up, exporting) is written to a
     list. Each entry carries a fingerprint (SHA-256 hash) of the entry
     before it, so changing or deleting an old entry breaks the chain and
     the "Verify" button on the Connect page shows it. The list lives in
     this browser tab only and holds NO patient identifiers.
   * LIVE LOOK-UPS: when YOU switch them on, the app can ask public
     services (NCBI ClinVar/PubMed, ClinicalTrials.gov, openFDA) a
     question. What is sent is shown first: gene symbols, variant names,
     a tumour-type label, and drug names. Answers are shown with the
     time they were retrieved and the exact question asked.
   * If a service cannot be reached the app says so and shows NOTHING in
     its place. It never fills a gap with invented data.
   * OncoKB is licensed: its token must never sit in a web page. It is
     only reachable through the small local proxy in /server, which
     keeps the token on your own computer.
   ===================================================================== */
const APP_VERSION = '2.0.0';
/** Set to true by the hosted build (the hosting page blocks outside connections, printing and downloads). */
const HOSTED = !!(typeof window !== 'undefined' && window.ONCO_HOSTED);
const AUDIT_KEY = 'onco-ngs-reader/audit/v1';
const LIVE_CFG_KEY = 'onco-ngs-reader/live-config';

/* ---------- SHA-256 (pure JavaScript, so it works everywhere and in order) ---------- */
const sha256 = (() => {
  const K = [], H0 = [];
  const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296);
  for (let n = 2, c = 0; c < 64; n++) {
    let prime = true;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
    if (!prime) continue;
    if (c < 8) H0[c] = frac(Math.sqrt(n));
    K[c++] = frac(Math.cbrt(n));
  }
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  return function sha256(str) {
    const bytes = new TextEncoder().encode(String(str));
    const l = bytes.length, bitLen = l * 8, total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bitLen / 4294967296)); dv.setUint32(total - 4, bitLen >>> 0);
    const H = H0.slice(), w = new Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map((x) => x.toString(16).padStart(8, '0')).join('');
  };
})();

/* ---------- audit trail (hash-chained) ---------- */
const ZERO_HASH = '0'.repeat(64);
const audit = { log: [], last: {} };
const auditEntryHash = (prev, seq, ts, action, detail) => sha256([prev, seq, ts, action, detail].join('|'));
function auditHead() { return audit.log.length ? audit.log[audit.log.length - 1].hash : ZERO_HASH; }
function auditSave() { store.set('sessionStorage', AUDIT_KEY, audit.log); }
/** Append one entry. Keep `detail` free of patient identifiers (the app never puts any there). */
function auditAdd(action, detail = '') {
  const seq = audit.log.length + 1, ts = new Date().toISOString(), prev = auditHead();
  const d = String(detail).slice(0, 300);
  audit.log.push({ seq, ts, action, detail: d, prev, hash: auditEntryHash(prev, seq, ts, action, d) });
  auditSave();
}
/** Log at most once per `ms` for the same key (used for typing). */
function auditThrottled(key, action, detail, ms = 30000) {
  const now = Date.now();
  if (audit.last[key] && now - audit.last[key] < ms) return;
  audit.last[key] = now; auditAdd(action, detail);
}
function auditVerify(log = audit.log) {
  let prev = ZERO_HASH;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.seq !== i + 1 || e.prev !== prev || e.hash !== auditEntryHash(e.prev, e.seq, e.ts, e.action, e.detail)) return { ok: false, brokenAt: i + 1, count: log.length };
    prev = e.hash;
  }
  return { ok: true, count: log.length, head: prev };
}
function auditLoad() {
  const saved = store.get('sessionStorage', AUDIT_KEY);
  if (Array.isArray(saved) && saved.length) audit.log = saved;
  else auditAdd('session-start', `app ${APP_VERSION}; library ${KB_SNAPSHOT}${HOSTED ? '; hosted preview' : ''}`);
}

/* ---------- live look-up settings (opt-in, per session) ---------- */
function loadLiveConfig() {
  const cfg = store.get('localStorage', LIVE_CFG_KEY, {}) || {};
  state.live.oncokbUrl = typeof cfg.oncokbUrl === 'string' ? cfg.oncokbUrl : '';
}
function saveLiveConfig() { store.set('localStorage', LIVE_CFG_KEY, { oncokbUrl: state.live.oncokbUrl }); }

/* ---------- one careful way to call outside services ---------- */
let liveLastCall = 0;
const LIVE_GAP_MS = 400; // NCBI asks for no more than 3 requests per second without a key
async function liveFetch(connector, url, query) {
  if (HOSTED) return { ok: false, error: 'Live look-ups are not available in the hosted preview: the host blocks outside connections. Run the app locally (see the README) to use them.' };
  if (!state.live.enabled) return { ok: false, error: 'Live look-ups are switched off. Turn them on in Connect → Live look-ups.' };
  const wait = Math.max(0, liveLastCall + LIVE_GAP_MS - Date.now());
  liveLastCall = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) { auditAdd('live-lookup', `${connector} HTTP ${res.status} · ${query}`); return { ok: false, status: res.status, error: `${connector} answered HTTP ${res.status}. Nothing was retrieved.` }; }
    const json = await res.json();
    auditAdd('live-lookup', `${connector} OK · ${query}`);
    return { ok: true, json, url, retrievedAt: new Date().toISOString() };
  } catch (e) {
    clearTimeout(timer);
    const why = e && e.name === 'AbortError' ? 'timed out after 15 seconds' : 'could not connect (network policy, CORS, offline or blocked)';
    auditAdd('live-lookup', `${connector} FAILED: ${why} · ${query}`);
    return { ok: false, error: `${connector}: ${why}. No data was retrieved and none is shown.` };
  }
}

const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const NCBI_TOOL = '&tool=onco-ngs-reader';
const enc = encodeURIComponent;

/* ---------- ClinVar ---------- */
function reviewStars(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return null;
  if (s.includes('practice guideline')) return 4;
  if (s.includes('expert panel')) return 3;
  if (s.includes('multiple submitters') && s.includes('no conflicts')) return 2;
  if (s.includes('conflicting')) return 1;
  if (s.includes('single submitter')) return 1;
  if (s.includes('no assertion') || s.includes('no classification') || s.includes('no interpretation')) return 0;
  return null;
}
/** Words ClinVar might use for this variant, most specific first. */
function clinvarQueries(v) {
  const nv = normVariant(v), g = nv.gene;
  const cd = String(v.hgvsC || '').trim().replace(/^c\./i, '');
  const p1 = /^[A-Z]\d+[A-Z*]$/.test(nv.p) ? nv.p : '';
  const p3 = p1 ? `p.${AA1TO3[p1[0]]}${p1.slice(1, -1)}${AA1TO3[p1.slice(-1)]}` : '';
  const q = [];
  if (v.transcript && /\.\d+$/.test(v.transcript) && cd) q.push({ label: 'HGVS transcript + c.', term: `${v.transcript}:c.${cd}` });
  if (cd) q.push({ label: 'gene + c.', term: `${g}[gene] AND "c.${cd}"` });
  if (p3) q.push({ label: 'gene + p. (3-letter)', term: `${g}[gene] AND "${p3}"` });
  if (p1) q.push({ label: 'gene + one-letter change', term: `${g} ${p1}` });
  return { queries: q, needles: [p3, cd ? `c.${cd}` : '', p1 ? `p.${p1}` : ''].filter(Boolean).map((x) => x.toLowerCase()) };
}
function parseClinvarDoc(d) {
  const cls = [];
  const add = (type, o) => {
    if (!o || (!o.description && !o.review_status)) return;
    cls.push({ type, description: o.description || '', review: o.review_status || '', stars: reviewStars(o.review_status), last: String(o.last_evaluated || '').slice(0, 10), traits: (o.trait_set || []).map((t) => t.trait_name).filter(Boolean).slice(0, 4) });
  };
  add('Germline classification', d.germline_classification || d.clinical_significance);
  add('Somatic clinical impact', d.clinical_impact_classification);
  add('Oncogenicity classification', d.oncogenicity_classification);
  return { uid: String(d.uid || ''), accession: d.accession || d.accession_version || '', title: d.title || (d.variation_set && d.variation_set[0] && d.variation_set[0].variation_name) || '', objType: d.obj_type || '', genes: (d.genes || []).map((x) => x.symbol).filter(Boolean), classifications: cls };
}
function clinvarNameBlob(d) {
  const names = [d.title || ''].concat((d.variation_set || []).map((x) => `${x.variation_name || ''} ${x.cdna_change || ''}`));
  return names.join(' ').toLowerCase();
}
async function retrieveClinVar(v) {
  const nv = normVariant(v);
  const key = `${v.id}:clinvar`;
  if (!nv.gene || ['fusion', 'rearrangement', 'amplification', 'deletion'].includes(v.type)) {
    state.live.results[key] = { error: 'ClinVar is not suited to fusions or copy-number alterations. Nothing was queried.', at: new Date().toISOString() }; saveState(); return;
  }
  const { queries, needles } = clinvarQueries(v);
  if (!queries.length) { state.live.results[key] = { error: 'Enter a protein (p.) or cDNA (c.) change to build a ClinVar query.', at: new Date().toISOString() }; saveState(); return; }
  const tried = [];
  for (const q of queries) {
    const url = `${NCBI}esearch.fcgi?db=clinvar&term=${enc(q.term)}&retmode=json&retmax=20${NCBI_TOOL}`;
    const r = await liveFetch('NCBI ClinVar', url, q.term);
    if (!r.ok) { state.live.results[key] = { error: r.error, at: new Date().toISOString(), tried }; saveState(); return; }
    const ids = (r.json && r.json.esearchresult && r.json.esearchresult.idlist) || [];
    tried.push({ term: q.term, label: q.label, hits: ids.length });
    if (!ids.length) continue;
    const sUrl = `${NCBI}esummary.fcgi?db=clinvar&id=${ids.join(',')}&retmode=json${NCBI_TOOL}`;
    const s = await liveFetch('NCBI ClinVar', sUrl, `summary of ${ids.length} record(s)`);
    if (!s.ok) { state.live.results[key] = { error: s.error, at: new Date().toISOString(), tried }; saveState(); return; }
    const res = (s.json && s.json.result) || {};
    const docs = (res.uids || ids).map((u) => res[u]).filter(Boolean);
    const exact = [], other = [];
    docs.forEach((d) => { const blob = clinvarNameBlob(d); (needles.some((n) => blob.includes(n)) ? exact : other).push(parseClinvarDoc(d)); });
    if (exact.length || q === queries[queries.length - 1]) {
      state.live.results[key] = { at: s.retrievedAt, query: q.term, queryUrl: url, tried, exact, other, total: ids.length }; saveState(); return;
    }
  }
  state.live.results[key] = { at: new Date().toISOString(), query: queries[queries.length - 1].term, tried, exact: [], other: [], total: 0 };
  saveState();
}

/* ---------- PubMed ---------- */
async function retrievePubMed(v) {
  const key = `${v.id}:pubmed`, nv = normVariant(v);
  const cond = CANCER_SEARCH[state.case.cancer] || '';
  const term = [`${nv.gene}[Title/Abstract]`, v.variant ? `"${String(v.variant).replace(/^p\./i, '')}"` : '', cond ? `${cond}[Title/Abstract]` : ''].filter(Boolean).join(' AND ');
  const r = await liveFetch('NCBI PubMed', `${NCBI}esearch.fcgi?db=pubmed&term=${enc(term)}&retmax=6&sort=relevance&retmode=json${NCBI_TOOL}`, term);
  if (!r.ok) { state.live.results[key] = { error: r.error, at: new Date().toISOString() }; saveState(); return; }
  const ids = (r.json.esearchresult && r.json.esearchresult.idlist) || [];
  if (!ids.length) { state.live.results[key] = { at: r.retrievedAt, query: term, items: [] }; saveState(); return; }
  const s = await liveFetch('NCBI PubMed', `${NCBI}esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${NCBI_TOOL}`, `summary of ${ids.length} PMIDs`);
  if (!s.ok) { state.live.results[key] = { error: s.error, at: new Date().toISOString() }; saveState(); return; }
  const res = s.json.result || {};
  const items = (res.uids || ids).map((u) => res[u]).filter(Boolean).map((d) => ({ pmid: String(d.uid), title: d.title || '', journal: d.fulljournalname || d.source || '', date: d.pubdate || '', first: (d.authors && d.authors[0] && d.authors[0].name) || '' }));
  state.live.results[key] = { at: s.retrievedAt, query: term, items }; saveState();
}

/* ---------- ClinicalTrials.gov (API v2) ---------- */
function parseTrials(json) {
  return {
    total: typeof json.totalCount === 'number' ? json.totalCount : null,
    studies: (json.studies || []).map((s) => {
      const p = s.protocolSection || {}, id = p.identificationModule || {}, st = p.statusModule || {}, ds = p.designModule || {};
      const sp = (p.sponsorCollaboratorsModule || {}).leadSponsor || {}, cl = p.conditionsModule || {}, ar = p.armsInterventionsModule || {};
      const loc = (p.contactsLocationsModule || {}).locations || [];
      return { nct: id.nctId || '', title: id.briefTitle || '', status: st.overallStatus || '', phases: ds.phases || [], sponsor: sp.name || '', conditions: (cl.conditions || []).slice(0, 4), interventions: (ar.interventions || []).map((i) => i.name).filter(Boolean).slice(0, 4), countries: Array.from(new Set(loc.map((l) => l.country).filter(Boolean))).slice(0, 6) };
    })
  };
}
async function retrieveTrials(gene) {
  const key = `trials:${gene}`;
  const cond = CANCER_SEARCH[state.case.cancer] || state.case.histology || '';
  const url = `https://clinicaltrials.gov/api/v2/studies?${cond ? 'query.cond=' + enc(cond) + '&' : ''}query.term=${enc(gene)}&filter.overallStatus=RECRUITING&pageSize=10&countTotal=true&format=json`;
  const r = await liveFetch('ClinicalTrials.gov', url, `${cond || 'any condition'} · ${gene} · recruiting`);
  if (!r.ok) { state.live.results[key] = { error: r.error, at: new Date().toISOString() }; saveState(); return; }
  state.live.results[key] = Object.assign({ at: r.retrievedAt, query: `${cond || 'any condition'} · ${gene} · recruiting`, queryUrl: url }, parseTrials(r.json)); saveState();
}

/* ---------- openFDA drug labels ---------- */
/** Only words that look like generic drug names (by their standard endings) are sent to openFDA. */
const DRUG_SUFFIX = /(mab|nib|parib|ciclib|lisib|rasib|tecan|estrant|terone|lutamide|staurin|platin|taxel)$/;
function genericNames(drug) {
  const words = String(drug).toLowerCase().split(/[\s+,/±()–—-]+/).map((t) => t.replace(/[^a-z]/g, ''));
  return Array.from(new Set(words.filter((t) => t.length >= 6 && DRUG_SUFFIX.test(t)))).slice(0, 4);
}
function parseFda(json) {
  const rs = (json.results || []).filter((r) => r && r.indications_and_usage);
  if (!rs.length) return null;
  rs.sort((a, b) => String(b.effective_time || '').localeCompare(String(a.effective_time || '')));
  const r = rs[0], of = r.openfda || {};
  return { brand: (of.brand_name || []).join(', '), generic: (of.generic_name || []).join(', '), effective: String(r.effective_time || ''), version: String(r.version || ''), setId: r.set_id || '', indications: (r.indications_and_usage || []).join(' ').replace(/\s+/g, ' ').trim() };
}
async function retrieveFda(name) {
  const key = `fda:${name}`;
  const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${enc(name)}%22&limit=5`;
  const r = await liveFetch('openFDA', url, `label for ${name}`);
  if (!r.ok) { state.live.results[key] = { error: r.status === 404 ? `openFDA found no label for “${name}”. This does not mean the drug is unapproved.` : r.error, at: new Date().toISOString() }; saveState(); return; }
  const p = parseFda(r.json);
  state.live.results[key] = p ? Object.assign({ at: r.retrievedAt, query: `label for ${name}`, queryUrl: url }, p) : { at: r.retrievedAt, error: `openFDA returned no label text for “${name}”.` };
  saveState();
}

/* ---------- OncoKB through the local proxy only ---------- */
const ONCOTREE = { nsclc: 'NSCLC', breast: 'BRCA', crc: 'COADREAD', melanoma: 'MEL', prostate: 'PRAD', pancreatic: 'PAAD', gastric: 'STAD', biliary: 'CHOL', urothelial: 'BLCA', gist: 'GIST', aml: 'AML', cml: 'CML' };
function proxyBase() { return String(state.live.oncokbUrl || '').trim().replace(/\/+$/, ''); }
function parseOncokb(r) {
  return {
    oncogenic: r.oncogenic || '', effect: (r.mutationEffect && r.mutationEffect.knownEffect) || '',
    sensitive: r.highestSensitiveLevel || '', resistance: r.highestResistanceLevel || '',
    diagnostic: r.highestDiagnosticImplicationLevel || '', prognostic: r.highestPrognosticImplicationLevel || '',
    treatments: (r.treatments || []).slice(0, 12).map((t) => ({ level: t.level || '', drugs: (t.drugs || []).map((d) => d.drugName).filter(Boolean).join(' + '), cancer: (t.levelAssociatedCancerType && (t.levelAssociatedCancerType.name || t.levelAssociatedCancerType.mainType)) || '' })),
    dataVersion: (r.dataVersion || ''), lastUpdate: r.lastUpdate || ''
  };
}
async function retrieveOncokb(v) {
  const key = `${v.id}:oncokb`, nv = normVariant(v);
  const base = proxyBase();
  if (!base) { state.live.results[key] = { error: 'No local OncoKB proxy address is set. See Connect → OncoKB.', at: new Date().toISOString() }; saveState(); return; }
  const alt = /^[A-Z]\d+[A-Z*]$/.test(nv.p) ? nv.p : (v.variant || '').replace(/^p\./i, '');
  if (!alt) { state.live.results[key] = { error: 'OncoKB needs a protein change (for example L858R).', at: new Date().toISOString() }; saveState(); return; }
  const tumor = ONCOTREE[state.case.cancer] || '';
  const url = `${base}/api/oncokb/annotate?hugoSymbol=${enc(nv.gene)}&alteration=${enc(alt)}${tumor ? '&tumorType=' + enc(tumor) : ''}`;
  const r = await liveFetch('OncoKB (local proxy)', url, `${nv.gene} ${alt}${tumor ? ' · ' + tumor : ''}`);
  if (!r.ok) { state.live.results[key] = { error: r.error, at: new Date().toISOString() }; saveState(); return; }
  state.live.results[key] = Object.assign({ at: r.retrievedAt, query: `${nv.gene} ${alt}${tumor ? ' · tumorType ' + tumor : ' · no tumour type sent'}` }, parseOncokb(r.json)); saveState();
}

/* ---------- connection tests ---------- */
const CONNECTORS = [
  { key: 'clinvar', name: 'NCBI ClinVar', host: 'eutils.ncbi.nlm.nih.gov', sends: 'Gene symbol and variant name (for example p.Leu858Arg or NM_005228.5:c.2573T>G).', test: () => `${NCBI}esearch.fcgi?db=clinvar&term=BRAF%5Bgene%5D+AND+V600E&retmode=json&retmax=1${NCBI_TOOL}`, doc: 'ncbi_eutils' },
  { key: 'pubmed', name: 'NCBI PubMed', host: 'eutils.ncbi.nlm.nih.gov', sends: 'Gene symbol, protein change and a tumour-type label.', test: () => `${NCBI}esearch.fcgi?db=pubmed&term=EGFR&retmax=1&retmode=json${NCBI_TOOL}`, doc: 'ncbi_eutils' },
  { key: 'trials', name: 'ClinicalTrials.gov', host: 'clinicaltrials.gov', sends: 'Tumour-type label and gene symbol; recruiting studies only.', test: () => 'https://clinicaltrials.gov/api/v2/studies?query.term=EGFR&pageSize=1&format=json', doc: 'ctgov_api' },
  { key: 'fda', name: 'openFDA drug labels', host: 'api.fda.gov', sends: 'Drug generic names.', test: () => 'https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22osimertinib%22&limit=1', doc: 'openfda' },
  { key: 'oncokb', name: 'OncoKB (your local proxy)', host: 'address you set', sends: 'Gene, protein change and an OncoTree code, to YOUR proxy, which adds your licensed token and forwards to OncoKB.', test: () => `${proxyBase()}/api/health`, doc: 'oncokb_api' }
];
async function testConnector(key) {
  const c = CONNECTORS.find((x) => x.key === key); if (!c) return;
  if (key === 'oncokb' && !proxyBase()) { state.live.status[key] = { ok: false, at: new Date().toISOString(), detail: 'No proxy address set.' }; return; }
  const r = await liveFetch(c.name, c.test(), 'connection test');
  state.live.status[key] = { ok: r.ok, at: new Date().toISOString(), detail: r.ok ? (key === 'oncokb' ? (r.json && r.json.oncokbConfigured ? 'Proxy reachable; token configured.' : 'Proxy reachable; NO OncoKB token configured on it.') : 'Reachable.') : r.error };
}

/* ---------- small renderers for retrieved data ---------- */
const stamp = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');
const liveBtn = (action, attrs, label) => {
  const off = HOSTED || !state.live.enabled;
  return `<button class="btn btn-secondary btn-sm" data-action="${action}" ${attrs}${off ? ' aria-disabled="true"' : ''} title="${off ? (HOSTED ? 'Not available in the hosted preview' : 'Switch on live look-ups in Connect first') : 'Sends the query shown on the Connect page'}">${esc(label)}</button>`;
};
const liveError = (r) => `<p class="live-err" role="alert">${esc(r.error)}</p>`;
const liveProv = (r, extra = '') => `<p class="small muted prov">${chip('Retrieved live', 'mint')} ${esc(stamp(r.at))}${r.query ? ' · question: ' + esc(r.query) : ''}${extra}</p>`;

function clinvarBlock(v) {
  const r = state.live.results[`${v.id}:clinvar`];
  if (!r) return '';
  if (r.error) return liveError(r);
  const rec = (c) => `<li><strong>${esc(c.type)}:</strong> ${esc(c.description || '—')}${c.stars !== null ? ` · <span class="stars" title="ClinVar review status">${'★'.repeat(c.stars)}${'☆'.repeat(4 - c.stars)}</span> ${c.stars}/4` : ''}<div class="small muted">${esc(c.review || 'review status not given')}${c.last ? ' · last evaluated ' + esc(c.last) : ''}${c.traits.length ? ' · ' + esc(c.traits.join('; ')) : ''}</div></li>`;
  const card = (d) => `<div class="cv-rec"><div><strong>${esc(d.title || 'ClinVar record')}</strong> ${extLink('https://www.ncbi.nlm.nih.gov/clinvar/variation/' + d.uid + '/', d.accession || 'open')}</div>${d.classifications.length ? `<ul class="plain">${d.classifications.map(rec).join('')}</ul>` : '<p class="small muted">No classification fields were returned for this record.</p>'}</div>`;
  let h = liveProv(r, r.tried && r.tried.length ? ` · ${r.tried.map((t) => t.hits + ' hit(s) for “' + esc(t.term) + '”').join('; ')}` : '');
  h += r.exact.length ? `<p class="small"><strong>${r.exact.length} record(s) whose name matches the variant you entered:</strong></p>${r.exact.map(card).join('')}` : `<p class="muted">No ClinVar record with a name matching this exact variant was found. <strong>This does not prove the variant is absent from ClinVar</strong> (naming differences, transcript versions); search ClinVar yourself.</p>`;
  if (r.other && r.other.length) h += `<details class="detail-box"><summary>${r.other.length} other record(s) returned by the search (names do not match — not the same variant)</summary>${r.other.map(card).join('')}</details>`;
  h += `<p class="small muted">Read each classification <em>type</em> separately: germline pathogenicity, somatic clinical impact and oncogenicity are different questions.</p>`;
  return h;
}
function pubmedBlock(v) {
  const r = state.live.results[`${v.id}:pubmed`]; if (!r) return '';
  if (r.error) return liveError(r);
  return liveProv(r) + (r.items.length ? `<ul class="plain">${r.items.map((i) => `<li>${esc(i.first)} ${esc(i.journal)} ${esc(i.date)} — ${esc(i.title)} ${extLink('https://pubmed.ncbi.nlm.nih.gov/' + i.pmid + '/', 'PMID ' + i.pmid)}</li>`).join('')}</ul><p class="small muted">Ranked by PubMed relevance; this is a literature search, not an evidence appraisal.</p>` : '<p class="muted">No PubMed results for this query.</p>');
}
function oncokbBlock(v) {
  const r = state.live.results[`${v.id}:oncokb`]; if (!r) return '';
  if (r.error) return liveError(r);
  return liveProv(r, ' · via your local proxy') + kv([
    ['Oncogenic', esc(r.oncogenic || '—')], ['Mutation effect', esc(r.effect || '—')], ['Highest sensitive level', esc(r.sensitive || '—')], ['Highest resistance level', esc(r.resistance || '—')],
    ['Diagnostic / prognostic', esc([r.diagnostic, r.prognostic].filter(Boolean).join(' / ') || '—')], ['OncoKB data version', esc(r.dataVersion || 'not returned')]
  ]) + (r.treatments.length ? `<div class="table-wrap"><table class="table table-compact"><thead><tr><th>Level</th><th>Drug(s)</th><th>Cancer type</th></tr></thead><tbody>${r.treatments.map((t) => `<tr><td>${esc(t.level)}</td><td>${esc(t.drugs)}</td><td>${esc(t.cancer)}</td></tr>`).join('')}</tbody></table></div>` : '') + `<p class="small muted">OncoKB content is licensed; check the terms for clinical-reporting use. Levels are versioned: cite the data version and date.</p>`;
}
function fdaBlock(name) {
  const r = state.live.results[`fda:${name}`]; if (!r) return '';
  if (r.error) return liveError(r);
  const ex = r.indications.length > 650 ? r.indications.slice(0, 650) + '…' : r.indications;
  const eff = /^\d{8}$/.test(r.effective) ? `${r.effective.slice(0, 4)}-${r.effective.slice(4, 6)}-${r.effective.slice(6)}` : r.effective;
  return `<div class="fda-box">${liveProv(r)}<p class="small"><strong>${esc(r.brand || r.generic || name)}</strong> · label effective ${esc(eff || 'date not given')}${r.version ? ' · version ' + esc(r.version) : ''}${r.setId ? ' · ' + extLink('https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=' + r.setId, 'DailyMed') : ''}</p><p class="small">${esc(ex)}</p><p class="small muted">Label text is shown verbatim; the app does not judge whether it supports the curated entry. Compare the wording yourself.</p></div>`;
}
function trialsBlock(gene) {
  const r = state.live.results[`trials:${gene}`]; if (!r) return '';
  if (r.error) return liveError(r);
  return liveProv(r, r.total !== null ? ` · ${r.total} recruiting stud${r.total === 1 ? 'y' : 'ies'} matched; first ${r.studies.length} shown` : '') + (r.studies.length ? `<div class="table-wrap"><table class="table table-compact"><thead><tr><th>NCT</th><th>Title</th><th>Phase / status</th><th>Interventions · countries</th></tr></thead><tbody>${r.studies.map((s) => `<tr><td>${extLink('https://clinicaltrials.gov/study/' + s.nct, s.nct)}</td><td>${esc(s.title)}<div class="small muted">${esc(s.sponsor)}</div></td><td>${esc((s.phases || []).join(', ').replace(/PHASE/g, 'Phase ') || '—')}<div class="small muted">${esc(s.status)}</div></td><td>${esc(s.interventions.join('; ') || '—')}<div class="small muted">${esc(s.countries.join(', '))}</div></td></tr>`).join('')}</tbody></table></div><p class="small muted">The app does not check eligibility. Read the protocol and confirm sites and criteria.</p>` : '<p class="muted">No recruiting studies matched this query.</p>');
}

/* =====================================================================
   13. STAGE 2 — PDF VIEWER AND EXPERIMENTAL TEXT EXTRACTION
   ---------------------------------------------------------------------
   HOW IT WORKS (plain language)
   * The PDF is opened inside your browser with the bundled pdf.js
     library (folder vendor/pdfjs). It is NOT uploaded anywhere.
   * "Extract" reads the selectable text on each page and looks for gene
     names next to variant descriptions, VAF, depth, fusions, copy
     number, and a few case-level items (TMB, MSI, tumour content…).
   * Everything found is only a PROPOSAL. You choose which items to add;
     each added item is marked "extracted — verify" and must be checked
     against the page it came from before the findings can be confirmed.
   LIMITS (stated honestly)
   * Only PDFs with selectable text. Scanned images need OCR, which is
     not included — the app tells you when no text is found.
   * Report layouts vary widely. This heuristic has been tried only on
     invented (synthetic) test reports, so its real-world sensitivity and
     error rate are UNKNOWN. Treat a missing item as "not found", never as
     "absent from the report".
   * The extracted text is held in memory only. It is never saved, never
     logged, and is discarded when you remove the file.
   ===================================================================== */

const pdfState = { doc: null, page: 1, scale: 1.25, renderTask: null, bytes: null };
const pdfjsReady = () => typeof window !== 'undefined' && window.pdfjsLib;

function pdfConfigure() {
  if (!pdfjsReady()) return false;
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.ONCO_PDF_WORKER_SRC || 'vendor/pdfjs/pdf.worker.min.js';
  }
  return true;
}
async function pdfOpen(file) {
  pdfClose();
  if (!pdfConfigure()) throw new Error('The PDF library (folder vendor/pdfjs) was not found next to index.html. Copy the whole project folder.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  pdfState.bytes = bytes;
  pdfState.doc = await window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  pdfState.page = 1;
  return pdfState.doc.numPages;
}
function pdfClose() {
  try { if (pdfState.renderTask) pdfState.renderTask.cancel(); } catch (e) { /* ignore */ }
  try { if (pdfState.doc) pdfState.doc.destroy(); } catch (e) { /* ignore */ }
  pdfState.doc = null; pdfState.bytes = null; pdfState.renderTask = null; pdfState.page = 1;
  state.extract = null;
}
async function pdfRender() {
  const canvas = $('#pdfCanvas'); if (!canvas || !pdfState.doc) return;
  try { if (pdfState.renderTask) pdfState.renderTask.cancel(); } catch (e) { /* ignore */ }
  const n = Math.min(Math.max(1, pdfState.page), pdfState.doc.numPages); pdfState.page = n;
  const page = await pdfState.doc.getPage(n);
  const vp = page.getViewport({ scale: pdfState.scale });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = '100%'; canvas.style.maxWidth = `${Math.floor(vp.width)}px`; canvas.style.height = 'auto';
  const ctx = canvas.getContext('2d');
  const task = page.render({ canvasContext: ctx, viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
  pdfState.renderTask = task;
  try { await task.promise; } catch (e) { /* cancelled by a newer render */ }
  const lbl = $('#pdfPageLabel'); if (lbl) lbl.textContent = `Page ${n} of ${pdfState.doc.numPages}`;
}
function pdfGoto(n) { pdfState.page = Number(n) || 1; pdfRender(); const v = $('#pdfViewer'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

/* ---------- reading the text, line by line ---------- */
async function pdfReadLines(onProgress) {
  const pages = [];
  for (let i = 1; i <= pdfState.doc.numPages; i++) {
    const page = await pdfState.doc.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items.filter((it) => it.str && it.str.trim() !== '').map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = []; let cur = null;
    for (const it of items) {
      if (cur && Math.abs(cur.y - it.y) <= 3) cur.items.push(it);
      else { cur = { y: it.y, items: [it] }; rows.push(cur); }
    }
    const lines = rows.map((r) => {
      r.items.sort((a, b) => a.x - b.x);
      let out = '', prevEnd = null;
      r.items.forEach((it) => {
        if (prevEnd !== null) { const gap = it.x - prevEnd; out += gap > 14 ? ' | ' : gap > 0.5 ? ' ' : ''; }
        out += it.s; prevEnd = it.x + it.w;
      });
      return out.trim();
    }).filter(Boolean);
    pages.push({ n: i, lines });
    if (onProgress) onProgress(i, pdfState.doc.numPages);
  }
  return pages;
}

/* ---------- proposing findings from lines (pure functions: easy to test) ---------- */
const EXTRACT_GENES = Object.keys(GENES).concat(['HER2']);
const GENE_RX = new RegExp(`(?<![A-Za-z0-9])(${EXTRACT_GENES.join('|')})(?![A-Za-z0-9])`, 'g');
const RX = {
  p3: /p\.\(?((?:[A-Z][a-z]{2}\d+(?:_[A-Z][a-z]{2}\d+)?(?:delins[A-Za-z]*|del[A-Za-z]*|dup[A-Za-z]*|ins[A-Za-z]*)|[A-Z][a-z]{2}\d+(?:[A-Z][a-z]{2})?fs(?:Ter|\*)?\d*|[A-Z][a-z]{2}\d+(?:[A-Z][a-z]{2}|Ter|\*)))\)?/,
  p1: /(?<![A-Za-z0-9_.])(?:p\.)?([A-Z]\d{2,4}[A-Z*])(?![A-Za-z0-9])/,
  c: /c\.[\d_+\-*]+(?:[ACGT]>[ACGT]|(?:delins|del|dup|ins)[ACGT\d]*)/,
  nm: /N[MR]_\d+\.\d+/,
  vafLabel: /(?:VAF|variant allele (?:fraction|frequency)|allele(?:ic)? (?:fraction|frequency)|\bAF\b)[^\d|]{0,20}(\d{1,3}(?:\.\d+)?)\s*%?/i,
  pct: /(\d{1,3}(?:\.\d+)?)\s*%/g,
  depthX: /(\d{2,6})\s*[x×]/i,
  depthLabel: /(?:depth|coverage|reads?)[^\d|]{0,15}(\d{2,6})/i,
  exon: /exon\s*(\d{1,2})\s*(skipping|deletion|insertion|duplication)/i,
  cn: /(?:copy[- ]number|\bCN\b|copies)[^\d|]{0,10}(\d+(?:\.\d+)?)/i,
  fusionWord: /fusion|rearrang|translocation/i,
  fusionPair: /(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,9})\s*(?:::|\/|-)\s*([A-Z][A-Z0-9]{1,9})(?![A-Za-z0-9])/
};
/** True when the text around a gene says the alteration was NOT found (so it must never be proposed). */
const NEG_AFTER = /\b(?:not (?:detected|identified|observed|found|seen)|none (?:detected|identified|found)|no (?:evidence|pathogenic|alteration|mutation|variant|amplification|fusion|rearrangement|deletion)|negative|wild[- ]?type|absent|without|no change|unaltered)\b/i;
const NEG_BEFORE = /\b(?:no|not|negative for|without|absence of|absent|no evidence of)\s*(?:\w+\s+){0,2}$/i;
function isNegated(before, seg) { return NEG_AFTER.test(seg) || NEG_BEFORE.test(before.slice(-40)); }
function inferType(p3, p1, c, segment) {
  const s = segment.toLowerCase();
  if (/amplif/.test(s)) return 'amplification';
  if (/homozygous deletion|deep deletion|biallelic (?:loss|deletion)|gene deletion/.test(s)) return 'deletion';
  if (/skipping/.test(s)) return 'splice';
  if (p3) { if (/fs/.test(p3)) return 'frameshift'; if (/(del|dup|ins)/.test(p3)) return 'inframe'; if (/(Ter|\*)$/.test(p3)) return 'nonsense'; return 'missense'; }
  if (p1) return /\*$/.test(p1) ? 'nonsense' : 'missense';
  if (c) { if (/[+-]\d+[ACGT]>/.test(c)) return 'splice'; if (/(del|dup|ins)/.test(c)) return 'inframe'; return 'missense'; }
  if (/exon\s*\d+\s*(deletion|insertion|duplication)/.test(s)) return 'inframe';
  return '';
}
/** Turn text lines into candidate findings. `pages` = [{n, lines:[...]}]. */
function proposeVariants(pages) {
  const out = []; const seen = new Set();
  pages.forEach((pg) => {
    const header = pg.lines.some((l) => /VAF|allele (fraction|frequency)/i.test(l) && /\|/.test(l) && !RX.p3.test(l) && !RX.c.test(l));
    pg.lines.forEach((line, li) => {
      // fusions first
      const fm = line.match(RX.fusionPair);
      if (fm && (RX.fusionWord.test(line) || /::/.test(line)) && !NEG_AFTER.test(line)) {
        const a = fm[1], b = fm[2];
        const known = (x) => !!GENES[normGene(x)];
        let gene = '', partner = '';
        if (known(b) && !known(a)) { gene = normGene(b); partner = a; } else if (known(a) && !known(b)) { gene = normGene(a); partner = b; } else if (known(a) && known(b)) { gene = normGene(b); partner = a; }
        if (gene) {
          const key = `${gene}|fusion|${partner}`;
          if (!seen.has(key)) {
            seen.add(key);
            const bp = line.match(/\((E\d+;\s*[A-Z]\d+|exon[^)]*)\)/i);
            const pctM = line.match(RX.vafLabel);
            out.push({ gene, variant: bp ? bp[1] : '', hgvsC: '', transcript: '', type: RX.fusionWord.test(line) && /rearrang/i.test(line) && !/fusion/i.test(line) ? 'rearrangement' : 'fusion', vaf: pctM ? pctM[1] : '', depth: '', partner: partner.toUpperCase(), cn: '', conf: 'medium', vafLabelled: true, page: pg.n, snippet: line.slice(0, 220) });
          }
          return;
        }
      }
      const hits = []; let m; GENE_RX.lastIndex = 0;
      while ((m = GENE_RX.exec(line))) hits.push({ g: m[1], i: m.index, end: m.index + m[1].length });
      hits.forEach((h, k) => {
        const segEnd = k + 1 < hits.length ? hits[k + 1].i : line.length;
        let seg = line.slice(h.end, segEnd);
        // wrapped table rows: if nothing useful follows the gene, borrow the next line when it has no gene
        let borrowed = false;
        if (!RX.p3.test(seg) && !RX.p1.test(seg) && !RX.c.test(seg) && !/amplif|deletion|skipping|rearrang/i.test(seg) && pg.lines[li + 1] && !GENE_RX.test(pg.lines[li + 1])) {
          GENE_RX.lastIndex = 0; const nxt = pg.lines[li + 1];
          if (RX.p3.test(nxt) || RX.c.test(nxt) || RX.p1.test(nxt)) { seg = seg + ' ' + nxt; borrowed = true; }
        }
        GENE_RX.lastIndex = 0;
        if (isNegated(line.slice(0, h.i), seg)) return;
        const p3m = seg.match(RX.p3), c = (seg.match(RX.c) || [''])[0];
        let p1m = seg.match(RX.p1);
        const exonM = seg.match(RX.exon);
        const isCNA = /amplif|homozygous deletion|deep deletion|biallelic (?:loss|deletion)|gene deletion/i.test(seg);
        if (!p3m && !p1m && !c && !exonM && !isCNA) return;
        const p3 = p3m ? p3m[1] : '', p1 = !p3m && p1m ? p1m[1] : '';
        const gene = normGene(h.g);
        let variant = p3 ? `p.${p3}` : p1 ? `p.${p1}` : exonM ? `exon ${exonM[1]} ${exonM[2].toLowerCase()}` : '';
        const type = inferType(p3, p1, c, exonM ? seg : seg);
        const nm = (line.match(RX.nm) || (borrowed ? pg.lines[li + 1].match(RX.nm) : null) || [''])[0];
        let vaf = '', vafLabelled = false;
        const lab = seg.match(RX.vafLabel) || (hits.length === 1 ? line.match(RX.vafLabel) : null);
        if (lab) { vaf = lab[1]; vafLabelled = true; }
        else {
          const pcts = Array.from(seg.matchAll(RX.pct)).map((x) => x[1]).filter((x) => Number(x) <= 100);
          if (pcts.length === 1) { vaf = pcts[0]; vafLabelled = header; }
        }
        const dm = seg.match(RX.depthX) || seg.match(RX.depthLabel);
        const cnm = isCNA ? seg.match(RX.cn) : null;
        const cn = type === 'deletion' ? (/homozygous|deep|biallelic/i.test(seg) ? '0' : (cnm ? cnm[1] : '')) : (cnm ? cnm[1] : '');
        const key = `${gene}|${variant || c}|${type}`;
        if (seen.has(key)) return; seen.add(key);
        const hasVar = !!(p3 || p1 || c || exonM || isCNA);
        out.push({ gene, variant, hgvsC: c, transcript: nm, type, vaf, depth: dm ? dm[1] : '', partner: '', cn, conf: hasVar && vaf !== '' && vafLabelled ? 'high' : 'medium', vafLabelled, page: pg.n, snippet: (borrowed ? line + ' ⏎ ' + pg.lines[li + 1] : line).slice(0, 260) });
      });
    });
  });
  return out.map((c, i) => Object.assign(c, { cid: `x${i}` }));
}
const CANCER_KEYWORDS = [
  ['nsclc', /non[- ]small[- ]cell|NSCLC|lung adenocarcinoma/i], ['sclc', /small[- ]cell lung/i], ['crc', /colorectal|colon (?:adeno)?carcinoma|rectal (?:adeno)?carcinoma/i],
  ['breast', /breast (?:cancer|carcinoma)|invasive ductal|invasive lobular/i], ['melanoma', /melanoma/i], ['ovarian', /ovarian|fallopian|primary peritoneal/i], ['prostate', /prostat/i],
  ['pancreatic', /pancrea/i], ['gastric', /gastric|gastro-?oesophageal|gastroesophageal|stomach/i], ['biliary', /cholangiocarcinoma|biliary/i], ['urothelial', /urothelial|bladder cancer/i],
  ['thyroid', /thyroid/i], ['gist', /\bGIST\b|gastrointestinal stromal/i], ['glioma', /glioma|glioblastoma|astrocytoma|oligodendroglioma/i], ['aml', /acute myeloid|\bAML\b/i], ['cml', /chronic myeloid|\bCML\b/i]
];
/** Case-level suggestions with the exact text they came from. */
function proposeCase(pages) {
  const all = pages.flatMap((p) => p.lines.map((l) => ({ l, n: p.n })));
  const text = all.map((x) => x.l).join('\n');
  const find = (rx) => { for (const x of all) { const m = x.l.match(rx); if (m) return { m, line: x.l, page: x.n }; } return null; };
  const out = [];
  const add = (field, label, value, hit) => { if (value !== '' && value !== undefined) out.push({ field, label, value, shown: String(value), snippet: hit.line.slice(0, 200), page: hit.page }); };
  let h;
  if ((h = find(/(?:TMB|tumou?r mutational burden)[^\d|]{0,30}(\d{1,3}(?:\.\d+)?)\s*(?:mut(?:ation)?s?)?\s*\/\s*Mb/i))) add('tmb', 'TMB (mutations/Mb)', h.m[1], h);
  if ((h = find(/\b(MSI-H|MSI-high|microsatellite instability[- ]high|high microsatellite instability)\b/i)) && !/\b(?:not|no|negative for)\b[^|.]{0,20}(MSI|microsatellite)/i.test(h.line)) add('msi', 'MSI status', 'MSI-H', h);
  else if ((h = find(/\b(MSS|microsatellite[- ]stable)\b/i))) add('msi', 'MSI status', 'MSS', h);
  if ((h = find(/\b(dMMR|MMR[- ]deficient|loss of (?:MLH1|MSH2|MSH6|PMS2))\b/i))) add('mmr', 'MMR immunohistochemistry', 'dMMR', h);
  else if ((h = find(/\b(pMMR|MMR[- ]proficient)\b/i))) add('mmr', 'MMR immunohistochemistry', 'pMMR', h);
  if ((h = find(/HRD[^|.\n]{0,40}\b(positive|negative)\b/i))) add('hrd', 'HRD', h.m[1].toLowerCase(), h);
  if ((h = find(/PD-?L1[^\n|]{0,60}?(TPS|CPS|IC)[^\d]{0,5}(\d{1,3})\s*%?/i))) add('pdl1', 'PD-L1', `${h.m[1].toUpperCase()} ${h.m[2]}%`, h);
  if ((h = find(/(?:tumou?r (?:content|purity|cellularity|percentage)|neoplastic cellularity)[^\d|]{0,20}(\d{1,3})\s*%/i))) add('purity', 'Tumour purity (%)', h.m[1], h);
  if (/\bplasma\b|cell-free|\bctDNA\b|liquid biopsy/i.test(text)) { const x = find(/plasma|cell-free|ctDNA|liquid biopsy/i); add('specimen', 'Specimen', 'liquid', x); }
  else if (/bone marrow|peripheral blood/i.test(text)) add('specimen', 'Specimen', 'marrow', find(/bone marrow|peripheral blood/i));
  else if (/FFPE|formalin|tissue|biops/i.test(text)) add('specimen', 'Specimen', 'tissue', find(/FFPE|formalin|tissue|biops/i));
  for (const [code, rx] of CANCER_KEYWORDS) { const x = find(rx); if (x) { add('cancer', 'Cancer type', code, x); break; } }
  return out;
}

async function runExtraction() {
  if (!pdfState.doc) return;
  const box = $('#extractResult'); box.innerHTML = '<p class="muted">Reading the PDF text…</p>';
  try {
    const pages = await pdfReadLines((i, n) => { box.innerHTML = `<p class="muted">Reading page ${i} of ${n}…</p>`; });
    const lineCount = pages.reduce((a, p) => a + p.lines.length, 0);
    const cands = proposeVariants(pages), caseSug = proposeCase(pages);
    state.extract = { pages, cands, caseSug, at: new Date().toISOString(), lineCount };
    auditAdd('pdf-extraction', `${pages.length} page(s), ${lineCount} text line(s), ${cands.length} candidate variant(s), ${caseSug.length} case suggestion(s)`);
  } catch (e) {
    state.extract = null; box.innerHTML = `<p class="live-err">The PDF text could not be read (${esc(e.message || 'unknown error')}). Nothing was extracted.</p>`;
    auditAdd('pdf-extraction', 'FAILED to read text'); return;
  }
  renderExtraction();
}

function renderExtraction() {
  const box = $('#extractResult'); if (!box) return;
  const x = state.extract;
  if (!x) { box.innerHTML = ''; return; }
  if (!x.lineCount) {
    box.innerHTML = callout('peach', 'No selectable text found', '<p>This PDF looks like a scanned image. OCR is not included in this version, so nothing could be extracted. Read the report in the viewer and enter the findings by hand.</p>');
    return;
  }
  const exist = new Set(state.variants.map((v) => `${normGene(v.gene)}|${normProtein(v.variant)}|${v.hgvsC}`));
  const rows = x.cands.map((c) => {
    const dup = exist.has(`${c.gene}|${normProtein(c.variant)}|${c.hgvsC}`);
    return `<tr><td><input type="checkbox" data-cand="${c.cid}" ${dup ? 'disabled' : ''} aria-label="Select ${esc(c.gene)} ${esc(c.variant)}"></td>
      <td><strong>${esc(c.partner ? c.partner + '::' + c.gene : c.gene)}</strong><div class="small muted">${esc(c.variant || c.hgvsC || '—')}${c.variant && c.hgvsC ? ' · ' + esc(c.hgvsC) : ''}</div></td>
      <td>${esc((TYPE_LABEL[c.type] || 'type unclear').split(' (')[0])}</td><td>${c.vaf !== '' ? esc(c.vaf) + '%' + (c.vafLabelled ? '' : ' <span class="small muted">(unlabelled)</span>') : '—'}</td><td>${c.depth !== '' ? esc(c.depth) + '×' : '—'}</td>
      <td>${chip(c.conf === 'high' ? 'More complete' : 'Partial', c.conf === 'high' ? 'mint' : 'peach')}${dup ? ' ' + chip('already added', 'grey') : ''}</td>
      <td class="small"><button class="link-btn" data-action="pdfGoto" data-p="${c.page}">p.${c.page}</button> <span class="mono">${esc(c.snippet)}</span></td></tr>`;
  }).join('');
  const cs = x.caseSug.map((s, i) => `<tr><td>${esc(s.label)}</td><td><strong>${esc(s.field === 'cancer' ? cancerLabel(s.value) : s.field === 'specimen' ? (SPECIMENS.find((q) => q[0] === s.value) || [0, s.value])[1] : s.shown)}</strong></td><td class="small"><button class="link-btn" data-action="pdfGoto" data-p="${s.page}">p.${s.page}</button> <span class="mono">${esc(s.snippet)}</span></td><td class="right">${s.applied ? chip('Applied — check the page', 'mint') : `<button class="btn btn-secondary btn-sm" data-action="applyCaseSug" data-i="${i}">Apply</button>`}</td></tr>`).join('');
  box.innerHTML = `<div class="callout callout-peach"><div class="callout-title">Experimental: proposals only</div><div class="callout-body"><p>Found ${x.lineCount} text lines on ${x.pages.length} page(s). Items below are <strong>proposals</strong>. Add only what you can see on the page; each added item must then be verified. A missing item means “not found by this heuristic”, not “absent from the report”. Tested only on synthetic fictional reports.</p></div></div>
    <h4 class="sub-title">Case-level suggestions</h4>
    ${cs ? `<div class="table-wrap"><table class="table table-compact"><tbody>${cs}</tbody></table></div>` : '<p class="muted">None found.</p>'}
    <h4 class="sub-title">Candidate alterations (${x.cands.length})</h4>
    ${rows ? `<div class="table-wrap"><table class="table table-compact"><thead><tr><th></th><th>Alteration</th><th>Type</th><th>VAF</th><th>Depth</th><th>Completeness</th><th>Source text</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="btn-row"><button class="btn btn-primary" data-action="addCands">Add selected to findings</button><button class="btn btn-ghost" data-action="selectAllCands">Select all</button></div>` : '<p class="muted">No candidate alterations found.</p>'}
    <details class="detail-box"><summary>Show all extracted text (so you can see what the heuristic saw)</summary><div class="mono pre-text">${x.pages.map((p) => `<div class="pg-head">— page ${p.n} —</div>` + p.lines.slice(0, 400).map((l) => `<div>${esc(l)}</div>`).join('')).join('')}</div></details>`;
}

function addCandidates() {
  const x = state.extract; if (!x) return;
  const ids = $$('#extractResult [data-cand]:checked').map((e) => e.dataset.cand);
  if (!ids.length) { toast('Tick at least one candidate first.'); return; }
  let n = 0;
  ids.forEach((id) => {
    const c = x.cands.find((q) => q.cid === id); if (!c) return;
    state.variants.push(Object.assign(emptyVariant(), { gene: c.gene, variant: c.variant, hgvsC: c.hgvsC, transcript: c.transcript, type: c.type, vaf: c.vaf, depth: c.depth, partner: c.partner, cn: c.cn, origin: 'unknown', src: 'extracted', verified: false, page: c.page, snippet: c.snippet, uncertain: c.vafLabelled || c.vaf === '' ? [] : ['vaf'] }));
    n++;
  });
  auditAdd('extraction-accepted', `${n} candidate variant(s) added as unverified`);
  dataChanged(); renderVariantTable(); renderChecklist(); renderConfirmPanel(); renderExtraction();
  toast(`${n} extracted item(s) added. Verify each against the PDF before confirming.`);
}
function applyCaseSuggestion(i) {
  const x = state.extract; if (!x) return; const s = x.caseSug[i]; if (!s) return;
  state.case[s.field] = s.value; s.applied = true; auditAdd('case-suggestion-applied', `field ${s.field}`);
  dataChanged(); fillCaseForm(); renderChecklist(); renderConfirmPanel(); renderExtraction(); toast(`${s.label} set from the PDF. Check it against the page.`);
}
const unverifiedExtracted = () => state.variants.filter((v) => v.src === 'extracted' && !v.verified);

/* =====================================================================
   14. STAGE 2 — PROTECTED CASE FILE (passphrase encryption)
   ---------------------------------------------------------------------
   Plain language: you can save the whole case into one text file that is
   scrambled with a passphrase you choose. Without the passphrase it
   cannot be read. The passphrase is never stored and cannot be recovered.
   Technical: AES-256-GCM, key from PBKDF2-SHA-256 (250 000 rounds) with a
   random salt; the browser's built-in Web Crypto does the work.
   This protects a FILE you carry or e-mail. It does not replace your
   institution's secure storage, access control or consent processes.
   ===================================================================== */
const PROTECT_FORMAT = 'onco-ngs-reader-case';
const PROTECT_ITER = 250000;
const b64 = {
  enc: (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
};
async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function casePayload() {
  return {
    appVersion: APP_VERSION, library: KB_SNAPSHOT, exportedAt: new Date().toISOString(),
    case: state.case, variants: state.variants.map((v) => { const c = Object.assign({}, v); delete c.snippet; return c; }),
    sampleId: state.sampleId, boardNotes: state.boardNotes, preparedBy: state.preparedBy, reviewedBy: state.reviewedBy,
    liveResults: state.live.results, audit: audit.log
  };
}
async function protectEncrypt(pass) {
  if (!window.crypto || !crypto.subtle) throw new Error('This browser does not provide encryption (Web Crypto).');
  if (!pass || pass.length < 10) throw new Error('Choose a passphrase of at least 10 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, PROTECT_ITER);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(PROTECT_FORMAT) }, key, new TextEncoder().encode(JSON.stringify(casePayload())));
  return JSON.stringify({ format: PROTECT_FORMAT, v: 1, created: new Date().toISOString(), kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PROTECT_ITER, salt: b64.enc(salt) }, cipher: { name: 'AES-GCM', iv: b64.enc(iv) }, data: b64.enc(data) }, null, 1);
}
/** Check the shape of decrypted data before trusting it. */
function validPayload(p) {
  const isStr = (x) => typeof x === 'string';
  if (!p || typeof p !== 'object' || !p.case || !Array.isArray(p.variants)) return false;
  if (!Object.keys(emptyCase()).every((k) => p.case[k] === undefined || isStr(p.case[k]))) return false;
  return p.variants.every((v) => v && isStr(v.gene) && isStr(v.type) && isStr(v.variant || '') && isStr(v.hgvsC || ''));
}
async function protectDecrypt(text, pass) {
  let f; try { f = JSON.parse(text); } catch (e) { throw new Error('That text is not a protected case file (it could not be read as JSON).'); }
  if (!f || f.format !== PROTECT_FORMAT || f.v !== 1 || !f.kdf || !f.cipher || !f.data) throw new Error('This is not a protected case file made by Onco NGS Reader.');
  const iter = Number(f.kdf.iterations);
  if (!(iter >= 100000 && iter <= 2000000)) throw new Error('The file’s key settings are outside the accepted range.');
  const key = await deriveKey(pass, b64.dec(f.kdf.salt), iter);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(f.cipher.iv), additionalData: new TextEncoder().encode(PROTECT_FORMAT) }, key, b64.dec(f.data)); }
  catch (e) { throw new Error('Wrong passphrase, or the file was damaged or altered.'); }
  const p = JSON.parse(new TextDecoder().decode(plain));
  if (!validPayload(p)) throw new Error('The file decrypted but its contents are not a valid case.');
  return p;
}
function restorePayload(p) {
  state.case = Object.assign(emptyCase(), p.case);
  state.variants = p.variants.map((v) => Object.assign(emptyVariant(), v, { lookups: Object.assign(emptyLookups(), v.lookups || {}), snippet: '' }));
  state.sampleId = p.sampleId || null; state.boardNotes = p.boardNotes || ''; state.preparedBy = p.preparedBy || ''; state.reviewedBy = p.reviewedBy || '';
  state.live.results = p.liveResults && typeof p.liveResults === 'object' ? p.liveResults : {};
  state.confirmed = false; state.confirmedAt = null; state.ui.selectedId = null; state.editingId = null;
  let chain = 'no audit trail in the file';
  if (Array.isArray(p.audit) && p.audit.length) { const v = auditVerify(p.audit); chain = v.ok ? `imported audit chain of ${v.count} entries verified` : `imported audit chain BROKEN at entry ${v.brokenAt}`; audit.log = p.audit; }
  auditAdd('case-imported', `${chain}; confirmation cleared — the findings must be confirmed again`);
  saveState(); renderCaseStrip();
  return chain;
}

/* =====================================================================
   15. STAGE 2 — "CONNECT" PAGE (live look-ups, audit trail, protected files)
   ===================================================================== */
function downloadText(name, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function connectStatusChip(key) {
  const s = state.live.status[key];
  if (!s) return chip('Not tested', 'grey');
  return s.ok ? chip('Reachable · ' + stamp(s.at), 'mint') : chip('Not reachable', 'rose');
}
function renderConnect() {
  const root = $('#connectRoot'); if (!root) return;
  const ver = auditVerify(), last = audit.log.slice(-12).reverse();
  const live = state.live;
  root.innerHTML = `
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h3>Live look-ups</h3>${HOSTED ? chip('Not available in hosted preview', 'peach') : live.enabled ? chip('On for this session', 'mint') : chip('Off', 'grey')}</div>
        ${HOSTED ? callout('peach', 'Hosted preview', '<p>The page that hosts this preview blocks outside network connections, so live look-ups cannot run here. Run the app on your computer (see the README) to use them. The Stage 2 features that work offline remain available: PDF extraction, audit trail and protected files.</p>') : `
        <p>When switched on, the app asks public services a question from <strong>your browser</strong>. It sends only what is listed below. No report, file name, patient detail or free text is sent.</p>
        <label class="check-row"><input type="checkbox" id="liveToggle" ${live.enabled ? 'checked' : ''}> <span>I allow Onco NGS Reader to send the items listed below to these services for this session. I will not use real patient identifiers in gene, variant or tumour fields. Consent resets when the tab closes.</span></label>`}
        <div class="table-wrap"><table class="table table-compact"><thead><tr><th>Service</th><th>What is sent</th><th>Status</th><th></th></tr></thead><tbody>
          ${CONNECTORS.map((c) => `<tr><td><strong>${esc(c.name)}</strong><div class="small muted">${esc(c.key === 'oncokb' ? (proxyBase() || 'no address set') : c.host)}</div></td><td class="small">${esc(c.sends)}</td><td>${connectStatusChip(c.key)}${live.status[c.key] && !live.status[c.key].ok ? `<div class="small warn-line">${esc(live.status[c.key].detail)}</div>` : live.status[c.key] ? `<div class="small muted">${esc(live.status[c.key].detail || '')}</div>` : ''}</td><td class="right"><button class="btn btn-ghost btn-sm" data-action="testConn" data-key="${c.key}"${HOSTED || !live.enabled ? ' aria-disabled="true"' : ''}>Test</button></td></tr>`).join('')}
        </tbody></table></div>
        <p class="small muted">Retrieved results always show the time retrieved and the exact question asked. If a service cannot be reached, the app reports that and shows nothing in its place. Library tiers, clinician-entered records and live results are always labelled separately.</p>
      </section>

      <section class="card">
        <div class="card-head"><h3>OncoKB (licensed)</h3></div>
        <p>OncoKB requires an API token and licence terms for clinical-reporting use. A token must <strong>never</strong> be placed in a web page, so the app reaches OncoKB only through the small proxy in the <code>server</code> folder, which keeps your token on your own computer.</p>
        <ol class="small"><li>Obtain access from OncoKB and agree to its terms.</li><li>On your computer set <code>ONCOKB_API_TOKEN</code> and run <code>node server/server.js</code>.</li><li>Open <code>http://127.0.0.1:8787/</code> (the proxy also serves this app), or enter its address below.</li></ol>
        <label class="field"><span>Local proxy address</span><input type="text" id="oncokbUrl" value="${esc(live.oncokbUrl)}" placeholder="http://127.0.0.1:8787" spellcheck="false" ${HOSTED ? 'disabled' : ''}></label>
        <p class="small muted">Only address ${esc('http://127.0.0.1')} or ${esc('http://localhost')} style local addresses are expected.</p>
      </section>
    </div>

    <section class="card section-tight">
      <div class="card-head"><h3>Audit trail</h3>${ver.ok ? chip(`Chain intact · ${ver.count} entries`, 'mint') : chip(`Chain broken at entry ${ver.brokenAt}`, 'rose')}</div>
      <p>Each entry carries a fingerprint of the one before it, so an altered or removed entry is detectable. The trail records what was done, with no patient identifiers, and is kept in this browser tab only. Export it if you need to keep it.</p>
      <div class="btn-row"><button class="btn btn-secondary btn-sm" data-action="auditVerify">Verify chain now</button><button class="btn btn-secondary btn-sm" data-action="auditCopy">Copy as JSON</button>${HOSTED ? '' : '<button class="btn btn-secondary btn-sm" data-action="auditDownload">Download JSON</button>'}<span id="auditResult" class="small" role="status"></span></div>
      <div class="table-wrap"><table class="table table-compact"><thead><tr><th>#</th><th>Time (UTC)</th><th>Action</th><th>Detail</th><th>Fingerprint</th></tr></thead><tbody>${last.map((e) => `<tr><td>${e.seq}</td><td class="nowrap">${esc(e.ts.replace('T', ' ').slice(0, 19))}</td><td>${esc(e.action)}</td><td class="small">${esc(e.detail)}</td><td class="mono small">${esc(e.hash.slice(0, 12))}…</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Showing the latest ${last.length} of ${audit.log.length}. Current chain head: <span class="mono">${esc(auditHead().slice(0, 16))}…</span></p>
    </section>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h3>Protected case file</h3></div>
        <p>Save the case into one passphrase-protected text file (AES-256-GCM). The passphrase is never stored and <strong>cannot be recovered</strong>. After restoring a file, the findings must be confirmed again.</p>
        <label class="field"><span>Passphrase (10+ characters)</span><input type="password" id="protectPass" autocomplete="new-password"></label>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="protectMake">Create protected file</button></div>
        <label class="field"><span>Protected text (copy it, or download it when running locally)</span><textarea id="protectOut" rows="4" readonly placeholder="The protected file text appears here."></textarea></label>
        <div class="btn-row"><button class="btn btn-secondary btn-sm" data-action="protectCopy">Copy</button>${HOSTED ? '' : '<button class="btn btn-secondary btn-sm" data-action="protectDownload">Download file</button>'}</div>
        <p id="protectMsg" class="small" role="status"></p>
      </section>
      <section class="card">
        <div class="card-head"><h3>Restore a protected file</h3></div>
        <label class="field"><span>Choose a file, or paste its text</span><input type="file" id="protectFile" accept=".json,.txt,application/json,text/plain"></label>
        <label class="field"><span>Protected text</span><textarea id="protectIn" rows="4" placeholder="Paste the protected file text here."></textarea></label>
        <label class="field"><span>Passphrase</span><input type="password" id="restorePass" autocomplete="off"></label>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="protectRestore">Decrypt and restore</button></div>
        <p id="restoreMsg" class="small" role="status"></p>
        <p class="small muted">This protects a file. It does not replace institutional secure storage, access control or consent.</p>
      </section>
    </div>

    <section class="card section-tight">
      <div class="card-head"><h3>Versions and what still needs a hosted back end</h3></div>
      ${kv([['App version', esc(APP_VERSION)], ['Curated library snapshot', esc(KB_SNAPSHOT)], ['PDF library', 'pdf.js 3.11.174 (Apache-2.0), bundled'], ['Mode', HOSTED ? 'Hosted preview (live look-ups disabled by the host)' : 'Local']])}
      <p class="small">Not built, because it needs hosting, identity and governance: user accounts and sign-in, a central encrypted database, role-based access, institution-controlled retention, server-side audit storage, OCR for scanned reports, live CIViC/ClinGen connectors, and independent clinical validation of the rule library.</p>
    </section>`;
}

/* =====================================================================
   10. PAGE RENDERERS
   ---------------------------------------------------------------------
   Each page has a function that builds its HTML. Pieces that must keep
   keyboard focus while you type (search boxes, forms) live in the HTML
   file; only the results area below them is redrawn.
   ===================================================================== */

/* ---------- small building blocks ---------- */
const chip = (text, tone = 'grey', extra = '') => `<span class="chip chip-${tone} ${extra}">${esc(text)}</span>`;
const statusChip = (s) => (STATUS[s] ? chip(STATUS[s].label, STATUS[s].tone) : chip(s));
const callout = (tone, title, bodyHtml) => `<div class="callout callout-${tone}"><div class="callout-title">${title}</div><div class="callout-body">${bodyHtml}</div></div>`;
const extLink = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="ext" aria-hidden="true"> ↗</span></a>`;
const emptyState = (title, text, btn) => `<div class="empty card"><div class="empty-icon" aria-hidden="true">✦</div><h3>${esc(title)}</h3><p>${text}</p>${btn || ''}</div>`;
const goBtn = (page, label, kind = 'primary') => `<button class="btn btn-${kind}" data-action="goto" data-page="${page}">${esc(label)}</button>`;
const kv = (rows) => `<dl class="kv">${rows.filter((r) => r && r[1] !== undefined && r[1] !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

function shortRef(r) {
  if (r.kind !== 'paper') return r.src;
  const lead = r.by.replace(/\s+[A-Z][A-Z-]*(,|\s|$).*/, '');
  return `${lead} ${r.year}`;
}
function refChip(id) {
  const r = REF_BY_ID[id]; if (!r) return '';
  return `<a class="ref-chip" href="${esc(refLink(r))}" target="_blank" rel="noopener noreferrer" title="${esc(r.title)}">${esc(shortRef(r))}</a>`;
}
const refChips = (ids) => (ids || []).filter((i) => REF_BY_ID[i]).map(refChip).join(' ');

function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

const cancerLabel = (code) => (code ? (CANCER_LABEL[code] || code) : 'Not selected');

/* ---------- the slim "current case" strip under the header ---------- */
function renderCaseStrip() {
  const el = $('#caseStrip'); if (!el) return;
  const c = state.case, n = state.variants.length;
  if (!n && !c.label && !c.cancer) {
    el.innerHTML = `<div class="strip-inner"><span class="strip-label">No case loaded</span><span class="muted">Load a fictional sample or enter findings manually.</span><button class="btn btn-ghost btn-sm" data-action="goto" data-page="upload">Start →</button></div>`;
    return;
  }
  el.innerHTML = `<div class="strip-inner">
    <span class="strip-label">Current case</span>
    <strong>${esc(c.label || 'Untitled case')}</strong>
    <span class="muted">${esc(cancerLabel(c.cancer))} · ${n} variant${n === 1 ? '' : 's'}</span>
    ${state.confirmed ? chip('✓ Findings confirmed', 'mint') : chip('Not yet confirmed', 'peach')}
    <button class="btn btn-ghost btn-sm" data-action="goto" data-page="upload">${state.confirmed ? 'Review' : 'Review & confirm →'}</button></div>`;
}

/* ---------- DASHBOARD ---------- */
const FEATURES = [
  ['Manual case and variant entry', 'working', 'Runs entirely in your browser. Nothing is sent anywhere unless you switch on live look-ups.'],
  ['PDF viewing (canvas viewer)', 'working', 'The PDF is drawn in your browser with the bundled pdf.js library. It is never uploaded.'],
  ['PDF text extraction (experimental)', 'partial', 'Proposes genes, variants, VAF, depth, fusions, copy number and case-level items from PDFs with selectable text. Every item must be added by you and verified one by one. Tested only on synthetic fictional reports; no OCR for scans.'],
  ['Variant interpretation', 'partial', `Curated library: ${Object.keys(GENES).length} genes and ${RULES.length} interpretation rules. Everything else is shown as “not curated”.`],
  ['Evidence tiers (AMP/ASCO/CAP, ESCAT, OncoKB)', 'partial', 'Hand-curated snapshot only where the developer was confident; blank otherwise. Verify at the source.'],
  ['Live ClinVar, PubMed, ClinicalTrials.gov, openFDA look-ups', 'partial', 'Built and opt-in, with time-stamped, query-stamped results. Local use only: the hosted preview blocks outside connections. Tested here only against recorded response shapes, not the live services.'],
  ['OncoKB data', 'partial', 'Reachable only through the optional local proxy that keeps your licensed token off the web page. Needs your own OncoKB token and licence terms.'],
  ['CIViC, ClinGen, COSMIC, Cancer Genome Interpreter', 'backend', 'No connector yet: search links plus a record-your-own-look-up form. Needs a server-side integration.'],
  ['FDA label text', 'partial', 'Curated wording for listed drugs, plus an on-demand openFDA label check (local use). EMA status is not curated.'],
  ['Audit trail and protected case files', 'working', 'Tamper-evident hash-chained audit trail; passphrase-encrypted case files (AES-256-GCM). Per tab, no server.'],
  ['Learning Centre, flash-cards, quiz, calculators', 'working', 'Fully functional offline.'],
  ['Tumour board summary and printing', 'working', 'Print or save as PDF (local); copy as text (everywhere). Includes data-provenance and audit references.'],
  ['Accounts, central secure database, role-based access', 'backend', 'Not built. Needs hosting, identity management and institutional governance before real patient data is used.']
];
const FEATURE_TONE = { working: ['Working now', 'mint'], partial: ['Partly working', 'peach'], backend: ['Needs backend / APIs', 'blue'], none: ['Not built', 'grey'] };

function dayOfYear() { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }

function renderDashboard() {
  const root = $('#dashboardRoot'); if (!root) return;
  const its = interpretAll();
  const count = (cat) => its.filter((i) => i.category === cat).length;
  const bm = biomarkerFindings(state.case).filter((b) => b.state === 'positive').length;
  const flagged = state.variants.filter((v) => variantFlags(v).some((f) => ['missing', 'uncertain', 'warn'].includes(f.level))).length;
  const pearl = FLASHCARDS[dayOfYear() % FLASHCARDS.length];
  const hasCase = state.variants.length > 0;

  const caseCard = hasCase ? `
    <div class="card card-feature">
      <div class="card-head"><h3>Your case</h3>${state.confirmed ? chip('Confirmed', 'mint') : chip('Awaiting confirmation', 'peach')}</div>
      <p class="muted">${esc(state.case.label || 'Untitled case')} · ${esc(cancerLabel(state.case.cancer))}</p>
      <div class="stat-row">
        <div class="stat"><span class="stat-n">${state.variants.length}</span><span class="stat-l">variants</span></div>
        <div class="stat"><span class="stat-n">${count('actionable')}</span><span class="stat-l">actionable in this tumour</span></div>
        ${count('conditional') ? `<div class="stat"><span class="stat-n">${count('conditional')}</span><span class="stat-l">conditional on germline confirmation</span></div>` : ''}
        <div class="stat"><span class="stat-n">${count('resistance')}</span><span class="stat-l">resistance / negative predictors</span></div>
        <div class="stat"><span class="stat-n">${bm}</span><span class="stat-l">positive biomarkers</span></div>
        <div class="stat"><span class="stat-n">${flagged}</span><span class="stat-l">need review</span></div>
      </div>
      <div class="btn-row">${state.confirmed ? goBtn('interpreter', 'Open Variant Interpreter') : goBtn('upload', 'Review & confirm findings')}${state.confirmed ? goBtn('summary', 'Tumour board summary', 'secondary') : ''}</div>
    </div>` : `
    <div class="card card-feature">
      <div class="card-head"><h3>Start a case</h3></div>
      <p class="muted">Load one of the fictional sample reports to explore the app, or enter findings from a real report by hand.</p>
      <div class="btn-row">${goBtn('upload', 'Enter findings manually')}<button class="btn btn-secondary" data-action="loadSample" data-id="sampleA">Load sample A</button></div>
    </div>`;

  root.innerHTML = `
    <section class="hero">
      <div class="hero-blobs" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i></div>
      <p class="eyebrow">Stage 2 · Evidence-connected prototype</p>
      <h1>Read the genome<br>behind every cancer.</h1>
      <p class="lead">Onco NGS Reader helps medical oncologists and molecular pathologists work through NGS reports — from the basics to the details — with the evidence, its limits and the uncertainty always in view.</p>
      <div class="btn-row center">
        ${goBtn('upload', 'Upload or enter a report')}
        <button class="btn btn-secondary" data-action="loadSample" data-id="sampleC">Try a sample case</button>
        ${goBtn('learn', 'Open Learning Centre', 'ghost')}
      </div>
    </section>

    <section class="grid grid-2 section">
      ${caseCard}
      <div class="card">
        <div class="card-head"><h3>Three questions, never mixed</h3></div>
        <div class="poa">
          <div class="poa-item poa-lav"><b>Pathogenic?</b><span>Inherited variant causes disease<br><em>ACMG/AMP 2015</em></span></div>
          <div class="poa-item poa-blue"><b>Oncogenic?</b><span>Somatic variant drives the tumour<br><em>ClinGen/CGC/VICC 2022</em></span></div>
          <div class="poa-item poa-mint"><b>Actionable?</b><span>Changes treatment in this tumour &amp; setting<br><em>AMP/ASCO/CAP · ESCAT · OncoKB</em></span></div>
        </div>
        <p class="muted small">A variant can be oncogenic yet not actionable (TP53 R175H), and evidence from one tumour type does not automatically apply to another.</p>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">How it works</h2>
      <div class="steps">
        <div class="step"><span class="step-n">1</span><h4>Add</h4><p>Drop in the PDF for side-by-side viewing, then type or load the findings.</p></div>
        <div class="step"><span class="step-n">2</span><h4>Check</h4><p>Missing, unreadable and uncertain items are flagged for you.</p></div>
        <div class="step"><span class="step-n">3</span><h4>Confirm</h4><p>You verify the findings against the original report. Nothing is interpreted before this.</p></div>
        <div class="step"><span class="step-n">4</span><h4>Interpret</h4><p>Biology, classification, treatment implications and a printable tumour-board summary.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="row-between"><h2 class="section-title">Fictional sample reports</h2><span class="muted small">All invented for teaching</span></div>
      <div class="grid grid-3">
        ${SAMPLES.map((s) => `
          <article class="card sample tone-${s.tone}">
            <div class="sample-icon" aria-hidden="true">${s.icon}</div>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.blurb)}</p>
            <p class="small muted">Teaches: ${esc(s.teaches)}</p>
            <button class="btn btn-secondary btn-sm" data-action="loadSample" data-id="${s.id}">Load this case</button>
          </article>`).join('')}
      </div>
    </section>

    <section class="grid grid-2 section">
      <div class="card tone-peach-soft">
        <div class="card-head"><h3>Pearl of the day</h3>${chip(pearl.cat, 'peach')}</div>
        <p class="pearl-q">${esc(pearl.q)}</p>
        <p>${esc(pearl.a)}</p>
        <p class="hack">💡 Memory hook: <strong>${esc(pearl.hack)}</strong></p>
        <button class="btn btn-ghost btn-sm" data-action="goto" data-page="learn" data-tab="cards">More flash-cards →</button>
      </div>
      <div class="card">
        <div class="card-head"><h3>How this app stays trustworthy</h3></div>
        <ul class="ticks">
          <li>It never claims to have checked a database it has not actually queried.</li>
          <li>Where the curated library has no entry, it says so instead of guessing.</li>
          <li>Pathogenicity, oncogenicity and actionability are shown separately.</li>
          <li>Every statement of approval names its status: approved, tumour-agnostic, other-tumour, evolving, investigational or not supported.</li>
          <li>You must confirm the findings before any interpretation appears.</li>
          <li>Sources are PubMed-verified; web addresses are marked as not live-checked.</li>
          <li>Live results, library tiers and your own look-ups are always labelled separately, with times and the exact question asked.</li>
          <li>PDF-extracted items stay “unverified” until you check each against its source page.</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">What works today — and what needs a secure backend</h2>
      <div class="card table-card">
        <table class="table">
          <thead><tr><th>Feature</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>${FEATURES.map(([f, k, d]) => `<tr><td><strong>${esc(f)}</strong></td><td>${chip(FEATURE_TONE[k][0], FEATURE_TONE[k][1])}</td><td>${esc(d)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
}

/* ---------- UPLOAD PAGE ---------- */
function optionList(list, selected) {
  return list.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
}
/** Fill the static form fields from the current state. */
function fillCaseForm() {
  $$('[data-case]').forEach((el) => { el.value = state.case[el.dataset.case] ?? ''; });
  $('#c_cancer').innerHTML = optionList(CANCERS, state.case.cancer);
  $('#c_setting').innerHTML = optionList(SETTINGS, state.case.setting);
  $('#c_specimen').innerHTML = optionList(SPECIMENS, state.case.specimen);
  $('#c_germline').innerHTML = optionList(GERMLINE_STATUS, state.case.germline);
  $('#v_type').innerHTML = optionList(TYPES, $('#v_type').value || '');
  $('#v_origin').innerHTML = optionList(ORIGINS, 'unknown');
  const sel = (id, val) => { const e = $('#' + id); if (e) e.value = val; };
  sel('c_cancer', state.case.cancer); sel('c_setting', state.case.setting); sel('c_specimen', state.case.specimen);
  sel('c_germline', state.case.germline); sel('c_msi', state.case.msi); sel('c_mmr', state.case.mmr); sel('c_hrd', state.case.hrd);
  $('#geneList').innerHTML = Object.keys(GENES).sort().map((g) => `<option value="${g}">${esc(GENES[g].name)}</option>`).join('');
}

function renderSampleButtons() {
  const el = $('#sampleButtons'); if (!el) return;
  el.innerHTML = SAMPLES.map((s) => `<button class="sample-pill tone-${s.tone}${state.sampleId === s.id ? ' active' : ''}" data-action="loadSample" data-id="${s.id}"><span aria-hidden="true">${s.icon}</span> ${esc(s.title)}</button>`).join('');
}

function renderVariantTable() {
  const el = $('#variantTable'); if (!el) return;
  if (!state.variants.length) { el.innerHTML = `<div class="empty-inline">No variants yet. Add one with the form above, or load a sample case.</div>`; return; }
  el.innerHTML = `<div class="table-wrap"><table class="table table-compact">
    <thead><tr><th>Gene / variant</th><th>Type</th><th>VAF</th><th>Depth</th><th>Origin</th><th>Review flags</th><th class="right">Actions</th></tr></thead>
    <tbody>${state.variants.map((v) => {
      const fl = variantFlags(v);
      const m = fl.filter((f) => f.level === 'missing').length, u = fl.filter((f) => f.level === 'uncertain').length, w = fl.filter((f) => f.level === 'warn').length;
      const chips = [m ? chip(`${m} missing`, 'rose') : '', u ? chip(`${u} uncertain`, 'peach') : '', w ? chip(`${w} warning${w > 1 ? 's' : ''}`, 'peach') : '', (!m && !u && !w) ? chip('Complete', 'mint') : ''].join(' ');
      const ext = v.src === 'extracted' ? (v.verified ? chip('Extracted · verified', 'mint') : chip('Extracted · verify', 'rose')) : '';
      return `<tr>
        <td><strong>${esc(varLabel(v))}</strong> ${ext}${v.hgvsC ? `<div class="small muted mono">${esc(v.hgvsC)}${v.transcript ? ' · ' + esc(v.transcript) : ''}</div>` : ''}${v.src === 'extracted' && v.snippet ? `<div class="small muted mono src-line">p.${esc(v.page)}: ${esc(v.snippet)}</div>` : ''}</td>
        <td>${esc((TYPE_LABEL[v.type] || '—').split(' (')[0])}</td>
        <td>${v.vaf !== '' ? esc(v.vaf) + '%' : '—'}</td>
        <td>${v.depth !== '' ? esc(v.depth) + '×' : '—'}</td>
        <td>${esc((ORIGINS.find((o) => o[0] === v.origin) || ['', '—'])[1].split(' (')[0])}</td>
        <td>${chips}</td>
        <td class="right nowrap">${v.src === 'extracted' && !v.verified ? `<button class="btn btn-secondary btn-sm" data-action="verifyVariant" data-id="${v.id}">I checked it</button>${v.page && state.file.valid ? `<button class="btn btn-ghost btn-sm" data-action="pdfGoto" data-p="${esc(v.page)}">Source p.${esc(v.page)}</button>` : ''}` : ''}<button class="btn btn-ghost btn-sm" data-action="editVariant" data-id="${v.id}">Edit</button><button class="btn btn-ghost btn-sm danger" data-action="deleteVariant" data-id="${v.id}">Delete</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function renderChecklist() {
  const el = $('#checklist'); if (!el) return;
  const items = caseChecks();
  const icon = { missing: '○', warn: '▲', info: 'ℹ', uncertain: '?' };
  const tone = { missing: 'rose', warn: 'peach', info: 'blue', uncertain: 'peach' };
  const perVariant = state.variants.map((v) => ({ v, fl: variantFlags(v).filter((f) => ['missing', 'uncertain', 'warn'].includes(f.level)) })).filter((x) => x.fl.length);
  el.innerHTML = (items.length ? `<ul class="check-list">${items.map((i) => `<li class="check-${tone[i.level]}"><span class="check-ico" aria-hidden="true">${icon[i.level]}</span><span>${esc(i.text)}</span></li>`).join('')}</ul>` : `<p class="ok-line">✓ No case-level gaps detected.</p>`)
    + (perVariant.length ? `<details class="detail-box"><summary>Variant-level details (${perVariant.length} variant${perVariant.length > 1 ? 's' : ''})</summary>${perVariant.map(({ v, fl }) => `<div class="vf"><strong>${esc(varLabel(v))}</strong><ul>${fl.map((f) => `<li class="check-${tone[f.level]}"><span class="check-ico" aria-hidden="true">${icon[f.level]}</span><span>${esc(f.text)}</span></li>`).join('')}</ul></div>`).join('')}</details>` : '');
}

function renderConfirmPanel() {
  const el = $('#confirmPanel'); if (!el) return;
  const n = state.variants.length, unver = unverifiedExtracted().length;
  if (state.confirmed) {
    el.innerHTML = `<div class="callout callout-mint"><div class="callout-title">✓ Findings confirmed</div><div class="callout-body">You confirmed these findings${state.confirmedAt ? ' on ' + esc(new Date(state.confirmedAt).toLocaleString()) : ''}. Editing any detail will clear this confirmation.<div class="btn-row">${goBtn('interpreter', 'Open Variant Interpreter')}${goBtn('actionability', 'Actionability', 'secondary')}${goBtn('summary', 'Tumour board summary', 'secondary')}</div></div></div>`;
    return;
  }
  el.innerHTML = `<div class="confirm-box">
    ${unver ? callout('rose', `${unver} extracted entr${unver === 1 ? 'y needs' : 'ies need'} verification`, '<p>Entries proposed from the PDF must each be compared with their source page and marked “I checked it” in the table above before the findings can be confirmed.</p>') : ''}
    <label class="check-row"><input type="checkbox" id="confirmCheck"${n && !unver ? '' : ' disabled'}> <span>I have compared every entry above with the original laboratory report and I confirm that the case details and variants are accurate. I understand this tool provides educational decision support and does not replace the laboratory report or a molecular tumour board.</span></label>
    <button class="btn btn-primary" id="confirmBtn" data-action="confirm" disabled>Confirm findings and enable interpretation</button>
    <p class="small muted">${!n ? 'Add at least one variant first.' : unver ? 'Verify the extracted entries first.' : 'Tick the box to enable the button.'}</p></div>`;
}

function renderFileCard() {
  const el = $('#fileCard'); if (!el) return;
  const f = state.file;
  if (!f.name) { el.innerHTML = ''; return; }
  const kb = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB';
  const ready = f.valid === true && pdfState.doc;
  el.innerHTML = `<div class="file-card">
    <div class="file-head"><span class="file-ico" aria-hidden="true">PDF</span><div><strong>${esc(f.name)}</strong><div class="small muted">${kb} · ${f.valid === true ? 'Valid PDF · ' + (f.pages || '?') + ' page(s)' : f.valid === false ? 'Does not look like a readable PDF file' : 'Checking…'}</div></div>
      <button class="btn btn-ghost btn-sm" data-action="removeFile">Remove</button></div>
    ${callout('blue', 'Stays in your browser', `<p>The file is displayed and read <strong>only on your device</strong>; it is not uploaded. The file name is not written to the audit trail or saved. “Extract” proposes findings from the text; you decide what to add, and each added item must be verified against its page.</p>`)}
    ${ready ? `<div id="pdfViewer" class="pdf-viewer"><div class="pdf-bar"><button class="btn btn-secondary btn-sm" data-action="pdfPrev" aria-label="Previous page">‹ Prev</button><span id="pdfPageLabel" class="small">Page 1 of ${f.pages}</span><button class="btn btn-secondary btn-sm" data-action="pdfNext" aria-label="Next page">Next ›</button><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-action="pdfZoomOut" aria-label="Zoom out">−</button><button class="btn btn-ghost btn-sm" data-action="pdfZoomIn" aria-label="Zoom in">+</button></div>
      <div class="pdf-canvas-wrap"><canvas id="pdfCanvas" aria-label="PDF page preview"></canvas></div></div>
      <div class="btn-row"><button class="btn btn-primary" data-action="runExtract">Extract text and propose findings (experimental)</button></div>` : ''}
    ${f.valid === true && !pdfState.doc && f.error ? callout('peach', 'The PDF could not be displayed', `<p>${esc(f.error)}</p>`) : ''}
    <div id="extractResult"></div>
  </div>`;
  if (ready) { pdfRender(); renderExtraction(); }
}

async function handleFile(file) {
  if (!file) return;
  state.extract = null; pdfClose();
  state.file = { name: file.name, size: file.size, valid: null, url: '', pages: 0, error: '' };
  renderFileCard();
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const ok = head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d; // "%PDF-"
  if (!ok) { state.file.valid = false; renderFileCard(); toast('That file does not appear to be a PDF.'); return; }
  state.file.valid = true;
  try { state.file.pages = await pdfOpen(file); }
  catch (e) { state.file.error = e.message || 'Unknown error'; state.file.pages = 0; }
  auditAdd('pdf-loaded', state.file.error ? 'PDF opened with an error' : `PDF opened locally (${state.file.pages} page(s), ${Math.max(1, Math.round(file.size / 1024))} KB)`);
  renderFileCard();
  toast(state.file.error ? 'The PDF could not be displayed.' : 'PDF loaded locally. Enter the findings or try the experimental extraction.');
}

/* ---- variant form handling ---- */
function updateVariantFormVisibility() {
  const t = $('#v_type').value;
  $('#fld_partner').hidden = !(t === 'fusion' || t === 'rearrangement');
  $('#fld_cn').hidden = !(t === 'amplification' || t === 'deletion');
  const info = $('#typeInfo');
  info.innerHTML = t ? `<strong>${esc((TYPE_LABEL[t] || '').split(' (')[0])}:</strong> ${esc(TYPE_INFO[t] || '')}` : '';
  info.hidden = !t;
}
function readVariantForm() {
  const g = (id) => $('#' + id).value.trim();
  return { gene: g('v_gene'), variant: g('v_variant'), hgvsC: g('v_hgvsC'), transcript: g('v_transcript'), type: g('v_type'), vaf: g('v_vaf'), depth: g('v_depth'), origin: g('v_origin'), partner: g('v_partner'), cn: g('v_cn'), reported: g('v_reported') };
}
function clearVariantForm() {
  ['v_gene', 'v_variant', 'v_hgvsC', 'v_transcript', 'v_vaf', 'v_depth', 'v_partner', 'v_cn', 'v_reported'].forEach((id) => { $('#' + id).value = ''; });
  $('#v_type').value = ''; $('#v_origin').value = 'unknown';
  state.editingId = null;
  $('#variantSubmit').textContent = 'Add variant';
  $('#variantCancel').hidden = true;
  $('#variantFormTitle').textContent = 'Add a variant';
  $('#variantError').textContent = '';
  updateVariantFormVisibility();
}
function submitVariant() {
  const f = readVariantForm();
  const err = $('#variantError'); err.textContent = '';
  const fail = (m) => { err.textContent = m; };
  // typed a fusion such as EML4::ALK into the gene box?
  const split = splitFusionName(f.gene);
  if (split && (f.type === 'fusion' || f.type === 'rearrangement' || !f.type)) { f.gene = split.gene; if (!f.partner) f.partner = split.partner; if (!f.type) f.type = 'fusion'; }
  if (!f.gene) return fail('Please enter a gene symbol (for example EGFR).');
  if (!f.type) return fail('Please choose a mutation type.');
  const isCNA = ['amplification', 'deletion'].includes(f.type), isSV = ['fusion', 'rearrangement'].includes(f.type);
  if (!isCNA && !isSV && !f.variant && !f.hgvsC) return fail('Enter the protein change (p.) or the cDNA change (c.), or choose a copy-number/fusion type.');
  const vaf = num(f.vaf);
  if (f.vaf !== '' && (vaf === null || vaf < 0 || vaf > 100)) return fail('VAF must be a number between 0 and 100 (percent).');
  if (f.depth !== '' && (num(f.depth) === null || num(f.depth) < 0)) return fail('Read depth must be a positive number.');
  if (f.cn !== '' && (num(f.cn) === null || num(f.cn) < 0)) return fail('Copy number must be a positive number.');
  if (state.editingId) {
    const v = state.variants.find((x) => x.id === state.editingId);
    if (v) { Object.assign(v, f, { uncertain: (v.uncertain || []).filter((u) => !f[u] || f[u] === '') }); if (v.src === 'extracted') v.verified = false; }
    toast('Variant updated. Please re-confirm the findings.');
  } else {
    state.variants.push(Object.assign(emptyVariant(), f));
    toast('Variant added.');
  }
  dataChanged(); clearVariantForm(); renderVariantTable(); renderChecklist(); renderConfirmPanel();
}
function editVariant(id) {
  const v = state.variants.find((x) => x.id === id); if (!v) return;
  state.editingId = id;
  const set = (i, val) => { $('#' + i).value = val ?? ''; };
  set('v_gene', v.gene); set('v_variant', v.variant); set('v_hgvsC', v.hgvsC); set('v_transcript', v.transcript); set('v_type', v.type);
  set('v_vaf', v.vaf); set('v_depth', v.depth); set('v_origin', v.origin); set('v_partner', v.partner); set('v_cn', v.cn); set('v_reported', v.reported);
  $('#variantSubmit').textContent = 'Update variant'; $('#variantCancel').hidden = false; $('#variantFormTitle').textContent = 'Edit variant';
  updateVariantFormVisibility();
  $('#variantFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#v_gene').focus();
}
function deleteVariant(id, btn) {
  const v = state.variants.find((x) => x.id === id); if (!v) return;
  if (!inlineConfirm(btn, 'Really delete?')) return;
  state.variants = state.variants.filter((x) => x.id !== id);
  if (state.ui.selectedId === id) state.ui.selectedId = null;
  auditAdd('variant-deleted', varLabel(v));
  dataChanged(); renderVariantTable(); renderChecklist(); renderConfirmPanel();
}
/** Two-step confirmation inside the page (browser pop-up dialogs are blocked in some hosts). Returns true on the confirming click. */
function inlineConfirm(btn, label) {
  if (!btn) return true;
  if (btn.dataset.armed === '1') { btn.dataset.armed = ''; return true; }
  const old = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label; btn.classList.add('armed');
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = old; btn.classList.remove('armed'); } }, 4000);
  return false;
}
function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id); if (!s) return;
  state.case = Object.assign(emptyCase(), s.case);
  state.variants = s.variants.map((v) => Object.assign(emptyVariant(), v, { uncertain: v.uncertain || [], lookups: emptyLookups() }));
  state.sampleId = id; state.ui.selectedId = null; state.live.results = {};
  auditAdd('case-loaded', `fictional sample ${id}`);
  state.confirmed = false; state.confirmedAt = null; state.boardNotes = ''; state.editingId = null;
  saveState(); renderCaseStrip();
  toast(`Sample ${s.title.split(' · ')[0]} loaded (fictional). Review and confirm the findings.`);
  navigate('upload');
}
function resetAll(btn) {
  if (!inlineConfirm(btn, 'Click again to clear everything')) return;
  state.case = emptyCase(); state.variants = []; state.confirmed = false; state.confirmedAt = null; state.sampleId = null;
  state.boardNotes = ''; state.preparedBy = ''; state.reviewedBy = ''; state.editingId = null; state.ui.selectedId = null;
  state.live.results = {}; state.live.status = {}; pdfClose();
  state.file = { name: '', size: 0, valid: null, url: '', pages: 0 };
  store.remove('sessionStorage', SESSION_KEY);
  auditAdd('data-cleared', 'case, findings and retrieved results cleared from this tab (audit trail kept)');
  renderCaseStrip(); route(); toast('Case data cleared. The audit trail is kept for this session.');
}

function renderUpload() {
  fillCaseForm(); renderSampleButtons(); renderFileCard(); renderVariantTable(); renderChecklist(); renderConfirmPanel(); updateVariantFormVisibility();
}

/* ---------- VARIANT INTERPRETER ---------- */
const CAT_ORDER = ['actionable', 'conditional', 'resistance', 'other-tumour', 'investigational', 'informational', 'norule', 'nogene'];
const ESCAT_TEXT = {
  'I-A': 'Tier I (ready for routine clinical decisions) — sub-level A',
  'I-B': 'Tier I (ready for routine clinical decisions) — sub-level B',
  'I-C': 'Tier I (ready for routine clinical decisions) — sub-level C: benefit shown across tumour types'
};
const AMP_TEXT = 'AMP/ASCO/CAP 2017: Tier I strong · II potential · III unknown · IV benign/likely benign. Evidence levels: A = FDA-approved therapy or professional guideline in this tumour type; B = well-powered studies with expert consensus; C = FDA-approved in a different tumour type or investigational with multiple small studies; D = preclinical studies or case reports.';

/** Links that open a SEARCH on external sites. They do not retrieve anything. */
function dbLinks(it) {
  const g = it.nv.gene, p = it.nv.p;
  const term = [g, it.v.variant || it.v.hgvsC].filter(Boolean).join(' ');
  const cond = CANCER_LABEL[state.case.cancer] || state.case.histology || '';
  const oncokbVar = /^[A-Z]\d+[A-Z*]$/.test(p) ? `/${p}` : '';
  return [
    ['ClinVar', `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(g + '[gene]' + (p ? ' AND ' + p : ''))}`],
    ['OncoKB', `https://www.oncokb.org/gene/${encodeURIComponent(g)}${oncokbVar}`],
    ['CIViC', 'https://civicdb.org/'],
    ['ClinGen', 'https://clinicalgenome.org/'],
    ['COSMIC', `https://cancer.sanger.ac.uk/cosmic/search?q=${encodeURIComponent(g)}`],
    ['gnomAD', `https://gnomad.broadinstitute.org/gene/${encodeURIComponent(g)}?dataset=gnomad_r4`],
    ['Cancer Genome Interpreter', 'https://www.cancergenomeinterpreter.org/'],
    ['PubMed', `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term + (cond ? ' ' + cond : ''))}`]
  ];
}

const FILTERS = [
  ['all', 'All'], ['actionable', 'Actionable'], ['conditional', 'Conditional'], ['resistance', 'Resistance'], ['other-tumour', 'Other tumour types'],
  ['informational', 'Informational'], ['norule', 'Not curated'], ['flagged', 'Needs review']
];

function filteredInterpretations() {
  const q = state.ui.interpSearch.trim().toLowerCase();
  let list = interpretAll();
  list = list.filter((it) => {
    const f = state.ui.interpFilter;
    if (f === 'flagged') { if (!variantFlags(it.v).some((x) => ['missing', 'uncertain', 'warn'].includes(x.level))) return false; }
    else if (f === 'norule') { if (!['norule', 'nogene'].includes(it.category)) return false; }
    else if (f !== 'all' && it.category !== f) return false;
    if (state.ui.interpType && it.v.type !== state.ui.interpType) return false;
    if (q) {
      const hay = `${varLabel(it.v)} ${it.v.variant} ${it.v.hgvsC} ${it.nv.gene} ${it.gene ? it.gene.name : ''} ${it.rule ? it.rule.title : ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
  return list;
}

function renderInterpreter() {
  const gate = $('#interpGate'), wrap = $('#interpWrap');
  if (!state.variants.length) {
    gate.innerHTML = emptyState('No findings to interpret yet', 'Add variants manually or load a fictional sample report first.', goBtn('upload', 'Go to Upload NGS Report'));
    wrap.hidden = true; return;
  }
  if (!state.confirmed) {
    gate.innerHTML = confirmGate('Variant Interpreter');
    wrap.hidden = true; return;
  }
  gate.innerHTML = ''; wrap.hidden = false;
  const types = Array.from(new Set(state.variants.map((v) => v.type).filter(Boolean)));
  $('#interpType').innerHTML = `<option value="">All mutation types</option>` + types.map((t) => `<option value="${t}"${state.ui.interpType === t ? ' selected' : ''}>${esc((TYPE_LABEL[t] || t).split(' (')[0])}</option>`).join('');
  $('#interpSearch').value = state.ui.interpSearch;
  renderInterpFilters(); renderInterpList(); renderInterpDetail();
}
function confirmGate(where) {
  const n = state.variants.length, fl = caseChecks().filter((i) => ['missing', 'warn', 'uncertain'].includes(i.level)).length;
  return `<div class="card gate"><div class="gate-icon" aria-hidden="true">🔒</div><h3>Please confirm the findings first</h3>
    <p>${esc(where)} only opens after you have checked the ${n} entered variant${n === 1 ? '' : 's'} against the original report and confirmed them. This keeps interpretation tied to findings a clinician has verified.</p>
    ${fl ? `<p class="small muted">${fl} review item${fl > 1 ? 's' : ''} currently flagged.</p>` : ''}
    <div class="btn-row center">${goBtn('upload', 'Review & confirm findings')}</div></div>`;
}

function renderInterpFilters() {
  const all = interpretAll();
  const cnt = (f) => (f === 'all' ? all.length : f === 'flagged' ? all.filter((it) => variantFlags(it.v).some((x) => ['missing', 'uncertain', 'warn'].includes(x.level))).length : f === 'norule' ? all.filter((i) => ['norule', 'nogene'].includes(i.category)).length : all.filter((i) => i.category === f).length);
  $('#interpFilters').innerHTML = FILTERS.map(([k, l]) => `<button class="pill${state.ui.interpFilter === k ? ' active' : ''}" data-action="interpFilter" data-key="${k}" aria-pressed="${state.ui.interpFilter === k}">${esc(l)} <span class="pill-n">${cnt(k)}</span></button>`).join('');
}

function renderInterpList() {
  const list = filteredInterpretations();
  const el = $('#interpList');
  if (!list.length) { el.innerHTML = `<div class="empty-inline">No variants match the current search or filter.</div>`; return; }
  if (!list.some((it) => it.v.id === state.ui.selectedId)) state.ui.selectedId = list[0].v.id;
  el.innerHTML = list.map((it) => {
    const [catLabel, catTone] = CATEGORY_LABEL[it.category];
    const fl = variantFlags(it.v).filter((f) => ['missing', 'uncertain', 'warn'].includes(f.level)).length;
    return `<button class="vcard${it.v.id === state.ui.selectedId ? ' active' : ''}" data-action="selectVariant" data-id="${it.v.id}">
      <span class="vcard-top"><strong>${esc(varLabel(it.v))}</strong>${fl ? `<span class="flag-dot" title="${fl} review flag(s)">${fl}</span>` : ''}</span>
      <span class="vcard-sub">${esc((TYPE_LABEL[it.v.type] || '—').split(' (')[0])}${it.v.vaf !== '' ? ' · VAF ' + esc(it.v.vaf) + '%' : ''}</span>
      ${chip(catLabel, catTone)}</button>`;
  }).join('');
}

const INTERP_TABS = [['biology', 'Biology & variant'], ['classification', 'Classification'], ['clinical', 'Clinical relevance'], ['origin', 'Origin & caveats'], ['sources', 'Sources']];

function renderInterpDetail() {
  const el = $('#interpDetail');
  const v = state.variants.find((x) => x.id === state.ui.selectedId);
  if (!v) { el.innerHTML = `<div class="empty-inline">Select a variant from the list.</div>`; return; }
  const it = interpret(v);
  const [catLabel, catTone] = CATEGORY_LABEL[it.category];
  const body = { biology: detailBiology, classification: detailClassification, clinical: detailClinical, origin: detailOrigin, sources: detailSources }[state.ui.interpTab](it);
  el.innerHTML = `<div class="detail-head">
      <div><p class="eyebrow">${esc(it.gene ? it.gene.role : 'Gene not in library')}</p><h2>${esc(varLabel(v))}</h2></div>
      <div class="chips">${chip((TYPE_LABEL[v.type] || '—').split(' (')[0], 'grey')}${chip(catLabel, catTone)}</div></div>
    ${it.warn ? callout('peach', 'Variant-specific caution', esc(it.warn)) : ''}
    <div class="tabs" role="tablist" aria-label="Variant detail sections">${INTERP_TABS.map(([k, l]) => `<button role="tab" class="tab${state.ui.interpTab === k ? ' active' : ''}" aria-selected="${state.ui.interpTab === k}" data-action="interpTab" data-key="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="tab-body" role="tabpanel">${body}</div>`;
}

/* ---- tab 1: biology ---- */
function hgvsTable(label, str, hasTranscript) {
  const p = parseHGVS(str); if (!p) return '';
  if (hasTranscript) p.warnings = p.warnings.filter((w) => !/^No reference/.test(w));
  return `<div class="hgvs-block"><h5>${esc(label)}: <span class="mono">${esc(str)}</span></h5>${p.rows.length ? kv(p.rows.map(([k, val]) => [k, esc(val)])) : ''}${p.warnings.map((w) => `<p class="small warn-line">⚠ ${esc(w)}</p>`).join('')}</div>`;
}
function detailBiology(it) {
  const { v, gene, rule } = it;
  let h = '';
  h += gene ? `<section class="block"><h4>Gene and normal function</h4>${kv([
      ['Gene', `<strong>${esc(it.nv.gene)}</strong> — ${esc(gene.name)}`],
      ['Role in cancer', esc(gene.role)],
      ['Normal function', esc(gene.fn)],
      ['Pathway', esc(gene.pathway)]
    ])}</section>`
    : `<section class="block">${callout('grey', 'Gene not in the prototype library', `<p><strong>${esc(it.nv.gene || '(no gene)')}</strong> is not part of the ${Object.keys(GENES).length}-gene curated library, so no biological summary or interpretation is shown. This is a limit of the prototype, not a statement about the gene. Use the search links in the Sources tab.</p>`)}</section>`;

  h += `<section class="block"><h4>Exact reported variant and nomenclature</h4>${kv([
      ['Protein change (as reported)', v.variant ? `<span class="mono">${esc(v.variant)}</span>` : ''],
      ['cDNA change (as reported)', v.hgvsC ? `<span class="mono">${esc(v.hgvsC)}</span>` : ''],
      ['Transcript', v.transcript ? `<span class="mono">${esc(v.transcript)}</span>` : '<span class="warn-text">Not stated</span>'],
      ['Mutation type', `<strong>${esc((TYPE_LABEL[v.type] || '—').split(' (')[0])}</strong> — ${esc(TYPE_INFO[v.type] || '')}`],
      ['VAF / depth', `${v.vaf !== '' ? esc(v.vaf) + '%' : '—'} / ${v.depth !== '' ? esc(v.depth) + '×' : '—'}`],
      ['Copy number', v.cn !== '' ? esc(v.cn) : ''],
      ['Fusion partner', v.partner ? esc(v.partner.toUpperCase()) : '']
    ])}
    ${v.variant && /^p\.|^[A-Za-z]{1,3}\d/.test(v.variant.trim()) ? hgvsTable('Protein description decoded', v.variant, !!v.transcript) : ''}
    ${v.hgvsC ? hgvsTable('cDNA description decoded', v.hgvsC, !!v.transcript) : ''}</section>`;

  if (rule) {
    h += `<section class="block"><h4>What this variant does</h4><p class="subtle"><strong>${esc(rule.title)}</strong> · ${esc(rule.effect)}</p><p>${rule.biology}</p></section>
      <section class="block"><h4>Oncogenic significance <span class="tag">curated educational statement</span></h4>
        <p><strong>${esc(rule.onco)}</strong></p>
        <p class="small muted">This is a hand-curated summary, not a formal ClinGen/CGC/VICC point-based classification. Pathogenicity (germline), oncogenicity (somatic) and actionability are separate questions — see the Classification tab.</p></section>`;
  } else {
    const ts = gene && /suppressor/i.test(gene.role);
    h += `<section class="block"><h4>Variant-level interpretation</h4>${callout('grey', 'No curated interpretation for this specific variant', `<p>The prototype has no rule for this exact variant, so it <strong>does not classify it</strong> and does not infer pathogenicity or oncogenicity from the gene alone. Check ClinVar, ClinGen, CIViC, OncoKB and COSMIC (search links in the Sources tab) and record what you find in the Classification tab.</p>${ts && TRUNCATING.includes(v.type) ? `<p class="small">Educational note: truncating variants (nonsense, frameshift, canonical splice-site) in a tumour-suppressor gene are often loss-of-function, but this must be confirmed for the specific position and transcript.</p>` : ''}${v.type === 'missense' ? `<p class="small">Educational note: a missense change is a variant of uncertain significance until supported by hotspot recurrence, functional or clinical evidence.</p>` : ''}`)}</section>`;
  }
  return h;
}

/* ---- tab 2: classification ---- */
function classificationAMP(it) {
  if (it.ctx && it.ctx.tier && it.match !== 'other') return { val: it.ctx.tier, note: 'Suggested by the curated rule for this tumour type. The laboratory or molecular tumour board assigns the final tier.' };
  if (it.match === 'other' && it.rule) {
    const approvedElsewhere = it.rule.contexts.some((c) => c.rx.some((r) => r.status === 'approved'));
    if (approvedElsewhere) return { val: 'Tier II · Level C (pattern: approved therapy in a different tumour type)', note: 'Derived from the AMP/ASCO/CAP definition of Level C. Not a laboratory assignment — confirm.' };
  }
  return { val: null, note: 'Not assigned by the prototype. Tier assignment requires the tumour type, the evidence and laboratory/tumour-board judgement.' };
}
function lookupInputs(it) {
  const L = it.v.lookups;
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x)}"${x === sel ? ' selected' : ''}>${esc(x || 'Select…')}</option>`).join('');
  const cvCls = ['', 'Pathogenic', 'Likely pathogenic', 'Uncertain significance', 'Likely benign', 'Benign', 'Conflicting classifications', 'Not found in ClinVar'];
  return `<form class="lookup-form" data-vid="${it.v.id}" autocomplete="off" onsubmit="return false">
    <p class="small muted">Record what <em>you</em> found when you looked it up yourself. These entries are saved only in this browser tab, are labelled “clinician-entered”, and are not verified by the app.</p>
    <div class="form-grid">
      <label class="field"><span>ClinVar classification</span><select data-lk="clinvar.cls">${opts(cvCls, L.clinvar.cls)}</select></label>
      <label class="field"><span>ClinVar review status (stars)</span><select data-lk="clinvar.stars">${opts(['', '0', '1', '2', '3', '4'], L.clinvar.stars)}</select></label>
      <label class="field"><span>ClinVar date checked</span><input type="date" data-lk="clinvar.date" value="${esc(L.clinvar.date)}"></label>
      <label class="field"><span>ClinGen (VCEP / curation note)</span><input type="text" data-lk="clingen.cls" value="${esc(L.clingen.cls)}" maxlength="120" placeholder="e.g. expert-panel classification"></label>
      <label class="field"><span>ClinGen date checked</span><input type="date" data-lk="clingen.date" value="${esc(L.clingen.date)}"></label>
      <label class="field"><span>CIViC evidence (level / summary)</span><input type="text" data-lk="civic.cls" value="${esc(L.civic.cls)}" maxlength="120" placeholder="e.g. evidence level and direction"></label>
      <label class="field"><span>CIViC date checked</span><input type="date" data-lk="civic.date" value="${esc(L.civic.date)}"></label>
      <label class="field"><span>OncoKB level (as you saw it)</span><input type="text" data-lk="oncokb.level" value="${esc(L.oncokb.level)}" maxlength="40" placeholder="e.g. Level 1"></label>
      <label class="field"><span>OncoKB date checked</span><input type="date" data-lk="oncokb.date" value="${esc(L.oncokb.date)}"></label>
    </div></form>`;
}
function detailClassification(it) {
  const { v, rule, ctx } = it;
  const L = v.lookups;
  const amp = classificationAMP(it);
  const germlineGene = GERMLINE_PRONE.includes(it.nv.gene);
  const heme = IS_HEME(state.case.cancer);
  const fdaDrugs = ctx ? ctx.rx.filter((r) => r.status === 'approved' || r.status === 'agnostic').map((r) => r.drug) : [];
  const sec = (title, inner, tag) => `<section class="class-card"><div class="class-head"><h4>${title}</h4>${tag || ''}</div>${inner}</section>`;
  const recorded = (text, date) => text ? `<p class="recorded"><span class="chip chip-blue">Clinician-entered</span> ${esc(text)}${date ? ` · checked ${esc(date)}` : ' · date not recorded'} <span class="muted small">(not verified by this app)</span></p>` : '';
  let h = `<div class="poa-strip">
      <div class="poa-item poa-lav"><b>Pathogenic?</b><span>Germline disease-causing<br><em>ACMG/AMP 2015</em></span></div>
      <div class="poa-item poa-blue"><b>Oncogenic?</b><span>Somatic driver<br><em>ClinGen/CGC/VICC 2022</em></span></div>
      <div class="poa-item poa-mint"><b>Actionable?</b><span>Alters care for this tumour &amp; setting<br><em>AMP/ASCO/CAP · ESCAT · OncoKB</em></span></div>
    </div>
    <p class="small muted center-text">Each lens answers a different question. They are shown separately and must not be mixed.</p>`;

  h += sec('Germline pathogenicity <span class="muted">(ACMG/AMP 2015)</span>',
    germlineGene
      ? `<p><strong>Applies if this variant is germline.</strong> ${esc(it.nv.gene)} is a hereditary-cancer gene. If germline origin is confirmed, the five-class ACMG/AMP scale (pathogenic → benign) applies. This prototype does not classify germline variants; use ClinVar and ClinGen expert-panel (VCEP) curation.</p>`
      : `<p>Not applicable unless germline origin is suspected. ${esc(it.nv.gene || 'This gene')} is not in the prototype’s hereditary-cancer list.</p>`,
    chip('Not assigned', 'grey'));

  h += sec('Somatic oncogenicity <span class="muted">(ClinGen / CGC / VICC 2022)</span>',
    rule ? `<p>${esc(rule.onco)}.</p><p class="small muted">Curated educational statement; the formal scale is oncogenic · likely oncogenic · VUS · likely benign · benign, applied with the point-based SOP.</p>` : `<p>No curated statement for this variant. Do not infer oncogenicity from the gene alone.</p>`,
    chip(rule ? 'Curated statement' : 'Not curated', rule ? 'lav' : 'grey'));

  h += sec('AMP/ASCO/CAP somatic variant tier', `<p class="big-val">${amp.val ? esc(amp.val) : '<span class="muted">Not assigned</span>'}</p><p class="small muted">${esc(amp.note)}</p><details class="detail-box"><summary>Tier and level definitions</summary><p class="small">${esc(AMP_TEXT)}</p></details>`, chip(amp.val ? 'Suggested' : 'Not assigned', amp.val ? 'mint' : 'grey'));

  let escatHtml;
  if (heme) escatHtml = `<p class="muted">ESCAT tiers are not curated for haematological malignancies in this prototype. Use disease-specific frameworks (for example ELN 2022 for AML).</p>`;
  else if (ctx && ctx.escat && it.match === 'exact') escatHtml = `<p class="big-val">${esc(ctx.escat)}</p><p class="small">${esc(ESCAT_TEXT[ctx.escat] || '')}</p><p class="small muted">Entered by the developer only where the tier was clearly established in the Mateo et al. 2018 publication; the table was not machine-verified. Tiers are tumour-type-specific and revised over time — verify against the ESCAT publication and current ESMO guidance.</p>`;
  else escatHtml = `<p class="muted">No ESCAT tier is curated in this prototype for this alteration and tumour type. <strong>This does not mean no tier exists.</strong> Consult the ESCAT publications and ESMO guidelines.</p>`;
  h += sec('ESMO ESCAT tier', escatHtml + `<details class="detail-box"><summary>ESCAT tier definitions (primary source)</summary><p class="small">I: ready for routine clinical decisions · II: investigational, likely to define a benefiting population but more data needed · III: clinical benefit shown in other tumour types or for similar targets · IV: preclinical evidence · V: supports co-targeting · X: lack of evidence. Mateo J et al., Ann Oncol 2018.</p></details>`, chip(ctx && ctx.escat && it.match === 'exact' && !heme ? 'Curated snapshot' : 'Not curated', ctx && ctx.escat && it.match === 'exact' && !heme ? 'lav' : 'grey'));

  const ok = ctx && ctx.oncokb && it.match === 'exact';
  h += sec('OncoKB therapeutic evidence level', `${ok ? `<p class="big-val">${esc(ctx.oncokb)}</p><p class="small muted">Curated by the developer from the published level definitions and the FDA approval status; <strong>not retrieved from OncoKB</strong>. OncoKB levels are versioned and updated and may differ from this entry, so confirm on oncokb.org and note the date.</p>` : `<p class="muted">Not curated here. Open OncoKB to view the current level for this alteration and tumour type.</p>`}
    ${recorded(L.oncokb.level, L.oncokb.date)}
    <div class="live-zone"><p class="small"><strong>Live (optional):</strong> ${liveBtn('liveOncokb', `data-id="${v.id}"`, 'Retrieve from OncoKB via local proxy')} <span class="small muted">needs your licensed token on the local proxy</span></p>${oncokbBlock(v)}</div>
    <p class="small muted">OncoKB is free for research and educational use; clinical-reporting use and API access need a licence/token. The token stays on the local proxy, never in this page.</p>`, state.live.results[`${v.id}:oncokb`] && !state.live.results[`${v.id}:oncokb`].error ? chip('Retrieved via proxy', 'mint') : chip(ok ? 'Curated snapshot' : 'Not curated', ok ? 'lav' : 'grey'));

  h += sec('ClinVar classification and review status',
    `${state.live.results[`${v.id}:clinvar`] && !state.live.results[`${v.id}:clinvar`].error ? '' : `<p><strong>Not retrieved.</strong> This app has <u>not</u> queried ClinVar for this variant. ${recorded(L.clinvar.cls ? `${L.clinvar.cls}${L.clinvar.stars !== '' ? ` · ${L.clinvar.stars} star(s)` : ''}` : '', L.clinvar.date)}</p>`}
    <div class="live-zone"><p class="small"><strong>Live (optional):</strong> ${liveBtn('liveClinvar', `data-id="${v.id}"`, 'Retrieve from NCBI ClinVar')} <span class="small muted">sends the gene and variant name to NCBI</span></p>${clinvarBlock(v)}${state.live.results[`${v.id}:clinvar`] ? recorded(L.clinvar.cls ? `${L.clinvar.cls}${L.clinvar.stars !== '' ? ` · ${L.clinvar.stars} star(s)` : ''}` : '', L.clinvar.date) : ''}</div>
    <details class="detail-box"><summary>How to read ClinVar review status</summary><p class="small">0 stars: no assertion criteria / no classification provided · 1 star: criteria provided, single submitter or conflicting classifications · 2 stars: criteria provided, multiple submitters, no conflicts · 3 stars: reviewed by expert panel · 4 stars: practice guideline. Check the classification <em>type</em>: ClinVar remains largely germline-oriented.</p></details>`,
    state.live.results[`${v.id}:clinvar`] && !state.live.results[`${v.id}:clinvar`].error ? chip('Retrieved live', 'mint') : chip('Not retrieved', 'grey'));

  h += sec('ClinGen and CIViC', `<p><strong>Not retrieved.</strong> There is no ClinGen or CIViC connector in this version; the app has not queried them. Use the search links in the Sources tab and record what you find below.</p>${recorded(L.clingen.cls, L.clingen.date)}${recorded(L.civic.cls, L.civic.date)}<p class="small muted">ClinGen offers expert-panel variant curation and gene–disease validity; CIViC offers community-curated evidence items with evidence levels and direction.</p>`, chip('Not retrieved', 'grey'));

  h += sec('Regulatory status (FDA / EMA)',
    `<p><strong>FDA</strong> — ${fdaDrugs.length ? `approved options curated for this biomarker in your tumour type: <strong>${esc(fdaDrugs.join('; '))}</strong>. Confirm the exact indication and companion-diagnostic requirement on the label.` : 'no FDA-approved option is curated for this biomarker in your tumour type.'}</p>
     <p><strong>EMA</strong> — <span class="muted">not curated in this prototype.</span> EU status and indications can differ; check the EPAR. ${extLink('https://www.ema.europa.eu/en/medicines', 'EMA medicines')} · ${extLink('https://www.accessdata.fda.gov/scripts/cder/daf/', 'Drugs@FDA')}</p>`,
    chip(fdaDrugs.length ? 'FDA curated' : 'None curated', fdaDrugs.length ? 'mint' : 'grey'));

  h += `<section class="class-card"><div class="class-head"><h4>Record your own look-ups</h4></div>${lookupInputs(it)}</section>`;
  return h;
}

/* ---- tab 3: clinical ---- */
function matchBanner(it) {
  const cancer = cancerLabel(state.case.cancer);
  if (!it.rule) return '';
  if (it.match === 'exact') return callout('mint', 'Curated for your tumour type', `<p>This interpretation is curated for <strong>${esc(cancer)}</strong>. Confirm the disease setting and the exact label wording.</p>`);
  if (it.match === 'agnostic' && !it.ctx.rx.some((r) => ['approved', 'agnostic'].includes(r.status))) return callout('grey', 'Not tumour-specific', `<p>This entry applies across tumour types. No approved therapy is attached to it, so the information below is biological, prognostic or cautionary rather than a treatment recommendation.</p>`);
  if (it.match === 'agnostic') return callout('blue', 'Tumour-agnostic indication', `<p>Evidence in this entry applies across tumour types, with conditions (prior treatment, no satisfactory alternative, age). Haematological malignancies are not covered by the curated tumour-agnostic entries.</p>`);
  const tumours = it.rule.contexts.filter((c) => !c.c.includes('*')).flatMap((c) => c.c).map(cancerLabel).join(', ');
  return callout('lav', 'Your tumour type is not covered by this rule', `<p>The curated evidence for this alteration comes from: <strong>${esc(tumours || 'other tumour types')}</strong>. Your tumour type (<strong>${esc(cancer)}</strong>) is different, so that evidence <strong>does not automatically apply</strong>.</p>${it.rule.other ? `<p>${esc(it.rule.other)}</p>` : ''}`);
}
function rxTable(rx) {
  if (!rx || !rx.length) return `<p class="muted">No treatment options are curated for this alteration in this context.</p>`;
  return `<div class="table-wrap"><table class="table table-compact"><thead><tr><th>Option</th><th>Status</th><th>Indication / note</th></tr></thead><tbody>${rx.map((r) => `<tr><td><strong>${esc(r.drug)}</strong><div class="small muted">${esc(r.cls)}</div></td><td>${statusChip(r.status)}</td><td>${esc(r.indication)}${r.caution ? `<div class="small warn-line">⚠ ${esc(r.caution)}</div>` : ''}${r.refs && r.refs.length ? `<div class="small">${refChips(r.refs)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function detailClinical(it) {
  const { rule, ctx } = it;
  if (!rule) return callout('grey', 'No curated clinical interpretation', `<p>No prognostic, predictive or resistance statements are curated for this variant. Do not assume a clinical meaning from the gene alone.</p>`) + `<p class="small muted">${it.gene ? 'Gene-level biology is available on the Biology tab.' : ''}</p>`;
  let h = matchBanner(it);
  if (ctx) {
    h += `<section class="block"><h4>Predictive significance</h4><p>${esc(ctx.pred || 'Not curated.')}</p></section>`;
    h += `<section class="block"><h4>Prognostic significance</h4><p>${esc(ctx.prog || 'No prognostic statement is curated for this alteration in this tumour type.')}</p></section>`;
    h += `<section class="block"><h4>Resistance implications</h4>${ctx.res && ctx.res.length ? `<ul>${ctx.res.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="muted">None curated.</p>'}${rule.roles.includes('resistance') ? `<p>${chip('This alteration is itself a resistance-associated marker', 'rose')}</p>` : ''}</section>`;
    h += `<section class="block"><h4>Treatment options (${it.match === 'agnostic' ? 'tumour-agnostic' : 'for this tumour type'})</h4>${rxTable(ctx.rx)}<div class="btn-row">${goBtn('actionability', 'Compare with your disease setting →', 'secondary')}</div></section>`;
    if (ctx.note) h += `<section class="block">${callout('blue', 'Practical note', `<p>${esc(ctx.note)}</p>`)}</section>`;
  } else {
    const others = rule.contexts.filter((c) => !c.c.includes('*'));
    h += `<section class="block"><h4>Evidence in other tumour types (does not transfer automatically)</h4>${others.map((c) => `<div class="other-ctx"><h5>${esc(c.c.map(cancerLabel).join(', '))}</h5><p class="small">${esc(c.pred || '')}</p>${rxTable(c.rx.map((r) => (['approved', 'agnostic'].includes(r.status) ? { ...r, status: 'approved-other' } : r)))}</div>`).join('')}</section>`;
  }
  return h;
}

/* ---- tab 4: origin & caveats ---- */
function vafBar(v) {
  const vaf = num(v.vaf), purity = num(state.case.purity);
  if (vaf === null) return '';
  const marks = [[50, '50%'], [100, '100%']];
  const exp = state.case.specimen === 'tissue' && purity ? purity / 2 : null;
  return `<div class="vaf-bar" role="img" aria-label="VAF ${vaf} percent"><div class="vaf-fill" style="width:${Math.min(100, vaf)}%"></div>
    ${marks.map(([m, l]) => `<i class="vaf-tick" style="left:${m === 100 ? 99.5 : m}%"><span>${l}</span></i>`).join('')}
    ${exp ? `<i class="vaf-exp" style="left:${exp}%"><span>expected ≈ ${exp.toFixed(0)}%</span></i>` : ''}</div>
    <p class="small muted">Bar = observed VAF (${vaf}%). Ticks mark 50% and 100% (germline-like values)${exp ? '; the marker shows the VAF expected for a clonal heterozygous change at the entered tumour purity' : ''}.</p>`;
}
function detailOrigin(it) {
  const { v, rule, gene } = it;
  const fl = variantFlags(v);
  const icon = { missing: '○', warn: '▲', info: 'ℹ', uncertain: '?' }, tone = { missing: 'rose', warn: 'peach', info: 'blue', uncertain: 'peach' };
  let h = `<section class="block"><h4>Somatic versus germline</h4><p>${esc(rule ? rule.somgerm : (gene ? gene.germline : 'Not curated: gene not in the library.'))}</p>
     <p class="small muted">Reported origin: <strong>${esc((ORIGINS.find((o) => o[0] === v.origin) || ['', '—'])[1])}</strong>. Case germline status: <strong>${esc((GERMLINE_STATUS.find((g) => g[0] === state.case.germline) || ['', '—'])[1])}</strong>.</p></section>`;
  h += `<section class="block"><h4>Allele fraction in context</h4>${vafBar(v) || '<p class="muted">VAF not stated.</p>'}</section>`;
  h += `<section class="block"><h4>Review flags for this variant</h4>${fl.length ? `<ul class="check-list">${fl.map((f) => `<li class="check-${tone[f.level]}"><span class="check-ico" aria-hidden="true">${icon[f.level]}</span><span>${esc(f.text)}</span></li>`).join('')}</ul>` : '<p class="ok-line">✓ No flags raised for this variant.</p>'}</section>`;
  return h;
}

/* ---- tab 5: sources ---- */
function detailSources(it) {
  const links = dbLinks(it);
  const refs = it.rule ? it.rule.refs.concat(...it.rule.contexts.flatMap((c) => c.rx.map((r) => r.refs || []))) : [];
  const uniq = Array.from(new Set(refs)).filter((x) => REF_BY_ID[x]);
  return `<section class="block"><h4>Open a search for this variant</h4>
      <p class="small muted">These buttons only <strong>open a search page</strong> on the external site. The app has not retrieved anything from these databases. Web addresses were not live-checked.</p>
      <div class="chips">${links.map(([n, u]) => `<a class="btn btn-secondary btn-sm" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a>`).join('')}</div>
      <p class="small warn-line">⚠ Do not paste identifiable patient information into external tools without consent and governance.</p></section>
    <section class="block"><h4>Literature search (live, optional)</h4><p class="small">${liveBtn('livePubmed', `data-id="${it.v.id}"`, 'Search PubMed for this variant')} <span class="small muted">sends the gene, protein change and tumour-type label to NCBI</span></p>${pubmedBlock(it.v)}</section>
    <section class="block"><h4>References behind the curated entry</h4>${uniq.length ? `<ul class="ref-list">${uniq.map((id) => { const r = REF_BY_ID[id]; return `<li>${esc(refCitation(r))} ${extLink(refLink(r), r.kind === 'paper' ? 'PubMed' : 'Site')}</li>`; }).join('')}</ul>` : '<p class="muted">No curated references for this variant.</p>'}
      <p class="small muted">Curated library snapshot: ${KB_SNAPSHOT}. PMIDs and DOIs were matched in PubMed on that date. See the Evidence Library for details.</p></section>`;
}

/* ---------- ACTIONABILITY & TARGETED THERAPIES ---------- */

/**
 * Turn every interpreted variant (and biomarker) into a flat list of treatment
 * "options", each knowing whether the evidence comes from THIS tumour type,
 * from a tumour-agnostic approval, or from a DIFFERENT tumour type.
 */
function collectOptions() {
  const opts = [];
  interpretAll().forEach((it) => {
    if (!it.rule) return;
    if (it.ctx) {
      it.ctx.rx.forEach((r) => opts.push({ it, source: 'variant', rx: r, tumour: it.match, from: it.ctx.c.map(cancerLabel), warn: it.warn }));
    } else {
      it.rule.contexts.filter((c) => !c.c.includes('*')).forEach((c) => {
        c.rx.forEach((r) => opts.push({
          it, source: 'variant', tumour: 'other', from: c.c.map(cancerLabel), warn: '',
          rx: ['approved', 'agnostic'].includes(r.status) ? { ...r, status: 'approved-other' } : r
        }));
      });
    }
  });
  biomarkerFindings(state.case).filter((b) => b.state === 'positive').forEach((b) => {
    b.rx.forEach((r) => opts.push({ it: null, bm: b, source: 'biomarker', rx: r, tumour: r.status === 'agnostic' ? 'agnostic' : r.status === 'approved-other' ? 'other' : 'exact', from: [], warn: '' }));
  });
  return opts;
}

/** Does this option fit the patient's exact tumour type AND disease setting? */
function fitFor(opt) {
  const cs = state.case, r = opt.rx;
  if (r.status === 'unsupported') return { tone: 'rose', head: 'Caution', lines: ['This describes something that is NOT expected to work or should be avoided in this biomarker context.'] };
  const lines = []; let tumourOk = null, settingOk = null;
  if (opt.tumour === 'exact') { tumourOk = true; lines.push(`Tumour type: evidence is curated for ${cancerLabel(cs.cancer)}.`); }
  else if (opt.tumour === 'agnostic') { tumourOk = true; lines.push('Tumour type: tumour-agnostic indication (check prior-therapy and age conditions).'); }
  else { tumourOk = false; lines.push(`Tumour type: evidence comes from ${opt.from.join(', ') || 'other tumour types'}; it is not established for ${cancerLabel(cs.cancer)}.`); }
  if (r.settings && r.settings.length) {
    if (cs.setting && cs.setting !== 'unspecified') {
      settingOk = r.settings.includes(cs.setting);
      lines.push(settingOk ? 'Disease setting: matches the curated setting.' : `Disease setting: differs — curated for ${r.settings.map((s) => SETTING_SHORT[s] || s).join('; ')}.`);
    } else lines.push('Disease setting: not specified in the case — cannot check.');
  } else lines.push('Disease setting: not curated — check the label.');
  let tone = 'grey', head = 'Check the label';
  if (tumourOk === false) { tone = 'rose'; head = 'Does not automatically apply'; }
  else if (settingOk === false) { tone = 'peach'; head = 'Tumour matches · setting differs'; }
  else if (settingOk === true) { tone = 'mint'; head = 'Likely applies · verify the label'; }
  else { tone = 'blue'; head = 'Tumour matches · confirm the setting'; }
  return { tone, head, lines, tumourOk, settingOk };
}

const ACT_FILTERS = [['all', 'All'], ['approved', 'Approved (this tumour / agnostic)'], ['other', 'Approved in other tumour'], ['verify', 'Evolving'], ['investigational', 'Investigational'], ['unsupported', 'Not supported']];
function passFilter(opt) {
  const f = state.ui.actFilter, s = opt.rx.status;
  if (f === 'approved' && !['approved', 'agnostic'].includes(s)) return false;
  if (f === 'other' && s !== 'approved-other') return false;
  if (['verify', 'investigational', 'unsupported'].includes(f) && s !== f) return false;
  if (state.ui.actGene && !(opt.it && opt.it.nv.gene === state.ui.actGene)) return false;
  if (state.ui.actSettingOnly) { const ft = fitFor(opt); if (ft.settingOk === false) return false; }
  return true;
}

/** Buttons (and results) for checking the live openFDA label of each drug in an option. */
function fdaControls(r) {
  if (!['approved', 'agnostic', 'approved-other'].includes(r.status)) return '';
  const names = genericNames(r.drug);
  if (!names.length) return '';
  return `<div class="live-zone">${names.map((n) => `<div>${liveBtn('liveFda', `data-name="${esc(n)}"`, `Check FDA label: ${n}`)}${fdaBlock(n)}</div>`).join('')}</div>`;
}

function optionCard(opt) {
  const r = opt.rx, ft = fitFor(opt);
  return `<article class="rx-card">
    <div class="rx-top"><div><h5>${esc(r.drug)}</h5><p class="small muted">${esc(r.cls)}</p></div>${statusChip(r.status)}</div>
    <p>${esc(r.indication)}</p>
    ${r.key ? `<p class="key-result"><strong>Key result:</strong> ${esc(r.key)}</p>` : ''}
    <div class="fit fit-${ft.tone}"><strong>${esc(ft.head)}</strong><ul>${ft.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
    ${opt.warn ? `<p class="small warn-line">⚠ ${esc(opt.warn)}</p>` : ''}
    ${r.caution ? `<p class="small warn-line">⚠ ${esc(r.caution)}</p>` : ''}
    ${r.refs && r.refs.length ? `<p class="small">Evidence: ${refChips(r.refs)}</p>` : '<p class="small muted">No primary trial reference curated — see the FDA label.</p>'}
    ${fdaControls(r)}
  </article>`;
}

function renderActionability() {
  const gate = $('#actGate'), wrap = $('#actWrap');
  if (!state.variants.length) { gate.innerHTML = emptyState('No findings yet', 'Add variants or load a sample report first.', goBtn('upload', 'Go to Upload NGS Report')); wrap.hidden = true; return; }
  if (!state.confirmed) { gate.innerHTML = confirmGate('Actionability & Targeted Therapies'); wrap.hidden = true; return; }
  gate.innerHTML = ''; wrap.hidden = false;
  const genes = Array.from(new Set(state.variants.map((v) => normGene(v.gene)).filter(Boolean))).sort();
  $('#actGene').innerHTML = `<option value="">All genes</option>` + genes.map((g) => `<option value="${g}"${state.ui.actGene === g ? ' selected' : ''}>${g}</option>`).join('');
  $('#actSettingOnly').checked = state.ui.actSettingOnly;
  $('#actFilters').innerHTML = ACT_FILTERS.map(([k, l]) => `<button class="pill${state.ui.actFilter === k ? ' active' : ''}" data-action="actFilter" data-key="${k}" aria-pressed="${state.ui.actFilter === k}">${esc(l)}</button>`).join('');
  $('#actTabs').innerHTML = [['therapies', 'Targeted therapies'], ['immuno', 'Immunotherapy & signatures'], ['resistance', 'Resistance'], ['trials', 'Clinical trials']].map(([k, l]) => `<button role="tab" class="tab${state.ui.actTab === k ? ' active' : ''}" aria-selected="${state.ui.actTab === k}" data-action="actTab" data-key="${k}">${esc(l)}</button>`).join('');
  $('#actFilterBar').hidden = state.ui.actTab !== 'therapies';
  renderActBody();
}

function renderActBody() {
  const el = $('#actRoot');
  const opts = collectOptions();
  const its = interpretAll();
  const cs = state.case;
  const header = `<div class="grid grid-4 act-stats">
      <div class="stat card"><span class="stat-n">${its.filter((i) => i.category === 'actionable').length}</span><span class="stat-l">alterations actionable in ${esc(cancerLabel(cs.cancer))}${its.some((i) => i.category === 'conditional') ? ` (+${its.filter((i) => i.category === 'conditional').length} conditional on germline confirmation)` : ''}</span></div>
      <div class="stat card"><span class="stat-n">${its.filter((i) => i.category === 'other-tumour').length}</span><span class="stat-l">with evidence only in other tumour types</span></div>
      <div class="stat card"><span class="stat-n">${its.filter((i) => i.category === 'resistance').length}</span><span class="stat-l">resistance / negative predictors</span></div>
      <div class="stat card"><span class="stat-n">${its.filter((i) => ['norule', 'nogene'].includes(i.category)).length}</span><span class="stat-l">not curated (unassessed)</span></div></div>
    <div class="callout callout-blue"><div class="callout-title">Setting for matching: ${esc(SETTING_LABEL[cs.setting] || 'Not specified')}</div><div class="callout-body">Matching uses the tumour type and disease setting you entered. Treatment choice also depends on performance status, comorbidity, prior therapy, access and the molecular tumour board. This page is decision support, not a recommendation.</div></div>`;
  let body = '';
  if (state.ui.actTab === 'therapies') {
    const legend = `<div class="legend card"><h4>Status legend</h4><div class="chips">${Object.keys(STATUS).filter((k) => k !== 'guideline').map((k) => statusChip(k)).join('')}</div>
      <p class="small muted"><strong>Guideline-supported</strong> is deliberately not assigned: the prototype does not reproduce NCCN/ESMO text, which is proprietary or changes often. Check current guidelines. <strong>EMA</strong> status is not curated.</p></div>`;
    const filtered = opts.filter((o) => o.source === 'variant' && passFilter(o));
    const byVariant = new Map();
    filtered.forEach((o) => { const k = o.it.v.id; if (!byVariant.has(k)) byVariant.set(k, []); byVariant.get(k).push(o); });
    body = legend;
    if (!byVariant.size) body += `<div class="empty-inline">No treatment options match the current filters${its.some((i) => i.rule) ? '.' : ' — none of the variants has a curated rule.'}</div>`;
    byVariant.forEach((list, id) => {
      const it = list[0].it; const [cl, ct] = CATEGORY_LABEL[it.category];
      body += `<section class="act-group"><div class="act-group-head"><h3>${esc(varLabel(it.v))}</h3>${chip(cl, ct)}</div>
        ${it.match === 'other' ? callout('lav', 'Different tumour type', `<p>Options below are from <strong>other</strong> tumour types and do not automatically apply to ${esc(cancerLabel(cs.cancer))}.</p>`) : ''}
        <div class="grid grid-2">${list.map(optionCard).join('')}</div></section>`;
    });
    const noRule = its.filter((i) => !i.rule);
    if (noRule.length) body += `<section class="act-group"><h3>Not assessed</h3><p class="small muted">No curated rule: ${noRule.map((i) => esc(varLabel(i.v))).join('; ')}. Absence from this page does not mean absence of an option.</p></section>`;
  } else if (state.ui.actTab === 'immuno') {
    const bms = biomarkerFindings(cs);
    body = `<div class="callout callout-lav"><div class="callout-title">Biomarker-associated immunotherapy</div><div class="callout-body"><p>These are case-level biomarkers entered on the Upload page (MSI/MMR, TMB, HRD, PD-L1). They are separate from single-gene variants.</p></div></div>`;
    if (!bms.length) body += `<div class="empty-inline">No biomarker values were entered. Add MSI/MMR status, TMB, HRD or PD-L1 on the Upload page.</div>`;
    bms.forEach((b) => {
      const tone = b.state === 'positive' ? 'mint' : b.state === 'negative' ? 'grey' : 'blue';
      body += `<section class="act-group"><div class="act-group-head"><h3>${esc(b.title)}</h3>${chip(b.state === 'positive' ? 'Positive' : b.state === 'negative' ? 'Not met' : 'Recorded', tone)}</div><p>${esc(b.text)}</p>
        ${b.rx.length ? `<div class="grid grid-2">${b.rx.map((r) => optionCard({ it: null, bm: b, source: 'biomarker', rx: r, tumour: r.status === 'agnostic' ? 'agnostic' : r.status === 'approved-other' ? 'other' : 'exact', from: ['other tumour types'], warn: '' })).join('')}</div>` : ''}
        ${b.notes.length ? `<ul class="ticks">${b.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        ${b.refs && b.refs.length ? `<p class="small">Evidence: ${refChips(b.refs)}</p>` : ''}</section>`;
    });
    const mmr = its.filter((i) => i.rule && i.rule.id === 'MMR_GENES');
    if (mmr.length) body += `<div class="callout callout-peach"><div class="callout-title">Mismatch-repair gene variant reported</div><div class="callout-body"><p>${mmr.map((i) => esc(varLabel(i.v))).join('; ')}. The treatment relevance is carried by the MSI-H/dMMR phenotype; the germline question (Lynch syndrome) needs separate confirmation and counselling.</p></div></div>`;
  } else if (state.ui.actTab === 'resistance') {
    const markers = its.filter((i) => i.rule && i.rule.roles.includes('resistance'));
    body = `<div class="callout callout-rose"><div class="callout-title">Resistance-associated alterations</div><div class="callout-body"><p>Two groups: (1) alterations in this report that are themselves resistance markers; (2) resistance mechanisms to watch for with the therapies matched to this report.</p></div></div>`;
    body += `<h3 class="section-sub">Detected in this report</h3>`;
    if (!markers.length) body += `<div class="empty-inline">No curated resistance markers detected.</div>`;
    markers.forEach((i) => { body += `<article class="rx-card"><div class="rx-top"><div><h5>${esc(varLabel(i.v))}</h5><p class="small muted">${esc(i.rule.title)}</p></div>${chip('Resistance marker', 'rose')}</div><p>${esc((i.ctx && i.ctx.pred) || i.rule.effect)}</p>${i.ctx && i.ctx.res && i.ctx.res.length ? `<ul>${i.ctx.res.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</article>`; });
    body += `<h3 class="section-sub">To watch for with matched therapies</h3>`;
    const watch = its.filter((i) => i.ctx && i.ctx.res && i.ctx.res.length && !i.rule.roles.includes('resistance'));
    if (!watch.length) body += `<div class="empty-inline">None curated.</div>`;
    watch.forEach((i) => { body += `<article class="rx-card"><div class="rx-top"><div><h5>${esc(varLabel(i.v))}</h5></div></div><ul>${i.ctx.res.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></article>`; });
  } else {
    const cond = CANCER_SEARCH[cs.cancer] || cs.histology || '';
    const genes = Array.from(new Set(interpretAll().filter((i) => i.nv.gene).map((i) => i.nv.gene)));
    const inv = collectOptions().filter((o) => ['investigational', 'verify'].includes(o.rx.status));
    body = `<div class="callout callout-peach"><div class="callout-title">Clinical trials</div><div class="callout-body"><p>The app <strong>does not retrieve, match or verify trials</strong>. The buttons below open a search on ClinicalTrials.gov using your tumour type and gene. Check eligibility, recruiting status and sites yourself, and never share identifiable information with a trial site without consent.</p></div></div>
      <div class="card"><h4>Search ClinicalTrials.gov</h4><div class="chips">${genes.length ? genes.map((g) => `<a class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href="https://clinicaltrials.gov/search?${cond ? 'cond=' + encodeURIComponent(cond) + '&' : ''}term=${encodeURIComponent(g)}">${esc(g)}${cond ? ' · ' + esc(cond) : ''} ↗</a>`).join('') : '<span class="muted">No genes to search.</span>'}
      ${cond ? `<a class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href="https://clinicaltrials.gov/search?cond=${encodeURIComponent(cond)}">All trials · ${esc(cond)} ↗</a>` : ''}</div></div>
      <div class="card"><h4>Live trial search (ClinicalTrials.gov API, optional)</h4>${genes.length ? genes.map((g) => `<div class="live-zone"><p class="small">${liveBtn('liveTrials', `data-gene="${esc(g)}"`, `Search recruiting trials: ${g}${cond ? ' · ' + cond : ''}`)}</p>${trialsBlock(g)}</div>`).join('') : '<p class="muted">No genes to search.</p>'}<p class="small muted">Sends only the tumour-type label and gene symbol. Results are not an eligibility match.</p></div>
      <div class="card"><h4>Investigational or evolving classes noted in the library</h4>${inv.length ? `<ul>${inv.map((o) => `<li><strong>${esc(o.rx.drug)}</strong>${o.it ? ' — ' + esc(varLabel(o.it.v)) : ''}: ${esc(o.rx.indication)} ${statusChip(o.rx.status)}</li>`).join('')}</ul>` : '<p class="muted">None noted for this case.</p>'}
      <p class="small muted">No specific trial results are quoted. The library does not name unverified trials.</p></div>`;
  }
  el.innerHTML = header + body;
}
const CANCER_SEARCH = { nsclc: 'Non-small cell lung cancer', sclc: 'Small cell lung cancer', breast: 'Breast cancer', crc: 'Colorectal cancer', melanoma: 'Melanoma', ovarian: 'Ovarian cancer', prostate: 'Prostate cancer', pancreatic: 'Pancreatic cancer', gastric: 'Gastric cancer', biliary: 'Cholangiocarcinoma', urothelial: 'Urothelial carcinoma', thyroid: 'Thyroid cancer', gist: 'Gastrointestinal stromal tumor', glioma: 'Glioma', aml: 'Acute myeloid leukemia', cml: 'Chronic myeloid leukemia' };

/* ---------- MOLECULAR LEARNING CENTRE ---------- */
const LEARN_TABS = [['topics', 'Topics'], ['tools', 'Tools'], ['cards', 'Flash-cards'], ['quiz', 'Quiz']];

function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' '); }

function toolDepth() {
  return `<div class="calc" data-calc="depth"><h4>Can I trust a low-VAF call? (detection probability)</h4>
    <p class="small muted">Binomial model of random read sampling only — it ignores sequencing error, mapping problems and assay-specific filters.</p>
    <div class="form-grid">
      <label class="field"><span>Read depth (×)</span><input type="number" min="1" step="1" value="500" data-in="D"></label>
      <label class="field"><span>True VAF (%)</span><input type="number" min="0" max="100" step="0.1" value="2" data-in="f"></label>
      <label class="field"><span>Minimum mutant reads required to call</span><input type="number" min="1" step="1" value="5" data-in="k"></label></div>
    <div class="calc-out" data-out></div></div>`;
}
function toolPurity() {
  return `<div class="calc" data-calc="purity"><h4>Tumour purity ↔ VAF</h4>
    <p class="small muted"><code>expected VAF = (p × m) ÷ (p × CN + 2 × (1 − p))</code> — p = purity, CN = total copy number in the tumour, m = mutated copies per tumour cell.</p>
    <div class="form-grid">
      <label class="field"><span>Tumour purity (%)</span><input type="number" min="1" max="100" step="1" value="40" data-in="p"></label>
      <label class="field"><span>Tumour copy number at locus (CN)</span><input type="number" min="0" max="20" step="1" value="2" data-in="cn"></label>
      <label class="field"><span>Mutated copies per tumour cell (m)</span><input type="number" min="1" max="20" step="1" value="1" data-in="m"></label>
      <label class="field"><span>Observed VAF (%) — optional</span><input type="number" min="0" max="100" step="0.1" placeholder="e.g. 38" data-in="obs"></label></div>
    <div class="calc-out" data-out></div></div>`;
}
function toolHgvs() {
  return `<div class="calc" data-calc="hgvs"><h4>HGVS decoder</h4>
    <p class="small muted">Type a variant name. Examples: <button class="link-btn" data-action="hgvsExample" data-v="NM_005228.5:c.2573T>G">c.2573T&gt;G</button> · <button class="link-btn" data-action="hgvsExample" data-v="p.Leu858Arg">p.Leu858Arg</button> · <button class="link-btn" data-action="hgvsExample" data-v="c.5946del">c.5946del</button> · <button class="link-btn" data-action="hgvsExample" data-v="p.Ser1982ArgfsTer22">p.Ser1982ArgfsTer22</button> · <button class="link-btn" data-action="hgvsExample" data-v="c.2188-2A>G">c.2188-2A&gt;G</button></p>
    <label class="field"><span>Variant description</span><input type="text" value="NM_005228.5:c.2573T>G" data-in="s" maxlength="80" spellcheck="false"></label>
    <div class="calc-out" data-out></div></div>`;
}
function toolSyndromes() {
  return `<div class="calc" data-calc="syndromes"><h4>Eponymous cancer-predisposition syndromes ↔ genes</h4>
    <label class="field"><span>Filter</span><input type="search" placeholder="e.g. Lynch, TP53, RET" data-in="q"></label>
    <div class="table-wrap"><table class="table table-compact"><thead><tr><th>Syndrome</th><th>Gene(s)</th><th>Main tumours</th><th>Pearl</th></tr></thead><tbody data-out></tbody></table></div></div>`;
}

/** Fill the output area of one calculator. */
function runCalc(box) {
  const type = box.dataset.calc, out = $('[data-out]', box);
  const val = (k) => { const e = $(`[data-in="${k}"]`, box); return e ? e.value : ''; };
  if (type === 'depth') {
    const D = num(val('D')), f = num(val('f')), k = num(val('k'));
    if (!D || D < 1 || f === null || f < 0 || f > 100 || !k || k < 1) { out.innerHTML = '<p class="muted">Enter valid numbers.</p>'; return; }
    const pr = detectionProbability(Math.round(D), f / 100, Math.round(k)), exp = D * f / 100, lod = lodVaf(Math.round(D), Math.round(k), 0.95) * 100;
    out.innerHTML = `<div class="stat-row"><div class="stat"><span class="stat-n">${exp.toFixed(1)}</span><span class="stat-l">expected mutant reads</span></div>
      <div class="stat"><span class="stat-n">${(pr * 100).toFixed(1)}%</span><span class="stat-l">chance of ≥ ${Math.round(k)} mutant reads</span></div>
      <div class="stat"><span class="stat-n">${lod.toFixed(2)}%</span><span class="stat-l">VAF detected 95% of the time at this depth</span></div></div>
      <p class="small">${pr < 0.95 ? 'A true variant at this VAF would be missed in a meaningful fraction of runs. A negative result at this depth is weak evidence of absence.' : 'Detection is very likely under this simple model.'}</p>`;
  } else if (type === 'purity') {
    const p = num(val('p')), cn = num(val('cn')), m = num(val('m')), obs = num(val('obs'));
    if (!p || p <= 0 || p > 100 || cn === null || cn < 0 || !m || m < 1) { out.innerHTML = '<p class="muted">Enter valid numbers.</p>'; return; }
    const pf = p / 100, denom = pf * cn + 2 * (1 - pf);
    const exp = denom > 0 ? (pf * m) / denom * 100 : 0;
    let h = `<div class="stat-row"><div class="stat"><span class="stat-n">${exp.toFixed(1)}%</span><span class="stat-l">expected VAF</span></div>
      <div class="stat"><span class="stat-n">${(p / 2).toFixed(1)}%</span><span class="stat-l">clonal heterozygous, diploid (p ÷ 2)</span></div></div>`;
    if (obs !== null && pf > 0) {
      const mEst = obs / 100 * denom / pf;
      h += `<p><strong>Observed ${obs}%</strong> implies about <strong>${mEst.toFixed(2)}</strong> mutated copies per tumour cell at CN ${cn}. ` + (mEst < 0.7 ? 'Below 1: consistent with a subclonal variant (or lower true purity).' : mEst <= 1.3 ? 'About 1: consistent with a clonal variant on one copy.' : 'Above 1: suggests the variant sits on more than one copy (allelic imbalance/LOH or copy gain) — or a germline variant.') + '</p>';
    }
    out.innerHTML = h;
  } else if (type === 'hgvs') {
    const r = parseHGVS(val('s'));
    if (!r) { out.innerHTML = '<p class="muted">Type a variant description.</p>'; return; }
    out.innerHTML = (r.rows.length ? kv(r.rows.map(([k2, v2]) => [k2, esc(v2)])) : '') + r.warnings.map((w) => `<p class="small warn-line">⚠ ${esc(w)}</p>`).join('') + (r.ok ? '' : '');
  } else if (type === 'syndromes') {
    const q = val('q').trim().toLowerCase();
    out.innerHTML = SYNDROMES.filter((s) => !q || s.join(' ').toLowerCase().includes(q)).map((s) => `<tr><td><strong>${esc(s[0])}</strong></td><td>${esc(s[1])}</td><td>${esc(s[2])}</td><td>${esc(s[3])}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No match.</td></tr>';
  }
}
function initCalcs(root) { $$('.calc', root).forEach(runCalc); }

function renderLearn() {
  const tabs = $('#learnTabs');
  tabs.innerHTML = LEARN_TABS.map(([k, l]) => `<button role="tab" class="tab${state.ui.learnTab === k ? ' active' : ''}" aria-selected="${state.ui.learnTab === k}" data-action="learnTab" data-key="${k}">${esc(l)}${k === 'cards' ? ` <span class="pill-n">${FLASHCARDS.length}</span>` : ''}</button>`).join('');
  const el = $('#learnRoot');
  if (state.ui.learnTab === 'topics') el.innerHTML = learnTopics();
  else if (state.ui.learnTab === 'tools') el.innerHTML = `<div class="grid grid-2">${toolDepth()}${toolPurity()}</div>${toolHgvs()}${toolSyndromes()}`;
  else if (state.ui.learnTab === 'cards') el.innerHTML = learnCards();
  else el.innerHTML = learnQuiz();
  initCalcs(el);
}

function learnTopics() {
  const cats = ['All', ...Array.from(new Set(TOPICS.map((t) => t.cat)))];
  const q = state.ui.learnSearch.trim().toLowerCase();
  const list = TOPICS.filter((t) => (state.ui.learnCat === 'All' || t.cat === state.ui.learnCat) && (!q || `${t.title} ${stripHtml(t.simple)} ${stripHtml(t.advanced)} ${t.eponyms.join(' ')} ${t.hook}`.toLowerCase().includes(q)));
  const toolFor = { depth: toolDepth, purity: toolPurity, hgvs: toolHgvs, syndromes: toolSyndromes };
  return `<div class="toolbar"><label class="search"><span class="sr-only">Search topics</span><input type="search" id="learnSearch" placeholder="Search topics, e.g. CHIP, purity, Lynch…" value="${esc(state.ui.learnSearch)}" data-ui="learnSearch"></label>
      <div class="pills">${cats.map((c) => `<button class="pill${state.ui.learnCat === c ? ' active' : ''}" data-action="learnCat" data-key="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
    <p class="muted small">Each topic starts with a simple explanation. Open “Go deeper” for the advanced oncology version.</p>
    <div class="topics">${list.map((t, i) => `
      <details class="topic card"${list.length === 1 || q ? ' open' : ''}>
        <summary><span class="topic-title">${esc(t.title)}</span><span class="chips">${chip(t.cat, 'lav')}${t.eponyms.length ? chip('Eponym', 'peach') : ''}</span></summary>
        <div class="topic-body">
          ${t.diagram ? `<div class="diagram-wrap">${DIAGRAMS[t.diagram]()}</div>` : ''}
          <h4>In simple terms</h4>${t.simple}
          <details class="adv"><summary>Go deeper · advanced explanation</summary><div class="adv-body">${t.advanced}</div></details>
          ${t.eponyms.length ? `<p class="eponyms"><strong>Eponyms &amp; named criteria:</strong> ${t.eponyms.map(esc).join(' · ')}</p>` : ''}
          <div class="grid grid-2 hooks"><div class="hook-box"><b>💡 Memory hook</b><p>${esc(t.hook)}</p></div><div class="trap-box"><b>⚠ Exam / practice trap</b><p>${esc(t.trap)}</p></div></div>
          ${toolFor[t.tool] ? `<div class="topic-tool">${toolFor[t.tool]()}</div>` : ''}
          <p class="small refs"><strong>Sources:</strong> ${refChips(t.refs)}</p>
        </div></details>`).join('') || '<div class="empty-inline">No topics match.</div>'}</div>`;
}

let cardOpen = new Set();
function learnCards() {
  const cats = ['All', ...Array.from(new Set(FLASHCARDS.map((c) => c.cat)))];
  const q = state.ui.cardSearch.trim().toLowerCase();
  const list = FLASHCARDS.map((c, i) => ({ ...c, i })).filter((c) => (state.ui.cardCat === 'All' || c.cat === state.ui.cardCat) && (!q || `${c.q} ${c.a} ${c.hack}`.toLowerCase().includes(q)));
  return `<div class="toolbar"><label class="search"><span class="sr-only">Search flash-cards</span><input type="search" id="cardSearch" placeholder="Search flash-cards…" value="${esc(state.ui.cardSearch)}" data-ui="cardSearch"></label>
    <div class="pills">${cats.map((c) => `<button class="pill${state.ui.cardCat === c ? ' active' : ''}" data-action="cardCat" data-key="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
    <p class="muted small">${FLASHCARDS.length} high-yield points. Read the question, answer from memory, then reveal. ${cardOpen.size} revealed this session.</p>
    <div class="cards">${list.map((c) => `<button class="flash${cardOpen.has(c.i) ? ' open' : ''}" data-action="flip" data-i="${c.i}" aria-expanded="${cardOpen.has(c.i)}">
      <span class="flash-cat">${esc(c.cat)} · #${c.i + 1}</span><span class="flash-q">${esc(c.q)}</span>
      <span class="flash-a" ${cardOpen.has(c.i) ? '' : 'hidden'}>${esc(c.a)}<span class="flash-hack">💡 ${esc(c.hack)}</span></span>
      ${cardOpen.has(c.i) ? '' : '<span class="flash-tap">Tap to reveal</span>'}</button>`).join('') || '<div class="empty-inline">No cards match.</div>'}</div>`;
}

function learnQuiz() {
  return `<p class="muted small">${QUIZ.length} single-best-answer questions. Choose answers, then check them.</p>
    <form id="quizForm" class="quiz" onsubmit="return false">${QUIZ.map((q, i) => `
      <fieldset class="card q" data-q="${i}"><legend>${i + 1}. ${esc(q.q)}</legend>
        ${q.opts.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"> <span>${String.fromCharCode(65 + j)}. ${esc(o)}</span></label>`).join('')}
        <div class="q-why" hidden></div></fieldset>`).join('')}
      <div class="btn-row"><button class="btn btn-primary" data-action="checkQuiz">Check my answers</button><button class="btn btn-ghost" data-action="resetQuiz">Reset</button><span id="quizScore" class="quiz-score" aria-live="polite"></span></div></form>`;
}
function checkQuiz() {
  let score = 0;
  QUIZ.forEach((q, i) => {
    const fs = $(`fieldset[data-q="${i}"]`); const sel = $(`input[name="q${i}"]:checked`, fs);
    const why = $('.q-why', fs); why.hidden = false;
    $$('.opt', fs).forEach((o, j) => { o.classList.toggle('correct', j === q.ans); o.classList.toggle('wrong', !!sel && Number(sel.value) === j && j !== q.ans); });
    const right = sel && Number(sel.value) === q.ans; if (right) score++;
    why.innerHTML = `<strong>${sel ? (right ? '✓ Correct.' : '✗ Not quite.') : 'No answer chosen.'}</strong> Answer: ${String.fromCharCode(65 + q.ans)}. ${esc(q.why)}`;
  });
  $('#quizScore').textContent = `Score: ${score} / ${QUIZ.length}`;
}

/* ---------- EVIDENCE LIBRARY ---------- */
const SOURCE_NOTES = [
  ['OncoKB', 'Levels of evidence linking alterations to drugs', 'Curated snapshot where confident, plus an optional retrieval through YOUR local proxy (token never in the page).', 'Your OncoKB token and licence terms for clinical-reporting use.'],
  ['ClinVar', 'Submitted variant classifications with review status', 'Optional live retrieval (E-utilities): shows accession, each classification type, review stars, date; name-matching only. Search link and record form remain.', 'Server-side caching, versioning, and validation against a larger test set.'],
  ['ClinGen', 'Expert-panel variant curation, gene–disease validity', 'Search link; you can record what you found.', 'Public data/APIs; map VCEP classifications.'],
  ['CIViC', 'Community-curated evidence items', 'Search link; you can record what you found.', 'Open API; filter by evidence level and acceptance status.'],
  ['COSMIC', 'Somatic mutation frequencies', 'Search link only.', 'Registration / commercial licence depending on use.'],
  ['Cancer Genome Interpreter', 'Driver and biomarker annotation', 'Link only.', 'Check data-governance terms before sending any patient data.'],
  ['FDA / EMA', 'Approved indications and companion diagnostics', 'FDA wording curated; optional on-demand openFDA label text with its effective date. EMA not curated.', 'Automated label-change monitoring; EMA product information (EPAR) ingestion.'],
  ['ClinicalTrials.gov', 'Registry of clinical studies', 'Optional live search of recruiting studies by tumour type and gene. No eligibility matching.', 'Site/eligibility matching with clinician review.'],
  ['NCCN', 'Proprietary guidelines', 'Not reproduced.', 'Licensed access only; cite version and date.'],
  ['PubMed', 'Primary literature', 'Library identifiers were matched in PubMed on ' + KB_SNAPSHOT + '; optional live literature search per variant.', 'Automated citation checking and evidence appraisal workflow.']
];

function accessLog() { return store.get('localStorage', ACCESS_KEY, {}) || {}; }

function renderEvidence() {
  const log = accessLog();
  const used = new Set(usedRefIds());
  const q = state.ui.evSearch.trim().toLowerCase();
  const cats = ['All', ...REF_CATS];
  $('#evPills').innerHTML = cats.map((c) => `<button class="pill${state.ui.evCat === c ? ' active' : ''}" data-action="evCat" data-key="${esc(c)}">${esc(c)}</button>`).join('');
  $('#evUsed').checked = state.ui.evUsed;
  $('#evSearch').value = state.ui.evSearch;
  const list = REFS.filter((r) => (state.ui.evCat === 'All' || r.cat === state.ui.evCat) && (!state.ui.evUsed || used.has(r.id)) &&
    (!q || `${r.title} ${r.by} ${r.src} ${r.year || ''} ${r.pmid || ''} ${r.doi || ''} ${r.note}`.toLowerCase().includes(q)));
  const papers = REFS.filter((r) => r.kind === 'paper').length, sites = REFS.length - papers;
  $('#evRoot').innerHTML = `
    <div class="callout callout-blue"><div class="callout-title">How to read this library</div><div class="callout-body">
      <p><strong>${papers} papers</strong>: PMID and DOI were matched in PubMed on <strong>${KB_SNAPSHOT}</strong> (title, journal, year, volume and first page checked; only the first page is shown).
      <strong>${sites} websites</strong>: addresses are the organisations’ main pages; they were <strong>not opened or live-checked</strong>, so a link may have moved. “Access date” is <em>your own</em> record of when you consulted a source — the app has not retrieved these sources.</p></div></div>
    <details class="detail-box"><summary>What this prototype does with each database — and what Stage 2 will need</summary>
      <div class="table-wrap"><table class="table table-compact"><thead><tr><th>Source</th><th>What it provides</th><th>This prototype</th><th>Stage 2 needs</th></tr></thead><tbody>${SOURCE_NOTES.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? '<strong>' + esc(c) + '</strong>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
    <p class="muted small">${list.length} of ${REFS.length} entries shown.</p>
    <div class="grid grid-2">${list.map((r) => {
      const when = log[r.id];
      return `<article class="card ref-card">
        <div class="ref-top">${chip(r.kind === 'paper' ? 'Paper' : 'Website', r.kind === 'paper' ? 'lav' : 'blue')}${chip(r.cat, 'grey')}${used.has(r.id) ? chip('Used in current case', 'mint') : ''}</div>
        <h4>${esc(r.title)}</h4>
        <p class="small muted">${esc(r.by)} · ${esc(r.src)}${r.year ? ' · ' + r.year : ''}${r.kind === 'paper' ? `;${esc(r.vol)}:${esc(r.page)}` : ''}</p>
        ${r.kind === 'paper' ? `<p class="small">PMID ${extLink('https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/', r.pmid)} · DOI ${extLink('https://doi.org/' + r.doi, r.doi)}</p>` : `<p class="small">${extLink(r.url, r.url)}</p>`}
        <p class="small"><strong>Version / date:</strong> ${esc(r.version)}</p>
        <p class="small">${esc(r.note)}</p>
        <p class="small ${r.kind === 'paper' ? 'ok-line' : 'warn-line'}">${r.kind === 'paper' ? '✓ Identifiers matched in PubMed ' + KB_SNAPSHOT : '⚠ Address not live-checked'}</p>
        <div class="ref-actions"><label class="small">Your access date <input type="date" value="${esc(when || '')}" data-access="${r.id}"></label>
          <button class="btn btn-ghost btn-sm" data-action="copyCite" data-id="${r.id}">Copy citation</button></div>
        ${when ? `<p class="small muted">You recorded access on ${esc(when)}.</p>` : '<p class="small muted">No access date recorded.</p>'}
      </article>`;
    }).join('') || '<div class="empty-inline">No sources match.</div>'}</div>`;
}

/* ---------- MOLECULAR TUMOUR BOARD SUMMARY ---------- */
function summaryModel() {
  const cs = state.case, its = interpretAll(), opts = collectOptions(), bms = biomarkerFindings(cs);
  const group = (fn) => opts.filter(fn);
  return {
    cs, its, bms,
    approved: group((o) => ['approved', 'agnostic'].includes(o.rx.status)),
    other: group((o) => o.rx.status === 'approved-other'),
    evolving: group((o) => ['verify', 'investigational'].includes(o.rx.status)),
    avoid: group((o) => o.rx.status === 'unsupported'),
    resistance: its.filter((i) => i.rule && i.rule.roles.includes('resistance')),
    flags: state.variants.map((v) => ({ v, fl: variantFlags(v).filter((f) => ['missing', 'uncertain', 'warn'].includes(f.level)) })).filter((x) => x.fl.length),
    checks: caseChecks().filter((c) => c.level !== 'info'),
    refs: usedRefIds()
  };
}
function liveItems() {
  const R = state.live.results, out = [];
  state.variants.forEach((v) => {
    const cv = R[`${v.id}:clinvar`];
    if (cv && !cv.error) out.push({ src: 'NCBI ClinVar', what: varLabel(v), at: cv.at, text: cv.exact.length ? cv.exact.map((r) => `${r.accession}: ${r.classifications.map((c) => `${c.type}: ${c.description || '—'} (${c.stars !== null ? c.stars + '/4 stars' : 'review status n/a'}; last evaluated ${c.last || 'n/a'})`).join('; ') || 'no classification fields'}`).join(' | ') : 'no record with a matching name found (this does not prove absence)' });
    const ok = R[`${v.id}:oncokb`];
    if (ok && !ok.error) out.push({ src: 'OncoKB (local proxy)', what: varLabel(v), at: ok.at, text: `oncogenic: ${ok.oncogenic || '—'}; highest sensitive level: ${ok.sensitive || '—'}; highest resistance level: ${ok.resistance || '—'}; data version: ${ok.dataVersion || 'not returned'}` });
    const pm = R[`${v.id}:pubmed`];
    if (pm && !pm.error) out.push({ src: 'NCBI PubMed', what: varLabel(v), at: pm.at, text: `${pm.items.length} result(s) for: ${pm.query}` });
  });
  Object.keys(R).forEach((k) => {
    if (k.startsWith('fda:') && !R[k].error) out.push({ src: 'openFDA label', what: k.slice(4), at: R[k].at, text: `label effective ${R[k].effective || 'n/a'}${R[k].version ? ' version ' + R[k].version : ''}` });
    if (k.startsWith('trials:') && !R[k].error) out.push({ src: 'ClinicalTrials.gov', what: k.slice(7), at: R[k].at, text: `${R[k].total !== null ? R[k].total : '?'} recruiting stud(ies) matched: ${R[k].query}` });
  });
  return out;
}
function stdLimits() {
  const live = liveItems().length;
  return [
    `The curated library (snapshot ${KB_SNAPSHOT}) is small and hand-written. Evidence tiers and approval statements shown are not live-retrieved and must be verified at the source before use.`,
    live ? 'Only the sources listed under “Live-retrieved data” were queried by this application, at the times stated. ClinGen, CIViC, COSMIC and the Cancer Genome Interpreter were NOT queried. Entries shown as “clinician-entered” were typed by the user and are not verified by the application.' : 'ClinVar, ClinGen, CIViC, OncoKB, COSMIC and the Cancer Genome Interpreter were NOT queried by this application. Entries shown as “clinician-entered” were typed by the user and are not verified by the application.',
    'EMA approval status is not curated. “Guideline-supported” status is not assigned because guideline text is not reproduced.',
    'Pathogenicity (germline), oncogenicity (somatic) and clinical actionability are different questions and are reported separately.',
    state.variants.some((v) => v.src === 'extracted') ? 'Some findings were proposed by an experimental PDF-text heuristic (tested only on synthetic reports) and were individually verified by the clinician against the source pages.' : 'Findings were entered by hand and confirmed by the clinician; the application did not read the source PDF.',
    'This document is educational decision support, not a laboratory report, and does not replace the original report, clinical judgement or the molecular tumour board.'
  ];
}
function provenanceCounts() {
  const rec = state.variants.filter((v) => { const L = v.lookups; return L.clinvar.cls || L.clingen.cls || L.civic.cls || L.oncokb.level; }).length;
  const ext = state.variants.filter((v) => v.src === 'extracted').length;
  return { live: liveItems().length, recorded: rec, extracted: ext };
}
function liveSummaryHtml() {
  const items = liveItems(), pc = provenanceCounts();
  return `<section class="sum-sec"><h3>4b · Data provenance and live-retrieved data</h3>
    <p class="small">Curated library snapshot ${KB_SNAPSHOT} · clinician-entered look-up records on ${pc.recorded} variant(s) · live-retrieved items: ${pc.live} · PDF-extracted entries (all verified): ${pc.extracted}.</p>
    ${items.length ? `<div class="table-wrap"><table class="table table-compact"><thead><tr><th>Source</th><th>For</th><th>Retrieved (UTC)</th><th>Result</th></tr></thead><tbody>${items.map((i) => `<tr><td>${esc(i.src)}</td><td>${esc(i.what)}</td><td class="nowrap">${esc(stamp(i.at))}</td><td class="small">${esc(i.text)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No live look-ups were performed for this case.</p>'}</section>`;
}

const fitShort = (o) => { const f = fitFor(o); return f.head; };

function renderSummary() {
  const gate = $('#sumGate'), wrap = $('#summaryRoot');
  if (!state.variants.length) { gate.innerHTML = emptyState('Nothing to summarise yet', 'Add variants or load a sample report first.', goBtn('upload', 'Go to Upload NGS Report')); wrap.hidden = true; return; }
  if (!state.confirmed) { gate.innerHTML = confirmGate('The Molecular Tumour Board Summary'); wrap.hidden = true; return; }
  gate.innerHTML = ''; wrap.hidden = false;
  const m = summaryModel(), cs = m.cs;
  const stg = (SETTING_LABEL[cs.setting] || '—');
  const optLine = (o) => `<li><strong>${esc(o.rx.drug)}</strong> — ${o.it ? esc(varLabel(o.it.v)) : esc(o.bm.title)} ${statusChip(o.rx.status)}<div class="small muted">${esc(o.rx.indication)} · <em>${esc(fitShort(o))}</em>${o.warn ? ` · <strong>⚠ ${esc(o.warn)}</strong>` : ''}</div></li>`;
  const lk = (v) => { const L = v.lookups, p = []; if (L.clinvar.cls) p.push(`ClinVar: ${L.clinvar.cls}${L.clinvar.stars !== '' ? ` (${L.clinvar.stars}★)` : ''}${L.clinvar.date ? ' · ' + L.clinvar.date : ''}`); if (L.clingen.cls) p.push(`ClinGen: ${L.clingen.cls}${L.clingen.date ? ' · ' + L.clingen.date : ''}`); if (L.civic.cls) p.push(`CIViC: ${L.civic.cls}${L.civic.date ? ' · ' + L.civic.date : ''}`); if (L.oncokb.level) p.push(`OncoKB (seen): ${L.oncokb.level}${L.oncokb.date ? ' · ' + L.oncokb.date : ''}`); return p; };
  wrap.innerHTML = `<article class="summary-doc">
    <header class="sum-head">
      <p class="eyebrow">Onco NGS Reader · prototype · educational decision support</p>
      <h2>Molecular Tumour Board Summary</h2>
      <p class="muted">Generated ${esc(new Date().toLocaleString())} · Findings confirmed by clinician${state.confirmedAt ? ' on ' + esc(new Date(state.confirmedAt).toLocaleString()) : ''}${state.sampleId ? ' · <strong>FICTIONAL SAMPLE CASE</strong>' : ''}</p>
    </header>

    <section class="sum-sec"><h3>1 · Cancer type and specimen</h3>${kv([
      ['Case label (no identifiers)', esc(cs.label || '—')], ['Cancer type', esc(cancerLabel(cs.cancer))], ['Histology / diagnosis', esc(cs.histology || '—')], ['Stage', esc(cs.stage || '—')],
      ['Disease setting', esc(stg)], ['Prior therapy', esc(cs.priorTx || '—')], ['Specimen', esc((SPECIMENS.find((s) => s[0] === cs.specimen) || ['', '—'])[1])], ['Assay', esc(cs.assay || '—')],
      ['Tumour purity', cs.purity ? esc(cs.purity) + '%' : '—'], ['Germline testing', esc((GERMLINE_STATUS.find((g) => g[0] === cs.germline) || ['', '—'])[1])], ['Case notes', esc(cs.notes || '')]])}</section>

    <section class="sum-sec"><h3>2 · Key molecular findings</h3>
      <div class="table-wrap"><table class="table table-compact"><thead><tr><th>Alteration</th><th>Type</th><th>VAF</th><th>Origin</th><th>Category</th></tr></thead><tbody>${m.its.map((it) => { const [cl, ct] = CATEGORY_LABEL[it.category]; return `<tr><td><strong>${esc(varLabel(it.v))}</strong>${it.v.hgvsC ? `<div class="small muted mono">${esc(it.v.hgvsC)}${it.v.transcript ? ' · ' + esc(it.v.transcript) : ''}</div>` : ''}</td><td>${esc((TYPE_LABEL[it.v.type] || '—').split(' (')[0])}</td><td>${it.v.vaf !== '' ? esc(it.v.vaf) + '%' : '—'}</td><td>${esc((ORIGINS.find((o) => o[0] === it.v.origin) || ['', '—'])[1].split(' (')[0])}</td><td>${chip(cl, ct)}</td></tr>`; }).join('')}</tbody></table></div>
      <h4>Biomarkers</h4>${kv([['MSI / MMR', esc(`${cs.msi} / ${cs.mmr}`)], ['TMB', cs.tmb !== '' ? esc(cs.tmb) + ' mut/Mb' : '—'], ['HRD', esc(cs.hrd)], ['PD-L1', esc(cs.pdl1 || '—')], ['HER2 (IHC/ISH)', esc(cs.her2 || '—')]])}
      ${m.bms.filter((b) => b.state === 'positive').map((b) => `<p>${chip('Positive', 'mint')} <strong>${esc(b.title)}</strong> — ${esc(b.text)}</p>`).join('')}</section>

    <section class="sum-sec"><h3>3 · Potentially actionable alterations</h3>
      ${m.its.filter((i) => i.category === 'actionable').length ? `<ul class="plain">${m.its.filter((i) => i.category === 'actionable').map((i) => `<li><strong>${esc(varLabel(i.v))}</strong> — ${esc(i.rule.title)}. ${esc(i.ctx.pred)}</li>`).join('')}</ul>` : '<p class="muted">No alteration with an approved option in the entered tumour type was found by the curated library.</p>'}
      ${m.its.filter((i) => i.category === 'conditional').length ? `<p><strong>Actionable only if germline origin is confirmed:</strong> ${m.its.filter((i) => i.category === 'conditional').map((i) => esc(varLabel(i.v))).join('; ')} — the approved indication in this tumour type requires a germline variant; confirm with germline testing and counselling.</p>` : ''}
      ${m.its.filter((i) => i.category === 'other-tumour').length ? `<p><strong>Evidence only in other tumour types:</strong> ${m.its.filter((i) => i.category === 'other-tumour').map((i) => esc(varLabel(i.v))).join('; ')} — does not automatically apply.</p>` : ''}</section>

    <section class="sum-sec"><h3>4 · Evidence classifications</h3>
      <div class="table-wrap"><table class="table table-compact"><thead><tr><th>Alteration</th><th>AMP/ASCO/CAP (suggested)</th><th>ESCAT (curated)</th><th>OncoKB (curated)</th><th>Clinician-entered look-ups</th></tr></thead><tbody>${m.its.map((it) => { const a = classificationAMP(it); const esc2 = !IS_HEME(cs.cancer) && it.ctx && it.match === 'exact' && it.ctx.escat ? it.ctx.escat : null; const ok = it.ctx && it.match === 'exact' && it.ctx.oncokb ? it.ctx.oncokb : null; const l = lk(it.v); return `<tr><td><strong>${esc(varLabel(it.v))}</strong></td><td>${a.val ? esc(a.val) : '<span class="muted">Not assigned</span>'}</td><td>${esc2 ? esc(esc2) : '<span class="muted">Not curated</span>'}</td><td>${ok ? esc(ok) : '<span class="muted">Not curated</span>'}</td><td>${l.length ? l.map(esc).join('<br>') : '<span class="muted">None recorded</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="small muted">ClinVar, ClinGen and CIViC were not retrieved by the application. Tiers are a curated snapshot (${KB_SNAPSHOT}); verify at source. Regulatory status: FDA curated for listed drugs; EMA not curated.</p></section>

    ${liveSummaryHtml()}

    <section class="sum-sec"><h3>5 · Therapeutic implications</h3>
      <p class="small muted">Disease setting used for matching: ${esc(stg)}.</p>
      ${m.approved.length ? `<h4>Approved in this tumour type or tumour-agnostic</h4><ul class="plain">${m.approved.map(optLine).join('')}</ul>` : '<p class="muted">No approved options curated for the entered tumour type.</p>'}
      ${m.other.length ? `<h4>Approved only in other tumour types (not established here)</h4><ul class="plain">${m.other.map(optLine).join('')}</ul>` : ''}
      ${m.evolving.length ? `<h4>Evolving or investigational</h4><ul class="plain">${m.evolving.map(optLine).join('')}</ul>` : ''}
      ${m.avoid.length ? `<h4>Not supported / avoid</h4><ul class="plain">${m.avoid.map(optLine).join('')}</ul>` : ''}
      <p class="small muted">Guideline-supported status is not assigned by the application. Check current NCCN/ESMO/ASCO guidance and trials.</p></section>

    <section class="sum-sec"><h3>6 · Resistance markers</h3>
      ${m.resistance.length ? `<ul class="plain">${m.resistance.map((i) => `<li><strong>${esc(varLabel(i.v))}</strong> — ${esc((i.ctx && i.ctx.pred) || i.rule.effect)}</li>`).join('')}</ul>` : '<p class="muted">No curated resistance markers in this report.</p>'}
      ${m.its.filter((i) => i.ctx && i.ctx.res && i.ctx.res.length && !i.rule.roles.includes('resistance')).map((i) => `<p class="small"><strong>Watch for with ${esc(varLabel(i.v))}-directed therapy:</strong> ${i.ctx.res.map(esc).join(' · ')}</p>`).join('')}</section>

    <section class="sum-sec"><h3>7 · Uncertainties and limitations</h3>
      <ul class="plain">${[...m.checks.map((c) => c.text), ...m.flags.flatMap(({ v, fl }) => fl.map((f) => `${varLabel(v)}: ${f.text}`)), ...m.its.filter((i) => ['norule', 'nogene'].includes(i.category)).map((i) => `${varLabel(i.v)}: no curated interpretation (${i.category === 'nogene' ? 'gene outside the prototype library' : 'variant not curated'}) — unassessed.`), ...stdLimits()].map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>

    <section class="sum-sec"><h3>8 · Board discussion and sign-off</h3>
      <label class="field no-print"><span>Discussion notes (printed with the summary)</span><textarea id="boardNotes" rows="4" maxlength="2000" placeholder="Questions for the board, clinical context, decisions…">${esc(state.boardNotes)}</textarea></label>
      <div class="print-only notes-print" id="boardNotesPrint">${esc(state.boardNotes)}</div>
      <div class="form-grid sign-grid"><label class="field"><span>Prepared by</span><input type="text" id="preparedBy" maxlength="80" value="${esc(state.preparedBy)}"></label><label class="field"><span>Reviewed by</span><input type="text" id="reviewedBy" maxlength="80" value="${esc(state.reviewedBy)}"></label></div></section>

    <section class="sum-sec"><h3>9 · References</h3>
      <ol class="ref-print">${m.refs.map((id) => { const r = REF_BY_ID[id]; return `<li>${esc(refCitation(r))}${r.kind === 'site' ? ' <span class="muted">(address not live-checked)</span>' : ''}</li>`; }).join('')}</ol>
      <p class="small muted">Curated library snapshot ${KB_SNAPSHOT}. PMIDs/DOIs matched in PubMed on that date. Access dates: not retrieved by the application; record your own on the Evidence Library page.</p></section>
    <footer class="sum-foot">Onco NGS Reader ${esc(APP_VERSION)} · library ${KB_SNAPSHOT} · audit trail ${audit.log.length} entries, chain ${auditVerify().ok ? 'intact' : 'BROKEN'}, head ${esc(auditHead().slice(0, 12))} · educational decision-support prototype, not a medical device · sample cases are fictional${state.live.enabled ? ' · live look-ups were enabled in this session' : ' · no data left this browser'}.</footer>
  </article>`;
}

function summaryText() {
  const m = summaryModel(), cs = m.cs;
  const L = [];
  L.push('MOLECULAR TUMOUR BOARD SUMMARY — Onco NGS Reader (educational prototype)');
  if (state.sampleId) L.push('*** FICTIONAL SAMPLE CASE ***');
  L.push(`Generated: ${new Date().toLocaleString()}  |  Findings confirmed by clinician${state.confirmedAt ? ' on ' + new Date(state.confirmedAt).toLocaleString() : ''}`, '');
  L.push('1. CANCER AND SPECIMEN', `Case: ${cs.label || '—'} | ${cancerLabel(cs.cancer)} | ${cs.histology || '—'} | Stage ${cs.stage || '—'}`, `Setting: ${SETTING_LABEL[cs.setting] || '—'} | Prior therapy: ${cs.priorTx || '—'}`, `Specimen: ${cs.specimen || '—'} | Assay: ${cs.assay || '—'} | Purity: ${cs.purity ? cs.purity + '%' : '—'}`, '');
  L.push('2. KEY MOLECULAR FINDINGS');
  m.its.forEach((it) => L.push(`- ${varLabel(it.v)} [${(TYPE_LABEL[it.v.type] || '').split(' (')[0]}${it.v.vaf !== '' ? ', VAF ' + it.v.vaf + '%' : ''}] — ${CATEGORY_LABEL[it.category][0]}`));
  L.push(`Biomarkers: MSI ${cs.msi}, MMR ${cs.mmr}, TMB ${cs.tmb || '—'}, HRD ${cs.hrd}, PD-L1 ${cs.pdl1 || '—'}, HER2 ${cs.her2 || '—'}`, '');
  L.push('3. POTENTIALLY ACTIONABLE ALTERATIONS');
  const act = m.its.filter((i) => i.category === 'actionable');
  act.length ? act.forEach((i) => L.push(`- ${varLabel(i.v)}: ${i.ctx.pred}`)) : L.push('- None found by the curated library for the entered tumour type.');
  m.its.filter((i) => i.category === 'conditional').forEach((i) => L.push(`- ${varLabel(i.v)}: ONLY IF GERMLINE CONFIRMED — the approved indication requires a germline variant.`));
  L.push('', '4. EVIDENCE CLASSIFICATIONS (curated snapshot; ClinVar/ClinGen/CIViC/OncoKB not queried)');
  m.its.forEach((it) => { const a = classificationAMP(it); L.push(`- ${varLabel(it.v)}: AMP/ASCO/CAP ${a.val || 'not assigned'}; ESCAT ${(!IS_HEME(cs.cancer) && it.ctx && it.match === 'exact' && it.ctx.escat) || 'not curated'}; OncoKB ${(it.ctx && it.match === 'exact' && it.ctx.oncokb) || 'not curated'}`); });
  const li = liveItems();
  L.push('', '4b. DATA PROVENANCE', `Library snapshot ${KB_SNAPSHOT}; live-retrieved items: ${li.length}`);
  li.forEach((i) => L.push(`- ${i.src} · ${i.what} · retrieved ${stamp(i.at)} · ${i.text}`));
  L.push('', '5. THERAPEUTIC IMPLICATIONS');
  const sect = (title, arr) => { if (arr.length) { L.push(title); arr.forEach((o) => L.push(`  - ${o.rx.drug} (${o.it ? varLabel(o.it.v) : o.bm.title}) [${STATUS[o.rx.status].label}] — ${o.rx.indication}${o.warn ? ' (CAUTION: ' + o.warn + ')' : ''}`)); } };
  sect('Approved (this tumour type / tumour-agnostic):', m.approved); sect('Approved only in other tumour types:', m.other); sect('Evolving / investigational:', m.evolving); sect('Not supported / avoid:', m.avoid);
  L.push('', '6. RESISTANCE MARKERS');
  m.resistance.length ? m.resistance.forEach((i) => L.push(`- ${varLabel(i.v)}`)) : L.push('- None curated.');
  L.push('', '7. UNCERTAINTIES AND LIMITATIONS');
  m.checks.forEach((c) => L.push(`- ${c.text}`)); m.flags.forEach(({ v, fl }) => fl.forEach((f) => L.push(`- ${varLabel(v)}: ${f.text}`))); stdLimits().forEach((t) => L.push(`- ${t}`));
  if (state.boardNotes) L.push('', '8. DISCUSSION NOTES', state.boardNotes);
  L.push('', '9. REFERENCES'); L.push(`(App ${APP_VERSION}; audit trail ${audit.log.length} entries; chain head ${auditHead().slice(0, 12)})`); m.refs.forEach((id, i) => L.push(`${i + 1}. ${refCitation(REF_BY_ID[id])}`));
  return L.join('\n');
}

/* =====================================================================
   11. START-UP: navigation, events, theme
   ===================================================================== */
const PAGES = [
  ['dashboard', 'Dashboard', 'Dashboard', renderDashboard],
  ['upload', 'Upload NGS Report', 'Upload', renderUpload],
  ['interpreter', 'Variant Interpreter', 'Interpreter', renderInterpreter],
  ['actionability', 'Actionability & Targeted Therapies', 'Actionability', renderActionability],
  ['learn', 'Molecular Learning Centre', 'Learn', renderLearn],
  ['evidence', 'Evidence Library', 'Evidence', renderEvidence],
  ['summary', 'Molecular Tumour Board Summary', 'Tumour Board', renderSummary],
  ['connect', 'Connections & Audit', 'Connect', renderConnect]
];
let hostedRoute = 'dashboard';   // the hosted frame may not support hash navigation, so the page is tracked in memory there
function navigate(id) { if (HOSTED) { hostedRoute = id; route(); return; } if (location.hash === '#/' + id) route(); else location.hash = '#/' + id; }
function currentPage() { if (HOSTED) return hostedRoute; const m = location.hash.match(/^#\/([a-z]+)/); return PAGES.some((p) => p[0] === m?.[1]) ? m[1] : 'dashboard'; }
function route() {
  const id = currentPage(), page = PAGES.find((p) => p[0] === id);
  $$('.page').forEach((s) => { s.hidden = s.id !== 'page-' + id; s.classList.toggle('active', s.id === 'page-' + id); });
  $$('#mainNav a').forEach((a) => { const on = a.dataset.page === id; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = `${page[1]} · Onco NGS Reader`;
  $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false');
  if (['interpreter', 'actionability', 'summary', 'connect'].includes(id)) auditThrottled('page-' + id, 'page-opened', id, 8000);
  page[3]();
  window.scrollTo({ top: 0, behavior: 'auto' });
  const h = $(`#page-${id} h1`); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function rerenderKeepFocus(fn, id) {
  const el = $('#' + id), pos = el ? el.selectionStart : 0;
  fn();
  const n = $('#' + id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  store.set('localStorage', THEME_KEY, t);
  const b = $('#themeToggle'); if (b) { b.textContent = t === 'dark' ? '☀︎' : '☾'; b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
}

/** Click handlers keyed by data-action. */
const ACTIONS = {
  goto: (el) => { if (el.dataset.tab) state.ui.learnTab = el.dataset.tab; navigate(el.dataset.page); },
  loadSample: (el) => loadSample(el.dataset.id),
  editVariant: (el) => editVariant(el.dataset.id),
  deleteVariant: (el) => deleteVariant(el.dataset.id, el),
  confirm: () => {
    if (!$('#confirmCheck') || !$('#confirmCheck').checked) return;
    if (unverifiedExtracted().length) { toast('Verify the extracted entries first.'); renderConfirmPanel(); return; }
    state.confirmed = true; state.confirmedAt = new Date().toISOString(); saveState(); renderCaseStrip(); renderConfirmPanel();
    auditAdd('findings-confirmed', `${state.variants.length} variant(s); ${state.variants.filter((v) => v.src === 'extracted').length} PDF-extracted and verified`);
    toast('Findings confirmed. Interpretation is now available.');
  },
  removeFile: () => { pdfClose(); state.file = { name: '', size: 0, valid: null, url: '', pages: 0 }; $('#fileInput').value = ''; auditAdd('pdf-removed', 'PDF and extracted text discarded from memory'); renderFileCard(); },
  verifyVariant: (el) => { const v = state.variants.find((x) => x.id === el.dataset.id); if (!v) return; v.verified = true; saveState(); auditAdd('extracted-verified', varLabel(v)); renderVariantTable(); renderChecklist(); renderConfirmPanel(); toast('Marked as checked against the PDF.'); },
  pdfPrev: () => { pdfState.page = Math.max(1, pdfState.page - 1); pdfRender(); },
  pdfNext: () => { if (pdfState.doc) pdfState.page = Math.min(pdfState.doc.numPages, pdfState.page + 1); pdfRender(); },
  pdfZoomIn: () => { pdfState.scale = Math.min(3, pdfState.scale + 0.25); pdfRender(); },
  pdfZoomOut: () => { pdfState.scale = Math.max(0.6, pdfState.scale - 0.25); pdfRender(); },
  pdfGoto: (el) => pdfGoto(el.dataset.p),
  runExtract: () => runExtraction(),
  addCands: () => addCandidates(),
  selectAllCands: () => $$('#extractResult [data-cand]:not(:disabled)').forEach((c) => { c.checked = true; }),
  applyCaseSug: (el) => applyCaseSuggestion(Number(el.dataset.i)),
  liveClinvar: (el) => liveAction(el, () => retrieveClinVar(state.variants.find((v) => v.id === el.dataset.id))),
  liveOncokb: (el) => liveAction(el, () => retrieveOncokb(state.variants.find((v) => v.id === el.dataset.id))),
  livePubmed: (el) => liveAction(el, () => retrievePubMed(state.variants.find((v) => v.id === el.dataset.id))),
  liveFda: (el) => liveAction(el, () => retrieveFda(el.dataset.name)),
  liveTrials: (el) => liveAction(el, () => retrieveTrials(el.dataset.gene)),
  testConn: (el) => liveAction(el, () => testConnector(el.dataset.key)),
  auditVerify: () => { const v = auditVerify(); $('#auditResult').textContent = v.ok ? `✓ Chain intact: ${v.count} entries, no entry altered or removed.` : `✗ Chain broken at entry ${v.brokenAt}.`; auditAdd('audit-verified', v.ok ? 'intact' : `broken at ${v.brokenAt}`); },
  auditCopy: () => copyText(JSON.stringify(audit.log, null, 1), 'Audit trail copied as JSON.'),
  auditDownload: () => { downloadText(`onco-ngs-audit-${todayISO()}.json`, JSON.stringify(audit.log, null, 1)); auditAdd('audit-exported', 'downloaded'); },
  protectMake: async () => {
    const msg = $('#protectMsg'); msg.textContent = 'Encrypting…';
    try { const out = await protectEncrypt($('#protectPass').value); $('#protectOut').value = out; auditAdd('case-exported', 'passphrase-protected file created'); msg.textContent = '✓ Protected text created. Keep the passphrase safe: it cannot be recovered.'; }
    catch (e) { msg.textContent = '✗ ' + (e.message || 'Encryption failed.'); }
  },
  protectCopy: () => { const v = $('#protectOut').value; if (!v) { toast('Create the protected file first.'); return; } copyText(v, 'Protected text copied.'); },
  protectDownload: () => { const v = $('#protectOut').value; if (!v) { toast('Create the protected file first.'); return; } downloadText(`onco-ngs-case-${todayISO()}.protected.json`, v); },
  protectRestore: async () => {
    const msg = $('#restoreMsg'); msg.textContent = 'Decrypting…';
    try { const p = await protectDecrypt($('#protectIn').value.trim(), $('#restorePass').value); const chain = restorePayload(p); renderCaseStrip(); renderConnect(); $('#restoreMsg').textContent = `✓ Case restored (${state.variants.length} variant(s)); ${chain}. Review and confirm the findings again.`; }
    catch (e) { msg.textContent = '✗ ' + (e.message || 'Restore failed.'); }
  },
  variantCancel: () => clearVariantForm(),
  interpFilter: (el) => { state.ui.interpFilter = el.dataset.key; renderInterpFilters(); renderInterpList(); renderInterpDetail(); },
  selectVariant: (el) => { state.ui.selectedId = el.dataset.id; renderInterpList(); renderInterpDetail(); if (window.innerWidth < 900) $('#interpDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  interpTab: (el) => { state.ui.interpTab = el.dataset.key; renderInterpDetail(); },
  actFilter: (el) => { state.ui.actFilter = el.dataset.key; renderActionability(); },
  actTab: (el) => { state.ui.actTab = el.dataset.key; renderActionability(); },
  learnTab: (el) => { state.ui.learnTab = el.dataset.key; renderLearn(); },
  learnCat: (el) => { state.ui.learnCat = el.dataset.key; renderLearn(); },
  cardCat: (el) => { state.ui.cardCat = el.dataset.key; renderLearn(); },
  flip: (el) => { const i = Number(el.dataset.i); cardOpen.has(i) ? cardOpen.delete(i) : cardOpen.add(i); renderLearn(); },
  checkQuiz: () => checkQuiz(),
  resetQuiz: () => renderLearn(),
  hgvsExample: (el) => { const box = el.closest('.calc'); $('[data-in="s"]', box).value = el.dataset.v; runCalc(box); },
  evCat: (el) => { state.ui.evCat = el.dataset.key; renderEvidence(); },
  copyCite: (el) => { const r = REF_BY_ID[el.dataset.id]; copyText(refCitation(r), 'Citation copied.'); },
  printSummary: () => { auditAdd('summary-printed', 'print dialog opened'); window.print(); },
  copySummary: () => { auditAdd('summary-copied', 'plain-text summary copied'); copyText(summaryText(), 'Summary copied as plain text.'); },
  resetAll: (el) => resetAll(el),
  themeToggle: () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'),
  menuToggle: () => { const n = $('#mainNav'); const o = n.classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', String(o)); }
};
/** Run one live look-up with a busy label; refresh the visible results afterwards. */
async function liveAction(btn, fn) {
  if (HOSTED || !state.live.enabled) { toast(HOSTED ? 'Not available in the hosted preview: the host blocks outside connections.' : 'Switch on live look-ups first (Connect page).'); return; }
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1'; const old = btn.textContent; btn.textContent = 'Retrieving…';
  try { await fn(); } catch (e) { toast('The look-up failed unexpectedly. Nothing was retrieved.'); }
  btn.dataset.busy = ''; btn.textContent = old;
  refreshLiveViews();
}
function refreshLiveViews() {
  const id = currentPage();
  if (id === 'interpreter') renderInterpDetail(); else if (id === 'actionability') renderActBody(); else if (id === 'connect') renderConnect();
}
function copyText(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — select the text manually.'); }
  document.body.removeChild(ta);
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const link = HOSTED && e.target.closest('a[href^="#/"]');
    if (link) { e.preventDefault(); navigate(link.getAttribute('href').slice(2)); return; }
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) { if (el.tagName === 'A') e.preventDefault(); ACTIONS[el.dataset.action](el, e); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.case !== undefined && t.dataset.case !== '') {
      const was = state.confirmed; state.case[t.dataset.case] = t.value; dataChanged(); renderChecklist(); if (was) renderConfirmPanel();
    } else if (t.dataset.ui === 'interpSearch') { state.ui.interpSearch = t.value; renderInterpList(); renderInterpDetail(); }
    else if (t.dataset.ui === 'learnSearch') { state.ui.learnSearch = t.value; rerenderKeepFocus(renderLearn, 'learnSearch'); }
    else if (t.dataset.ui === 'cardSearch') { state.ui.cardSearch = t.value; rerenderKeepFocus(renderLearn, 'cardSearch'); }
    else if (t.id === 'oncokbUrl') { state.live.oncokbUrl = t.value; saveLiveConfig(); }
    else if (t.id === 'evSearch') { state.ui.evSearch = t.value; rerenderKeepFocus(renderEvidence, 'evSearch'); }
    else if (t.closest('.calc') && t.dataset.in !== undefined) runCalc(t.closest('.calc'));
    else if (t.id === 'boardNotes') { state.boardNotes = t.value; saveState(); const p = $('#boardNotesPrint'); if (p) p.textContent = t.value; }
    else if (t.id === 'preparedBy') { state.preparedBy = t.value; saveState(); }
    else if (t.id === 'reviewedBy') { state.reviewedBy = t.value; saveState(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.case !== undefined && t.dataset.case !== '') { const was = state.confirmed; state.case[t.dataset.case] = t.value; dataChanged(); renderChecklist(); if (was) renderConfirmPanel(); renderVariantTable(); }
    else if (t.id === 'v_type') updateVariantFormVisibility();
    else if (t.id === 'confirmCheck') { $('#confirmBtn').disabled = !t.checked; }
    else if (t.id === 'interpType') { state.ui.interpType = t.value; renderInterpList(); renderInterpDetail(); }
    else if (t.id === 'actGene') { state.ui.actGene = t.value; renderActBody(); }
    else if (t.id === 'actSettingOnly') { state.ui.actSettingOnly = t.checked; renderActBody(); }
    else if (t.id === 'evUsed') { state.ui.evUsed = t.checked; renderEvidence(); }
    else if (t.id === 'fileInput') { handleFile(t.files[0]); }
    else if (t.id === 'liveToggle') { state.live.enabled = t.checked; auditAdd('live-lookups', t.checked ? 'switched ON for this session' : 'switched OFF'); renderConnect(); }
    else if (t.id === 'oncokbUrl') { state.live.oncokbUrl = t.value.trim(); saveLiveConfig(); renderConnect(); }
    else if (t.id === 'protectFile') { const f = t.files[0]; if (f) f.text().then((x) => { $('#protectIn').value = x; $('#restoreMsg').textContent = 'File read. Enter the passphrase and press Decrypt and restore.'; }); }
    else if (t.dataset.access) { const log = accessLog(); if (t.value) log[t.dataset.access] = t.value; else delete log[t.dataset.access]; store.set('localStorage', ACCESS_KEY, log); renderEvidence(); toast('Access date saved in this browser.'); }
    else if (t.dataset.lk) {
      const form = t.closest('.lookup-form'), v = state.variants.find((x) => x.id === form.dataset.vid); if (!v) return;
      const [a, b] = t.dataset.lk.split('.'); v.lookups[a][b] = t.value; saveState(); toast('Saved as clinician-entered (not verified by the app).');
      if (state.ui.interpTab === 'classification') renderInterpDetail();
    }
  });
  $('#variantForm').addEventListener('submit', (e) => { e.preventDefault(); submitVariant(); });
  // drag-and-drop PDF
  const dz = $('#dropzone'), fi = $('#fileInput');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { if (!dz.contains(e.target)) e.preventDefault(); });
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); } });
}

function init() {
  loadState(); loadLiveConfig(); auditLoad();
  setTheme(store.get('localStorage', THEME_KEY, 'light') === 'dark' ? 'dark' : 'light');
  $('#mainNav').innerHTML = PAGES.map(([id, label, short], i) => `<a href="#/${id}" data-page="${id}" title="${esc(label)}"><span class="nav-n">${i + 1}</span>${esc(short)}</a>`).join('');
  if (HOSTED) $$('[data-action="printSummary"]').forEach((b) => { b.hidden = true; });
  bindEvents(); renderCaseStrip(); route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
