import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* ─────────────────────────────────────────────────────────
   First-person camera
   • WASD / arrow keys for keyboard users
   • externalKeysRef: D-pad buttons inject keys here
   • Touch-drag on canvas: look around (mobile)
   • Mouse pointer-lock: look around (desktop)
───────────────────────────────────────────────────────── */
function FirstPersonController({ speed = 5, eyeHeightRef, externalKeysRef, scrollRef }) {
  const { camera, gl } = useThree();
  const keys  = useRef({});
  const yaw   = useRef(0);
  const pitch = useRef(0);
  const pointerLocked = useRef(false);

  useEffect(() => {
    camera.position.set(0, eyeHeightRef.current, 4);
  }, [camera, eyeHeightRef]);

  // ── Scroll-wheel zoom ──
  // scrollRef is set by the parent div (outside Canvas) via a native wheel listener.
  // We read it each frame and apply movement, then reset.
  useFrame((_, delta) => {
    // (Applied in the combined useFrame below)
  });

  // Keyboard
  useEffect(() => {
    const onDown = (e) => { keys.current[e.code] = true; };
    const onUp   = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, []);

  // Desktop mouse look (pointer lock) + Mobile touch look
  useEffect(() => {
    const canvas = gl.domElement;

    // ── Pointer lock (desktop) ──
    const onPLChange = () => {
      pointerLocked.current = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e) => {
      if (!pointerLocked.current) return;
      yaw.current   -= e.movementX * 0.002;
      pitch.current -= e.movementY * 0.002;
      pitch.current  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch.current));
    };
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', onPLChange);
    document.addEventListener('mousemove', onMouseMove);

    // ── Touch drag look (mobile/tablet) ──
    let lastTouch = null;
    const onTouchStart = (e) => {
      if (e.touches.length === 1)
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 1 || !lastTouch) return;
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      yaw.current   -= dx * 0.004;
      pitch.current -= dy * 0.004;
      pitch.current  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch.current));
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => { lastTouch = null; };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   onTouchEnd);

    return () => {
      document.removeEventListener('pointerlockchange', onPLChange);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right   = new THREE.Vector3( Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const move    = new THREE.Vector3();

    // Keyboard + D-pad
    const k = { ...keys.current, ...(externalKeysRef?.current || {}) };
    if (k['KeyW'] || k['ArrowUp'])    move.addScaledVector(forward,  1);
    if (k['KeyS'] || k['ArrowDown'])  move.addScaledVector(forward, -1);
    if (k['KeyA'] || k['ArrowLeft'])  move.addScaledVector(right,   -1);
    if (k['KeyD'] || k['ArrowRight']) move.addScaledVector(right,    1);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      camera.position.add(move);
    }

    // Scroll-wheel: scrollRef.current accumulates deltaY from outside the Canvas
    if (scrollRef?.current) {
      camera.position.addScaledVector(forward, -scrollRef.current * 0.012);
      scrollRef.current = 0;   // consume
    }

    camera.position.y = eyeHeightRef.current;

    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
    camera.quaternion.copy(q);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────
   D-pad — Google Maps style on-screen movement buttons
   Works on mouse AND touch. Injects into externalKeysRef.
───────────────────────────────────────────────────────── */
function DirectionPad({ externalKeysRef }) {
  const press = (code, down) => {
    if (externalKeysRef) externalKeysRef.current[code] = down;
  };

  const btn = (code, icon, label) => {
    const handlers = {
      onMouseDown:   () => press(code, true),
      onMouseUp:     () => press(code, false),
      onMouseLeave:  () => press(code, false),
      onTouchStart:  (e) => { e.preventDefault(); press(code, true); },
      onTouchEnd:    () => press(code, false),
      onTouchCancel: () => press(code, false),
    };
    return (
      <motion.button
        key={code}
        {...handlers}
        whileTap={{ scale: 0.88 }}
        style={{
          width: 48, height: 48,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
        }}
        aria-label={label}
      >
        {icon}
      </motion.button>
    );
  };

  return (
    <motion.div
      className="absolute z-20"
      style={{ bottom: 28, left: '50%', transform: 'translateX(-50%)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      {/* D-pad grid: 3 cols × 2 rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 6 }}>
        {/* Row 1 */}
        <div />
        {btn('ArrowUp',    '↑', 'Forward')}
        <div />
        {/* Row 2 */}
        {btn('ArrowLeft',  '←', 'Left')}
        {btn('ArrowDown',  '↓', 'Back')}
        {btn('ArrowRight', '→', 'Right')}
      </div>

      {/* Hint label */}
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, textAlign: 'center',
                  marginTop: 6, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Move · Drag to look
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   GLB flat model + fallback
───────────────────────────────────────────────────────── */
function FlatModel({ modelPath }) {
  const { scene } = useGLTF(modelPath);
  return <primitive object={scene} scale={1} />;
}

function FlatFallback() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0d0d0d" />
      </mesh>
      {[
        { pos: [0, 1.5, -5],  rot: [0, 0, 0],           size: [14, 3] },
        { pos: [0, 1.5,  5],  rot: [0, Math.PI, 0],     size: [14, 3] },
        { pos: [-7, 1.5, 0],  rot: [0, Math.PI / 2, 0], size: [10, 3] },
        { pos: [ 7, 1.5, 0],  rot: [0,-Math.PI / 2, 0], size: [10, 3] },
      ].map((w, i) => (
        <mesh key={i} position={w.pos} rotation={w.rot}>
          <planeGeometry args={w.size} />
          <meshStandardMaterial color="#161616" side={THREE.FrontSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   Camera height slider (right side)
───────────────────────────────────────────────────────── */
function HeightSlider({ value, onChange }) {
  return (
    <motion.div
      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
    >
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        Height
      </span>
      <div style={{ writingMode: 'vertical-lr', direction: 'rtl' }}>
        <input type="range" min="0.5" max="3.5" step="0.05" value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ WebkitAppearance: 'slider-vertical', width: '4px', height: '120px',
                   cursor: 'pointer', accentColor: '#c49a3c', background: 'transparent' }}
        />
      </div>
      <span style={{ color: '#c49a3c', fontSize: 10, fontFamily: 'monospace',
                     background: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: 4 }}>
        {value.toFixed(1)}m
      </span>
      {[{ label: 'Eye', v: 1.7 }, { label: 'Sit', v: 1.1 }, { label: 'Top', v: 3.0 }].map(p => (
        <button key={p.label} onClick={() => onChange(p.v)}
          style={{
            background: Math.abs(value - p.v) < 0.15 ? 'rgba(196,154,60,0.25)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${Math.abs(value - p.v) < 0.15 ? 'rgba(196,154,60,0.6)' : 'rgba(255,255,255,0.1)'}`,
            color: Math.abs(value - p.v) < 0.15 ? '#c49a3c' : 'rgba(255,255,255,0.3)',
            fontSize: 9, letterSpacing: '0.1em', padding: '3px 6px', borderRadius: 4,
            cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
          }}
        >{p.label}</button>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   Zoomable 2D image — scroll wheel + pinch to zoom, drag to pan
───────────────────────────────────────────────────────── */
function ZoomableImage({ src, alt }) {
  const [zoom, setZoom]   = useState(1);
  const [pan,  setPan]    = useState({ x: 0, y: 0 });
  const [drag, setDrag]   = useState(false);   // track for cursor style
  const containerRef      = useRef(null);
  const lastPinchDist     = useRef(null);
  const isDragging        = useRef(false);
  const dragStart         = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const clampZ = v => Math.min(5, Math.max(0.5, v));

  // Scroll wheel on the image container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => { e.preventDefault(); setZoom(z => clampZ(z * (e.deltaY < 0 ? 1.12 : 0.9))); };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Mouse drag
  const onMouseDown = (e) => {
    isDragging.current = true; setDrag(true);
    dragStart.current  = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x,
             y: dragStart.current.py + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { isDragging.current = false; setDrag(false); };

  // Touch drag + pinch
  const onTouchStart = (e) => {
    if (e.touches.length === 2)
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
    else {
      isDragging.current = true;
      dragStart.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
    }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinchDist.current) setZoom(z => clampZ(z * d / lastPinchDist.current));
      lastPinchDist.current = d;
    } else if (isDragging.current) {
      setPan({ x: dragStart.current.px + e.touches[0].clientX - dragStart.current.x,
               y: dragStart.current.py + e.touches[0].clientY - dragStart.current.y });
    }
  };
  const onTouchEnd = () => { isDragging.current = false; lastPinchDist.current = null; };

  const btnStyle = { width: 40, height: 40, borderRadius: 10, background: 'rgba(10,10,10,0.75)',
    backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#c49a3c', fontSize: 20, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', userSelect: 'none' };

  return (
    /* Outer wrapper: relative so zoom buttons can be absolutely positioned OUTSIDE overflow:hidden */
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* ── Zoom + Reset buttons (outside overflow:hidden, always visible) ── */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 30,
                    display: 'flex', gap: 6, alignItems: 'center' }}>
        <button style={btnStyle} onClick={() => setZoom(z => clampZ(z * 1.25))}>+</button>
        <button style={btnStyle} onClick={() => setZoom(z => clampZ(z * 0.8))}>−</button>
        {zoom !== 1 && (
          <button style={{ ...btnStyle, color: 'rgba(255,255,255,0.5)', fontSize: 10,
                           letterSpacing: '0.08em', textTransform: 'uppercase' }}
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            Reset
          </button>
        )}
      </div>

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: 20, left: 16, zIndex: 30,
                    color: 'rgba(255,255,255,0.22)', fontSize: 9,
                    letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Scroll · Pinch · Drag
      </div>

      {/* Image container with overflow hidden (image can grow beyond bounds when zoomed) */}
      <div ref={containerRef}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                 justifyContent: 'center', overflow: 'hidden',
                 cursor: drag ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        <motion.img
          src={src} alt={alt} draggable={false}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                   borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                   userSelect: 'none', pointerEvents: 'none',
                   transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                   transformOrigin: 'center',
                   transition: drag ? 'none' : 'transform 0.1s ease-out' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

export default function WalkthroughView({ selection, onBack, onEnquire }) {
  const [mode, setMode]     = useState('3d');
  const [loading, setLoading] = useState(true);
  const [eyeHeight, setEyeHeight] = useState(1.7);
  const eyeHeightRef    = useRef(1.7);
  const externalKeysRef = useRef({});
  const scrollRef       = useRef(0);   // accumulates wheel deltaY for 3D zoom
  const canvasWrapRef   = useRef(null);

  const handleHeightChange = (v) => {
    eyeHeightRef.current = v;
    setEyeHeight(v);
  };

  // Native wheel listener on the 3D canvas wrapper — bypasses React's passive default
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (mode !== '3d') return;
      e.preventDefault();
      scrollRef.current += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode]);

  const is3BHK    = selection.flat?.type?.includes('3 BHK');
  const modelPath = is3BHK ? '/assets/models/flat_3bhk.glb' : '/assets/models/flat.glb';
  const floorPlanSrc = is3BHK ? '/assets/images/3bhk_flat_plan.png' : '/assets/images/floorplan.png';

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <PageBackground src="/assets/images/bg_walkthrough.png" intensity="heavy" />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <NavBar step={6} onBack={onBack} />

        {/* Mode toggle */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="rounded-full flex p-1 gap-1 border border-white/10"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>
            {['2D', '3D'].map(m => (
              <motion.button key={m}
                className={`px-7 py-2 rounded-full text-xs tracking-[0.2em] uppercase font-medium transition-all duration-300
                  ${mode === m.toLowerCase() ? 'bg-[#c49a3c] text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
                onClick={() => { setMode(m.toLowerCase()); setLoading(true); }}
                whileTap={{ scale: 0.95 }}>
                {m}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Main view */}
        <div className="flex-1 relative mt-16">
          <AnimatePresence mode="wait">

            {/* ── 3D walkthrough ── */}
            {mode === '3d' && (
              <motion.div key="3d" className="absolute inset-0"
                ref={canvasWrapRef}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}>

                <AnimatePresence>
                  {loading && (
                    <motion.div className="absolute inset-0 z-20 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.7)' }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                      <LoadingSpinner label="Loading 3D environment…" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <Canvas camera={{ fov: 75 }} shadows
                  onCreated={() => setTimeout(() => setLoading(false), 600)}>
                  <ambientLight intensity={0.5} />
                  <pointLight position={[0, 2.5, 0]} intensity={1.2} color="#ffe8c0" />
                  <pointLight position={[-4, 2, -3]} intensity={0.4} color="#c49a3c" />
                  <pointLight position={[4, 2, 3]}  intensity={0.3} color="#aabbff" />
                  <Suspense fallback={<FlatFallback />}>
                    <FlatModel modelPath={modelPath} />
                    <Environment preset="apartment" />
                  </Suspense>
                  <FirstPersonController speed={5} eyeHeightRef={eyeHeightRef}
                    externalKeysRef={externalKeysRef} scrollRef={scrollRef} />
                </Canvas>

                {/* D-pad (replaces old room tabs + WASD hint) */}
                <DirectionPad externalKeysRef={externalKeysRef} />

                {/* Height slider */}
                <HeightSlider value={eyeHeight} onChange={handleHeightChange} />
              </motion.div>
            )}

            {/* ── 2D floor plan with zoom ── */}
            {mode === '2d' && (
              <motion.div key="2d" className="absolute inset-0 p-6"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4 }}
                onAnimationComplete={() => setLoading(false)}
              >
                <ZoomableImage src={floorPlanSrc} alt="Floor Plan" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info chip */}
          <motion.div
            className="absolute top-4 left-4 rounded-xl px-4 py-3 border border-white/8"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          >
            <p className="text-[#c49a3c] text-xs tracking-widest uppercase">
              {selection.flat?.type}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {selection.tower?.name} · Floor {selection.floor} · Unit {selection.flat?.unit}
            </p>
          </motion.div>

          {/* Enquire button */}
          {onEnquire && (
            <motion.button
              className="absolute top-4 right-4 z-10 px-5 py-2.5 bg-[#c49a3c] text-black text-xs tracking-[0.2em] uppercase font-semibold rounded-full hover:bg-[#d4af6e] transition-colors duration-300"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              onClick={onEnquire}
            >
              Enquire Now →
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
