import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FLOORS, zoneFor, ZONES } from '../data/towerGeometry';
import FLATS from '../data/flats';
import { STATUS, statusOf, floorSummary } from '../data/availability';

/* ── Floor picker ────────────────────────────────────────
   The panel beside the live tower (right half on desktop, bottom sheet
   on phones). Hovering a number lights that storey on the building;
   clicking flies the camera down to it. On touch screens, where there is
   no hover, the first tap lights the floor and a button confirms. */

const ease = [0.22, 1, 0.36, 1];
const FLOOR_LIST = Array.from({ length: FLOORS }, (_, i) => FLOORS - i);
const FLAT_IDS = FLATS.map((f) => f.id);

/* the four homes of a floor as four small dots in their status colours */
function StatusDots({ towerId, floor, hot }) {
  return (
    <span className="absolute inset-x-0 bottom-[3px] sm:bottom-1 flex justify-center gap-[2px] sm:gap-[3px]">
      {FLAT_IDS.map((id) => (
        <span key={id} className="w-[3px] h-[3px] sm:w-1 sm:h-1 rounded-full"
          style={{ background: STATUS[statusOf(towerId, floor, id)].colour, opacity: hot ? 1 : 0.85 }} />
      ))}
    </span>
  );
}

export default function FloorSelection({ tower, hovered, onHover, onSelect, touch, showAvail = true, onToggleAvail }) {
  const zone = hovered ? ZONES[zoneFor(hovered)] : null;
  const towerId = tower?.id || 'A';
  const sum = hovered ? floorSummary(towerId, hovered, FLAT_IDS) : null;

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
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          Select a <span className="accent">floor</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.8 }}
          className="hidden sm:block mt-3 text-white/45 text-[13px] font-light leading-relaxed">
          {touch ? 'Tap a floor to light it on the tower.' : 'Hover a floor to see it on the tower.'} Four homes on every floor.
        </motion.p>

        {/* availability legend + the switch for the blocks on the tower */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.8 }}
          className="mt-3 sm:mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            {Object.values(STATUS).map((st) => (
              <span key={st.label} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.colour, boxShadow: `0 0 8px ${st.colour}66` }} />
                <span className="text-white/50 text-[9.5px] sm:text-[10.5px] tracking-[0.14em] uppercase">{st.label}</span>
              </span>
            ))}
          </div>
          <button onClick={onToggleAvail} aria-pressed={showAvail} title="Show availability on the tower"
            className="flex items-center gap-2 text-[9.5px] sm:text-[10px] tracking-[0.18em] uppercase transition-colors duration-300"
            style={{ color: showAvail ? '#e6cf93' : 'rgba(255,255,255,0.4)' }}>
            <span className="hidden sm:inline">On tower</span>
            <span className="relative w-7 h-4 rounded-full transition-colors duration-300"
              style={{ background: showAvail ? 'rgba(196,154,60,0.55)' : 'rgba(255,255,255,0.14)' }}>
              <span className="absolute top-[3px] w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{ left: showAvail ? 15 : 3, background: showAvail ? '#f1d990' : 'rgba(255,255,255,0.6)' }} />
            </span>
          </button>
        </motion.div>

        {/* the grid */}
        <div className="mt-3 sm:mt-4 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
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
                  className="relative h-10 sm:h-12 rounded-md pb-2 sm:pb-2.5 text-[12px] sm:text-[13px] tracking-wider transition-colors duration-200"
                  style={{
                    border: `1px solid ${hot ? '#c49a3c' : z === 'penthouse' ? 'rgba(196,154,60,0.38)' : z === 'premium' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.09)'}`,
                    background: hot ? 'rgba(196,154,60,0.16)' : 'rgba(255,255,255,0.025)',
                    color: hot ? '#e6cf93' : z === 'penthouse' ? '#c49a3c' : z === 'premium' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.42)',
                    boxShadow: hot ? '0 0 22px rgba(196,154,60,0.25)' : 'none',
                  }}>
                  {f}
                  {z === 'penthouse' && <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#c49a3c]" />}
                  <StatusDots towerId={towerId} floor={f} hot={hot} />
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
          {/* the card stays mounted while the floor changes, so quick hovers never leave it stale */}
          <div className="relative flex-1 sm:flex-none sm:w-[210px] min-h-[34px]">
          <AnimatePresence initial={false}>
            {hovered ? (
              <motion.div key="card" className="relative rounded-xl px-4 py-3"
                style={{ background: 'rgba(196,154,60,0.08)', border: '1px solid rgba(196,154,60,0.25)' }}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }}>
                <motion.div key={hovered} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                  <p className="text-[#c49a3c] text-[10px] tracking-[0.3em] uppercase">Floor {hovered}</p>
                  <p className="text-white text-[15px] font-light mt-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em' }}>{zone.label} zone</p>
                  <p className="text-white/45 text-[11px] mt-0.5">4 residences · {zone.bhk}</p>
                  <p className="text-[11px] mt-1 flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                    {Object.entries(STATUS).map(([k, st]) => sum[k] > 0 && (
                      <span key={k} className="flex items-center gap-1 whitespace-nowrap" style={{ color: st.colour }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.colour }} />{sum[k]} {st.label.toLowerCase()}
                      </span>
                    ))}
                  </p>
                </motion.div>
                {touch && (
                  <button onClick={() => onSelect(hovered)}
                    className="btn-gold mt-2.5 w-full rounded-md text-[11px] tracking-[0.2em] uppercase py-2.5">
                    Explore floor {hovered} →
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.p key="hint" className="absolute inset-x-0 bottom-0 text-white/25 text-[11px] leading-relaxed"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Higher floors look out over the lake.
              </motion.p>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
