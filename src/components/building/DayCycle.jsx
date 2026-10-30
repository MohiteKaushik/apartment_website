import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Time of day ─────────────────────────────────────────
   One number, `tod`, runs the lighting of the building scene:
       0    midday      1 … 0.5 golden hour … 1 night
   The lights, their colours and the haze are blended between three
   keys; the tower's own shader lights its windows as night falls and
   the page grades the photograph behind the model to match
   (see TowerSelection). Everything is damped, so dragging the control
   feels like the sun moving, not a switch. */

const KEYS = [
  { t: 0,   amb: ['#f6f7ff', 2.2],  sun: ['#fff3e0', 3.0, [-14, 26, 10]], fill: ['#dfe8ff', 0.9],  fog: '#d9e1e8' },
  { t: 0.5, amb: ['#ffc8a0', 1.35], sun: ['#ff9a4a', 2.7, [-28, 7, 12]],  fill: ['#ffd6b0', 0.55], fog: '#e7b48c' },
  { t: 1,   amb: ['#56669c', 0.5],  sun: ['#7d8fc4', 0.45, [12, 22, -8]], fill: ['#26335e', 0.3],  fog: '#0a1020' },
];

/* CSS grading of the photo behind the model, same three keys */
export const BACKDROP_FILTER = {
  0:   'sepia(0) saturate(1) brightness(1) contrast(1) hue-rotate(0deg)',
  0.5: 'sepia(0.45) saturate(1.35) brightness(0.86) contrast(1.06) hue-rotate(-8deg)',
  1:   'sepia(0.1) saturate(0.55) brightness(0.26) contrast(1.12) hue-rotate(190deg)',
};
export const BACKDROP_TINT = {
  0:   'rgba(0,0,0,0)',
  0.5: 'rgba(255,128,48,0.16)',
  1:   'rgba(8,14,40,0.45)',
};
export const todKey = (tod) => (tod < 0.25 ? 0 : tod < 0.75 ? 0.5 : 1);

const col = (a) => new THREE.Color(a);

function blend(tod) {
  const [k0, k1] = tod < 0.5 ? [KEYS[0], KEYS[1]] : [KEYS[1], KEYS[2]];
  const f = tod < 0.5 ? tod / 0.5 : (tod - 0.5) / 0.5;
  const lerp = (a, b) => a + (b - a) * f;
  const lc = (a, b) => col(a).lerp(col(b), f);
  return {
    amb: [lc(k0.amb[0], k1.amb[0]), lerp(k0.amb[1], k1.amb[1])],
    sun: [lc(k0.sun[0], k1.sun[0]), lerp(k0.sun[1], k1.sun[1]), k0.sun[2].map((v, i) => lerp(v, k1.sun[2][i]))],
    fill: [lc(k0.fill[0], k1.fill[0]), lerp(k0.fill[1], k1.fill[1])],
    fog: lc(k0.fog, k1.fog),
  };
}

export default function DayCycle({ stateRef }) {
  const amb = useRef(null), sun = useRef(null), fill = useRef(null);
  const cur = useRef(0);
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog('#d9e1e8', 40, 150), []);

  useFrame((_, dt) => {
    const target = stateRef.current?.tod ?? 0;
    cur.current += (target - cur.current) * (1 - Math.exp(-dt * 2.2));
    const b = blend(cur.current);
    if (amb.current) { amb.current.color.copy(b.amb[0]); amb.current.intensity = b.amb[1]; }
    if (sun.current) { sun.current.color.copy(b.sun[0]); sun.current.intensity = b.sun[1]; sun.current.position.set(...b.sun[2]); }
    if (fill.current) { fill.current.color.copy(b.fill[0]); fill.current.intensity = b.fill[1]; }
    fog.color.copy(b.fog);
    if (scene.fog !== fog) scene.fog = fog;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={2.2} color="#f6f7ff" />
      <directionalLight ref={sun} position={[-14, 26, 10]} intensity={3.0} color="#fff3e0" />
      <directionalLight ref={fill} position={[18, 10, -6]} intensity={0.9} color="#dfe8ff" />
    </>
  );
}

/* ── The control: sun · sunset · moon ───────────────────── */
export function TimeOfDayControl({ tod, onChange, className = '' }) {
  const steps = [
    { t: 0, label: 'Day', icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>) },
    { t: 0.5, label: 'Sunset', icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 17h18M5 21h14M12 9a4 4 0 0 1 4 4v1H8v-1a4 4 0 0 1 4-4zM12 3v3M5.6 7.6l2.1 2.1M18.4 7.6l-2.1 2.1" />
      </svg>) },
    { t: 1, label: 'Night', icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>) },
  ];
  return (
    <div className={`flex items-center gap-1 rounded-full p-1 ${className}`}
      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      role="group" aria-label="Time of day">
      {steps.map((st) => {
        const on = Math.abs(tod - st.t) < 0.25;
        return (
          <button key={st.label} onClick={() => onChange(st.t)} title={st.label} aria-pressed={on}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9.5px] tracking-[0.22em] uppercase transition-all duration-300 ${on ? 'btn-gold' : 'text-white/55 hover:text-white'}`}>
            {st.icon}<span className={on ? 'inline' : 'hidden sm:inline'}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}
