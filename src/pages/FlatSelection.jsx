import React from 'react';
import { motion } from 'framer-motion';
import FLATS from '../data/flats';

/* ── Home picker ─────────────────────────────────────────
   The panel beside the cut-open tower: the four homes on the chosen
   floor. Hovering a card lights that home on the 3D floor plate (and the
   other way round); clicking opens its floor plan. */

const ease = [0.22, 1, 0.36, 1];

export default function FlatSelection({ tower, floor, hovered, onHover, onSelect, touch }) {
  return (
    <motion.div
      className="absolute z-20 flex flex-col pointer-events-auto
                 inset-x-0 bottom-0 h-[50%] rounded-t-3xl
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
          style={{ fontFamily: "'Playfair Display', serif" }}>
          Select a <span className="italic text-[#e6cf93]">home</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.8 }}
          className="hidden sm:block mt-3 text-white/45 text-[13px] font-light leading-relaxed">
          Four homes around a central lift and stair core. {touch ? 'Tap' : 'Hover'} one to see it on the floor plate.
        </motion.p>

        <div className="mt-4 sm:mt-7 flex flex-col gap-2 sm:gap-2.5">
          {FLATS.map((flat, i) => {
            const hot = hovered === flat.id;
            return (
              <motion.button key={flat.id}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.1, duration: 0.8, ease }}
                onHoverStart={() => !touch && onHover(flat.id)} onHoverEnd={() => !touch && onHover(null)}
                onFocus={() => onHover(flat.id)}
                onClick={() => onSelect(flat)}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                className="relative text-left rounded-xl overflow-hidden px-4 py-3 sm:px-5 sm:py-4 transition-colors duration-300"
                style={{
                  background: hot ? 'rgba(196,154,60,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${hot ? 'rgba(196,154,60,0.7)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: hot ? '0 0 30px rgba(196,154,60,0.16)' : 'none',
                }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(196,154,60,0.14) 50%, transparent 70%)' }}
                  initial={{ x: '-120%' }} animate={{ x: hot ? '120%' : '-120%' }} transition={{ duration: 0.8, ease }} />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className="text-[22px] sm:text-[26px] font-light leading-none w-8"
                      style={{ fontFamily: "'Playfair Display', serif", color: hot ? '#e6cf93' : 'rgba(255,255,255,0.5)' }}>
                      {flat.unit}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-[14px] sm:text-[15px]">{flat.type}</p>
                      <p className="text-white/40 text-[11px] sm:text-xs mt-0.5">{flat.area} · {flat.facing} facing</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[#c49a3c] text-[13px] font-light">{flat.price}</span>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300
                      ${hot ? 'bg-[#c49a3c] text-black' : 'border border-white/20 text-white/60'}`}>→</span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
