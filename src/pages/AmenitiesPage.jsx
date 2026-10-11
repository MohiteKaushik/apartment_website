import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { XR, XROrigin, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import LoadingSpinner from '../components/LoadingSpinner';

/* Module-level XR store — separate instance from the apartment walkthrough */
const amenityXRStore = createXRStore({ emulate: false });

/* ─────────────────────────────────────────────────────────
   Data
───────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'infrastructure', numeral: 'I',   label: 'Infrastructure', blurb: 'The quiet systems that keep the towers running: security, power, water and parking.' },
  { id: 'health',         numeral: 'II',  label: 'Health & Wellness', blurb: 'A clubhouse gym, pools and courts, all a lift ride from home.' },
  { id: 'recreation',     numeral: 'III', label: 'Recreation', blurb: 'Rooms and lawns for the evenings and the occasions.' },
  { id: 'child',          numeral: 'IV',  label: 'Children & Pets', blurb: 'Safe, fenced, close by, and open till late.' },
  { id: 'lifestyle',      numeral: 'V',   label: 'Everyday Life', blurb: 'Work, shop and meet without leaving the gates.' },
];

/* image: path to a 16:9 background photo placed in public/assets/images/amenities/
   Highlighted on the right side, naturally darker on the left for text readability.
   Cards fall back to glassmorphism + emoji if the image is missing.             */
const AMENITIES = [
  /* Infrastructure & Security */
  { id: 'security',  category: 'infrastructure', icon: '🔐', name: 'Multi-tier Security',
    desc: 'Guarded main gates, CCTV surveillance, perimeter solar fencing, and app-based visitor management systems.',
    image: '/assets/images/amenities/amenity_security.jpg' },
  { id: 'power',     category: 'infrastructure', icon: '⚡', name: 'Power Backup',
    desc: 'Dedicated diesel generators ensuring uninterrupted electricity for common areas, elevators, and essential appliances.',
    image: '/assets/images/amenities/amenity_power.jpg' },
  { id: 'water',     category: 'infrastructure', icon: '💧', name: 'Water Systems',
    desc: 'In-house water treatment plants (WTP), sewage treatment plants (STP), and rainwater harvesting structures.',
    image: '/assets/images/amenities/amenity_water.jpg' },
  { id: 'parking',   category: 'infrastructure', icon: '🚗', name: 'Vehicle Parking',
    desc: 'Multilevel or basement covered car parking with dedicated EV charging stations.',
    image: '/assets/images/amenities/amenity_parking.jpg' },
  /* Health & Wellness */
  { id: 'gym',    category: 'health', icon: '🏋', name: 'Clubhouse Gym',
    desc: 'Fully equipped fitness centers with weights, cardio machines, and separate yoga/meditation decks.',
    image: '/assets/images/amenities/amenity_gym.jpg',
    model: '/assets/Amenities/gym.glb', modelLabel: 'Fitness Center' },
  { id: 'pool',   category: 'health', icon: '🏊', name: 'Swimming Pools',
    desc: 'Separate pools with luxury complexes featuring temperature-controlled indoor options.',
    image: '/assets/images/amenities/amenity_pool.jpg',
    model: '/assets/Amenities/pool.glb', modelLabel: 'Swimming Pool' },
  { id: 'sports', category: 'health', icon: '🏸', name: 'Sports Courts',
    desc: 'Multi-purpose courts for badminton (often indoor), tennis, and basketball.',
    image: '/assets/images/amenities/amenity_sports.jpg',
    model: '/assets/Amenities/BasketBall_Court.glb', modelLabel: 'Basketball Court' },
  /* Recreation & Social */
  { id: 'hall',   category: 'recreation', icon: '🎪', name: 'Multipurpose Hall',
    desc: 'Air-conditioned banquet halls or party lawns for resident meetups and private functions.',
    image: '/assets/images/amenities/amenity_hall.jpg' },
  { id: 'games',  category: 'recreation', icon: '🎱', name: 'Indoor Games Room',
    desc: 'Spaces equipped with table tennis, billiards, carrom, chess, and foosball tables.',
    image: '/assets/images/amenities/amenity_games.jpg' },
  { id: 'garden', category: 'recreation', icon: '🌿', name: 'Landscaped Gardens',
    desc: 'Manicured central lawns, seating plazas for senior citizens, and reflexology pathways.',
    image: '/assets/images/amenities/amenity_garden.jpg' },
  /* Child & Pet Friendly */
  { id: 'playground', category: 'child', icon: '🛝', name: "Children's Play Area",
    desc: 'Safe, rubberized-flooring playgrounds fitted with slides, swings, and climbing frames.',
    image: '/assets/images/amenities/amenity_playground.jpg' },
  { id: 'daycare',    category: 'child', icon: '👶', name: 'Daycare',
    desc: 'On-site childcare facilities catering to working parents within the community.',
    image: '/assets/images/amenities/amenity_daycare.jpg' },
  { id: 'petpark',    category: 'child', icon: '🐕', name: 'Pet Parks',
    desc: 'Enclosed, dedicated spaces with mini obstacle courses for residents to walk and exercise their pets.',
    image: '/assets/images/amenities/amenity_petpark.jpg' },
  /* Lifestyle Convenience */
  { id: 'cowork', category: 'lifestyle', icon: '💼', name: 'Co-working Spaces',
    desc: 'Wi-Fi enabled business lounges, conference rooms, and quiet pods for remote professionals.',
    image: '/assets/images/amenities/amenity_cowork.jpg',
    model: '/assets/Amenities/library_and_co_working_space_cafe.glb', modelLabel: 'Library & Co-working' },
  { id: 'retail', category: 'lifestyle', icon: '🛒', name: 'Convenience Retail',
    desc: 'Mini-supermarkets, pharmacy kiosks, and ATMs for everyday resident needs.',
    image: '/assets/images/amenities/amenity_retail.jpg' },
];

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
  const [isVRP, setIsVRP]             = useState(false);
  const orbitRef = useRef();

  useEffect(() => {
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
   Page pieces
───────────────────────────────────────────────────────── */
const ease = [0.22, 1, 0.36, 1];
const serif = { fontFamily: "'Playfair Display', serif" };

/* Appears when scrolled into view */
function Reveal({ children, className = '', delay = 0, y = 22, style }) {
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease, delay }}>
      {children}
    </motion.div>
  );
}

/* A large photo card for the spaces you can walk through in 3D / VR */
function FeatureCard({ amenity, index, onOpen }) {
  const [hot, setHot] = useState(false);
  return (
    <Reveal delay={index * 0.08}>
      <motion.button onClick={onOpen}
        onHoverStart={() => setHot(true)} onHoverEnd={() => setHot(false)}
        className="relative w-full text-left overflow-hidden rounded-2xl group"
        style={{ aspectRatio: '16 / 10', border: `1px solid ${hot ? 'rgba(196,154,60,0.65)' : 'rgba(255,255,255,0.1)'}`,
                 transition: 'border-color 0.4s' }}
        whileTap={{ scale: 0.99 }}>
        <motion.img src={amenity.image} alt="" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          animate={{ scale: hot ? 1.06 : 1 }} transition={{ duration: 1.2, ease }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.88) 100%)' }} />
        <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(196,154,60,0.45)', backdropFilter: 'blur(8px)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#c49a3c]" />
          <span className="text-[#e6cf93] text-[9px] tracking-[0.3em] uppercase">3D · VR</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-white/55 text-[10px] tracking-[0.32em] uppercase">{CATEGORIES.find(c => c.id === amenity.category)?.label}</p>
            <h3 className="text-white font-light text-[22px] sm:text-[26px] leading-tight mt-1" style={serif}>{amenity.modelLabel || amenity.name}</h3>
          </div>
          <span className={`flex-shrink-0 flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase transition-colors duration-300 ${hot ? 'text-[#c49a3c]' : 'text-white/60'}`}>
            Enter <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${hot ? 'bg-[#c49a3c] text-black' : 'border border-white/25'}`}>→</span>
          </span>
        </div>
      </motion.button>
    </Reveal>
  );
}

/* A photo tile for every other amenity */
function Tile({ amenity, index, onOpen }) {
  const [hot, setHot] = useState(false);
  const has3D = !!amenity.model;
  return (
    <Reveal delay={(index % 3) * 0.07}>
      <motion.div
        onHoverStart={() => setHot(true)} onHoverEnd={() => setHot(false)}
        onClick={has3D ? onOpen : undefined}
        className={`relative overflow-hidden rounded-xl aspect-[16/9] sm:aspect-[4/3] ${has3D ? 'cursor-pointer' : ''}`}
        style={{ border: `1px solid ${hot ? 'rgba(196,154,60,0.5)' : 'rgba(255,255,255,0.08)'}`, transition: 'border-color 0.4s' }}>
        <motion.img src={amenity.image} alt="" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          animate={{ scale: hot ? 1.05 : 1, filter: hot ? 'brightness(1.05)' : 'brightness(0.92)' }} transition={{ duration: 1.1, ease }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 72%, rgba(0,0,0,0.9) 100%)' }} />
        {has3D && (
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[#e6cf93] text-[8.5px] tracking-[0.28em] uppercase"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(196,154,60,0.4)' }}>3D</div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3 className="text-white font-light text-[17px] sm:text-[19px] leading-tight" style={serif}>{amenity.name}</h3>
          <motion.p className="text-white/55 text-[11.5px] leading-relaxed mt-1.5 hidden sm:block"
            initial={false} animate={{ opacity: hot ? 1 : 0, y: hot ? 0 : 6, height: hot ? 'auto' : 0 }} transition={{ duration: 0.35 }}>
            {amenity.desc}
          </motion.p>
          <p className="text-white/45 text-[11px] leading-relaxed mt-1 sm:hidden">{amenity.desc}</p>
        </div>
      </motion.div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function AmenitiesPage({ onBack, onEnquire }) {
  const [viewing3D, setViewing3D] = useState(null);
  const [scrolled, setScrolled]   = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const scroller = useRef(null);
  const featured = AMENITIES.filter(a => a.model);

  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    setScrolled(el.scrollTop > 40);
    // which section is under the top bar
    let cur = null;
    CATEGORIES.forEach(c => {
      const sec = el.querySelector(`[data-cat="${c.id}"]`);
      if (sec && sec.offsetTop - el.scrollTop < el.clientHeight * 0.45) cur = c.id;
    });
    setActiveCat(cur);
  };
  const jump = (id) => scroller.current?.querySelector(`[data-cat="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <motion.div className="absolute inset-0 bg-[#07070a]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }}>

      {/* ── Top bar ── */}
      <motion.div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 sm:px-8 h-[60px] sm:h-[68px]"
        style={{ background: scrolled ? 'rgba(7,7,10,0.78)' : 'transparent',
                 backdropFilter: scrolled ? 'blur(22px)' : 'none', WebkitBackdropFilter: scrolled ? 'blur(22px)' : 'none',
                 borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.07)' : 'transparent'}`, transition: 'background 0.5s, border-color 0.5s' }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} className="text-white/45 hover:text-[#c49a3c] transition-colors leading-none" style={{ fontSize: 22 }}
            whileHover={{ x: -4 }} whileTap={{ scale: 0.9 }} title="Go back">←</motion.button>
          <span className="text-white text-lg sm:text-xl font-light tracking-[0.25em]" style={serif}>VAYAM</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => jump(c.id)}
              className={`relative text-[10px] tracking-[0.26em] uppercase transition-colors duration-300 ${activeCat === c.id ? 'text-[#c49a3c]' : 'text-white/45 hover:text-white/80'}`}>
              {c.label}
              <span className="absolute -bottom-2 left-0 h-px bg-[#c49a3c] transition-all duration-400" style={{ width: activeCat === c.id ? '100%' : 0 }} />
            </button>
          ))}
        </div>
        {onEnquire && (
          <motion.button onClick={onEnquire}
            className="flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase rounded-full px-4 py-2"
            style={{ border: '1px solid rgba(196,154,60,0.5)', color: '#e6cf93', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
            whileHover={{ scale: 1.04, backgroundColor: 'rgba(196,154,60,0.15)' }} whileTap={{ scale: 0.96 }}>
            Enquire <span>→</span>
          </motion.button>
        )}
      </motion.div>

      {/* ── Scrolling page ── */}
      <div ref={scroller} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>

        {/* Hero */}
        <section className="relative h-[68vh] sm:h-[78vh] min-h-[440px] overflow-hidden">
          <motion.img src="/assets/images/amenities/amenity_pool.jpg" alt="" className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 14, ease: 'easeOut' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,7,10,0.5) 0%, rgba(7,7,10,0.05) 35%, rgba(7,7,10,0.55) 72%, #07070a 100%)' }} />
          <div className="absolute inset-y-0 left-0 w-2/3" style={{ background: 'linear-gradient(90deg, rgba(7,7,10,0.55), rgba(7,7,10,0))' }} />
          <div className="absolute left-5 right-5 sm:left-10 bottom-10 sm:bottom-16 max-w-[640px]">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.9, ease }}
              className="text-[#c49a3c] text-[10px] sm:text-[11px] tracking-[0.4em] uppercase">Amenities · {AMENITIES.length} spaces</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 1, ease }}
              className="mt-3 text-white font-light leading-[1.02] text-[40px] sm:text-[64px] lg:text-[76px]" style={{ ...serif, textShadow: '0 2px 30px rgba(0,0,0,0.5)' }}>
              Life, between<br /><span className="italic text-[#e6cf93]">the towers</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.9, ease }}
              className="mt-4 sm:mt-6 text-white/65 text-[13px] sm:text-[16px] font-light leading-relaxed max-w-[460px]">
              Fifteen spaces on the podium and in the clubhouse, from the lap pool to the co-working lounge. Four of them you can walk through in 3D or in a headset.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.9 }}
              className="mt-6 sm:mt-8 flex items-center gap-6 sm:gap-10">
              {[[AMENITIES.length, 'Amenities'], [COUNT_3D, 'In 3D · VR'], ['24/7', 'Security']].map(([n, l]) => (
                <div key={l}>
                  <p className="text-white text-[22px] sm:text-[28px] font-light leading-none" style={serif}>{n}</p>
                  <p className="text-white/40 text-[9px] sm:text-[10px] tracking-[0.3em] uppercase mt-1.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>
          <motion.div className="absolute right-6 sm:right-10 bottom-8 sm:bottom-14 hidden sm:flex flex-col items-center gap-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
            <span className="text-white/35 text-[9px] tracking-[0.35em] uppercase" style={{ writingMode: 'vertical-rl' }}>Scroll</span>
            <motion.span className="w-px h-10 bg-gradient-to-b from-[#c49a3c] to-transparent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2.2 }} />
          </motion.div>
        </section>

        {/* Walk through in 3D */}
        <section className="px-5 sm:px-10 pt-6 sm:pt-10 pb-10 sm:pb-16">
          <Reveal className="flex items-end justify-between gap-6 mb-6 sm:mb-8">
            <div>
              <p className="text-[#c49a3c] text-[10px] tracking-[0.4em] uppercase">Walk through</p>
              <h2 className="mt-2 text-white font-light text-[28px] sm:text-[40px] leading-none" style={serif}>
                Four spaces, <span className="italic text-[#e6cf93]">in 3D and VR</span>
              </h2>
            </div>
            <p className="hidden sm:block text-white/40 text-[13px] font-light max-w-[320px] leading-relaxed">
              Orbit on screen, or put on a headset and walk the room at full size.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {featured.map((a, i) => <FeatureCard key={a.id} amenity={a} index={i} onOpen={() => setViewing3D(a)} />)}
          </div>
        </section>

        {/* Categories */}
        {CATEGORIES.map((cat, ci) => {
          const items = AMENITIES.filter(a => a.category === cat.id);
          return (
            <section key={cat.id} data-cat={cat.id} className="px-5 sm:px-10 py-10 sm:py-16 scroll-mt-[68px]"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-12">
                <Reveal>
                  <div className="lg:sticky lg:top-24">
                    <p className="text-[#c49a3c] text-[11px] tracking-[0.4em]" style={serif}>{cat.numeral}</p>
                    <h2 className="mt-2 text-white font-light text-[26px] sm:text-[34px] leading-tight" style={serif}>{cat.label}</h2>
                    <div className="w-8 h-px bg-[#c49a3c]/60 my-4" />
                    <p className="text-white/45 text-[13px] font-light leading-relaxed max-w-[280px]">{cat.blurb}</p>
                    <p className="text-white/25 text-[10px] tracking-[0.3em] uppercase mt-5">{items.length} {items.length === 1 ? 'space' : 'spaces'}</p>
                  </div>
                </Reveal>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {items.map((a, i) => <Tile key={a.id} amenity={a} index={i} onOpen={() => setViewing3D(a)} />)}
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing */}
        <section className="relative px-5 sm:px-10 py-16 sm:py-24 overflow-hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="/assets/images/amenities/amenity_garden.jpg" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #07070a 20%, rgba(7,7,10,0.6) 70%, rgba(7,7,10,0.9))' }} />
          <Reveal className="relative max-w-[560px]">
            <p className="text-[#c49a3c] text-[10px] tracking-[0.4em] uppercase">See it in person</p>
            <h2 className="mt-3 text-white font-light text-[30px] sm:text-[44px] leading-tight" style={serif}>
              Come for a walk <span className="italic text-[#e6cf93]">around the podium</span>
            </h2>
            <p className="mt-4 text-white/55 text-[13px] sm:text-[15px] font-light leading-relaxed">
              Our team will show you the clubhouse, the pools and the lake walk, and answer anything about the homes.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {onEnquire && (
                <motion.button onClick={onEnquire} className="rounded-full bg-[#c49a3c] text-black text-[11px] tracking-[0.25em] uppercase px-6 py-3"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Book a visit →</motion.button>
              )}
              <motion.button onClick={onBack} className="rounded-full text-white/70 text-[11px] tracking-[0.25em] uppercase px-6 py-3"
                style={{ border: '1px solid rgba(255,255,255,0.2)' }} whileHover={{ scale: 1.03, color: '#fff' }} whileTap={{ scale: 0.97 }}>Back to the towers</motion.button>
            </div>
          </Reveal>
          <p className="relative mt-14 text-white/20 text-[9px] tracking-[0.35em] uppercase">Vayam · Lakefront residences</p>
        </section>
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
