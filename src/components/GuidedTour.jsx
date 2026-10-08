import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────
   Guided tour: Next / Previous / jump-to-room with a smooth
   glide, fixed eye height, no free walking.

   Desktop / mobile:  drag to look, ← → keys or on-screen buttons
   VR (Quest):        trigger or A → next, X → previous,
                      stick left/right → 45° snap turn,
                      B → exit VR + back, Y → exit VR + enquire.
                      Head height comes from the headset, so the
                      viewpoint can no longer drift up or through
                      the floor.

   The controller exposes an imperative API through `apiRef`
   ({ goTo, next, prev }) so that on-screen buttons, keyboard, VR
   buttons — and later a remote "guide" — all drive the same code.
───────────────────────────────────────────────────────── */

/* ── path helpers ──────────────────────────────────────── */
function buildPath(from, to, tour) {
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  if (direct < tour.directBelow) return [from, to];

  const cz = tour.corridorZ;
  const nearCorridor = (p) => Math.abs(p.z - cz) < 0.6;
  const pts = [from];
  if (!nearCorridor(from)) pts.push({ x: from.x, z: cz });
  pts.push({ x: to.x, z: cz });
  pts.push(to);

  // drop consecutive duplicates
  return pts.filter((p, i) => i === 0 ||
    Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.05);
}

function makeRoute(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const length = cum[cum.length - 1];
  const at = (d) => {
    if (length === 0) return { x: pts[0].x, z: pts[0].z };
    d = Math.max(0, Math.min(length, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return {
      x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
      z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t,
    };
  };
  return { length, at };
}

const smoothstep = (t) => t * t * (3 - 2 * t);
const wrapAngle  = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle  = (a, b, t) => a + wrapAngle(b - a) * t;
const GLIDE_SPEED = 3.0;   // m/s
const GLIDE_MIN   = 0.8;   // s
const GLIDE_MAX   = 4.5;   // s

/* ── controller (lives inside <Canvas>) ────────────────── */
export function TourController({ tour, apiRef, xrStore, onStopChange, onBack, onEnquire }) {
  const { camera, gl } = useThree();
  const originRef = useRef(null);

  const stopIdx   = useRef(0);
  const yaw       = useRef(tour.stops[0].yaw);
  const pitch     = useRef(0);
  const pos       = useRef({ x: tour.stops[0].x, z: tour.stops[0].z });
  const anim      = useRef(null);           // { route, t0, dur, yaw0, yaw1 }
  const btnPrev   = useRef({});
  const stickPrev = useRef({});
  const onBackRef    = useRef(onBack);
  const onEnquireRef = useRef(onEnquire);
  const onStopRef    = useRef(onStopChange);
  useEffect(() => { onBackRef.current    = onBack;       }, [onBack]);
  useEffect(() => { onEnquireRef.current = onEnquire;    }, [onEnquire]);
  useEffect(() => { onStopRef.current    = onStopChange; }, [onStopChange]);

  /* current head position on the floor plane (VR: the headset, not the origin) */
  const headXZ = () => {
    if (gl.xr.isPresenting) {
      const v = new THREE.Vector3();
      gl.xr.getCamera().getWorldPosition(v);
      return { x: v.x, z: v.z };
    }
    return { x: pos.current.x, z: pos.current.z };
  };
  const headYaw = () => {
    if (gl.xr.isPresenting) {
      const d = new THREE.Vector3();
      gl.xr.getCamera().getWorldDirection(d);
      return Math.atan2(-d.x, -d.z);
    }
    return yaw.current;
  };

  /* rotate the XR origin about the user's head so the view turns in place */
  const rotateOriginAroundHead = (angle) => {
    const o = originRef.current;
    if (!o) return;
    const head = new THREE.Vector3();
    gl.xr.getCamera().getWorldPosition(head);
    const rel = new THREE.Vector3().subVectors(o.position, head);
    rel.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    o.position.copy(head).add(rel);
    o.rotation.y += angle;
  };

  const goTo = (i) => {
    const n = tour.stops.length;
    i = ((i % n) + n) % n;
    const stop  = tour.stops[i];
    const from  = headXZ();
    const route = makeRoute(buildPath(from, stop, tour));
    const dur   = Math.max(GLIDE_MIN, Math.min(GLIDE_MAX, route.length / GLIDE_SPEED));
    const yaw0  = headYaw();

    if (gl.xr.isPresenting) {
      // VR comfort: turn instantly, then glide. (Animated turns cause nausea.)
      rotateOriginAroundHead(wrapAngle(stop.yaw - yaw0));
    }
    anim.current = { route, t0: performance.now(), dur, yaw0, yaw1: stop.yaw };
    stopIdx.current = i;
    onStopRef.current?.(i);
  };

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      goTo,
      next: () => goTo(stopIdx.current + 1),
      prev: () => goTo(stopIdx.current - 1),
      index: () => stopIdx.current,
    };
    return () => { if (apiRef) apiRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  /* non-VR look: mouse drag + touch drag */
  useEffect(() => {
    const canvas = gl.domElement;
    let last = null;
    const start = (x, y) => { last = { x, y }; };
    const move  = (x, y, k) => {
      if (!last) return;
      yaw.current   -= (x - last.x) * k;
      pitch.current -= (y - last.y) * k;
      pitch.current  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch.current));
      last = { x, y };
    };
    const end = () => { last = null; };

    const onMouseDown = (e) => { if (e.button === 0) start(e.clientX, e.clientY); };
    const onMouseMove = (e) => move(e.clientX, e.clientY, 0.0035);
    const onTouchStart = (e) => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove  = (e) => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, 0.005); };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   end);
    canvas.addEventListener('touchcancel', end);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   end);
      canvas.removeEventListener('touchcancel', end);
    };
  }, [gl]);

  /* keyboard: ← → (and PageUp/Down) step through the tour */
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'ArrowRight' || e.code === 'PageDown' || e.code === 'Space') { e.preventDefault(); apiRef?.current?.next(); }
      if (e.code === 'ArrowLeft'  || e.code === 'PageUp')                          { e.preventDefault(); apiRef?.current?.prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apiRef]);

  /* place the non-VR camera on the first stop */
  useEffect(() => {
    camera.position.set(tour.stops[0].x, tour.eyeHeight, tour.stops[0].z);
  }, [camera, tour]);

  useFrame(() => {
    const presenting = gl.xr.isPresenting;

    /* ── glide animation ── */
    if (anim.current) {
      const a = anim.current;
      const t = Math.min(1, (performance.now() - a.t0) / (a.dur * 1000));
      const s = smoothstep(t);
      const p = a.route.at(a.route.length * s);

      if (presenting && originRef.current) {
        // Keep the *headset* on the path: origin = path point − (head − origin)
        const o = originRef.current;
        const head = new THREE.Vector3();
        gl.xr.getCamera().getWorldPosition(head);
        o.position.x += p.x - head.x;
        o.position.z += p.z - head.z;
        o.position.y  = 0;
      } else {
        pos.current = p;
        yaw.current   = lerpAngle(a.yaw0, a.yaw1, s);
        pitch.current = pitch.current * (1 - s);
      }
      if (t >= 1) anim.current = null;
    }

    /* ── VR input ── */
    if (presenting) {
      const session = xrStore.getState().session;
      if (session) {
        for (const src of session.inputSources) {
          const gp = src.gamepad;
          if (!gp) continue;
          const hand = src.handedness;

          // stick X → 45° snap turn (fires once per push)
          if (gp.axes && gp.axes.length >= 2) {
            const sx = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
            const dir = sx > 0.6 ? 1 : sx < -0.6 ? -1 : 0;
            if (dir !== 0 && stickPrev.current[hand] !== dir)
              rotateOriginAroundHead(-dir * Math.PI / 4);
            stickPrev.current[hand] = dir;
          }

          if (gp.buttons) {
            for (let i = 0; i < gp.buttons.length; i++) {
              const key = `${hand}_${i}`;
              const now = gp.buttons[i].pressed;
              if (now && !btnPrev.current[key]) {
                const isTrigger = i === 0, isAX = i === 4, isBY = i === 5;
                if (hand === 'right' && (isTrigger || isAX)) apiRef?.current?.next();
                if (hand === 'left'  && (isTrigger || isAX)) apiRef?.current?.prev();
                if (hand === 'right' && isBY) { session.end(); onBackRef.current?.(); }
                if (hand === 'left'  && isBY) { session.end(); onEnquireRef.current?.(); }
              }
              btnPrev.current[key] = now;
            }
          }
        }
      }
      return;
    }

    /* ── non-VR camera ── */
    camera.position.set(pos.current.x, tour.eyeHeight, pos.current.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
  });

  /* Origin starts so that a user standing at the centre of their play
     space is on the first stop, facing its direction. */
  const s0 = tour.stops[0];
  return <XROrigin ref={originRef} position={[s0.x, 0, s0.z]} rotation={[0, s0.yaw, 0]} />;
}

/* ── VR heads-up panel: current room + what the buttons do ── */
function drawHud(ctx, w, h, title, sub, hint) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,10,10,0.78)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 36); ctx.fill();
  ctx.strokeStyle = 'rgba(196,154,60,0.7)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c49a3c'; ctx.font = '600 28px sans-serif'; ctx.fillText(sub, w / 2, 56);
  ctx.fillStyle = '#ffffff'; ctx.font = '500 64px sans-serif'; ctx.fillText(title, w / 2, 136);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '400 28px sans-serif'; ctx.fillText(hint, w / 2, 198);
}

export function TourHUD({ tour, stopIndex, visible }) {
  const { gl } = useThree();
  const ref = useRef();
  const W = 1024, H = 232;
  const { texture, ctx } = useMemo(() => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, ctx: c.getContext('2d') };
  }, []);

  useEffect(() => {
    const stop = tour.stops[stopIndex];
    drawHud(ctx, W, H, stop.label, `${stopIndex + 1} / ${tour.stops.length}`,
      'Trigger or A → next room   ·   X → previous   ·   B → exit');
    texture.needsUpdate = true;
  }, [tour, stopIndex, ctx, texture]);

  // Lazy follow: sits 1.6 m ahead, a little below eye line, eases towards the gaze
  useFrame(() => {
    if (!ref.current || !gl.xr.isPresenting) return;
    const cam = gl.xr.getCamera();
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    cam.getWorldPosition(p); cam.getWorldDirection(d);
    d.y = 0; d.normalize();
    const target = p.clone().addScaledVector(d, 1.6); target.y = p.y - 0.45;
    ref.current.position.lerp(target, 0.08);
    ref.current.lookAt(p.x, ref.current.position.y, p.z);
  });

  return (
    <mesh ref={ref} visible={visible} renderOrder={999}>
      <planeGeometry args={[1.0, 1.0 * H / W]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} />
    </mesh>
  );
}

/* ── on-screen controls (outside the canvas) ───────────── */
export function TourBar({ tour, stopIndex, onPrev, onNext, onGoTo }) {
  const chipsRef = useRef(null);
  useEffect(() => {
    const el = chipsRef.current?.children?.[stopIndex];
    el?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [stopIndex]);

  const stop = tour.stops[stopIndex];
  const navBtn = (label, onClick, aria) => (
    <motion.button onClick={onClick} whileTap={{ scale: 0.9 }} aria-label={aria}
      style={{
        width: 52, height: 52, borderRadius: 26, cursor: 'pointer',
        background: '#c49a3c', color: '#000', border: 'none',
        fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
      }}>
      {label}
    </motion.button>
  );

  return (
    <motion.div className="absolute z-20 flex flex-col items-center"
      style={{ bottom: 24, left: 0, right: 0, pointerEvents: 'none' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>

      {/* room chips */}
      <div ref={chipsRef}
        style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '92vw', padding: '4px 8px',
                 marginBottom: 10, pointerEvents: 'auto', scrollbarWidth: 'none' }}>
        {tour.stops.map((s, i) => {
          const active = i === stopIndex;
          return (
            <button key={s.id} onClick={() => onGoTo(i)}
              style={{
                flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                background: active ? 'rgba(196,154,60,0.25)' : 'rgba(0,0,0,0.55)',
                border: `1px solid ${active ? 'rgba(196,154,60,0.8)' : 'rgba(255,255,255,0.15)'}`,
                color: active ? '#c49a3c' : 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(10px)', transition: 'all 0.25s',
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* prev · name · next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
        {navBtn('‹', onPrev, 'Previous room')}
        <div style={{ minWidth: 170, textAlign: 'center', padding: '10px 18px', borderRadius: 14,
                      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)',
                      backdropFilter: 'blur(12px)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{stop.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.2em', marginTop: 2 }}>
            {stopIndex + 1} / {tour.stops.length} · DRAG TO LOOK
          </div>
        </div>
        {navBtn('›', onNext, 'Next room')}
      </div>
    </motion.div>
  );
}
