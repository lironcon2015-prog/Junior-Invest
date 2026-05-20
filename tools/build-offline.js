// tools/build-offline.js
// Produces a single self-contained HTML file that runs the entire
// JuniorInvest SPA from disk via file://, with no install, no server,
// and no relative module imports. Tailwind/fonts still load from CDN.
//
//   node tools/build-offline.js
//   → writes dist/JuniorInvest-Offline.html
//
// Run after `npx esbuild app.js --bundle --format=iife --minify
//   --target=es2020 --outfile=tools/.bundle.js`.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bundle    = fs.readFileSync(path.join(__dirname, '.bundle.js'), 'utf8');
const iconB64   = fs.readFileSync(path.join(ROOT, 'icons/icon-192.png')).toString('base64');
const version   = require(path.join(ROOT, 'version.json')).version;

const iconDataUrl = `data:image/png;base64,${iconB64}`;

let html = indexHtml;

// Strip the cache-busting bootstrap (we don't need it — JS is inline).
html = html.replace(
  /<!--\s*Cache-busting bootstrap[\s\S]*?-->\s*/,
  '',
);
html = html.replace(
  /<script>\s*\/\/\s*Tear down any service worker[\s\S]*?<\/script>\s*/,
  '',
);

// Drop the PWA manifest + favicon links (file:// can't load them reliably
// and we're inlining the brand icon anyway).
html = html.replace(/<link rel="manifest"[^>]*>\s*/g, '');
html = html.replace(/<link rel="icon"[^>]*>\s*/g, '');
html = html.replace(/<link rel="shortcut icon"[^>]*>\s*/g, '');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '');

// Inline the brand icon (used by sidebar + mobile top bar).
html = html.replace(/\.\/icons\/icon-192\.png/g, iconDataUrl);

// Inject the bundled app right before </body>. The IIFE bundle exposes the
// app on window.JI; provide JI_APP_VERSION before it runs so the settings
// footer renders correctly.
const injection = `
<script>window.JI_APP_VERSION = ${JSON.stringify(version)};</script>
<script>${bundle}</script>
`;
html = html.replace(/<\/body>/, `${injection}\n</body>`);

const outDir = path.join(ROOT, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'JuniorInvest-Offline.html');
fs.writeFileSync(outPath, html);

const sizeKb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`✓ ${outPath} (${sizeKb} KB)`);
