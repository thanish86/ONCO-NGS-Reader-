#!/usr/bin/env python3
"""
Builds ONE self-contained HTML file for hosting the app as a preview page.

Plain-language: the normal app is a few files in a folder. Some hosting pages
want a single file and block things like outside connections, printing and
downloads. This script merges index.html, style.css, script.js and the PDF
library into one file and switches on "hosted mode" (live look-ups, print and
download buttons are turned off there, and a clear message explains why).

Usage:   python3 tools/make_hosted.py            (writes hosted/onco-ngs-reader-hosted.html)
The output is generated, so it is not stored in the repository.
"""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (root / p).read_text(encoding="utf-8")

html = read("index.html")
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r"<script\b[^>]*>\s*</script>", "", body)            # scripts are re-added inline below
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)                  # drop developer comments

def safe_js(src: str) -> str:
    return src.replace("</script", "<\\/script")                     # never close the inline script early

css = read("style.css")
pdf = safe_js(read("vendor/pdfjs/pdf.min.js"))
worker_b64 = base64.b64encode((root / "vendor/pdfjs/pdf.worker.min.js").read_bytes()).decode()
app = safe_js(read("script.js"))

out = f"""<title>Onco NGS Reader</title>
<style>
{css}
</style>
{body}
<script>window.ONCO_HOSTED = true;</script>
<script>{pdf}</script>
<script id="pdf-worker-b64" type="text/plain">{worker_b64}</script>
<script>
try {{ window.ONCO_PDF_WORKER_SRC = URL.createObjectURL(new Blob([Uint8Array.from(atob(document.getElementById('pdf-worker-b64').textContent.trim()), function (c) {{ return c.charCodeAt(0); }})], {{ type: 'text/javascript' }})); }} catch (e) {{ /* viewer falls back to its own handling */ }}
</script>
<script>
{app}
</script>
"""
dest = root / "hosted"
dest.mkdir(exist_ok=True)
(dest / "onco-ngs-reader-hosted.html").write_text(out, encoding="utf-8")
print(f"Wrote {dest / 'onco-ngs-reader-hosted.html'} ({len(out) / 1024 / 1024:.2f} MB)")
