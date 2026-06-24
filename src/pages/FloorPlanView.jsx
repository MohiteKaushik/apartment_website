import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';
import LoadingSpinner from '../components/LoadingSpinner';

const ROOMS = [
  { label: 'Master Bedroom', area: '320 sq.ft', icon: '🛏' },
  { label: 'Bedroom 2',      area: '240 sq.ft', icon: '🛏' },
  { label: 'Bedroom 3',      area: '220 sq.ft', icon: '🛏' },
  { label: 'Living Room',    area: '480 sq.ft', icon: '🛋' },
  { label: 'Kitchen',        area: '160 sq.ft', icon: '🍳' },
  { label: 'Dining',         area: '180 sq.ft', icon: '🍽' },
];

export default function FloorPlanView({ selection, onWalkthrough, onBack }) {
  const flat = selection.flat;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);

  // ── Pick floor-plan image based on flat type ──
  const is3BHK   = flat?.type?.includes('3 BHK');
  const is2BHK   = flat?.type?.includes('2 BHK');
  const planImage = is3BHK ? '/assets/images/3bhk_flat_plan.png'
                  : is2BHK ? '/assets/images/2bhk_flat_plan.png'
                  : '/assets/images/floorplan.png';

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65 }}
    >
      <PageBackground src="/assets/images/bg_floor_plan.png" intensity="heavy" />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <NavBar step={5} onBack={onBack} />

      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

        {/* Floor plan image area */}
        <motion.div
          className="flex-1 flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="relative w-full max-w-xs sm:max-w-md md:max-w-2xl aspect-square max-h-[42vh] md:max-h-none glass-dark rounded-2xl overflow-hidden border border-white/8 flex items-center justify-center">

            {/* Loading spinner until image loads */}
            <AnimatePresence>
              {!imgLoaded && !imgError && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  exit={{ opacity: 0 }}
                >
                  <LoadingSpinner label="Loading floor plan…" />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.img
              src={planImage}
              alt="Floor Plan"
              className="w-full h-full object-contain p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: imgLoaded ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />

            {/* Fallback grid if no image */}
            {imgError && (
              <div className="absolute inset-6 grid grid-cols-3 grid-rows-3 gap-2 opacity-20">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border border-[#c49a3c]/40 rounded" />
                ))}
              </div>
            )}

            {/* Subtle gold corner accents */}
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos) => (
              <div key={pos} className={`absolute ${pos} w-4 h-4`}>
                <div className="absolute top-0 left-0 w-full h-px bg-[#c49a3c]/40" />
                <div className="absolute top-0 left-0 w-px h-full bg-[#c49a3c]/40" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right info panel */}
        <motion.div
          className="w-full md:w-80 flex flex-col p-4 md:p-8 border-t md:border-t-0 md:border-l border-white/6 gap-4"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div>
            <p className="text-[#c49a3c] text-xs tracking-[0.35em] uppercase mb-2">Unit Details</p>
            <h2 className="text-white text-2xl md:text-3xl font-light mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {flat?.type}
            </h2>
            <p className="text-white/40 text-sm">
              {selection.tower?.name} · Floor {selection.floor} · Unit {flat?.unit}
            </p>
            <div className="w-8 h-px bg-[#c49a3c]/60 mt-3" />
          </div>

          {/* Key stats */}
          <div className="glass-dark rounded-xl p-4 flex gap-4 border border-white/8">
            <div>
              <p className="text-white/35 text-xs uppercase tracking-wider mb-1">Area</p>
              <p className="text-white text-xl font-light">{flat?.area}</p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-white/35 text-xs uppercase tracking-wider mb-1">Price</p>
              <p className="text-[#c49a3c] text-xl font-light">{flat?.price}</p>
            </div>
          </div>

          {/* Room breakdown — desktop only (too many rows on mobile) */}
          <div className="hidden md:block glass-dark rounded-xl p-4 border border-white/8">
            <p className="text-white/35 text-xs uppercase tracking-wider mb-3">Room Breakdown</p>
            <div className="space-y-2.5">
              {ROOMS.map((room, i) => (
                <motion.div
                  key={room.label}
                  className="flex justify-between items-center text-sm group"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                >
                  <span className="text-white/55 group-hover:text-white/80 transition-colors">{room.label}</span>
                  <span className="text-white/25">{room.area}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.button
            className="w-full py-4 bg-[#c49a3c] text-black text-sm tracking-[0.2em] uppercase font-semibold rounded-lg hover:bg-[#d4af6e] transition-colors duration-300 relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onWalkthrough}
          >
            {/* Shine sweep */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Start Walkthrough →</span>
          </motion.button>
        </motion.div>
      </div>
      </div>
    </motion.div>
  );
}
