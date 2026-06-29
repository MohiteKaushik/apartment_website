import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import { XR, XROrigin, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

/* Module-level XR store — one instance for the whole session */
const xrStore = createXRStore({ emulate: false });

/* ─────────────────────────────────────────────────────────
   First-person camera (non-VR)
   • WASD / arrow keys for keyboard users
   • externalKeysRef: D-pad buttons inject keys here
   • Touch-drag on canvas: look around (mobile)
   • Mouse pointer-lock: look around (desktop)
   • Automatically yields control when a VR session is active
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
    // Yield to VR when a headset session is active
    if (gl.xr.isPresenting) return;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right   = new THREE.Vector3( Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const move    = new THREE.Vector3();

    const k = { ...keys.current, ...(externalKeysRef?.current || {}) };
    if (k['KeyW'] || k['ArrowUp'])    move.addScaledVector(forward,  1);
    if (k['KeyS'] || k['ArrowDown'])  move.addScaledVector(forward, -1);
    if (k['KeyA'] || k['ArrowLeft'])  move.addScaledVector(right,   -1);
    if (k['KeyD'] || k['ArrowRight']) move.addScaledVector(right,    1);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      camera.position.add(move);
    }

    if (scrollRef?.current) {
      camera.position.addScaledVector(forward, -scrollRef.current * 0.012);
      scrollRef.current = 0;
    }

    camera.position.y = eyeHeightRef.current;

    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
    camera.quaternion.copy(q);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────
   VR Locomotion — direct WebXR session input (works on all devices)
   • RIGHT stick       → walk forward / back / strafe
   • LEFT  stick X     → smooth rotate left / right
   • LEFT  stick Y     → raise / lower viewpoint
   • RIGHT button B (buttons[5]) → exit VR + go back
   • LEFT  button X (buttons[4]) → exit VR + go to Enquire

   Cross-device axis mapping:
     Most headsets (Quest 2/3/Pro, Reverb G2, Index, Pico):
       axes[2] = thumbstick X,  axes[3] = thumbstick Y
     Simple 3DoF / touchpad-only:
       axes[0] = input X,       axes[1] = input Y
───────────────────────────────────────────────────────── */
function VRLocomotion({ speed = 2.5, onBack, onEnquire }) {
  const originRef   = useRef(null);
  const heightRef   = useRef(0);
  const btnPrevRef  = useRef({});   // rising-edge debounce per button
  // Keep callbacks in refs so the render-loop closure always sees the latest value
  const onBackRef    = useRef(onBack);
  const onEnquireRef = useRef(onEnquire);
  useEffect(() => { onBackRef.current    = onBack; },    [onBack]);
  useEffect(() => { onEnquireRef.current = onEnquire; }, [onEnquire]);

  useFrame(({ gl }, delta) => {
    const session = xrStore.getState().session;
    if (!session || !originRef.current) return;

    // Head look direction (from the XR camera) for steering
    const xrCam  = gl.xr.getCamera ? gl.xr.getCamera() : null;
    const forward = new THREE.Vector3();
    if (xrCam) xrCam.getWorldDirection(forward);
    else        originRef.current.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;
      const hand = source.handedness;   // 'right' | 'left'

      // ── Thumbstick axes ──────────────────────────────────
      if (gp.axes && gp.axes.length >= 2) {
        const n  = gp.axes.length;
        // axes[2]/[3] = thumbstick (6DoF standard); axes[0]/[1] = touchpad fallback
        const sx = n >= 4 ? gp.axes[2] : gp.axes[0];
        const sy = n >= 4 ? gp.axes[3] : gp.axes[1];

        if (hand === 'right') {
          // RIGHT stick → movement
          const mx = Math.abs(sx) > 0.1 ? sx : 0;
          const mz = Math.abs(sy) > 0.1 ? sy : 0;
          if (mx !== 0 || mz !== 0) {
            originRef.current.position.addScaledVector(forward, -mz * speed * delta);
            originRef.current.position.addScaledVector(right,    mx * speed * delta);
          }

        } else if (hand === 'left') {
          // LEFT stick X → smooth yaw rotation
          const rx = Math.abs(sx) > 0.12 ? sx : 0;
          if (rx !== 0) {
            originRef.current.rotation.y -= rx * 1.5 * delta;
          }

          // LEFT stick Y → height up / down
          const hy = Math.abs(sy) > 0.15 ? sy : 0;
          if (hy !== 0) {
            heightRef.current = Math.max(-1.5, Math.min(2.5,
              heightRef.current - hy * 1.5 * delta
            ));
            originRef.current.position.y = heightRef.current;
          }
        }
      }

      // ── Buttons (rising-edge — only fires on the press frame) ──
      if (gp.buttons) {
        for (let i = 0; i < gp.buttons.length; i++) {
          const key  = `${hand}_${i}`;
          const now  = gp.buttons[i].pressed;
          const prev = btnPrevRef.current[key] || false;

          if (now && !prev) {
            // B button: right controller index 5 → exit VR + go back
            if (hand === 'right' && i === 5) {
              xrStore.getState().session?.end();
              onBackRef.current?.();
            }
            // X button: left controller index 4 → exit VR + go to Enquire
            if (hand === 'left' && i === 4) {
              xrStore.getState().session?.end();
              onEnquireRef.current?.();
            }
          }
          btnPrevRef.current[key] = now;
        }
      }
    }
  });

  return <XROrigin ref={originRef} position={[0, 0, 4]} />;
}

/* ─────────────────────────────────────────────────────────
   D-pad — Google Maps style on-screen movement buttons
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 6 }}>
        <div />
        {btn('ArrowUp',    '↑', 'Forward')}
        <div />
        {btn('ArrowLeft',  '←', 'Left')}
        {btn('ArrowDown',  '↓', 'Back')}
        {btn('ArrowRight', '→', 'Right')}
      </div>

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
   Camera height slider (right side, desktop only)
───────────────────────────────────────────────────────── */
function HeightSlider({ value, onChange }) {
  return (
    <motion.div
      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col items-center gap-2"
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
   Zoomable 2D image — scroll wheel + pinch to zoom, drag to pan
───────────────────────────────────────────────────────── */
function ZoomableImage({ src, alt }) {
  const [zoom, setZoom]   = useState(1);
  const [pan,  setPan]    = useState({ x: 0, y: 0 });
  const [drag, setDrag]   = useState(false);
  const containerRef      = useRef(null);
  const lastPinchDist     = useRef(null);
  const isDragging        = useRef(false);
  const dragStart         = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const clampZ = v => Math.min(5, Math.max(0.5, v));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => { e.preventDefault(); setZoom(z => clampZ(z * (e.deltaY < 0 ? 1.12 : 0.9))); };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

      <div style={{ position: 'absolute', bottom: 20, left: 16, zIndex: 30,
                    color: 'rgba(255,255,255,0.22)', fontSize: 9,
                    letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Scroll · Pinch · Drag
      </div>

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

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function WalkthroughView({ selection, onBack, onEnquire }) {
  const [mode, setMode]       = useState('3d');
  const [loading, setLoading] = useState(true);
  const [eyeHeight, setEyeHeight] = useState(1.7);
  const [vrSupported, setVrSupported]   = useState(false);
  const [isVRPresenting, setIsVRPresenting] = useState(false);

  const eyeHeightRef    = useRef(1.7);
  const externalKeysRef = useRef({});
  const scrollRef       = useRef(0);
  const canvasWrapRef   = useRef(null);

  const handleHeightChange = (v) => {
    eyeHeightRef.current = v;
    setEyeHeight(v);
  };

  // Check if the browser + device supports immersive VR
  useEffect(() => {
    navigator.xr?.isSessionSupported('immersive-vr')
      .then(setVrSupported)
      .catch(() => {});
  }, []);

  // Track VR session state from xrStore
  useEffect(() => {
    return xrStore.subscribe(state => {
      setIsVRPresenting(!!state.session);
    });
  }, []);

  // Native wheel listener on the 3D canvas wrapper
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

  const handleEnterVR = async () => {
    try {
      await xrStore.enterVR();
    } catch (e) {
      alert('VR is not supported on this device or browser.\nUse a VR headset with a WebXR-compatible browser (e.g. Meta Browser on Quest).');
    }
  };

  const handleExitVR = () => {
    xrStore.getState().session?.end();
  };

  const flatType = selection.flat?.type || '';
  const is3BHK   = flatType.includes('3 BHK');
  const is2BHK   = flatType.includes('2 BHK');
  const modelPath = is3BHK ? '/assets/models/flat_3bhk.glb'
                  : is2BHK ? '/assets/models/flat_2bhk.glb'
                  : '/assets/models/flat.glb';
  const floorPlanSrc = is3BHK ? '/assets/images/3bhk_flat_plan.png'
                     : is2BHK ? '/assets/images/2bhk_flat_plan.png'
                     : '/assets/images/floorplan.png';

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
                className={`px-4 sm:px-7 py-1.5 sm:py-2 rounded-full text-xs tracking-[0.2em] uppercase font-medium transition-all duration-300
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
                  <XR store={xrStore}>
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
                    <VRLocomotion speed={2.5} onBack={onBack} onEnquire={onEnquire} />
                  </XR>
                </Canvas>

                {/* D-pad — hidden when VR is presenting (controller used instead) */}
                {!isVRPresenting && (
                  <DirectionPad externalKeysRef={externalKeysRef} />
                )}

                {/* Mobile height presets — hidden in VR */}
                {!isVRPresenting && (
                  <motion.div
                    className="absolute md:hidden z-20 flex gap-2"
                    style={{ bottom: 110, left: '50%', transform: 'translateX(-50%)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  >
                    {[{ label: 'Eye', v: 1.7 }, { label: 'Sit', v: 1.1 }, { label: 'Top', v: 3.0 }].map(p => (
                      <button key={p.label} onClick={() => handleHeightChange(p.v)}
                        style={{
                          background: Math.abs(eyeHeight - p.v) < 0.15 ? 'rgba(196,154,60,0.25)' : 'rgba(0,0,0,0.55)',
                          border: `1px solid ${Math.abs(eyeHeight - p.v) < 0.15 ? 'rgba(196,154,60,0.6)' : 'rgba(255,255,255,0.15)'}`,
                          color: Math.abs(eyeHeight - p.v) < 0.15 ? '#c49a3c' : 'rgba(255,255,255,0.4)',
                          fontSize: 10, letterSpacing: '0.1em', padding: '5px 12px', borderRadius: 6,
                          cursor: 'pointer', textTransform: 'uppercase', backdropFilter: 'blur(10px)',
                        }}
                      >{p.label}</button>
                    ))}
                  </motion.div>
                )}

                {/* Desktop height slider */}
                <HeightSlider value={eyeHeight} onChange={handleHeightChange} />

                {/* ── VR Entry Button — always visible; graceful alert if no VR hardware ── */}
                {(
                  <motion.button
                    onClick={isVRPresenting ? handleExitVR : handleEnterVR}
                    className="absolute z-30 flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-semibold rounded-full transition-all duration-300"
                    style={{
                      bottom: 28, left: 16,
                      padding: '10px 18px',
                      background: isVRPresenting
                        ? 'rgba(196,154,60,0.15)'
                        : 'rgba(0,0,0,0.6)',
                      border: `1px solid ${isVRPresenting ? 'rgba(196,154,60,0.7)' : 'rgba(196,154,60,0.5)'}`,
                      color: '#c49a3c',
                      backdropFilter: 'blur(12px)',
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                  >
                    <span style={{ fontSize: 16 }}>🥽</span>
                    <span>{isVRPresenting ? 'Exit VR' : 'Enter VR'}</span>
                  </motion.button>
                )}

                {/* VR Active indicator + controller hint */}
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
                    <div className="flex gap-3 px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                               border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="text-white/40 text-[10px] tracking-wider">B → Back</span>
                      <span className="text-white/20 text-[10px]">·</span>
                      <span className="text-white/40 text-[10px] tracking-wider">X → Enquire</span>
                    </div>
                  </motion.div>
                )}
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
              className="absolute top-4 right-4 z-10 px-3 sm:px-5 py-2 sm:py-2.5 bg-[#c49a3c] text-black text-xs tracking-[0.15em] uppercase font-semibold rounded-full hover:bg-[#d4af6e] transition-colors duration-300"
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
