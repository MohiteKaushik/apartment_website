import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import FLATS from '../data/flats';
import { STATUS, statusOf } from '../data/availability';
import { planThumbnail } from '../components/building/planCanvas';

/* ── Home picker ─────────────────────────────────────────
   The panel beside the cut-open tower: the four homes on the chosen
   floor, each with a glimpse of its plan and its sales status. Hovering
   a card lights that home on the 3D floor plate (and the other way
   round); clicking opens its floor plan. */

const ease = [0.22, 1, 0.36, 1];

export default function FlatSelection({ tower, floor, hovered, onHover, onSelect, touch }) {
  const towerId = tower?.id || 'A';
  const thumbs = useMemo(() => Object.fromEntries(FLATS.map((f) => [f.id, planThumbnail(f.type)])), []);

  return (
    <motion.div
      className="absolute z-20 flex flex-col pointer-events-auto
                 inset-x-0 bottom-0 h-[52%] rounded-t-3xl
                 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-[46%] lg:w-[420px] sm:rounded-none"
      style={{ background: 'linear-gradient(180deg, rgba(6,6,8,0.82), rgba(6,6,8,0.9))',
               backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
               borderLeft: '1px solid rgba(255,255,255,0.07)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.9, ease, delay: 0.5 }}>

      <div className="flex-1 min-h-0 flex flex-col px-5 pt-5 sm:px-9 sm:pt-[92px] pb-4 sm:pb-8 overflow-y-auto">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.7 }}
          className="text-[#c49a3c] text-[10px] sm:text-[11px] tracking-[0.38em] uppercase">
          {tower?.name} · Floor {floor}
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-1.5 sm:mt-2 text-white font-light leading-none text-[26px] sm:text-[38px]"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          Select a <span className="accent">home</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.8 }}
          className="hidden sm:block mt-3 text-white/45 text-[13px] font-light leading-relaxed">
          Four homes around a central lift and stair core. {touch ? 'Tap' : 'Hover'} one to see it on the floor plate.
        </motion.p>

        <div className="mt-4 sm:mt-6 flex flex-col gap-2 sm:gap-2.5">
          {FLATS.map((flat, i) => {
            const hot = hovered === flat.id;
            const status = statusOf(towerId, floor, flat.id);
            const st = STATUS[status];
            const sold = status === 'sold';
            return (
              <motion.button key={flat.id} aria-label={`Home ${flat.unit}, ${flat.type}`}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.1, duration: 0.8, ease }}
                onHoverStart={() => !touch && onHover(flat.id)} onHoverEnd={() => !touch && onHover(null)}
                onFocus={() => !touch && onHover(flat.id)}
                onClick={() => onSelect(flat)}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                className="relative w-full text-left rounded-xl overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3">
                {/* the frame is a plain element: a motion element's style lags a render behind */}
                <span className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-300"
                  style={{
                    background: hot ? 'rgba(196,154,60,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${hot ? 'rgba(196,154,60,0.7)' : sold ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: hot ? '0 0 30px rgba(196,154,60,0.16)' : 'none',
                  }} />
                <motion.div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(196,154,60,0.14) 50%, transparent 70%)' }}
                  initial={{ x: '-120%' }} animate={{ x: hot ? '120%' : '-120%' }} transition={{ duration: 0.8, ease }} />
                {/* a strip of the home's status colour down the left edge */}
                <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: st.colour, opacity: hot ? 1 : 0.7 }} />
                <div className="relative flex items-center gap-3 sm:gap-3.5 transition-opacity duration-300" style={{ opacity: sold && !hot ? 0.62 : 1 }}>
                  {/* the plan */}
                  <div className="relative flex-shrink-0 w-[76px] h-[38px] sm:w-[92px] sm:h-[46px] rounded-md overflow-hidden transition-transform duration-300"
                    style={{ border: `1px solid ${hot ? 'rgba(230,207,147,0.6)' : 'rgba(255,255,255,0.12)'}`,
                             transform: hot ? 'scale(1.04)' : 'scale(1)', filter: sold && !hot ? 'saturate(0.3)' : 'none' }}>
                    {thumbs[flat.id] && <img src={thumbs[flat.id]} alt={`${flat.type} plan`} className="w-full h-full object-cover block" draggable={false} />}
                    <span className="absolute left-1 top-0.5 text-[9px] sm:text-[10px] leading-none"
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#1b1409', letterSpacing: '0.04em' }}>{flat.unit}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-[14px] sm:text-[15px] whitespace-nowrap">{flat.type}</p>
                      <span className="flex items-center gap-1 flex-shrink-0 rounded-full px-1.5 py-[2px] text-[8px] sm:text-[8.5px] tracking-[0.16em] uppercase"
                        style={{ color: st.colour, background: st.dim, border: `1px solid ${st.colour}55` }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: st.colour }} />{st.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mt-1">
                      <p className="text-white/40 text-[11px] sm:text-xs whitespace-nowrap truncate">{flat.area} · {flat.facing}</p>
                      <span className="text-[13px] font-light whitespace-nowrap flex-shrink-0" style={{ color: sold ? 'rgba(255,255,255,0.35)' : '#c49a3c', textDecoration: sold ? 'line-through' : 'none' }}>{flat.price}</span>
                    </div>
                  </div>
                  <span className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm transition-all duration-300
                    ${hot ? 'btn-gold' : 'border border-white/20 text-white/60'}`}>→</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
