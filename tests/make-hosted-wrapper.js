// Wraps the hosted build in a minimal page skeleton (like a host would) so it can be tested from disk.
const fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const c = fs.readFileSync(path.join(root, 'hosted/onco-ngs-reader-hosted.html'), 'utf8');
fs.writeFileSync(path.join(root, 'hosted/wrapped-for-test.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + c + '</body></html>');
console.log('wrote hosted/wrapped-for-test.html');
