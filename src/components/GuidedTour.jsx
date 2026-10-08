import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────
   Guided tour: Next / Previous / jump-to-room with a smooth
   glide at a fixed eye height, plus a little forward / back
   movement inside each room. No free walking, no flying.

   Desktop / mobile:  ‹ › buttons, room chips, ← → keys = change room
                      ▲ ▼ buttons (hold) or ↑ ↓ / W S keys = move
                      drag = look around
   VR (Quest):        A → next room, X → previous room
                      point the controller at the floating panel and pull
                      the trigger to pick a room; trigger elsewhere = next
                      either stick ↕ → move forward / back
                      either stick ↔ → 45° snap turn
                      B → exit VR + back, Y → exit VR + enquire
   The room name (and the highlighted chip) follows wherever the
   visitor actually is, including after walking there themselves.

   Between rooms the camera follows pre-computed routes through the
   doorways (src/data/tourRoutes.json, from `npm run tours:routes`).
   Walls and furniture stop the forward / back movement (ray test
   against the model, sped up by drei's <Bvh>), and the visitor
   can't drift more than `tour.reach` metres from the room's spot.

   The controller exposes an imperative API through `apiRef`
   ({ goTo, next, prev, setMove }) so on-screen buttons, keys,
   VR buttons — and later a remote "guide" — share one code path.
───────────────────────────────────────────────────────── */

/* ── routing between stops ─────────────────────────────── */
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* Waypoints come from src/data/tourRoutes.json (npm run tours:routes),
   which routes through doorways. Without an entry: glide straight. */
function buildPath(from, fromStop, toStop, tour) {
  const mid = tour.routes?.[`${fromStop.id}>${toStop.id}`] || [];
  const pts = [from, ...mid.map(([x, z]) => ({ x, z })), { x: toStop.x, z: toStop.z }];
  // drop consecutive duplicates
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.05);
}

function makeRoute(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
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
const GLIDE_SPEED = 3.0;   // m/s between rooms
const GLIDE_MIN   = 0.8;   // s
const GLIDE_MAX   = 5.0;   // s
const MOVE_SPEED  = 1.2;   // m/s inside a room
const WALL_GAP    = 0.35;  // stop this far from walls / furniture
const RAY_HEIGHTS = [0.35, 1.0];   // knee and waist height above the floor

/* ── controller (lives inside <Canvas>) ────────────────── */
export function TourController({ tour, apiRef, xrStore, modelRef, menuHoverRef, onStopChange, onBack, onEnquire }) {
  const { camera, gl } = useThree();
  const originRef = useRef(null);

  const stopIdx   = useRef(0);
  const yaw       = useRef(tour.stops[0].yaw);
  const pitch     = useRef(0);
  const pos       = useRef({ x: tour.stops[0].x, z: tour.stops[0].z });
  const anim      = useRef(null);           // { route, t0, dur, yaw0, yaw1 }
  const moveInput = useRef(0);              // -1 back, 0, +1 forward (buttons / keys)
  const btnPrev   = useRef({});
  const stickPrev = useRef({});
  const lastRoomCheck = useRef(0);
  const ray       = useMemo(() => { const r = new THREE.Raycaster(); r.firstHitOnly = true; return r; }, []);
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

  /* can we step `step` metres from p along unit vector (dx, dz)? */
  const canStep = (p, dx, dz, step) => {
    const stop = tour.stops[stopIdx.current];
    const next = { x: p.x + dx * step, z: p.z + dz * step };
    // leash: allow moving back towards the room's spot, never further than `reach` from it
    if (dist(next, stop) > (tour.reach || 3) && dist(next, stop) > dist(p, stop)) return false;

    const model = modelRef?.current;
    if (!model) return true;
    const sgn = Math.sign(step);
    const dir = new THREE.Vector3(dx * sgn, 0, dz * sgn);
    ray.far = Math.abs(step) + WALL_GAP;
    for (const h of RAY_HEIGHTS) {
      ray.set(new THREE.Vector3(p.x, (tour.floorY || 0) + h, p.z), dir);
      if (ray.intersectObject(model, true).length) return false;
    }
    return true;
  };

  const goTo = (i) => {
    const n = tour.stops.length;
    i = ((i % n) + n) % n;
    const fromStop = tour.stops[stopIdx.current];
    const stop  = tour.stops[i];
    const from  = headXZ();
    const route = makeRoute(buildPath(from, fromStop, stop, tour));
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
      setMove: (v) => { moveInput.current = v; },
      /* Point at the nearest stop without moving (used when the visitor
         walks into another room on their own). */
      setIndex: (i) => { stopIdx.current = i; onStopRef.current?.(i); },
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

  /* keyboard: ← → change room, ↑ ↓ / W S move */
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'ArrowRight' || e.code === 'PageDown') { e.preventDefault(); apiRef?.current?.next(); }
      if (e.code === 'ArrowLeft'  || e.code === 'PageUp')   { e.preventDefault(); apiRef?.current?.prev(); }
      if (e.code === 'ArrowUp'    || e.code === 'KeyW')     { e.preventDefault(); moveInput.current =  1; }
      if (e.code === 'ArrowDown'  || e.code === 'KeyS')     { e.preventDefault(); moveInput.current = -1; }
    };
    const onUp = (e) => {
      if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.code)) moveInput.current = 0;
    };
    const onBlur = () => { moveInput.current = 0; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [apiRef]);

  /* place the non-VR camera on the first stop */
  useEffect(() => {
    camera.position.set(tour.stops[0].x, tour.eyeHeight, tour.stops[0].z);
  }, [camera, tour]);

  useFrame((_, delta) => {
    const presenting = gl.xr.isPresenting;
    const dt = Math.min(delta, 0.1);

    /* ── glide animation ── */
    if (anim.current) {
      const a = anim.current;
      const t = Math.min(1, (performance.now() - a.t0) / (a.dur * 1000));
      const s = smoothstep(t);
      const p = a.route.at(a.route.length * s);

      if (presenting && originRef.current) {
        // Keep the *headset* on the path: origin += path point − head
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
    let vrMove = 0;
    if (presenting) {
      const session = xrStore.getState().session;
      if (session) {
        for (const src of session.inputSources) {
          const gp = src.gamepad;
          if (!gp) continue;
          const hand = src.handedness;

          if (gp.axes && gp.axes.length >= 2) {
            const sx = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
            const sy = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
            // stick ↔ → 45° snap turn (fires once per push), only when not pushing forward/back
            const dir = Math.abs(sx) > 0.6 && Math.abs(sx) > Math.abs(sy) ? Math.sign(sx) : 0;
            if (dir !== 0 && stickPrev.current[hand] !== dir) rotateOriginAroundHead(-dir * Math.PI / 4);
            stickPrev.current[hand] = dir;
            // stick ↕ → forward / back (pushing up gives a negative axis value)
            if (Math.abs(sy) > 0.25 && Math.abs(sy) > Math.abs(sx) && Math.abs(sy) > Math.abs(vrMove)) vrMove = -sy;
          }

          if (gp.buttons) {
            for (let i = 0; i < gp.buttons.length; i++) {
              const key = `${hand}_${i}`;
              const now = gp.buttons[i].pressed;
              if (now && !btnPrev.current[key]) {
                const isTrigger = i === 0, isAX = i === 4, isBY = i === 5;
                // A trigger pull while pointing at the floating menu is a click
                // on that menu (handled by the menu itself), not next / previous.
                const onMenu = isTrigger && (menuHoverRef?.current || 0) > 0;
                if (hand === 'right' && (isTrigger || isAX) && !onMenu) apiRef?.current?.next();
                if (hand === 'left'  && (isTrigger || isAX) && !onMenu) apiRef?.current?.prev();
                if (hand === 'right' && isBY) { session.end(); onBackRef.current?.(); }
                if (hand === 'left'  && isBY) { session.end(); onEnquireRef.current?.(); }
              }
              btnPrev.current[key] = now;
            }
          }
        }
      }
    }

    /* ── forward / back inside the room ── */
    const input = presenting ? vrMove : moveInput.current;
    if (input !== 0 && !anim.current) {
      const y = headYaw();
      const dx = -Math.sin(y), dz = -Math.cos(y);
      const step = input * MOVE_SPEED * dt;
      const here = headXZ();
      if (canStep(here, dx, dz, step)) {
        if (presenting && originRef.current) {
          originRef.current.position.x += dx * step;
          originRef.current.position.z += dz * step;
        } else {
          pos.current = { x: here.x + dx * step, z: here.z + dz * step };
        }
      }
    }

    /* ── which room are we in? (after walking or sliding on our own) ──
       Nearest stop wins, with a margin so the label doesn't flicker on a
       boundary. Checked a few times a second, never mid-glide. */
    if (!anim.current && performance.now() - lastRoomCheck.current > 300) {
      lastRoomCheck.current = performance.now();
      const here = headXZ();
      const cur  = stopIdx.current;
      let best = cur, bestD = dist(here, tour.stops[cur]);
      tour.stops.forEach((st, i) => { const d = dist(here, st); if (d < bestD - 0.8) { best = i; bestD = d; } });
      if (best !== cur) apiRef?.current?.setIndex(best);
    }

    if (presenting) return;

    /* ── non-VR camera ── */
    camera.position.set(pos.current.x, tour.eyeHeight, pos.current.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
  });

  /* Origin starts so that a user standing at the centre of their play
     space is on the first stop, facing its direction. */
  const s0 = tour.stops[0];
  return <XROrigin ref={originRef} position={[s0.x, 0, s0.z]} rotation={[0, s0.yaw, 0]} />;
}

/* ── VR floating panel: room name + room buttons ──────────
   Drawn on one canvas texture; invisible hit meshes over each
   room button pick up the controller ray (hover + trigger).
   Follows the gaze lazily, but stays still while you're looking
   roughly at it so it can be pointed at. */
const HUD_W = 1024;
const HUD_PAD = 36, HUD_CHIP_H = 64, HUD_CHIP_GAP = 14, HUD_ROW_GAP = 14;

function layoutHud(stops, ctx) {
  ctx.font = '500 26px sans-serif';
  const rows = [[]];
  let x = HUD_PAD;
  const chips = stops.map((st, i) => {
    const w = Math.ceil(ctx.measureText(st.label.toUpperCase()).width) + 44;
    if (x + w > HUD_W - HUD_PAD && rows[rows.length - 1].length) { rows.push([]); x = HUD_PAD; }
    const c = { i, w, x, row: rows.length - 1 };
    rows[rows.length - 1].push(c); x += w + HUD_CHIP_GAP;
    return c;
  });
  // centre each row
  rows.forEach((row) => {
    const total = row.reduce((n, c) => n + c.w, 0) + HUD_CHIP_GAP * (row.length - 1);
    let cx = (HUD_W - total) / 2;
    row.forEach((c) => { c.x = cx; cx += c.w + HUD_CHIP_GAP; });
  });
  const top = 176;
  chips.forEach((c) => { c.y = top + c.row * (HUD_CHIP_H + HUD_ROW_GAP); c.h = HUD_CHIP_H; });
  const height = top + rows.length * (HUD_CHIP_H + HUD_ROW_GAP) + 52;
  return { chips, height };
}

function drawHud(ctx, W, H, tour, stopIndex, hovered, chips) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,8,8,0.82)';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 34); ctx.fill();
  ctx.strokeStyle = 'rgba(196,154,60,0.6)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#c49a3c'; ctx.font = '600 24px sans-serif';
  ctx.fillText(`${stopIndex + 1} / ${tour.stops.length}   ·   YOU ARE IN`, W / 2, 52);
  ctx.fillStyle = '#ffffff'; ctx.font = '500 60px sans-serif';
  ctx.fillText(tour.stops[stopIndex].label, W / 2, 124);
  ctx.font = '500 26px sans-serif'; ctx.textBaseline = 'middle';
  chips.forEach((c) => {
    const active = c.i === stopIndex, hov = c.i === hovered;
    ctx.fillStyle = active ? 'rgba(196,154,60,0.32)' : hov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, c.h / 2); ctx.fill();
    ctx.strokeStyle = active ? 'rgba(196,154,60,0.95)' : hov ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = active || hov ? 3 : 2; ctx.stroke();
    ctx.fillStyle = active ? '#e8c874' : hov ? '#ffffff' : 'rgba(255,255,255,0.72)';
    ctx.fillText(tour.stops[c.i].label.toUpperCase(), c.x + c.w / 2, c.y + c.h / 2 + 1);
  });
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 23px sans-serif';
  ctx.fillText('Point + trigger: pick a room   ·   A: next   X: previous   ·   Stick: move / turn   ·   B: exit', W / 2, H - 22);
}

export function TourHUD({ tour, stopIndex, visible, onGoTo, hoverRef }) {
  const { gl } = useThree();
  const ref = useRef();
  const following = useRef(true);
  const [hovered, setHovered] = React.useState(-1);
  const { texture, ctx, canvas } = useMemo(() => {
    const c = document.createElement('canvas'); c.width = HUD_W; c.height = 512;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, ctx: c.getContext('2d'), canvas: c };
  }, []);
  const { chips, height } = useMemo(() => layoutHud(tour.stops, ctx), [tour, ctx]);
  const PANEL_W = 1.15;                               // metres
  const PANEL_H = PANEL_W * height / HUD_W;
  const px = (v) => (v / HUD_W) * PANEL_W;            // canvas px → metres

  useEffect(() => {
    if (canvas.height !== height) { canvas.height = height; }
    drawHud(ctx, HUD_W, height, tour, stopIndex, hovered, chips);
    texture.needsUpdate = true;
  }, [tour, stopIndex, hovered, chips, ctx, texture, canvas, height]);

  useFrame(() => {
    if (!ref.current || !gl.xr.isPresenting) return;
    const cam = gl.xr.getCamera();
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    cam.getWorldPosition(p); cam.getWorldDirection(d);
    d.y = 0; d.normalize();
    const target = p.clone().addScaledVector(d, 1.7); target.y = p.y - 0.25;
    const toPanel = ref.current.position.clone().sub(p);
    const flat = toPanel.clone().setY(0);
    const angle = flat.lengthSq() > 1e-6 ? flat.angleTo(d) : Math.PI;
    const off = Math.abs(flat.length() - 1.7) > 0.7 || Math.abs(toPanel.y + 0.25) > 0.6;
    // start following when the panel drifts out of view; stop once it's centred
    if (angle > 0.6 || off) following.current = true;
    if (following.current) {
      ref.current.position.lerp(target, 0.08);
      if (ref.current.position.distanceTo(target) < 0.03) following.current = false;
    }
    ref.current.lookAt(p.x, ref.current.position.y, p.z);
  });

  const enter = (i) => (e) => { e.stopPropagation(); setHovered(i); if (hoverRef) hoverRef.current = (hoverRef.current || 0) + 1; };
  const leave = () => { setHovered(-1); if (hoverRef) hoverRef.current = Math.max(0, (hoverRef.current || 0) - 1); };

  return (
    <group ref={ref} visible={visible} renderOrder={999}>
      <mesh>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial map={texture} transparent depthTest={false} />
      </mesh>
      {/* invisible hit areas over the room buttons */}
      {visible && chips.map((c) => (
        <mesh key={c.i}
          position={[px(c.x + c.w / 2) - PANEL_W / 2, PANEL_H / 2 - px(c.y + c.h / 2), 0.005]}
          onPointerOver={enter(c.i)} onPointerOut={leave}
          onClick={(e) => { e.stopPropagation(); onGoTo(c.i); }}>
          <planeGeometry args={[px(c.w), px(c.h)]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ── on-screen controls (outside the canvas) ───────────── */
const GOLD = '#c49a3c';
const roundBtn = (size, primary) => ({
  width: size, height: size, borderRadius: size / 2, cursor: 'pointer', flex: '0 0 auto',
  background: primary ? GOLD : 'rgba(0,0,0,0.55)',
  color: primary ? '#000' : GOLD,
  border: primary ? 'none' : '1px solid rgba(196,154,60,0.5)',
  fontSize: primary ? 22 : 13, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)',
  userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
});

/* press-and-hold button for moving forward / back */
function HoldButton({ label, aria, onHold }) {
  const down = (e) => { e.preventDefault(); onHold(true); };
  const up   = () => onHold(false);
  return (
    <motion.button aria-label={aria} whileTap={{ scale: 0.9 }} style={roundBtn(30, false)}
      onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}>
      {label}
    </motion.button>
  );
}

export function TourBar({ tour, stopIndex, onPrev, onNext, onGoTo, onMove }) {
  const chipsRef = useRef(null);
  useEffect(() => {
    const el = chipsRef.current?.children?.[stopIndex];
    el?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [stopIndex]);

  const stop = tour.stops[stopIndex];
  const navBtn = (label, onClick, aria) => (
    <motion.button onClick={onClick} whileTap={{ scale: 0.9 }} aria-label={aria} style={roundBtn(38, true)}>
      {label}
    </motion.button>
  );

  return (
    // Compact: one control row, one chip row, hugging the bottom edge.
    // On phones it sits above the Enter VR button; on wider screens beside it.
    <motion.div className="absolute z-20 flex flex-col items-center bottom-[70px] md:bottom-3"
      style={{ left: 0, right: 0, pointerEvents: 'none' }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>

      {/* ‹  name  ›   ▲▼ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', marginBottom: 6 }}>
        {navBtn('‹', onPrev, 'Previous room')}
        <div style={{ minWidth: 150, textAlign: 'center', padding: '6px 14px', borderRadius: 12,
                      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)',
                      backdropFilter: 'blur(12px)' }}>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{stop.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.18em', marginTop: 2 }}>
            {stopIndex + 1} / {tour.stops.length} · DRAG TO LOOK
          </div>
        </div>
        {navBtn('›', onNext, 'Next room')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 4 }}>
          <HoldButton label="▲" aria="Move forward" onHold={(on) => onMove(on ? 1 : 0)} />
          <HoldButton label="▼" aria="Move back"    onHold={(on) => onMove(on ? -1 : 0)} />
        </div>
      </div>

      {/* room chips */}
      <div ref={chipsRef}
        style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: '94vw', padding: '2px 8px',
                 pointerEvents: 'auto', scrollbarWidth: 'none' }}>
        {tour.stops.map((s, i) => {
          const active = i === stopIndex;
          return (
            <button key={s.id} onClick={() => onGoTo(i)}
              style={{
                flex: '0 0 auto', padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                background: active ? 'rgba(196,154,60,0.25)' : 'rgba(0,0,0,0.5)',
                border: `1px solid ${active ? 'rgba(196,154,60,0.8)' : 'rgba(255,255,255,0.12)'}`,
                color: active ? GOLD : 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(10px)', transition: 'all 0.25s',
              }}>
              {s.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
