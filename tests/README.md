# Tests

These are developer checks, not something you need to run to use the app.

Setup (once): `npm install --no-save playwright` and `npx playwright install chromium`.

| File | What it checks |
|---|---|
| `logic.test.js` | SHA-256 vs Node's crypto, audit chain and tamper detection, AES-GCM round trip, ClinVar / ClinicalTrials.gov / openFDA / OncoKB response parsers, PDF extraction heuristics (including negated statements) |
| `make-fixtures.js` | Writes three **synthetic, fictional** PDF reports (table layout, narrative, scanned image-only) |
| `pdf.e2e.test.js` | Viewer, extraction, verification gate, privacy (no file name or snippet saved), from disk and over the local server |
| `live-and-audit.e2e.test.js` | Live connectors against **recorded response shapes** (not the real services), failure paths, opt-in behaviour, audit trail, protected file, hosted mode |
| `proxy.test.js` | The local proxy against a mock upstream: token handling, input validation, host and path protection, audit log |
| `hosted-build.e2e.test.js` | The single-file hosted build |

Important: the live-service tests use fixtures written from documentation, because the services were not reachable when the tests were authored. Before relying on the live connectors, run them against the real services and compare.
