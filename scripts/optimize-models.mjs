/* ─────────────────────────────────────────────────────────────
   Builds the AR/mobile variants of every flat model.

     npm run models:ar

   Reads   public/assets/models/*.glb        (untouched originals)
   Writes  public/assets/models/ar/*_card.glb   1024 px textures
           public/assets/models/ar/*_room.glb   2048 px textures

   Why this exists: the source models carry up to five 4096 × 4096 textures
   each. Decoded, that is ~450 MB of GPU memory for one flat — several times
   what a mobile browser tab is allowed before it is killed. Resizing and
   re-encoding is what makes the models usable on a phone at all; the file-size
   saving is a side effect.
   ───────────────────────────────────────────────────────────── */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = join(ROOT, 'public', 'assets', 'models');
const OUT  = join(SRC, 'ar');

// Invoke the CLI's entry point through node directly. Going via `npx` needs a
// shell on Windows, and a shell mangles the spaces in this project's path.
const CLI = join(ROOT, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const MODELS = ['flat_3bhk', 'flat_2bhk', 'flat'];

const VARIANTS = [
  { suffix: 'card', size: 1024 },   // dollhouse on a printed card
  { suffix: 'room', size: 2048 },   // 1:1 placement and plain 3D orbit
];

const mb = (p) => (statSync(p).size / 1048576).toFixed(2);

mkdirSync(OUT, { recursive: true });

let before = 0, after = 0;

for (const name of MODELS) {
  const src = join(SRC, `${name}.glb`);
  if (!existsSync(src)) {
    console.warn(`skip ${name}.glb — not found`);
    continue;
  }
  before += statSync(src).size;

  for (const v of VARIANTS) {
    const dst = join(OUT, `${name}_${v.suffix}.glb`);
    console.log(`${name}.glb (${mb(src)} MB) → ar/${name}_${v.suffix}.glb …`);

    execFileSync(process.execPath, [
      CLI, 'optimize', src, dst,
      '--compress', 'draco',
      '--texture-compress', 'webp',
      '--texture-size', String(v.size),
      // Geometry stays as authored. These flats are baked-lightmap models and
      // meshoptimizer's simplifier tears the UV seams the bake depends on.
      '--simplify', 'false',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });

    after += statSync(dst).size;
    console.log(`   → ${mb(dst)} MB`);
  }
}

console.log(`\noriginals ${(before / 1048576).toFixed(1)} MB → variants ${(after / 1048576).toFixed(1)} MB`);
console.log(`
Optional next step — cuts GPU memory a further 4×, which matters most on
budget Android handsets. Install KTX-Software 4.4+ from
https://github.com/KhronosGroup/KTX-Software/releases (free, Apache 2.0),
then swap --texture-compress webp for --texture-compress ktx2 above.
WebP still decodes to full RGBA in VRAM; KTX2 stays compressed on the GPU.`);
