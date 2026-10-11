import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FLOORS, zoneFor, ZONES } from '../data/towerGeometry';

/* ── Floor picker ────────────────────────────────────────
   The panel beside the live tower (right half on desktop, bottom sheet
   on phones). Hovering a number lights that storey on the building;
   clicking flies the camera down to it. On touch screens, where there is
   no hover, the first tap lights the floor and a button confirms. */

const ease = [0.22, 1, 0.36, 1];
const FLOOR_LIST = Array.from({ length: FLOORS }, (_, i) => FLOORS - i);

export default function FloorSelection({ tower, hovered, onHover, onSelect, touch }) {
  const zone = hovered ? ZONES[zoneFor(hovered)] : null;

  return (
    <motion.div
      className="absolute z-20 flex flex-col pointer-events-auto
                 inset-x-0 bottom-0 h-[56%] rounded-t-3xl
                 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-[46%] lg:w-[420px] sm:rounded-none"
      style={{ background: 'linear-gradient(180deg, rgba(6,6,8,0.82), rgba(6,6,8,0.9))',
               backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
               borderLeft: '1px solid rgba(255,255,255,0.07)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      initial={{ opacity: 0, x: 60, y: 0 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.9, ease, delay: 0.35 }}>

      <div className="flex-1 min-h-0 flex flex-col px-5 pt-5 sm:px-9 sm:pt-[92px] pb-4 sm:pb-8">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }}
          className="text-[#c49a3c] text-[10px] sm:text-[11px] tracking-[0.38em] uppercase">
          {tower?.name} · 40 floors
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-1.5 sm:mt-2 text-white font-light leading-none text-[26px] sm:text-[38px]"
          style={{ fontFamily: "'Playfair Display', serif" }}>
          Select a <span className="italic text-[#e6cf93]">floor</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.8 }}
          className="hidden sm:block mt-3 text-white/45 text-[13px] font-light leading-relaxed">
          {touch ? 'Tap a floor to light it on the tower.' : 'Hover a floor to see it on the tower.'} Four homes on every floor.
        </motion.p>

        {/* the grid */}
        <div className="mt-4 sm:mt-6 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-8 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {FLOOR_LIST.map((f, i) => {
              const z = zoneFor(f);
              const hot = hovered === f;
              return (
                <motion.button key={f}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 + i * 0.012, duration: 0.5 }}
                  onHoverStart={() => !touch && onHover(f)} onHoverEnd={() => !touch && onHover(null)}
                  onFocus={() => !touch && onHover(f)}
                  onClick={(e) => ((touch || e.nativeEvent?.pointerType === 'touch') && hovered !== f ? onHover(f) : onSelect(f))}
                  whileTap={{ scale: 0.94 }}
                  className="relative h-9 sm:h-11 rounded-md text-[12px] sm:text-[13px] tracking-wider transition-colors duration-200"
                  style={{
                    border: `1px solid ${hot ? '#c49a3c' : z === 'penthouse' ? 'rgba(196,154,60,0.38)' : z === 'premium' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.09)'}`,
                    background: hot ? 'rgba(196,154,60,0.16)' : 'rgba(255,255,255,0.025)',
                    color: hot ? '#e6cf93' : z === 'penthouse' ? '#c49a3c' : z === 'premium' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.42)',
                    boxShadow: hot ? '0 0 22px rgba(196,154,60,0.25)' : 'none',
                  }}>
                  {f}
                  {z === 'penthouse' && <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#c49a3c]" />}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* legend + detail */}
        <div className="mt-3 sm:mt-5 flex items-end justify-between gap-3">
          <div className="hidden sm:flex flex-col gap-1.5">
            {Object.values(ZONES).map((zn) => (
              <div key={zn.label} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: zn.colour }} />
                <span className="text-white/35 text-[11px] tracking-wide">{zn.label} <span className="text-white/20">· {zn.floors}</span></span>
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {hovered ? (
              <motion.div key={hovered} className="flex-1 sm:flex-none sm:w-[190px] rounded-xl px-4 py-3"
                style={{ background: 'rgba(196,154,60,0.08)', border: '1px solid rgba(196,154,60,0.25)' }}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }}>
                <p className="text-[#c49a3c] text-[10px] tracking-[0.3em] uppercase">Floor {hovered}</p>
                <p className="text-white text-[15px] font-light mt-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{zone.label} zone</p>
                <p className="text-white/45 text-[11px] mt-0.5">4 residences · {zone.bhk}</p>
                {touch && (
                  <button onClick={() => onSelect(hovered)}
                    className="mt-2.5 w-full rounded-md bg-[#c49a3c] text-black text-[11px] tracking-[0.2em] uppercase py-2">
                    Explore floor {hovered} →
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.p key="hint" className="flex-1 sm:flex-none sm:w-[190px] text-white/25 text-[11px] leading-relaxed"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Higher floors look out over the lake.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
