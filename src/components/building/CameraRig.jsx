import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TOWERS, floorBase } from '../../data/towerGeometry';
import { unitWorld } from './FloorPlate';

/* ── Camera poses ────────────────────────────────────────
   One camera, flown between a handful of poses:

   hero    exactly where the intro film's camera ends (worked out by
           overlaying renders on the film's last frame), so the cut from
           film to page is a match cut; then a slow push-in;
   floor   the chosen tower close up, framed on the left so the floor
           list has the right half (on phones: top half);
   unit    down at the chosen storey, looking at the floor plate from
           a little above;
   amenities  the podium between the towers.

   A pose is { az, el, dist, look, fov, ox, oy }: orbit angles (deg) and
   distance about a look-at point, vertical field of view, and where the
   look-at point sits on screen (ox, oy as fractions of the viewport, 0 =
   centre; +ox moves it left, +oy moves it up).

   The flight between poses is an ease-in-out tween; a gentle drag-to-look
   (±9° / ±5°) and, on the hero, an idle sway are layered on top. */

export const HERO = { az: -42, el: 33, dist: 36, look: [0, 7.4, 0], fovAt16x9: 45 };
/* Opening timeline, seconds after the reveal starts:
     0 … HOLD      the film's last frame holds (the cross-fade is inside this)
     HOLD …        the model grows out of the still (GROW_DUR), while the
                   picture behind it softens and a vignette settles around it
     HOLD+0.3 …    the camera's slow push-in / pan (PUSH_DUR)              */
const HOLD = 1.0, GROW_DUR = 1.5, PUSH_T0 = HOLD + 0.3, PUSH_DUR = 3.0;
const GROW_FROM = 1 / 1.22;    // model starts at the film's size, ends at full size
/* Zoom of the opening move, by screen shape. Landscape 16:9 pushes in a
   touch; very wide screens and phones pull out so the whole building fits. */
const pushFor = (aspect, baseFovDeg) =>
  aspect < 0.9 ? 0.86 : Math.min(1.05, Math.max(0.85, baseFovDeg / 38));
/* On phones the composite also pans down so the towers sit between the
   title and the cards. */
const panFor = (aspect) => (aspect < 0.9 ? 0.17 : 0);

/* window.__slowFlights = N stretches every flight N× (used by the screenshot tests) */
const slow = () => (typeof window !== 'undefined' && window.__slowFlights) || 1;
const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const deg = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;

/* Each tower is looked at from the courtyard side, where its broad face is. */
const TOWER_AZ = { A: -16, B: -68 };

export function poseFor(s, aspect) {
  const phone = aspect < 0.9;
  if (s.view === 'floor' && s.towerId) {
    const [cx, cz] = TOWERS[s.towerId].centre;
    return phone
      ? { az: TOWER_AZ[s.towerId], el: 9, dist: 60, look: [cx, 9.3, cz], fov: 46, ox: 0, oy: 0.25 }
      : { az: TOWER_AZ[s.towerId], el: 8, dist: 33, look: [cx, 9.0, cz], fov: 44, ox: s.towerId === 'A' ? 0.17 : 0.12, oy: -0.02 };
  }
  if (s.view === 'unit' && s.towerId && s.floor) {
    const [cx, cz] = TOWERS[s.towerId].centre;
    const y = floorBase(s.floor) + 0.1;
    return phone
      ? { az: TOWER_AZ[s.towerId] + 8, el: 42, dist: 9.8, look: [cx, y, cz], fov: 46, ox: 0, oy: 0.2 }
      : { az: TOWER_AZ[s.towerId] + 8, el: 38, dist: 7.6, look: [cx, y, cz], fov: 42, ox: 0.11, oy: 0.02 };
  }
  if (s.view === 'unitZoom' && s.towerId && s.floor && s.flatId) {
    // down onto the chosen home, before its floor plan opens
    const [ux, uy, uz] = unitWorld(s.towerId, s.floor, s.flatId);
    const az = TOWER_AZ[s.towerId] + 8;
    return phone
      ? { az, el: 58, dist: 4.4, look: [ux, uy, uz], fov: 46, ox: 0, oy: 0.12 }
      : { az, el: 56, dist: 3.4, look: [ux, uy, uz], fov: 42, ox: 0.06, oy: 0.0 };
  }
  if (s.view === 'amenities') {
    return { az: HERO.az, el: 50, dist: phone ? 20 : 15, look: [0.4, 2.3, 0.2], fov: 44, ox: 0, oy: 0 };
  }
  return null;   // hero: handled separately (depends on the opening timeline)
}

export default function CameraRig({ stateRef, backdropRef, fxRef, growRef, cinematic }) {
  const { camera, gl, size } = useThree();
  const cur  = useRef(null);                 // current base pose (object)
  const from = useRef(null);
  const to   = useRef(null);
  const t0   = useRef(0);
  const dur  = useRef(1.6);
  const lastKey = useRef('');
  const azOff = useRef(0), elOff = useRef(0);        // drag-look, damped
  const azOffT = useRef(0), elOffT = useRef(0);
  const zoom = useRef(1), pan = useRef(0);
  const grow = useRef(cinematic ? GROW_FROM : 1);
  const fx   = useRef(cinematic ? 0 : 1);
  const open0 = useRef(null);
  const settled = useRef(!cinematic);
  const lastInput = useRef(performance.now());
  const dragging = useRef(false);

  /* base vertical fov for the hero: follows the viewport the way
     object-fit: cover crops the backdrop, so the composite holds on any
     screen shape */
  const heroFov = () => {
    const aspect = size.width / size.height, video = 16 / 9;
    const t = Math.tan(deg(HERO.fovAt16x9) / 2);
    const base = aspect > video ? 2 * Math.atan(t * video / aspect) : deg(HERO.fovAt16x9);
    return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(base / 2) / zoom.current));
  };
  const heroPose = () => ({ az: HERO.az, el: HERO.el, dist: HERO.dist, look: HERO.look, fov: heroFov(), ox: 0, oy: -pan.current });

  /* drag to look (mouse + touch) */
  useEffect(() => {
    const el_ = gl.domElement;
    let last = null;
    const start = (x, y) => { if (!settled.current) return; last = { x, y }; dragging.current = true; };
    const move = (x, y) => {
      if (!last) return;
      azOffT.current = THREE.MathUtils.clamp(azOffT.current - (x - last.x) * 0.22, -9, 9);
      elOffT.current = THREE.MathUtils.clamp(elOffT.current + (y - last.y) * 0.17, -5, 5);
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

  useFrame((_, dt) => {
    const now = performance.now();
    const s = stateRef.current || { view: 'hero' };
    const aspect = size.width / size.height;
    const hero = s.view === 'hero';

    /* opening move (hero only) */
    if (cinematic && !settled.current) {
      if (open0.current === null) open0.current = now;
      const el_ = (now - open0.current) / 1000;
      const g = easeOutCubic(Math.min(1, Math.max(0, el_ - HOLD) / GROW_DUR));
      grow.current = GROW_FROM + (1 - GROW_FROM) * g;
      fx.current = g;
      const t = Math.min(1, Math.max(0, el_ - PUSH_T0) / PUSH_DUR);
      const k = easeOutCubic(t);
      const target = pushFor(aspect, heroFov());
      zoom.current = 1 + (target - 1) * k;
      pan.current = panFor(aspect) * k;
      azOffT.current = 2.5 * k;                      // a touch of parallax
      if (t >= 1 || !hero) { settled.current = true; grow.current = 1; fx.current = 1; }
    }

    /* which pose do we want? */
    const target = hero ? heroPose() : poseFor(s, aspect);
    const key = hero ? 'hero' : `${s.view}:${s.towerId}:${s.floor}:${s.view === 'unitZoom' ? s.flatId : ''}`;
    if (!cur.current) {
      cur.current = { ...target, look: [...target.look] };
      from.current = null;
      // coming back from a floor plan: start down on that home and pull out
      if (s.view === 'unit' && s.flatId) {
        const z = poseFor({ ...s, view: 'unitZoom' }, aspect);
        if (z) { cur.current = { ...z, look: [...z.look] }; from.current = { ...z, look: [...z.look] }; t0.current = now; dur.current = 1.7; }
      }
    }
    if (key !== lastKey.current) {
      if (lastKey.current) {
        from.current = { ...cur.current, look: [...cur.current.look] };
        t0.current = now;
        dur.current = s.view === 'unitZoom' ? 1.3 : hero || lastKey.current === 'hero' ? 1.9 : s.view === 'unit' || lastKey.current.startsWith('unit') ? 1.7 : 1.4;
        azOffT.current = 0; elOffT.current = 0;
        lastInput.current = now;
      }
      lastKey.current = key;
    }
    to.current = target;
    if (from.current) {
      const k = easeInOutCubic(Math.min(1, (now - t0.current) / 1000 / (dur.current * slow())));
      const f = from.current, t = to.current, c = cur.current;
      c.az = lerp(f.az, t.az, k); c.el = lerp(f.el, t.el, k); c.dist = lerp(f.dist, t.dist, k);
      c.fov = lerp(f.fov, t.fov, k); c.ox = lerp(f.ox, t.ox, k); c.oy = lerp(f.oy, t.oy, k);
      c.look = [lerp(f.look[0], t.look[0], k), lerp(f.look[1], t.look[1], k), lerp(f.look[2], t.look[2], k)];
      if (k >= 1) from.current = null;
    } else {
      cur.current = { ...target, look: [...target.look] };
    }

    /* idle sway on the hero once interactive */
    if (hero && settled.current && !dragging.current && now - lastInput.current > 3000) {
      const sw = (now - lastInput.current - 3000) / 1000;
      const ease = Math.min(1, sw / 4);
      azOffT.current = 2.5 + Math.sin(sw / 7) * 3 * ease;
      elOffT.current = Math.sin(sw / 11) * 1 * ease;
    }
    const kd = 1 - Math.exp(-dt * 3.6);
    azOff.current += (azOffT.current - azOff.current) * kd;
    elOff.current += (elOffT.current - elOff.current) * kd;

    /* place the camera */
    const c = cur.current;
    const az = deg(c.az + azOff.current), el = deg(c.el + elOff.current);
    const [lx, ly, lz] = c.look;
    camera.position.set(lx + c.dist * Math.cos(el) * Math.sin(az), ly + c.dist * Math.sin(el), lz + c.dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(lx, ly, lz);
    camera.fov = c.fov;
    const sx = Math.round(c.ox * size.width), sy = Math.round(c.oy * size.height);
    if (sx || sy) camera.setViewOffset(size.width, size.height, sx, sy, size.width, size.height);
    else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();

    /* the composite layers behind the model (hero only) */
    if (growRef?.current) growRef.current.scale.setScalar(grow.current);
    if (fxRef?.current) {
      fxRef.current.blur.style.opacity = fx.current.toFixed(3);
      fxRef.current.vignette.style.opacity = fx.current.toFixed(3);
    }
    if (backdropRef?.current) {
      const z = zoom.current, shift = -sy;
      backdropRef.current.style.transform = `translateY(${shift}px) scale(${z.toFixed(4)})`;
      const m = (z < 0.995 || shift) ? 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 72%, transparent 100%)' : 'none';
      backdropRef.current.style.maskImage = m; backdropRef.current.style.webkitMaskImage = m;
    }
  });
  return null;
}
