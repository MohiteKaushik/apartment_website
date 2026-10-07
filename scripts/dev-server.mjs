/* ─────────────────────────────────────────────────────────────
   Local dev server for the AR pages.

     npm run ar:serve            → serves public/ (HTTP on :4173, HTTPS on :4174)
     npm run ar:serve -- build   → serves build/ instead

   Why not `npx serve`: two reasons.

   1. Phones need HTTPS. `getUserMedia` and WebXR only run in a secure context.
      `localhost` is exempt, but the phone reaches this machine as
      http://192.168.x.x, which is not. Camera access is refused outright.
      This server makes a self-signed certificate covering the current LAN
      address so the phone gets a real secure context.

   2. `serve` rewrites /ar/card.html to /ar/card and drops the query string
      along the way, so ?unit=2bhk silently disappears. Paths here are served
      exactly as written.

   It also accepts PUT /__save/<path> under public/ar/targets and public/ar/print,
   which is how a compiled .mind file gets from the browser tab onto disk.
   ───────────────────────────────────────────────────────────── */

import { createServer as createHttps } from 'node:https';
import { createServer as createHttp } from 'node:http';
import { execFileSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, statSync, createReadStream,
} from 'node:fs';
import { dirname, join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const SERVE = process.argv[2] === 'build' ? 'build' : 'public';
const ROOT = join(ROOT_DIR, SERVE);
const CERT_DIR = join(ROOT_DIR, '.certs');

// Writes are confined to these two folders. Nothing else is reachable.
const WRITABLE = ['ar/targets', 'ar/print'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.mind': 'application/octet-stream',
};

function lanAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs || []) {
      // Skip WSL / Hyper-V virtual adapters; the phone cannot reach those.
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('172.')) {
        return a.address;
      }
    }
  }
  return null;
}

/** Self-signed cert covering localhost and the current LAN address. */
function ensureCert(ip) {
  mkdirSync(CERT_DIR, { recursive: true });
  const key = join(CERT_DIR, 'key.pem');
  const crt = join(CERT_DIR, 'cert.pem');
  const stamp = join(CERT_DIR, '.for');

  const want = ip || 'localhost';
  const have = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null;
  if (existsSync(key) && existsSync(crt) && have === want) {
    return { key: readFileSync(key), cert: readFileSync(crt) };
  }

  const san = ['DNS:localhost', 'IP:127.0.0.1', ip && `IP:${ip}`]
    .filter(Boolean).join(',');
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', key, '-out', crt, '-days', '825',
      '-subj', '/CN=vayam-dev',
      '-addext', `subjectAltName=${san}`,
    ], { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    writeFileSync(stamp, want);
    console.log(`generated a self-signed certificate for ${san}`);
    return { key: readFileSync(key), cert: readFileSync(crt) };
  } catch {
    return null;   // openssl missing — caller falls back to plain HTTP
  }
}

/** Percent-decode without throwing on the malformed URLs scanners send. */
function safeDecode(str) {
  try { return decodeURIComponent(str); } catch { return str; }
}

/** Resolve a URL path to a file inside ROOT, or null if it escapes. */
function resolveInRoot(urlPath) {
  const decoded = safeDecode(urlPath.split('?')[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const full = join(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

/** One bad request must never take the server down mid-demo. */
function guard(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      console.error(`  500 ${req.url} - ${err.message}`);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('server error');
    }
  };
}

function handle(req, res) {
  const url = req.url || '/';

  if (req.method === 'PUT' && url.startsWith('/__save/')) return save(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('method not allowed');
    return;
  }

  let file = resolveInRoot(url);
  if (!file) { res.writeHead(403).end('forbidden'); return; }

  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

  // Also answer the extensionless form. `npx serve` used to 301 /ar/card.html
  // to /ar/card, and browsers cache a 301 forever, so the stripped URL keeps
  // arriving here long after that server is gone.
  if (!existsSync(file) && !extname(file) && existsSync(file + '.html')) {
    file += '.html';
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`404 ${url}`);
    console.log(`  404 ${url}`);
    return;
  }

  const size = statSync(file).size;
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
    // Camera has to be granted to this origin for MindAR to start.
    'permissions-policy': 'camera=(self), xr-spatial-tracking=(self)',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

function save(req, res, url) {
  const rel = normalize(safeDecode(url.slice('/__save/'.length).split('?')[0]))
    .split(sep).join('/');

  if (!WRITABLE.some(dir => rel.startsWith(dir + '/'))) {
    res.writeHead(403, { 'content-type': 'text/plain' })
       .end(`writes are only allowed under ${WRITABLE.join(', ')}`);
    return;
  }
  const full = join(ROOT, rel);
  if (!full.startsWith(ROOT + sep)) { res.writeHead(403).end('forbidden'); return; }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    // An empty write would silently leave card.html with a zero-byte target and
    // no obvious reason why nothing tracks. Refuse it.
    if (buf.length === 0) {
      res.writeHead(400, { 'content-type': 'text/plain' }).end('refusing to write an empty file');
      console.log(`  400 ${rel} — empty body`);
      return;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, buf);
    console.log(`  saved ${rel} (${(buf.length / 1024).toFixed(0)} KB)`);
    res.writeHead(200, { 'content-type': 'application/json' })
       .end(JSON.stringify({ ok: true, path: rel, bytes: buf.length }));
  });
  req.on('error', () => res.writeHead(400).end('bad request'));
}

const ip = lanAddress();
const tls = ensureCert(ip);

// A phone dropping a connection mid-download should not kill the process.
process.on('uncaughtException', (err) => console.error('ignored:', err.message));

/* Two listeners on purpose.

   http://localhost:4173  — this machine. A localhost origin counts as secure
   even over plain HTTP, so the camera works and no certificate warning gets in
   the way of tooling.

   https://192.168.x.x:4174 — the phone. Any non-localhost origin must be HTTPS
   before a browser will hand over the camera. */
createHttp(guard(handle)).listen(PORT, '0.0.0.0', () => {
  console.log(`
serving ${SERVE}/
`);
  console.log(`  this machine   http://localhost:${PORT}/ar/`);
});

if (tls) {
  createHttps(tls, guard(handle)).listen(PORT + 1, '0.0.0.0', () => {
    if (ip) console.log(`  your phone     https://${ip}:${PORT + 1}/ar/`);
    console.log(`
The phone certificate is self-signed, so it warns once. Tap Advanced then
"Proceed" (Android), or Show Details then "visit this website" (iOS). After
that the origin counts as secure and the camera is allowed.`);
  });
} else {
  console.log(`
openssl was not found, so there is no HTTPS listener. localhost still works,
but the camera will be BLOCKED when you open this from your phone.`);
}
