import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { XR, XROrigin, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* Module-level XR store — separate instance from the apartment walkthrough */
const amenityXRStore = createXRStore({ emulate: false });

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

/* image: path to a 16:9 background photo placed in public/assets/images/amenities/
   Highlighted on the right side, naturally darker on the left for text readability.
   Cards fall back to glassmorphism + emoji if the image is missing.             */
const AMENITIES = [
  /* Infrastructure & Security */
  { id: 'security',  category: 'infrastructure', icon: '🔐', name: 'Multi-tier Security',
    desc: 'Guarded main gates, CCTV surveillance, perimeter solar fencing, and app-based visitor management systems.',
    image: '/assets/images/amenities/amenity_security.png' },
  { id: 'power',     category: 'infrastructure', icon: '⚡', name: 'Power Backup',
    desc: 'Dedicated diesel generators ensuring uninterrupted electricity for common areas, elevators, and essential appliances.',
    image: '/assets/images/amenities/amenity_power.png' },
  { id: 'water',     category: 'infrastructure', icon: '💧', name: 'Water Systems',
    desc: 'In-house water treatment plants (WTP), sewage treatment plants (STP), and rainwater harvesting structures.',
    image: '/assets/images/amenities/amenity_water.png' },
  { id: 'parking',   category: 'infrastructure', icon: '🚗', name: 'Vehicle Parking',
    desc: 'Multilevel or basement covered car parking with dedicated EV charging stations.',
    image: '/assets/images/amenities/amenity_parking.png' },
  /* Health & Wellness */
  { id: 'gym',    category: 'health', icon: '🏋', name: 'Clubhouse Gym',
    desc: 'Fully equipped fitness centers with weights, cardio machines, and separate yoga/meditation decks.',
    image: '/assets/images/amenities/amenity_gym.png',
    model: '/assets/Amenities/gym.glb', modelLabel: 'Fitness Center' },
  { id: 'pool',   category: 'health', icon: '🏊', name: 'Swimming Pools',
    desc: 'Separate pools with luxury complexes featuring temperature-controlled indoor options.',
    image: '/assets/images/amenities/amenity_pool.png',
    model: '/assets/Amenities/pool.glb', modelLabel: 'Swimming Pool' },
  { id: 'sports', category: 'health', icon: '🏸', name: 'Sports Courts',
    desc: 'Multi-purpose courts for badminton (often indoor), tennis, and basketball.',
    image: '/assets/images/amenities/amenity_sports.png',
    model: '/assets/Amenities/BasketBall_Court.glb', modelLabel: 'Basketball Court' },
  /* Recreation & Social */
  { id: 'hall',   category: 'recreation', icon: '🎪', name: 'Multipurpose Hall',
    desc: 'Air-conditioned banquet halls or party lawns for resident meetups and private functions.',
    image: '/assets/images/amenities/amenity_hall.png' },
  { id: 'games',  category: 'recreation', icon: '🎱', name: 'Indoor Games Room',
    desc: 'Spaces equipped with table tennis, billiards, carrom, chess, and foosball tables.',
    image: '/assets/images/amenities/amenity_games.png' },
  { id: 'garden', category: 'recreation', icon: '🌿', name: 'Landscaped Gardens',
    desc: 'Manicured central lawns, seating plazas for senior citizens, and reflexology pathways.',
    image: '/assets/images/amenities/amenity_garden.png' },
  /* Child & Pet Friendly */
  { id: 'playground', category: 'child', icon: '🛝', name: "Children's Play Area",
    desc: 'Safe, rubberized-flooring playgrounds fitted with slides, swings, and climbing frames.',
    image: '/assets/images/amenities/amenity_playground.png' },
  { id: 'daycare',    category: 'child', icon: '👶', name: 'Daycare',
    desc: 'On-site childcare facilities catering to working parents within the community.',
    image: '/assets/images/amenities/amenity_daycare.png' },
  { id: 'petpark',    category: 'child', icon: '🐕', name: 'Pet Parks',
    desc: 'Enclosed, dedicated spaces with mini obstacle courses for residents to walk and exercise their pets.',
    image: '/assets/images/amenities/amenity_petpark.png' },
  /* Lifestyle Convenience */
  { id: 'cowork', category: 'lifestyle', icon: '💼', name: 'Co-working Spaces',
    desc: 'Wi-Fi enabled business lounges, conference rooms, and quiet pods for remote professionals.',
    image: '/assets/images/amenities/amenity_cowork.png',
    model: '/assets/Amenities/library_and_co_working_space_cafe.glb', modelLabel: 'Library & Co-working' },
  { id: 'retail', category: 'lifestyle', icon: '🛒', name: 'Convenience Retail',
    desc: 'Mini-supermarkets, pharmacy kiosks, and ATMs for everyday resident needs.',
    image: '/assets/images/amenities/amenity_retail.png' },
];

const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));
const COUNT_3D  = AMENITIES.filter(a => a.model).length;

/* ─────────────────────────────────────────────────────────
   3D viewer: model component
   Uses useFrame (not useEffect) so that camera + OrbitControls
   refs are guaranteed to be live when we call update().
───────────────────────────────────────────────────────── */
function AmenityModelScene({ modelPath, orbitRef, onLoaded }) {
  const { scene } = useGLTF(modelPath);
  const groupRef   = useRef();
  const { camera } = useThree();
  const doneRef    = useRef(false);
  const cbRef      = useRef(onLoaded);
  useEffect(() => { cbRef.current = onLoaded; }, [onLoaded]);

  useFrame(() => {
    // Wait until both the group AND OrbitControls refs are ready
    if (doneRef.current || !groupRef.current || !orbitRef?.current) return;

    // Bounding box of the group (r3f has already updated matrixWorld before useFrame)
    const box = new THREE.Box3().setFromObject(groupRef.current);
    if (box.isEmpty()) return;   // geometry not yet in GPU — wait one more frame

    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim < 0.001) return;

    // Shift group so the model is centred at world origin
    groupRef.current.position.sub(center);

    // Position camera closer — roughly 1x model size away
    const dist = maxDim * 1.0;
    camera.position.set(dist * 0.62, Math.max(dist * 0.28, 1.2), dist * 0.62);
    camera.near = Math.max(0.05, maxDim * 0.004);
    camera.far  = maxDim * 100;
    camera.updateProjectionMatrix();

    // Tell OrbitControls about the new camera position (critical — avoids black screen)
    orbitRef.current.target.set(0, 0, 0);
    orbitRef.current.update();

    doneRef.current = true;
    setTimeout(() => cbRef.current?.(), 120);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

/* Orbit controls that step aside when VR session is active */
function AdaptiveOrbitControls({ orbitRef }) {
  const [vrActive, setVrActive] = useState(false);
  useEffect(() => amenityXRStore.subscribe(s => setVrActive(!!s.session)), []);
  if (vrActive) return null;
  return (
    <OrbitControls
      ref={orbitRef}
      enableDamping
      dampingFactor={0.07}
      autoRotate
      autoRotateSpeed={0.45}
      enablePan={false}
      minDistance={0.3}
      maxDistance={800}
    />
  );
}

/* VR locomotion: RIGHT stick = move, LEFT stick X/Y = rotate/height, B = exit VR */
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
      const gp = src.gamepad;
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
  const [isVRP, setIsVRP]             = useState(false);
  const orbitRef = useRef();

  useEffect(() => {
    navigator.xr?.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {});
    return amenityXRStore.subscribe(s => setIsVRP(!!s.session));
  }, []);

  const handleEnterVR = async () => {
    try { await amenityXRStore.enterVR(); }
    catch { alert('VR not supported on this device/browser.\nUse a VR headset with a WebXR browser (e.g. Meta Browser on Quest).'); }
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: '#060606' }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-white/6"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>{amenity.icon}</span>
          <div>
            <p className="text-[#c49a3c] text-[9px] tracking-[0.4em] uppercase">3D Explore</p>
            <h3 className="text-white font-light text-sm sm:text-base">{amenity.modelLabel || amenity.name}</h3>
          </div>
        </div>
        <motion.button onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/35 hover:text-white/70 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}>
          ✕
        </motion.button>
      </div>

      {/* Canvas */}
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

        <Canvas camera={{ fov: 58, position: [10, 5, 10] }}
          shadows={false}
          dpr={Math.min(window.devicePixelRatio, 1.5)}
          performance={{ min: 0.5 }}>
          <XR store={amenityXRStore}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 18, 10]} intensity={1.6} castShadow={false} />
            <directionalLight position={[-8, 8, -8]}  intensity={0.4} color="#aac4ff" />
            <pointLight       position={[0, 6, 0]}    intensity={0.5} color="#c49a3c" />

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

        {/* VR button — always visible; handleEnterVR catches unsupported gracefully */}
        {(
          <motion.button
            onClick={isVRP ? () => amenityXRStore.getState().session?.end() : handleEnterVR}
            className="absolute bottom-6 left-5 z-20 flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-semibold rounded-full"
            style={{
              padding: '9px 16px',
              background: isVRP ? 'rgba(196,154,60,0.15)' : 'rgba(0,0,0,0.65)',
              border: `1px solid ${isVRP ? 'rgba(196,154,60,0.7)' : 'rgba(196,154,60,0.5)'}`,
              color: '#c49a3c', backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          >
            <span style={{ fontSize: 15 }}>🥽</span>
            <span>{isVRP ? 'Exit VR' : 'Enter VR'}</span>
          </motion.button>
        )}

        {/* Controls hint */}
        {!isVRP && !loading && (
          <motion.div className="absolute bottom-6 right-5 z-20 text-right"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <p className="text-white/18 text-[10px] tracking-wider">Drag · Scroll · Pinch</p>
            <p className="text-white/10 text-[9px] tracking-widest uppercase mt-0.5">Orbit to explore</p>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Amenity card — supports background photos.
   Photo: object-fit cover, anchored right (subject shows on right).
   Left gradient overlay keeps text legible.
   Falls back to glassmorphism + emoji when the image is missing.
───────────────────────────────────────────────────────── */
function AmenityCard({ amenity, index, onView3D }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const catColor  = CAT_COLOR[amenity.category] || '#c49a3c';
  const has3D     = !!amenity.model;
  const hasImg    = !!amenity.image && !imgError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.04, 0.28) }}
      whileHover={{ scale: 1.035, transition: { duration: 0.22, ease: 'easeOut' } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        border: has3D ? '1px solid rgba(196,154,60,0.22)' : `1px solid ${catColor}16`,
        minHeight: hasImg ? 192 : 160,
        fontFamily: "inherit",
      }}
    >
      {/* ── Background layer ── */}
      {amenity.image && (
        <>
          {/* Dark base (visible while image loads, or if image fails) */}
          <div className="absolute inset-0"
            style={{ background: has3D ? 'rgba(18,12,4,0.98)' : 'rgba(8,8,12,0.98)' }} />

          {/* Photo — anchored to the right */}
          <img
            src={amenity.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: 'right center',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.55s ease',
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />

          {/* Left-to-right gradient: dark left (text readable) → transparent right (image visible)
              Lightens on hover so the photo reveals more vibrantly */}
          <div className="absolute inset-0" style={{
            background: isHovered
              ? 'linear-gradient(105deg, rgba(6,5,10,0.88) 0%, rgba(6,5,10,0.72) 35%, rgba(6,5,10,0.22) 62%, rgba(6,5,10,0.04) 100%)'
              : 'linear-gradient(105deg, rgba(6,5,10,0.97) 0%, rgba(6,5,10,0.92) 38%, rgba(6,5,10,0.55) 62%, rgba(6,5,10,0.15) 100%)',
            transition: 'background 0.28s ease',
          }} />
        </>
      )}

      {/* Glassmorphism base when there's no image */}
      {!amenity.image && (
        <div className="absolute inset-0"
          style={{
            background: has3D ? 'rgba(196,154,60,0.04)' : 'rgba(255,255,255,0.032)',
            backdropFilter: 'blur(18px)',
          }} />
      )}

      {/* Left category accent stripe */}
      <div className="absolute top-0 left-0 bottom-0 w-[2px]"
        style={{ background: `linear-gradient(to bottom, ${catColor}95, transparent)` }} />

      {/* 3D badge */}
      {has3D && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(196,154,60,0.38)', backdropFilter: 'blur(8px)' }}>
          <span className="w-1 h-1 rounded-full bg-[#c49a3c]" />
          <span className="text-[#c49a3c] text-[8px] tracking-[0.22em] uppercase font-bold">3D</span>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 px-5 pt-4 pb-3 pl-6">
        {/* Emoji — shown only when no background image */}
        {(!amenity.image || imgError) && (
          <span style={{ fontSize: 26, lineHeight: 1 }}>{amenity.icon}</span>
        )}
        <h3
          className={`text-white pr-10 leading-snug ${(!amenity.image || imgError) ? 'mt-3' : 'mt-0'}`}
          style={{
            fontSize: 14, fontWeight: 500, letterSpacing: '0.01em',
            textShadow: hasImg ? '0 1px 6px rgba(0,0,0,0.9)' : 'none',
          }}>
          {amenity.name}
        </h3>
        <p
          className="text-white/45 leading-relaxed mt-1.5"
          style={{
            fontSize: 12, fontWeight: 300, letterSpacing: '0.015em',
            textShadow: hasImg ? '0 1px 4px rgba(0,0,0,0.95)' : 'none',
          }}>
          {amenity.desc}
        </p>
      </div>

      {/* View in 3D CTA */}
      {has3D && (
        <div className="relative z-10 px-5 pb-4 pl-6 pt-1">
          <motion.button
            onClick={onView3D}
            className="flex items-center gap-1.5 text-[#c49a3c] text-xs tracking-[0.14em] uppercase font-medium hover:text-[#d4af6e] transition-colors"
            whileHover={{ x: 2 }}
          >
            <span className="text-[10px] opacity-70">◉</span>
            <span>View in 3D</span>
            <span>→</span>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function AmenitiesPage({ onBack, onEnquire }) {
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

        {/* ── Header ── */}
        <motion.div
          className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/5"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(22px)' }}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        >
          <motion.button onClick={onBack}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
            whileHover={{ x: -3 }}>
            <span style={{ fontSize: 20 }}>←</span>
            <span className="text-[10px] tracking-[0.22em] uppercase">Back</span>
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

          {/* Right: stats + enquire */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-center">
                <p className="text-white/55 text-sm font-light">{AMENITIES.length}</p>
                <p className="text-white/22 text-[8px] tracking-widest uppercase">Amenities</p>
              </div>
              <div className="w-px h-6 bg-white/8" />
              <div className="text-center">
                <p className="text-[#c49a3c] text-sm font-light">{COUNT_3D}</p>
                <p className="text-white/22 text-[8px] tracking-widest uppercase">In 3D · VR</p>
              </div>
              <div className="w-px h-6 bg-white/8" />
            </div>
            {onEnquire && (
              <motion.button
                onClick={onEnquire}
                className="flex items-center gap-1.5 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-medium rounded-lg px-3 py-1.5 relative overflow-hidden group"
                style={{
                  background: 'rgba(196,154,60,0.12)',
                  border: '1px solid rgba(196,154,60,0.35)',
                  color: '#c49a3c',
                  fontFamily: "inherit",
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c49a3c]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600" />
                <span className="relative">Enquire</span>
                <span className="relative">→</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── Category filter ── */}
        <motion.div
          className="flex-shrink-0 flex items-center gap-2 px-5 sm:px-8 py-3 border-b border-white/4 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', background: 'rgba(0,0,0,0.28)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
        >
          {CATEGORIES.map(cat => {
            const active = activeCat === cat.id;
            return (
              <motion.button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs tracking-wide transition-all duration-200"
                style={{
                  background: active ? cat.color : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? cat.color : 'rgba(255,255,255,0.08)'}`,
                  color:   active ? '#000' : 'rgba(255,255,255,0.42)',
                  fontWeight: active ? 600 : 400,
                }}
                whileTap={{ scale: 0.92 }}>
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Cards grid ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-5">

          <AnimatePresence mode="wait">
            <motion.p key={activeCat}
              className="text-white/18 text-[9px] tracking-[0.4em] uppercase mb-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              {activeCat === 'all'
                ? `All ${AMENITIES.length} amenities`
                : `${filtered.length} ${CATEGORIES.find(c => c.id === activeCat)?.label} amenities`}
            </motion.p>
          </AnimatePresence>

          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

          {filtered.some(a => a.model) && (
            <motion.p
              className="text-center text-white/10 text-[9px] tracking-[0.35em] uppercase mt-8 pb-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              Cards marked 3D are fully explorable — click &ldquo;View in 3D&rdquo; or enter VR
            </motion.p>
          )}
        </div>

      </div>

      {/* 3D viewer overlay */}
      <AnimatePresence>
        {viewing3D && (
          <AmenityViewer key={viewing3D.id} amenity={viewing3D} onClose={() => setViewing3D(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
