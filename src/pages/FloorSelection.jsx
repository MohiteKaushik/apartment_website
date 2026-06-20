import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';

const TOTAL_FLOORS = 28;

const zoneFor = (f) => f >= 20 ? 'penthouse' : f >= 10 ? 'premium' : 'signature';
const zoneLabel = { penthouse: 'Penthouse Zone', premium: 'Premium Zone', signature: 'Signature Zone' };
const zoneBhk   = { penthouse: '4 & 5 BHK', premium: '3 & 4 BHK', signature: '3 BHK' };

export default function FloorSelection({ selection, onSelectFloor, onBack }) {
  const [hovered, setHovered] = useState(null);
  const floors = Array.from({ length: TOTAL_FLOORS }, (_, i) => TOTAL_FLOORS - i);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65 }}
    >
      <PageBackground src="/assets/images/bg_floor.png" intensity="heavy" />

      {/* z-index:1 lifts content above the background's stacking context */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <NavBar step={3} onBack={onBack} />

      <div className="flex flex-col sm:flex-row flex-1 overflow-y-auto sm:overflow-hidden">

        {/* Left info panel — desktop only */}
        <motion.div
          className="hidden sm:flex w-72 flex-col justify-center p-8 border-r border-white/6"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-[#c49a3c] text-xs tracking-[0.35em] uppercase mb-3">
            {selection.tower?.name}
          </p>
          <h2 className="text-white text-4xl font-light mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Select Floor
          </h2>
          <div className="w-8 h-px bg-[#c49a3c]/60 mb-5" />
          <p className="text-white/40 text-sm leading-relaxed">
            Higher floors offer panoramic views and premium finishes. Each floor hosts 4 exclusive residences.
          </p>

          {/* Zone legend */}
          <div className="mt-8 space-y-2">
            {[
              { label: 'Penthouse (20+)', color: '#c49a3c' },
              { label: 'Premium (10–19)',  color: 'rgba(255,255,255,0.5)' },
              { label: 'Signature (1–9)',  color: 'rgba(255,255,255,0.2)' },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
                <span className="text-white/30 text-xs">{z.label}</span>
              </div>
            ))}
          </div>

          {/* Hover detail card */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                className="mt-6 glass-dark rounded-xl p-4 border border-[#c49a3c]/20"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-[#c49a3c] text-xs tracking-widest uppercase">Floor {hovered}</p>
                <p className="text-white text-base font-light mt-1">{zoneLabel[zoneFor(hovered)]}</p>
                <p className="text-white/40 text-xs mt-1">4 residences · {zoneBhk[zoneFor(hovered)]}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Floor grid */}
        <motion.div
          className="flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          {/* Mobile inline title (hidden on desktop where left panel shows it) */}
          <div className="sm:hidden w-full max-w-2xl mb-4">
            <p className="text-[#c49a3c] text-xs tracking-widest uppercase mb-1">{selection.tower?.name}</p>
            <h2 className="text-white text-2xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
              Select Floor
            </h2>
            <div className="w-8 h-px bg-[#c49a3c]/60 mt-2" />
          </div>

          <div className="w-full max-w-2xl">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {floors.map((floor) => {
                const zone = zoneFor(floor);
                const isHov = hovered === floor;
                return (
                  <motion.button
                    key={floor}
                    className={`relative py-3 rounded text-xs font-medium tracking-wider transition-all duration-200
                      ${zone === 'penthouse' ? 'border border-[#c49a3c]/40 text-[#c49a3c]'
                        : zone === 'premium'   ? 'border border-white/15 text-white/60'
                        : 'border border-white/8 text-white/30'}
                      ${isHov ? '!border-[#c49a3c] !text-[#c49a3c] bg-[#c49a3c]/12' : 'hover:border-[#c49a3c]/60 hover:text-[#c49a3c]/80'}`}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (TOTAL_FLOORS - floor) * 0.012, type: 'spring', stiffness: 200 }}
                    onHoverStart={() => setHovered(floor)}
                    onHoverEnd={() => setHovered(null)}
                    onClick={() => onSelectFloor(floor)}
                    whileHover={{ scale: 1.12, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                  >
                    {floor}
                    {zone === 'penthouse' && (
                      <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#c49a3c] animate-pulse" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
      </div> {/* end z-index wrapper */}
    </motion.div>
  );
}
