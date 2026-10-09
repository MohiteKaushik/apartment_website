import React, { Suspense, useState, useRef, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import NavBar from '../components/NavBar';
// import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* The last frame of the intro video. The hero scene is built on top of it:
   the 3D towers are rendered from the same angle and framing as the video's
   final shot, so the cut from film to page is a match cut. */
const HERO_STILL = '/assets/images/hero_still.jpg';
/* The GLB is a little shorter than the towers in the film; drawn 22% larger
   (about its base) it covers them completely at the hero camera. */
const MODEL_SCALE = 0.0122;

/* Only two towers */
const TOWERS = [
  { id: 'A', name: 'Tower Aureum',  tagline: 'North Facing · 28 Floors', units: 112 },
  { id: 'B', name: 'Tower Regalis', tagline: 'East Facing · 32 Floors',  units: 128 },
];

/* ── Error boundary ── */
class ModelErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/*
  The GLB is a single merged mesh, so we can't split by mesh objects.
  Instead we split the geometry itself at triangle level:
  1. Sample vertex positions to find the split axis (histogram valley).
  2. Assign every triangle to half-A or half-B based on its centroid.
  3. Build two new Three.js Meshes with independent materials.
  4. Hide the original, add the two halves → independent glow control.
*/
/* Start fetching the model and the hero still as soon as this module
   loads — i.e. while the intro video is still playing. */
useGLTF.preload('/assets/models/tower.glb');
if (typeof Image !== 'undefined') { const i = new Image(); i.src = HERO_STILL; }

function TowerGLB({ hoveredId, growRef }) {
  const { scene }  = useGLTF('/assets/models/tower.glb');
  const meshARef   = useRef(null);
  const meshBRef   = useRef(null);
  const hoveredRef = useRef(hoveredId);

  useEffect(() => { hoveredRef.current = hoveredId; }, [hoveredId]);

  useEffect(() => {
    meshARef.current = null;
    meshBRef.current = null;

    // ── Ground the tower: apply scale first, compute floor Y, then drop it to Y=0 ──
    // Change the number below to raise (+) or lower (–) the tower manually if needed:
    const MANUAL_Y_OFFSET = 0;     /* ground level; the hero camera in HeroRig assumes this */

    scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
    scene.updateMatrixWorld(true);
    const floorBox = new THREE.Box3().setFromObject(scene);
    if (isFinite(floorBox.min.y)) {
      scene.position.y = -floorBox.min.y + MANUAL_Y_OFFSET;
    }
    scene.updateMatrixWorld(true);

    // ── Log every mesh so we can see what's in the GLB ──
    console.log('[TowerSplit] Meshes in GLB:');
    scene.traverse(child => {
      if (!child.isMesh) return;
      const b = new THREE.Box3().setFromObject(child);
      const verts  = child.geometry.attributes.position.count;
      const height = (b.max.y - b.min.y).toFixed(2);
      const width  = Math.max(b.max.x - b.min.x, b.max.z - b.min.z).toFixed(2);
      console.log(`  "${child.name||'?'}"  verts=${verts}  H=${height}  W=${width}  ratio=${(height/width).toFixed(2)}`);
    });

    // ── Pick the BUILDING mesh, not the landscape ──
    // Buildings are tall relative to their footprint (aspect ratio > 0.3).
    // Landscape is wide and flat (aspect ratio << 0.1).
    // Among tall meshes, pick the one with the most triangles.
    let mainMesh = null;
    let bestScore = -1;
    scene.traverse(child => {
      if (!child.isMesh) return;
      const b      = new THREE.Box3().setFromObject(child);
      const height = b.max.y - b.min.y;
      const span   = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      const ratio  = span > 0 ? height / span : 0;  // tall = high ratio
      const verts  = child.geometry.attributes.position.count;
      // Score favours tall meshes; multiplied by vertex count as tiebreaker
      const score  = ratio * Math.log(verts + 1);
      if (score > bestScore) { bestScore = score; mainMesh = child; }
    });
    if (!mainMesh) return;
    console.log(`[TowerSplit] selected mesh: "${mainMesh.name||'?'}"  verts=${mainMesh.geometry.attributes.position.count}`);

    const geo     = mainMesh.geometry;
    const posAttr = geo.attributes.position;
    const worldMat = mainMesh.matrixWorld;

    // ── 1. Sample vertex world positions ──
    // Every 3rd vertex is enough for axis detection (saves time on large models)
    const STEP = 3;
    const allVerts = [];
    for (let i = 0; i < posAttr.count; i += STEP) {
      allVerts.push(
        new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(worldMat)
      );
    }

    // Ignore bottom 35% — excludes shared podium + the short central building
    const maxY   = Math.max(...allVerts.map(v => v.y));
    const cutoff = maxY * 0.15;
    const tall   = allVerts.filter(v => v.y > cutoff);
    const sample = tall.length ? tall : allVerts; // fallback: use all

    // ── 2. Histogram-valley detection across 4 axes ──
    const AXES = [
      { label: 'X',   fn: v => v.x },
      { label: 'Z',   fn: v => v.z },
      { label: 'X+Z', fn: v => v.x + v.z },
      { label: 'X-Z', fn: v => v.x - v.z },
    ];
    const BINS = 40;

    let bestAxis = AXES[0], bestSplit = 0, bestBalance = -1;

    AXES.forEach(axis => {
      const vals = sample.map(axis.fn);
      const lo   = Math.min(...vals), hi = Math.max(...vals);
      const span = hi - lo;
      if (span < 0.001) return;

      const hist = new Array(BINS).fill(0);
      vals.forEach(v => {
        const b = Math.min(Math.floor((v - lo) / span * BINS), BINS - 1);
        hist[b]++;
      });

      // Find lowest-count bin in middle 30–70% (the courtyard valley)
      const start = Math.floor(BINS * 0.30), end = Math.floor(BINS * 0.70);
      let minCount = Infinity, valleyBin = Math.floor(BINS / 2);
      for (let b = start; b < end; b++) {
        if (hist[b] < minCount) { minCount = hist[b]; valleyBin = b; }
      }

      const split   = lo + (valleyBin + 0.5) / BINS * span;
      const cA      = vals.filter(v => v < split).length;
      const cB      = vals.length - cA;
      const balance = Math.min(cA, cB) / vals.length; // 0→0.5, higher = more equal

      if (balance > bestBalance) {
        bestBalance = balance;
        bestSplit   = split;
        bestAxis    = axis;
      }
    });

    console.log(`[TowerSplit] axis=${bestAxis.label}  split=${bestSplit.toFixed(3)}  balance=${(bestBalance * 2).toFixed(2)} (1.0=perfect)`);

    // ── 3. Assign triangles: A, B, or neutral (shared building below cutoff) ──
    const idx      = geo.index;
    const triCount = idx ? idx.count / 3 : posAttr.count / 3;
    const trisA = [], trisB = [], trisNeutral = [];
    const tmp   = new THREE.Vector3();

    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3)     : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

      tmp.set(
        (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3,
        (posAttr.getY(i0) + posAttr.getY(i1) + posAttr.getY(i2)) / 3,
        (posAttr.getZ(i0) + posAttr.getZ(i1) + posAttr.getZ(i2)) / 3,
      ).applyMatrix4(worldMat);

      // Below height cutoff → shared building, never glows
      if (tmp.y < cutoff) {
        trisNeutral.push(i0, i1, i2);
      } else {
        (bestAxis.fn(tmp) < bestSplit ? trisA : trisB).push(i0, i1, i2);
      }
    }

    console.log(`[TowerSplit] A=${trisA.length/3}  B=${trisB.length/3}  neutral=${trisNeutral.length/3}`);

    // ── 4. Build two independent Mesh objects ──
    const baseMat = Array.isArray(mainMesh.material)
      ? mainMesh.material[0] : mainMesh.material;

    const makeHalf = (triIndices) => {
      if (!triIndices.length) return null;
      const newGeo = geo.clone();
      const Ctor   = posAttr.count > 65535 ? Uint32Array : Uint16Array;
      newGeo.setIndex(new THREE.BufferAttribute(new Ctor(triIndices), 1));
      const mat = baseMat.clone();
      mat.emissive          = new THREE.Color(0, 0, 0);
      mat.emissiveIntensity = 0;
      const m = new THREE.Mesh(newGeo, mat);
      // Copy local transform from original mesh
      m.matrix.copy(mainMesh.matrix);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      return m;
    };

    const mA = makeHalf(trisA);
    const mB = makeHalf(trisB);
    // Neutral mesh: shared small building — rendered with original material, never glows
    const mN = trisNeutral.length ? makeHalf(trisNeutral) : null;
    if (mN) {
      mN.material.dispose();
      mN.material = baseMat; // keep original material, no emissive
    }

    mainMesh.visible = false;
    if (mA) { mainMesh.parent.add(mA); meshARef.current = mA; }
    if (mB) { mainMesh.parent.add(mB); meshBRef.current = mB; }
    if (mN) { mainMesh.parent.add(mN); }

    return () => {
      [mA, mB, mN].forEach(m => {
        if (!m) return;
        m.geometry.dispose();
        if (m !== mN) m.material.dispose();
        mainMesh.parent?.remove(m);
      });
      mainMesh.visible = true;
    };
  }, [scene]);

  // ── 5. Smooth gold glow each frame ──
  useFrame(() => {
    const hov  = hoveredRef.current;
    const GOLD = new THREE.Color('#c49a3c');
    const OFF  = new THREE.Color(0, 0, 0);

    [[meshARef.current, 'A'], [meshBRef.current, 'B']].forEach(([mesh, id]) => {
      if (!mesh) return;
      const on = hov === id;
      mesh.material.emissiveIntensity += ((on ? 0.5 : 0) - mesh.material.emissiveIntensity) * 0.1;
      mesh.material.emissive.lerp(on ? GOLD : OFF, 0.1);
    });
  });

  // Turned 180° so the pool deck faces the viewer like in the film. The
  // group's scale is animated by HeroRig (the model "grows out" of the still).
  return (
    <group ref={growRef} rotation={[0, Math.PI, 0]}>
      <primitive object={scene} scale={MODEL_SCALE} />
    </group>
  );
}

/* ── Geometric placeholder ── */
function PlaceholderTower() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.2, 0.3, 2.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[1.4, 4.8, 1.4]} />
        <meshStandardMaterial color="#14142b" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 5.5, 0]}>
        <coneGeometry args={[0.15, 0.8, 4]} />
        <meshStandardMaterial color="#c49a3c" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

/* ── Hero camera ─────────────────────────────────────────
   The 3D camera starts exactly where the intro video's camera ends
   (worked out by overlaying renders on the video's last frame), so the
   model sits on top of the towers in the still. From there:

   • cinematic push-in: the camera's field of view narrows a little and the
     backdrop image is scaled by the same factor, so the two stay locked
     (a zoom is a uniform scale about the centre for both);
   • then a gentle, limited drag-to-look (±9° sideways, ±5° up/down) with
     damping, and a slow sway when idle. Limits keep the 3D towers believable
     against the flat photo behind them.

   Vertical field of view follows the viewport the same way `object-fit:
   cover` crops the backdrop, so the composite holds on any screen shape. */
const HERO = { az: -42, el: 33, dist: 36, look: [0, 7.4, 0], fovAt16x9: 45 };
/* Opening timeline, seconds after the reveal starts:
     0 … HOLD      the film's last frame holds (the cross-fade is inside this)
     HOLD …        the model grows out of the still (GROW_DUR), while the
                   picture behind it softens and a vignette settles around it
     HOLD+0.3 …    the camera's slow push-in / pan (PUSH_DUR)              */
const HOLD = 1.0, GROW_DUR = 1.5, PUSH_T0 = HOLD + 0.3, PUSH_DUR = 3.0;
const GROW_FROM = 1 / 1.22;    // model starts at the film's size, ends at MODEL_SCALE
/* Zoom of the opening move, by screen shape. Landscape 16:9 pushes in a
   touch; very wide screens and phones pull out so the whole building fits
   (phones also leave room for the title above it). */
const pushFor = (aspect, baseFovDeg) =>
  aspect < 0.9 ? 0.86 : Math.min(1.05, Math.max(0.85, baseFovDeg / 38));
/* On phones the composite also pans down (as a fraction of the height) so
   the towers sit between the title and the cards. Backdrop and 3D view are
   shifted by the same number of pixels, so they stay locked together. */
const panFor = (aspect) => (aspect < 0.9 ? 0.17 : 0);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const deg = (d) => (d * Math.PI) / 180;

function HeroRig({ backdropRef, fxRef, growRef, cinematic, onSettled }) {
  const { camera, gl, size } = useThree();
  const az   = useRef(deg(HERO.az)), el = useRef(deg(HERO.el));   // current
  const azT  = useRef(deg(HERO.az)), elT = useRef(deg(HERO.el));  // targets
  const zoom = useRef(1);
  const pan  = useRef(0);      // fraction of viewport height, +down
  const grow = useRef(cinematic ? GROW_FROM : 1);
  const fx   = useRef(cinematic ? 0 : 1);   // local blur + vignette strength
  const t0   = useRef(null);
  const lastInput = useRef(performance.now());
  const settled = useRef(!cinematic);
  const dragging = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => { onSettledRef.current = onSettled; }, [onSettled]);

  /* base vertical fov for this viewport (see note above) */
  const baseFov = () => {
    const aspect = size.width / size.height, video = 16 / 9;
    const t = Math.tan(deg(HERO.fovAt16x9) / 2);
    return aspect > video ? 2 * Math.atan(t * video / aspect) : deg(HERO.fovAt16x9);
  };

  /* drag to look (mouse + touch) — only once the opening move is over */
  useEffect(() => {
    const el_ = gl.domElement;
    let last = null;
    const start = (x, y) => { if (!settled.current) return; last = { x, y }; dragging.current = true; };
    const move  = (x, y) => {
      if (!last) return;
      azT.current = THREE.MathUtils.clamp(azT.current - (x - last.x) * 0.004, deg(HERO.az - 9), deg(HERO.az + 9));
      elT.current = THREE.MathUtils.clamp(elT.current + (y - last.y) * 0.003, deg(HERO.el - 5), deg(HERO.el + 5));
      last = { x, y }; lastInput.current = performance.now();
    };
    const end = () => { last = null; dragging.current = false; lastInput.current = performance.now(); };
    const md = (e) => start(e.clientX, e.clientY), mm = (e) => move(e.clientX, e.clientY);
    const ts = (e) => e.touches.length === 1 && start(e.touches[0].clientX, e.touches[0].clientY);
    const tm = (e) => e.touches.length === 1 && move(e.touches[0].clientX, e.touches[0].clientY);
    el_.addEventListener('mousedown', md); window.addEventListener('mousemove', mm); window.addEventListener('mouseup', end);
    el_.addEventListener('touchstart', ts, { passive: true }); el_.addEventListener('touchmove', tm, { passive: true });
    el_.addEventListener('touchend', end); el_.addEventListener('touchcancel', end);
    return () => {
      el_.removeEventListener('mousedown', md); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', end);
      el_.removeEventListener('touchstart', ts); el_.removeEventListener('touchmove', tm);
      el_.removeEventListener('touchend', end); el_.removeEventListener('touchcancel', end);
    };
  }, [gl]);

  useFrame(() => {
    const now = performance.now();

    /* opening push-in */
    if (cinematic && !settled.current) {
      if (t0.current === null) t0.current = now;
      const el_ = (now - t0.current) / 1000;
      const g = easeOutCubic(Math.min(1, Math.max(0, el_ - HOLD) / GROW_DUR));
      grow.current = GROW_FROM + (1 - GROW_FROM) * g;
      fx.current   = g;
      const t = Math.min(1, Math.max(0, el_ - PUSH_T0) / PUSH_DUR);
      const k = easeOutCubic(t);
      const aspect = size.width / size.height;
      const target = pushFor(aspect, THREE.MathUtils.radToDeg(baseFov()));
      zoom.current = 1 + (target - 1) * k;
      pan.current  = panFor(aspect) * k;
      azT.current  = deg(HERO.az + 2.5 * k);          // a touch of parallax
      if (t >= 1) { settled.current = true; onSettledRef.current?.(); }
    }

    /* idle sway once interactive */
    if (settled.current && !dragging.current && now - lastInput.current > 3000) {
      const s = (now - lastInput.current - 3000) / 1000;
      const ease = Math.min(1, s / 4);
      azT.current = deg(HERO.az + 2.5) + Math.sin(s / 7) * deg(3) * ease;
      elT.current = deg(HERO.el) + Math.sin(s / 11) * deg(1) * ease;
    }

    az.current += (azT.current - az.current) * 0.06;
    el.current += (elT.current - el.current) * 0.06;

    const [lx, ly, lz] = HERO.look;
    camera.position.set(
      lx + HERO.dist * Math.cos(el.current) * Math.sin(az.current),
      ly + HERO.dist * Math.sin(el.current),
      lz + HERO.dist * Math.cos(el.current) * Math.cos(az.current));
    camera.lookAt(lx, ly, lz);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseFov() / 2) / zoom.current));
    const shift = Math.round(pan.current * size.height);
    if (shift) camera.setViewOffset(size.width, size.height, 0, -shift, size.width, size.height);
    else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (growRef?.current) growRef.current.scale.setScalar(grow.current);
    if (fxRef?.current) {
      fxRef.current.blur.style.opacity = fx.current.toFixed(3);
      fxRef.current.vignette.style.opacity = fx.current.toFixed(3);
    }
    if (backdropRef.current) {
      const z = zoom.current;
      backdropRef.current.style.transform = `translateY(${shift}px) scale(${z.toFixed(4)})`;
      // when zoomed out, feather the edges of the sharp still into the blurred copy behind it
      const m = (z < 0.995 || shift) ? 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 72%, transparent 100%)' : 'none';
      backdropRef.current.style.maskImage = m; backdropRef.current.style.webkitMaskImage = m;
    }
  });
  return null;
}

/* While the page is hidden under the intro: ask for a frame every so often
   so the model and textures get uploaded to the GPU before the reveal. */
function WarmUp() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = setInterval(invalidate, 500);
    return () => clearInterval(t);
  }, [invalidate]);
  return null;
}

function TowerScene({ hoveredId, backdropRef, fxRef, cinematic, onSettled }) {
  const growRef = useRef(null);
  return (
    <>
      <HeroRig backdropRef={backdropRef} fxRef={fxRef} growRef={growRef} cinematic={cinematic} onSettled={onSettled} />
      {/* a little atmospheric haze so the model doesn't read as razor-sharp against the photo */}
      <fog attach="fog" args={['#d9e1e8', 40, 150]} />
      {/* Daylight to match the still: sun high on the left, soft fill from the right */}
      <ambientLight intensity={2.2} color="#f6f7ff" />
      <directionalLight position={[-14, 26, 10]} intensity={3.0} color="#fff3e0" />
      <directionalLight position={[18, 10, -6]} intensity={0.9} color="#dfe8ff" />
      <ModelErrorBoundary fallback={<PlaceholderTower />}>
        <Suspense fallback={<PlaceholderTower />}>
          <TowerGLB hoveredId={hoveredId} growRef={growRef} />
          {/* soft ground contact so the model sits in the photo */}
          <ContactShadows position={[0, 0.02, 0]} scale={34} blur={2.6} opacity={0.5} far={14} frames={1} />
        </Suspense>
      </ModelErrorBoundary>
    </>
  );
}

/* ── Main page ─────────────────────────────────────────── */
const ease = [0.22, 1, 0.36, 1];
const rise = (delay, dist = 18) => ({
  initial: { opacity: 0, y: dist },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.9, ease },
});

export default function TowerSelection({ onSelectTower, onViewAmenities, onCustomize, behindIntro = false }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [ready, setReady]         = useState(false);
  const [hintGone, setHintGone]   = useState(false);
  const backdropRef               = useRef(null);   // sharp still + local blur (transformed together)
  const blurRef                   = useRef(null);
  const vignetteRef               = useRef(null);
  const fxRef                     = useRef(null);
  useEffect(() => { fxRef.current = { blur: blurRef.current, vignette: vignetteRef.current }; }, []);
  // Cinematic opening only when we arrive from the intro film.
  const cinematic = useRef(behindIntro).current;
  // Delays: staged after the cut when cinematic, brisk otherwise.
  const D = cinematic ? { nav: 2.0, eyebrow: 2.4, title: 2.55, sub: 2.85, links: 3.1, card: 3.2, hint: 4.2 }
                      : { nav: 0.1, eyebrow: 0.2, title: 0.25, sub: 0.35, links: 0.45, card: 0.3, hint: 1.2 };

  useEffect(() => {
    if (behindIntro || hintGone) return;
    const t = setTimeout(() => setHintGone(true), 9000);
    return () => clearTimeout(t);
  }, [behindIntro, hintGone]);

  return (
    <motion.div className="absolute inset-0 overflow-hidden bg-black"
      initial={{ opacity: cinematic ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}>

      {/* Backdrop: last frame of the film, cover-cropped like the video.
          A blurred copy sits underneath to fill the edges when the opening
          move zooms out on phones and very wide screens. */}
      <img src={HERO_STILL} alt="" aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        style={{ filter: 'blur(22px) brightness(0.85)', transform: 'scale(1.12)' }} draggable={false} />
      <div ref={backdropRef} className="absolute inset-0 pointer-events-none"
        style={{ transformOrigin: '50% 50%', willChange: 'transform' }}>
        <img src={HERO_STILL} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover select-none" draggable={false} />
        {/* The same still, softened, shown only around the building: the
            filmed towers melt away behind the 3D model as it grows out. */}
        <img ref={blurRef} src={HERO_STILL} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ filter: 'blur(9px) saturate(0.9)', transform: 'scale(1.03)', opacity: 0,
                   maskImage: 'radial-gradient(ellipse 30% 46% at 50% 52%, #000 40%, transparent 100%)',
                   WebkitMaskImage: 'radial-gradient(ellipse 30% 46% at 50% 52%, #000 40%, transparent 100%)' }}
          draggable={false} />
      </div>
      {/* Vignette: a soft pool of light on the building, darker towards the edges */}
      <div ref={vignetteRef} className="absolute pointer-events-none" style={{ inset: '-25%', opacity: 0,
        background: 'radial-gradient(ellipse 27% 34% at 50% 52%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.2) 68%, rgba(0,0,0,0.38) 100%)' }} />

      {/* Live 3D towers, composited over the still */}
      <Canvas className="absolute inset-0"
        style={{ position: 'absolute', inset: 0,
                 /* take the digital edge off the render so it sits in the photo */
                 filter: 'blur(0.35px) saturate(0.96)' }}
        camera={{ fov: 45, near: 0.5, far: 400 }}
        gl={{ alpha: true, antialias: true }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        frameloop={behindIntro ? 'demand' : 'always'}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); setReady(true); }}>
        {behindIntro && <WarmUp />}
        <TowerScene hoveredId={hoveredId} backdropRef={backdropRef} fxRef={fxRef} cinematic={cinematic}
          onSettled={() => {}} />
      </Canvas>

      {/* Legibility gradients (never block the drag) */}
      <div className="absolute inset-x-0 top-0 h-40 sm:h-40 pointer-events-none"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))' }} />
      <div className="absolute inset-x-0 top-0 h-[46%] pointer-events-none sm:hidden"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72) 30%, rgba(0,0,0,0))' }} />
      <div className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{ background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.66))' }} />
      <div className="absolute inset-y-0 left-0 w-[48%] pointer-events-none hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0))' }} />

      {/* Loading veil — only when the page is opened directly (not under the film) */}
      <AnimatePresence>
        {!ready && !behindIntro && (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center bg-black"
            exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <LoadingSpinner label="Preparing view…" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <motion.div className="absolute inset-x-0 top-0 z-20"
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: D.nav, duration: 0.8, ease }}>
        <NavBar step={2} transparent />
      </motion.div>

      {/* Hero copy */}
      <div className="absolute z-20 left-5 right-5 sm:left-10 sm:right-auto sm:max-w-[520px]
                      top-[72px] sm:top-auto sm:bottom-12 pointer-events-none">
        <motion.p {...rise(D.eyebrow, 10)}
          className="text-[#c49a3c] text-[10px] sm:text-[11px] tracking-[0.38em] uppercase">
          Lakefront residences · Two towers
        </motion.p>
        <motion.h1 {...rise(D.title, 24)}
          className="mt-2 sm:mt-3 text-white font-light leading-[1.02] text-[34px] sm:text-[56px] lg:text-[64px]"
          style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 2px 30px rgba(0,0,0,0.45)' }}>
          Choose your<br />
          <span className="italic text-[#e6cf93]">residence</span>
        </motion.h1>
        <motion.p {...rise(D.sub, 14)}
          className="mt-3 sm:mt-5 text-white/60 text-[12.5px] sm:text-[15px] font-light leading-relaxed max-w-[380px]">
          Two towers over the water. Pick one to explore its floors, plans
          and a walk-through of every home.
        </motion.p>
        <motion.div {...rise(D.links, 10)} className="mt-4 sm:mt-6 flex gap-5 sm:gap-7 pointer-events-auto">
          {onViewAmenities && (
            <button onClick={onViewAmenities} className="group flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-[#c49a3c] transition-colors duration-300">
              <span className="w-5 h-px bg-current opacity-60 group-hover:w-8 transition-all duration-300" />Amenities
            </button>
          )}
          {onCustomize && (
            <button onClick={onCustomize} className="group flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-[#c49a3c] transition-colors duration-300">
              <span className="w-5 h-px bg-current opacity-60 group-hover:w-8 transition-all duration-300" />Customize a room
            </button>
          )}
        </motion.div>
      </div>

      {/* Tower cards — right rail on desktop, bottom stack on phones */}
      <div className="absolute z-20 inset-x-4 bottom-4 flex flex-col gap-2
                      sm:inset-x-auto sm:right-8 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-[300px] sm:gap-3">
        {TOWERS.map((tower, i) => {
          const hot = hoveredId === tower.id;
          return (
            <motion.button key={tower.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: D.card + i * 0.14, duration: 0.9, ease }}
              onHoverStart={() => setHoveredId(tower.id)} onHoverEnd={() => setHoveredId(null)}
              onFocus={() => setHoveredId(tower.id)} onBlur={() => setHoveredId(null)}
              onClick={() => onSelectTower(tower)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              className="relative text-left rounded-2xl overflow-hidden transition-colors duration-300"
              style={{
                background: hot ? 'rgba(20,16,8,0.72)' : 'rgba(8,8,10,0.55)',
                border: `1px solid ${hot ? 'rgba(196,154,60,0.7)' : 'rgba(255,255,255,0.12)'}`,
                backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                boxShadow: hot ? '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(196,154,60,0.15) inset' : '0 12px 40px rgba(0,0,0,0.35)',
              }}>
              {/* gold sweep */}
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(196,154,60,0.14) 50%, transparent 70%)' }}
                initial={{ x: '-120%' }} animate={{ x: hot ? '120%' : '-120%' }} transition={{ duration: 0.8, ease }} />
              <div className="relative px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[#c49a3c] text-[9.5px] tracking-[0.3em] uppercase">
                    Tower {tower.id} <span className="text-white/25 ml-1 tracking-normal normal-case">{tower.id === 'A' ? '· left' : '· right'}</span>
                  </p>
                  <h3 className="text-white text-[17px] sm:text-[20px] font-light mt-0.5 leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}>{tower.name}</h3>
                  <p className="text-white/45 text-[11px] sm:text-xs mt-0.5">{tower.tagline} · {tower.units} residences</p>
                </div>
                <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-300
                  ${hot ? 'bg-[#c49a3c] text-black' : 'border border-white/20 text-white/70'}`}>→</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Hint */}
      <AnimatePresence>
        {!hintGone && (
          <motion.div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-[204px] sm:bottom-6 pointer-events-none
                                 flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ delay: D.hint, duration: 0.8 }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#c49a3c] animate-pulse" />
            <span className="text-white/55 text-[10px] tracking-[0.2em] uppercase">Live 3D · drag to look around</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
