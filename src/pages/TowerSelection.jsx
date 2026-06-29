import React, { Suspense, useState, useRef, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import NavBar from '../components/NavBar';
// import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* ── 360° equirectangular background ──
   Loads bg_walkthrough.png as an env sphere — rotates naturally with the
   OrbitControls camera so it feels like a real surrounding landscape.
   backgroundBlurriness softens it so the tower stays the focal point. */
function SceneBackground() {
  const texture = useLoader(THREE.TextureLoader, '/assets/images/bg_walkthrough.png');
  const { scene } = useThree();
  useEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    // Blur available in Three.js r155+; safe no-op on older builds
    scene.backgroundBlurriness = 0;   /* 0 = sharp, 0.5 = heavy blur — adjust here */
    return () => {
      scene.background = null;
      scene.backgroundBlurriness = 0;
    };
  }, [texture, scene]);
  return null;
}

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
function TowerGLB({ hoveredId }) {
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
    const MANUAL_Y_OFFSET = -10;   /* e.g. -1 moves it 1 unit lower, +1 raises it */

    scene.scale.set(0.01, 0.01, 0.01);
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

  return <primitive object={scene} scale={0.01} />;
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

/* ── Camera matches video last-frame angle ──
   Video ends showing towers from front-right elevated view.
   We start the 3D camera at the same perspective so the reveal feels
   like the freeze-frame coming to life. */
function CameraSetup() {
  const { camera } = useThree();
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    // Front-elevated-right angle → matches video aerial shot
    /* ── Tune these 3 values to adjust the opening view ──
       position(x, y, z): x=left/right, y=height above ground, z=distance back
       lookAt(x, y, z)  : what the camera points at (y = halfway up tower)
       fov              : 45–60 is natural, higher = fisheye               */
    camera.position.set(10, 2, 24);  // low Y = near-ground level → tower looks grounded
    camera.lookAt(0, 8, 0);          // aim at mid-tower height
    camera.fov = 62;
    camera.updateProjectionMatrix();
    done.current = true;
  });
  return null;
}

/* ── Smoothly lerp orbit pivot height ── */
function TargetRig({ controlsRef, targetY }) {
  useFrame(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.y +=
      (targetY - controlsRef.current.target.y) * 0.08;
    controlsRef.current.update();
  });
  return null;
}

function TowerScene({ controlsRef, targetY, hoveredId }) {
  return (
    <>
      <CameraSetup />
      <TargetRig controlsRef={controlsRef} targetY={targetY} />
      {/* 360° photo background — loads fast, no poly count */}
      <Suspense fallback={null}>
        <SceneBackground />
      </Suspense>
      <ambientLight intensity={2.5} />
      <directionalLight position={[8, 12, 6]} intensity={5.1} color="#c49a3c" />
      <pointLight position={[4, 12, 6]} intensity={18.5} color="#c49a3c" />
      <pointLight position={[4, 3, 4]}  intensity={0.3} color="#ffffff" />
      <ModelErrorBoundary fallback={<PlaceholderTower />}>
        <Suspense fallback={<PlaceholderTower />}>
          <TowerGLB hoveredId={hoveredId} />
        </Suspense>
      </ModelErrorBoundary>
    </>
  );
}

/* ── Main page ── */
export default function TowerSelection({ onSelectTower, onViewAmenities }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [loading3D, setLoading3D] = useState(true);
  const [targetY, setTargetY]     = useState(7);  // orbit pivot at ~mid-tower
  const controlsRef               = useRef();

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      {/* Dark bg for the right-side card panel — canvas has its own 360° env */}
      <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <NavBar step={2} />

        <div className="flex flex-col-reverse sm:flex-row flex-1 overflow-hidden">

          {/* ── 3D Viewer ── */}
          <motion.div
            className="flex-1 relative min-h-0"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            {/* Badge */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 glass-dark px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c49a3c] animate-pulse" />
              <span className="text-[#c49a3c] text-xs tracking-widest uppercase">Live 3D</span>
            </div>

            {/* Hover hint */}
            <AnimatePresence>
              {!hoveredId && !loading3D && (
                <motion.div
                  className="absolute top-4 right-4 z-10 glass-dark px-3 py-1.5 rounded-full border border-white/8"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: 1.5 }}
                >
                  <span className="text-white/30 text-xs tracking-wider">Tap or hover a tower to explore</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading overlay */}
            <AnimatePresence>
              {loading3D && (
                <motion.div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
                  exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                >
                  <LoadingSpinner label="Rendering model…" />
                </motion.div>
              )}
            </AnimatePresence>

            <Canvas
              camera={{ position: [0, 3, 3], fov: 35 }}
              shadows={false}
              dpr={Math.min(window.devicePixelRatio, 1.5)}
              performance={{ min: 0.5 }}
              onCreated={() => setTimeout(() => setLoading3D(false), 800)}
            >
              <TowerScene
                controlsRef={controlsRef}
                targetY={targetY}
                hoveredId={hoveredId}
              />
              <OrbitControls
                ref={controlsRef}
                autoRotate
                autoRotateSpeed={0.8}
                enablePan={false}
                enableDamping
                dampingFactor={0.07}
                rotateSpeed={0.8}
                zoomSpeed={1.2}
                minDistance={3}
                maxDistance={15}
                minPolarAngle={Math.PI / 8}
                maxPolarAngle={Math.PI / 2.2}
              />
            </Canvas>

            {/* ── Seamless reveal overlay ──
                Starts black (matching IntroVideo's fade-to-black),
                then fades out to reveal the 3D scene behind it.
                Delay 200ms so the 3D has a frame to render first. */}
            <motion.div
              className="absolute inset-0 bg-black pointer-events-none"
              style={{ zIndex: 15 }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: 'easeInOut' }}
            />

            {/* Camera height slider */}
            <motion.div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', padding: '10px 18px', borderRadius: 40, border: '1px solid rgba(255,255,255,0.08)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Camera Height
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => setTargetY(v => Math.max(0, v - 2))}
                  style={{ color: '#c49a3c', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>−</button>
                <input type="range" min={0} max={30} step={0.5} value={targetY}
                  onChange={e => setTargetY(parseFloat(e.target.value))}
                  style={{ width: 120, accentColor: '#c49a3c', cursor: 'pointer' }} />
                <button onClick={() => setTargetY(v => Math.min(30, v + 2))}
                  style={{ color: '#c49a3c', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>+</button>
                <span style={{ color: '#c49a3c', fontSize: 10, fontFamily: 'monospace', minWidth: 32 }}>
                  {targetY.toFixed(1)}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Tower cards ── */}
          <div className="w-full sm:w-80 flex-shrink-0 flex flex-col sm:justify-center gap-3 p-4 sm:p-6 overflow-y-auto max-h-[44vh] sm:max-h-none">
            <motion.div className="hidden sm:block mb-2"
              initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p className="text-[#c49a3c] text-xs tracking-[0.35em] uppercase mb-2">Select Your Tower</p>
              <h2 className="text-white text-4xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
                Choose Residence
              </h2>
              <div className="w-10 h-px bg-[#c49a3c]/60 mt-3" />
            </motion.div>
            {/* Mobile compact title */}
            <p className="flex sm:hidden text-[#c49a3c] text-xs tracking-[0.3em] uppercase">Choose Your Tower</p>

            {/* Amenities shortcut — mobile only (desktop version below) */}
            {onViewAmenities && (
              <motion.button
                onClick={onViewAmenities}
                className="flex sm:hidden items-center justify-center gap-2 w-full py-2 text-[10px] tracking-[0.22em] uppercase text-white/30 rounded-lg border border-white/8 hover:text-white/55 hover:border-[#c49a3c]/30 transition-all duration-300"
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              >
                <span className="text-[#c49a3c]/50">✦</span>
                <span>Explore Amenities</span>
              </motion.button>
            )}

            {TOWERS.map((tower, i) => {
              const isHovered = hoveredId === tower.id;
              return (
                <motion.div
                  key={tower.id}
                  className={`relative glass-dark rounded-xl p-5 cursor-pointer border overflow-hidden transition-all duration-300
                    ${isHovered ? 'border-[#c49a3c]/70' : 'border-white/6 hover:border-white/20'}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.12 }}
                  onHoverStart={() => setHoveredId(tower.id)}
                  onHoverEnd={() => setHoveredId(null)}
                  onClick={() => onSelectTower(tower)}
                  whileHover={{ scale: 1.025, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {/* Gold sweep */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-[#c49a3c]/0 via-[#c49a3c]/8 to-[#c49a3c]/0"
                    initial={{ x: '-100%' }}
                    animate={{ x: isHovered ? '100%' : '-100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  {/* Left/Right label */}
                  <div className="relative flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[#c49a3c] text-[10px] tracking-[0.25em] uppercase">Tower {tower.id}</p>
                        <span className="text-white/20 text-[10px]">
                          {tower.id === 'A' ? '← Left' : 'Right →'}
                        </span>
                      </div>
                      <h3 className="text-white text-lg font-light">{tower.name}</h3>
                      <p className="text-white/40 text-xs mt-1">{tower.tagline}</p>
                    </div>
                    <span className="text-white/20 text-xs tabular-nums">{tower.units} units</span>
                  </div>

                  {/* Glow indicator dot */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        className="absolute top-3 right-3 flex items-center gap-1.5"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c49a3c] animate-pulse" />
                        <span className="text-[#c49a3c] text-[9px] tracking-widest uppercase">Highlighting</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    className={`relative w-full mt-1 py-2.5 text-xs tracking-[0.2em] uppercase rounded-sm transition-all duration-300
                      ${isHovered ? 'bg-[#c49a3c] text-black font-semibold' : 'border border-[#c49a3c]/40 text-[#c49a3c]'}`}
                  >
                    Select Floor →
                  </motion.button>
                </motion.div>
              );
            })}
            {/* Amenities link — desktop */}
            {onViewAmenities && (
              <motion.button
                onClick={onViewAmenities}
                className="hidden sm:flex items-center justify-center gap-2 w-full mt-1 py-2.5 text-[10px] tracking-[0.22em] uppercase text-white/28 rounded-lg border border-white/7 hover:text-[#c49a3c]/70 hover:border-[#c49a3c]/25 transition-all duration-300"
                whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
              >
                <span className="text-[#c49a3c]/45 text-[9px]">✦</span>
                <span>Explore Amenities</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
