import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { XR, XROrigin, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* Module-level XR store — separate instance from the apartment walkthrough */
const amenityXRStore = createXRStore();

/* ─────────────────────────────────────────────────────────
   Data
───────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',            label: 'All',            icon: '✦', color: '#c49a3c' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🛡', color: '#6B9EFF' },
  { id: 'health',         label: 'Health',         icon: '💪', color: '#5EC27D' },
  { id: 'recreation',     label: 'Recreation',     icon: '🎭', color: '#F0A84E' },
  { id: 'child',          label: 'Child & Pet',    icon: '🌸', color: '#F07ED5' },
  { id: 'lifestyle',      label: 'Lifestyle',      icon: '☕', color: '#A78BFA' },
];

const AMENITIES = [
  /* Infrastructure & Security */
  { id: 'security',  category: 'infrastructure', icon: '🔐', name: 'Multi-tier Security',
    desc: 'Guarded main gates, CCTV surveillance, perimeter solar fencing, and app-based visitor management systems.' },
  { id: 'power',     category: 'infrastructure', icon: '⚡', name: 'Power Backup',
    desc: 'Dedicated diesel generators ensuring uninterrupted electricity for common areas, elevators, and essential appliances.' },
  { id: 'water',     category: 'infrastructure', icon: '💧', name: 'Water Systems',
    desc: 'In-house water treatment plants (WTP), sewage treatment plants (STP), and rainwater harvesting structures.' },
  { id: 'parking',   category: 'infrastructure', icon: '🚗', name: 'Vehicle Parking',
    desc: 'Multilevel or basement covered car parking with dedicated EV charging stations.' },
  /* Health & Wellness */
  { id: 'gym',    category: 'health', icon: '🏋', name: 'Clubhouse Gym',
    desc: 'Fully equipped fitness centers with weights, cardio machines, and separate yoga/meditation decks.',
    model: '/assets/Amenities/gym.glb', modelLabel: 'Fitness Center' },
  { id: 'pool',   category: 'health', icon: '🏊', name: 'Swimming Pools',
    desc: 'Separate pools with luxury complexes featuring temperature-controlled indoor options.',
    model: '/assets/Amenities/pool.glb', modelLabel: 'Swimming Pool' },
  { id: 'sports', category: 'health', icon: '🏸', name: 'Sports Courts',
    desc: 'Multi-purpose courts for badminton (often indoor), tennis, and basketball.',
    model: '/assets/Amenities/BasketBall_Court.glb', modelLabel: 'Basketball Court' },
  /* Recreation & Social */
  { id: 'hall',   category: 'recreation', icon: '🎪', name: 'Multipurpose Hall',
    desc: 'Air-conditioned banquet halls or party lawns for resident meetups and private functions.' },
  { id: 'games',  category: 'recreation', icon: '🎱', name: 'Indoor Games Room',
    desc: 'Spaces equipped with table tennis, billiards, carrom, chess, and foosball tables.' },
  { id: 'garden', category: 'recreation', icon: '🌿', name: 'Landscaped Gardens',
    desc: 'Manicured central lawns, seating plazas for senior citizens, and reflexology pathways.' },
  /* Child & Pet Friendly */
  { id: 'playground', category: 'child', icon: '🛝', name: "Children's Play Area",
    desc: 'Safe, rubberized-flooring playgrounds fitted with slides, swings, and climbing frames.' },
  { id: 'daycare',    category: 'child', icon: '👶', name: 'Daycare',
    desc: 'On-site childcare facilities catering to working parents within the community.' },
  { id: 'petpark',    category: 'child', icon: '🐕', name: 'Pet Parks',
    desc: 'Enclosed, dedicated spaces with mini obstacle courses for residents to walk and exercise their pets.' },
  /* Lifestyle Convenience */
  { id: 'cowork', category: 'lifestyle', icon: '💼', name: 'Co-working Spaces',
    desc: 'Wi-Fi enabled business lounges, conference rooms, and quiet pods for remote professionals.',
    model: '/assets/Amenities/library_and_co_working_space_cafe.glb', modelLabel: 'Library & Co-working' },
  { id: 'retail', category: 'lifestyle', icon: '🛒', name: 'Convenience Retail',
    desc: 'Mini-supermarkets, pharmacy kiosks, and ATMs for everyday resident needs.' },
];

const CAT_COLOR  = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));
const COUNT_3D   = AMENITIES.filter(a => a.model).length;

/* ─────────────────────────────────────────────────────────
   3D helpers
───────────────────────────────────────────────────────── */

/* Loads the GLB, centres it at world origin via a group, and fits the camera */
function AmenityModelScene({ modelPath, orbitRef, onLoaded }) {
  const { scene } = useGLTF(modelPath);
  const groupRef  = useRef();
  const { camera } = useThree();

  useEffect(() => {
    if (!groupRef.current) return;
    scene.updateMatrixWorld(true);

    const box    = new THREE.Box3().setFromObject(scene);
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 10;

    // Shift the group so the model is centred at world origin
    groupRef.current.position.set(-center.x, -center.y, -center.z);

    // Position camera at a comfortable viewing distance
    const dist = maxDim * 1.5;
    camera.position.set(dist * 0.65, dist * 0.38, dist * 0.65);
    camera.near = Math.max(0.05, maxDim * 0.004);
    camera.far  = maxDim * 80;
    camera.updateProjectionMatrix();

    if (orbitRef?.current) {
      orbitRef.current.target.set(0, 0, 0);
      orbitRef.current.update();
    }

    setTimeout(() => onLoaded?.(), 300);
  }, [modelPath]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

/* OrbitControls that disappear when VR is presenting (headset takes over camera) */
function AdaptiveOrbitControls({ orbitRef }) {
  const [vrActive, setVrActive] = useState(false);
  useEffect(() => amenityXRStore.subscribe(s => setVrActive(!!s.session)), []);
  if (vrActive) return null;
  return (
    <OrbitControls
      ref={orbitRef}
      enableDamping
      dampingFactor={0.06}
      autoRotate
      autoRotateSpeed={0.5}
      enablePan={false}
      minDistance={0.3}
      maxDistance={500}
    />
  );
}

/* VR locomotion for the amenity viewer:
   RIGHT stick → move · LEFT stick X → rotate · LEFT stick Y → height · B → exit VR */
function AmenityVRMove({ speed = 3 }) {
  const originRef  = useRef(null);
  const btnPrevRef = useRef({});

  useFrame(({ gl }, delta) => {
    const session = amenityXRStore.getState().session;
    if (!session || !originRef.current) return;

    const xrCam = gl.xr.getCamera ? gl.xr.getCamera() : null;
    const fwd   = new THREE.Vector3();
    if (xrCam) xrCam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() > 0.0001) fwd.normalize();
    const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));

    for (const src of session.inputSources) {
      const gp   = src.gamepad;
      if (!gp) continue;
      const hand = src.handedness;

      if (gp.axes && gp.axes.length >= 2) {
        const n  = gp.axes.length;
        const sx = n >= 4 ? gp.axes[2] : gp.axes[0];
        const sy = n >= 4 ? gp.axes[3] : gp.axes[1];

        if (hand === 'right') {
          const mx = Math.abs(sx) > 0.1 ? sx : 0;
          const mz = Math.abs(sy) > 0.1 ? sy : 0;
          if (mx !== 0 || mz !== 0) {
            originRef.current.position.addScaledVector(fwd, -mz * speed * delta);
            originRef.current.position.addScaledVector(rgt,  mx * speed * delta);
          }
        } else if (hand === 'left') {
          const rx = Math.abs(sx) > 0.12 ? sx : 0;
          if (rx !== 0) originRef.current.rotation.y -= rx * 1.5 * delta;
          const hy = Math.abs(sy) > 0.15 ? sy : 0;
          if (hy !== 0) {
            originRef.current.position.y = Math.max(-1.5, Math.min(3,
              originRef.current.position.y - hy * 1.5 * delta
            ));
          }
        }
      }

      if (gp.buttons) {
        for (let i = 0; i < gp.buttons.length; i++) {
          const key = `${hand}_${i}`;
          const now = gp.buttons[i].pressed;
          if (now && !btnPrevRef.current[key] && hand === 'right' && i === 5) {
            amenityXRStore.getState().session?.end();
          }
          btnPrevRef.current[key] = now;
        }
      }
    }
  });

  return <XROrigin ref={originRef} position={[0, 0, 12]} />;
}

/* ─────────────────────────────────────────────────────────
   Full-screen 3D viewer overlay
───────────────────────────────────────────────────────── */
function AmenityViewer({ amenity, onClose }) {
  const [loading, setLoading]         = useState(true);
  const [vrSupported, setVrSupported] = useState(false);
  const [isVRPresenting, setIsVRP]    = useState(false);
  const orbitRef = useRef();

  useEffect(() => {
    navigator.xr?.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {});
    return amenityXRStore.subscribe(s => setIsVRP(!!s.session));
  }, []);

  const handleEnterVR = async () => {
    try { await amenityXRStore.enterVR(); }
    catch { alert('VR is not supported on this device or browser.\nUse a VR headset with a WebXR-compatible browser.'); }
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: '#060606' }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-white/6"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>{amenity.icon}</span>
          <div>
            <p className="text-[#c49a3c] text-[9px] tracking-[0.4em] uppercase">3D Explore</p>
            <h3 className="text-white font-light text-sm sm:text-base leading-tight">
              {amenity.modelLabel || amenity.name}
            </h3>
          </div>
        </div>
        <motion.button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/35 hover:text-white/70 transition-all duration-200"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative">
        <AnimatePresence>
          {loading && (
            <motion.div className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: '#060606' }}
              exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              <LoadingSpinner label="Loading 3D model…" />
            </motion.div>
          )}
        </AnimatePresence>

        <Canvas
          camera={{ fov: 58 }}
          shadows={false}
          dpr={Math.min(window.devicePixelRatio, 1.5)}
          performance={{ min: 0.5 }}
        >
          <XR store={amenityXRStore}>
            <ambientLight intensity={0.75} />
            <directionalLight position={[8, 15, 8]}  intensity={1.6} />
            <directionalLight position={[-6, 8, -6]} intensity={0.4} color="#aac4ff" />
            <pointLight       position={[0, 5, 0]}   intensity={0.6} color="#c49a3c" />

            <Suspense fallback={null}>
              <AmenityModelScene
                modelPath={amenity.model}
                orbitRef={orbitRef}
                onLoaded={() => setLoading(false)}
              />
              <Environment preset="apartment" />
            </Suspense>

            <AdaptiveOrbitControls orbitRef={orbitRef} />
            <AmenityVRMove speed={3} />
          </XR>
        </Canvas>

        {/* VR Entry button */}
        {vrSupported && (
          <motion.button
            onClick={isVRPresenting
              ? () => amenityXRStore.getState().session?.end()
              : handleEnterVR}
            className="absolute bottom-6 left-5 z-20 flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-semibold rounded-full"
            style={{
              padding: '9px 16px',
              background: isVRPresenting ? 'rgba(196,154,60,0.15)' : 'rgba(0,0,0,0.65)',
              border: `1px solid ${isVRPresenting ? 'rgba(196,154,60,0.7)' : 'rgba(196,154,60,0.5)'}`,
              color: '#c49a3c',
              backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span style={{ fontSize: 15 }}>🥽</span>
            <span>{isVRPresenting ? 'Exit VR' : 'Enter VR'}</span>
          </motion.button>
        )}

        {/* Controls hint */}
        {!isVRPresenting && !loading && (
          <motion.div
            className="absolute bottom-6 right-5 z-20 text-right"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          >
            <p className="text-white/18 text-[10px] tracking-wider">Drag · Scroll · Pinch</p>
            <p className="text-white/10 text-[9px] tracking-widest uppercase mt-0.5">Orbit to explore</p>
          </motion.div>
        )}

        {/* VR active indicator */}
        {isVRPresenting && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: 'rgba(196,154,60,0.15)', border: '1px solid rgba(196,154,60,0.4)',
                       backdropFilter: 'blur(12px)' }}>
              <span className="w-2 h-2 rounded-full bg-[#c49a3c] animate-pulse" />
              <span className="text-[#c49a3c] text-xs tracking-widest uppercase">VR Mode Active</span>
            </div>
            <div className="px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                       border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-white/40 text-[10px] tracking-wider">B → Exit VR</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Amenity card
───────────────────────────────────────────────────────── */
function AmenityCard({ amenity, index, onView3D }) {
  const catColor = CAT_COLOR[amenity.category] || '#c49a3c';
  const has3D    = !!amenity.model;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.04, 0.28) }}
      className="relative rounded-xl overflow-hidden flex flex-col group"
      style={{
        background: has3D
          ? 'rgba(196,154,60,0.04)'
          : 'rgba(255,255,255,0.032)',
        backdropFilter: 'blur(18px)',
        border: has3D
          ? '1px solid rgba(196,154,60,0.2)'
          : `1px solid ${catColor}14`,
        boxShadow: has3D ? '0 2px 20px rgba(196,154,60,0.04)' : 'none',
        minHeight: 148,
      }}
      whileHover={{ y: -3, transition: { duration: 0.16 } }}
    >
      {/* Category accent stripe */}
      <div className="absolute top-0 left-0 bottom-0 w-[2px]"
        style={{ background: `linear-gradient(to bottom, ${catColor}90, transparent)` }} />

      {/* 3D badge */}
      {has3D && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded"
          style={{ background: 'rgba(196,154,60,0.1)', border: '1px solid rgba(196,154,60,0.3)' }}>
          <span className="w-1 h-1 rounded-full bg-[#c49a3c]" />
          <span className="text-[#c49a3c] text-[8px] tracking-[0.22em] uppercase font-bold">3D</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-5 pt-4 pb-3 pl-6">
        <span style={{ fontSize: 26, lineHeight: 1 }}>{amenity.icon}</span>
        <h3 className="text-white text-sm font-medium mt-3 mb-1.5 pr-10 leading-snug">
          {amenity.name}
        </h3>
        <p className="text-white/38 text-xs leading-relaxed">{amenity.desc}</p>
      </div>

      {/* View in 3D CTA */}
      {has3D && (
        <div className="px-5 pb-4 pl-6 pt-1">
          <motion.button
            onClick={onView3D}
            className="flex items-center gap-1.5 text-[#c49a3c] text-xs tracking-[0.14em] uppercase font-medium hover:text-[#d4af6e] transition-colors group/btn"
            whileHover={{ x: 2 }}
          >
            <span className="text-[10px] opacity-70">◉</span>
            <span>View in 3D</span>
            <motion.span
              className="inline-block"
              initial={{ x: 0 }} whileHover={{ x: 3 }}
            >→</motion.span>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function AmenitiesPage({ onBack }) {
  const [activeCat, setActiveCat] = useState('all');
  const [viewing3D, setViewing3D] = useState(null);

  const filtered = activeCat === 'all'
    ? AMENITIES
    : AMENITIES.filter(a => a.category === activeCat);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
    >
      <PageBackground src="/assets/images/bg_unit.png" intensity="heavy" />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ── Page header ─────────────────────────────── */}
        <motion.div
          className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/5"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(22px)' }}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        >
          <motion.button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-xs tracking-[0.22em] uppercase"
            whileHover={{ x: -2 }}
          >
            ← Back
          </motion.button>

          <div className="text-center">
            <h1 className="text-white font-light tracking-[0.45em] uppercase text-sm sm:text-lg"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              Amenities
            </h1>
            <p className="text-[#c49a3c] text-[8px] sm:text-[9px] tracking-[0.5em] uppercase mt-0.5">
              World-class Facilities
            </p>
          </div>

          {/* Stats — desktop */}
          <div className="hidden sm:flex items-center gap-5">
            <div className="text-center">
              <p className="text-white/55 text-sm font-light">{AMENITIES.length}</p>
              <p className="text-white/22 text-[8px] tracking-widest uppercase">Amenities</p>
            </div>
            <div className="w-px h-7 bg-white/8" />
            <div className="text-center">
              <p className="text-[#c49a3c] text-sm font-light">{COUNT_3D}</p>
              <p className="text-white/22 text-[8px] tracking-widest uppercase">In 3D · VR</p>
            </div>
          </div>
          {/* Spacer for mobile alignment */}
          <div className="sm:hidden w-12" />
        </motion.div>

        {/* ── Category filter pills ────────────────────── */}
        <motion.div
          className="flex-shrink-0 flex items-center gap-2 px-5 sm:px-8 py-3 border-b border-white/4 overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            background: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(8px)',
          }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
        >
          {CATEGORIES.map(cat => {
            const active = activeCat === cat.id;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs tracking-wide transition-all duration-200"
                style={{
                  background: active ? cat.color : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? cat.color : 'rgba(255,255,255,0.08)'}`,
                  color:   active ? '#000' : 'rgba(255,255,255,0.42)',
                  fontWeight: active ? 600 : 400,
                }}
                whileTap={{ scale: 0.92 }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Cards grid ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-5">

          {/* Category label */}
          <AnimatePresence mode="wait">
            <motion.p
              key={activeCat}
              className="text-white/18 text-[9px] tracking-[0.4em] uppercase mb-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeCat === 'all'
                ? `Showing all ${AMENITIES.length} amenities`
                : `${filtered.length} ${CATEGORIES.find(c => c.id === activeCat)?.label} amenities`}
            </motion.p>
          </AnimatePresence>

          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((amenity, i) => (
                <AmenityCard
                  key={amenity.id}
                  amenity={amenity}
                  index={i}
                  onView3D={() => setViewing3D(amenity)}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Bottom note */}
          {filtered.some(a => a.model) && (
            <motion.p
              className="text-center text-white/12 text-[9px] tracking-[0.35em] uppercase mt-8 pb-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            >
              Cards marked 3D are fully explorable — click &ldquo;View in 3D&rdquo; or enter VR
            </motion.p>
          )}
        </div>
      </div>

      {/* ── 3D viewer overlay ── */}
      <AnimatePresence>
        {viewing3D && (
          <AmenityViewer
            key={viewing3D.id}
            amenity={viewing3D}
            onClose={() => setViewing3D(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
