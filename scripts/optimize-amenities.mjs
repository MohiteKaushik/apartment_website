/* ─────────────────────────────────────────────────────────────
   Builds the web versions of the amenity models.

     npm run models:amenities

   Reads   source-assets/Amenities/*.glb   (untouched originals, gitignored —
           kept outside public/ so CRA does not copy 200 MB into build/)
   Writes  public/assets/Amenities/*.glb   (what AmenitiesPage loads)

   Meshopt geometry compression is used rather than Draco because drei's
   useGLTF decodes meshopt with a decoder bundled in the app, while Draco pulls
   its decoder from a Google CDN at runtime. Textures are capped at 2048 px and
   re-encoded as WebP: sharp enough for the Quest, light enough for phones.
   ───────────────────────────────────────────────────────────── */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = join(ROOT, 'source-assets', 'Amenities');
const OUT  = join(ROOT, 'public', 'assets', 'Amenities');
const CLI  = join(ROOT, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const only = process.argv.slice(2);           // optional: file names to (re)build
const mb = (p) => (statSync(p).size / 1048576).toFixed(2);

mkdirSync(OUT, { recursive: true });
let before = 0, after = 0;

for (const file of readdirSync(SRC).filter(f => f.endsWith('.glb'))) {
  if (only.length && !only.includes(file)) continue;
  const src = join(SRC, file), dst = join(OUT, file);
  console.log(`${file} (${mb(src)} MB) …`);
  execFileSync(process.execPath, [
    CLI, 'optimize', src, dst,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '2048',
    '--simplify', 'false',     // keep geometry as authored
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  before += statSync(src).size; after += statSync(dst).size;
  console.log(`   → ${mb(dst)} MB`);
}
console.log(`\noriginals ${(before / 1048576).toFixed(1)} MB → web ${(after / 1048576).toFixed(1)} MB`);
