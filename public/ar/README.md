# Vayam WebAR

Three lanes, one URL, no licence fees. A customer scans a QR code on a printed
card or pamphlet and lands on `/ar/`.

| Lane | Page | Works on | Cost |
|---|---|---|---|
| Plain 3D, orbit and pinch | `/ar/index.html` | every phone with WebGL | free |
| Dollhouse anchored to printed paper | `/ar/card.html` | every phone with a camera | free |
| Life-size on the customer's own floor | `/ar/index.html` → *Place in your room* | ARCore / ARKit phones only | free |

The first two are the ones that answer "must work on most Indian phones". The
third is a bonus and the page says so plainly when a handset cannot do it.

## Why these pages sit outside the React app

`card.html` pins **three.js 0.160.0**. MindAR 1.2.5 imports `sRGBEncoding`,
which three.js removed after 0.163, and the React app is on 0.184 for
`@react-three/fiber` v9. Two three.js versions cannot share one webpack graph.
Two separate HTML pages coexist without any trouble.

Keeping them static also means the ~2.6 MB MindAR tracker downloads only for
people who actually hold the printed card, not for everyone who opens the site.

CRA copies `public/` verbatim into `build/`, so these pages ship with a normal
`npm run build` and need no extra configuration on Netlify.

## Setting it up

**1. Build the mobile model variants** (already done once; re-run whenever a
`.glb` changes):

```bash
npm run models:ar
```

Originals stay untouched in `public/assets/models/`. Variants land in
`public/assets/models/ar/`.

**2. Generate printable tracking artwork:**

```bash
npm run ar:targets
```

Writes `print/target-card.svg` (89 × 51 mm, the reverse of a visiting card) and
`print/target-a5.svg` (a pamphlet panel). Put the QR code on the *other* side —
the tracked face must be exactly what you compile.

**3. Start the dev server:**

```bash
npm run ar:serve
```

It listens twice. Plain HTTP on `:4173` for this machine, because a `localhost`
origin counts as secure and the camera works there. Self-signed HTTPS on `:4174`
for your phone, because every other origin must be HTTPS before a browser hands
over the camera. The phone warns about the certificate once; accept it and the
origin is trusted from then on.

**4. Compile the target.** Open `http://localhost:4173/ar/compile.html`, drop the
SVG in, press compile, then press **Save straight to public/ar/targets/**. That
writes two files:

- `vayam.mind` — the tracking data.
- `vayam.targets.json` — each target's printed shape.

The sidecar matters. MindAR normalises every target to one unit wide and offers
no way to ask how tall it is, so without it `card.html` cannot tell that an
89 × 51 mm card is not square, and the model overhangs the paper. `card.html`
also uses it to decide whether to lay the flat straight or turn it a quarter
turn, whichever sits larger.

Everything runs in the browser tab. Nothing is uploaded and there is no account.

**5. Print matte.** Gloss lamination bounces ceiling lights into the lens and
tracking dies.

## If the compiler seems stuck

The button shows a live percentage and elapsed seconds. If the percentage is
still moving it is working, just slowly. On a laptop with GPU acceleration two
1024 px targets take about 8 seconds; without it, minutes. Keep the tab in the
foreground, because background tabs get throttled and stall further. If the
percentage genuinely stops, the page says so and the browser console has the
detail.

One machine-specific trap: an earlier version of this setup used `npx serve`,
which permanently redirected `/ar/card.html` to `/ar/card` and dropped the query
string on the way. Browsers cache a permanent redirect indefinitely, so
`?unit=2bhk` can silently vanish long after that server is gone. The dev server
now answers both URL forms. Hard-reload once if you see the stripped URL.

## Measured on the generated artwork

| | Feature points | Verdict |
|---|---|---|
| Visiting card, 1024 px | 2,812 | strong |
| A5 pamphlet, 1024 px | 3,565 | strong |

Anything above roughly 400 tracks steadily. A bare logo on white scores in the
dozens, which is why the artwork is a floor-plan drawing rather than a wordmark.

How large the flat ends up on the paper, after fitting:

| | on the 89 mm card | on the A5 pamphlet |
|---|---|---|
| 3 BHK | 45 × 44 mm, 9 mm tall | 131 × 127 mm, 27 mm tall |
| 2 BHK | 66 × 44 mm, 16 mm tall | 181 × 120 mm, 43 mm tall |

The A5 is the better demo surface by a wide margin. The card works, but a nearly
square 3 BHK on a 51 mm short edge leaves a small model. Pinch to enlarge.

## Model budget

| | Original | Card variant | Room variant |
|---|---|---|---|
| 3 BHK | 17.80 MB | 0.93 MB | 2.12 MB |
| 2 BHK | 31.74 MB | 0.65 MB | 1.27 MB |
| fallback flat | 9.54 MB | 1.18 MB | 1.38 MB |

The file size is the visible saving. The invisible one matters more: the 2 BHK
source carries five 4096 × 4096 textures, which decode to roughly 450 MB of GPU
memory. Mobile Safari kills a tab well before that. Resizing to 2048 and 1024
is what makes these models loadable on a phone at all.

Next step when there is time: install
[KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases) (free) and
switch `--texture-compress webp` to `ktx2` in `scripts/optimize-models.mjs`.
WebP still expands to full RGBA in VRAM; KTX2 stays compressed on the GPU and
cuts memory a further 4×.

## Known gaps

- `targets/vayam.mind` is not committed. Compile it from your final printed
  artwork — a target compiled from anything else will not match the paper.
- There is no 4 BHK model. `units.js` points the 4 BHK at `flat.glb`, matching
  the fallback already in `WalkthroughView.jsx`.
- Model footprints do not match the advertised areas. The 3 BHK measures
  11.05 × 10.74 m (~1,275 sq ft) against a listed 1,850 sq ft. Life-size AR
  makes that discrepancy walkable, so reconcile the numbers before a public
  launch.
- QR codes scanned inside Instagram, Facebook or WhatsApp open an in-app
  browser that often blocks the camera. `card.html` detects the failure and
  tells the customer to reopen in Chrome or Safari.
- `targets/vayam.mind` currently holds the two generated designs. Recompile it
  from your real printed artwork before any customer sees this.
