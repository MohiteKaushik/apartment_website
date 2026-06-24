import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';

const FLATS = [
  { id: 'A', unit: '01', type: '3 BHK', area: '1,850 sq.ft', facing: 'North', price: '₹4.2 Cr' },
  { id: 'B', unit: '02', type: '4 BHK', area: '2,450 sq.ft', facing: 'East',  price: '₹5.8 Cr' },
  { id: 'C', unit: '03', type: '4 BHK', area: '2,300 sq.ft', facing: 'South', price: '₹5.4 Cr' },
  { id: 'D', unit: '04', type: '2 BHK', area: '1,450 sq.ft', facing: 'West',  price: '₹3.2 Cr' },
];

// Positions on the floor-plate diagram (percentage-based)
const FLAT_POS = {
  A: { top: '8%',  left: '8%',  width: '40%', height: '44%' },
  B: { top: '8%',  left: '52%', width: '40%', height: '44%' },
  C: { top: '56%', left: '52%', width: '40%', height: '36%' },
  D: { top: '56%', left: '8%',  width: '40%', height: '36%' },
};

export default function FlatSelection({ selection, onSelectFlat, onBack }) {
  const [hovered, setHovered] = useState(null);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65 }}
    >
      <PageBackground src="/assets/images/bg_unit.png" intensity="heavy" />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <NavBar step={4} onBack={onBack} />

      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

        {/* Floor plate diagram */}
        <motion.div
          className="flex-1 flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-lg aspect-square">
            {/* Outer border */}
            <div className="absolute inset-0 rounded-xl border border-white/10 glass-dark" />

            {/* Compass */}
            <div className="absolute top-3 right-4 text-white/20 text-xs tracking-wider">N ↑</div>

            {/* Floor label */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/15 text-[10px] tracking-widest uppercase">
              Floor {selection.floor} · {selection.tower?.name}
            </div>

            {/* Flat zones */}
            {FLATS.map((flat) => {
              const isHov = hovered === flat.id;
              return (
                <motion.button
                  key={flat.id}
                  className={`absolute flex flex-col items-center justify-center rounded-lg border cursor-pointer transition-all duration-300
                    ${isHov
                      ? 'border-[#c49a3c] bg-[#c49a3c]/12'
                      : 'border-white/10 bg-white/2 hover:border-white/25'}`}
                  style={FLAT_POS[flat.id]}
                  onHoverStart={() => setHovered(flat.id)}
                  onHoverEnd={() => setHovered(null)}
                  onClick={() => onSelectFlat(flat)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.span
                    className="text-2xl font-light"
                    animate={{ color: isHov ? '#c49a3c' : 'rgba(255,255,255,0.3)' }}
                  >
                    {flat.unit}
                  </motion.span>
                  <span className="text-[10px] text-white/25 mt-1 tracking-wider">{flat.type}</span>
                  <AnimatePresence>
                    {isHov && (
                      <motion.span
                        className="text-[10px] text-[#c49a3c]/70 mt-0.5"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {flat.price}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}

            {/* Lift/core */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[10%] h-[18%] border border-white/8 bg-white/3 rounded flex items-center justify-center">
              <span className="text-white/15 text-[7px] tracking-widest" style={{ writingMode: 'vertical-rl' }}>LIFT</span>
            </div>
          </div>
        </motion.div>

        {/* Right panel */}
        <div className="w-full md:w-80 flex flex-col p-4 md:p-8 border-t md:border-t-0 md:border-l border-white/6 gap-3">
          <motion.div
            className="mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-[#c49a3c] text-xs tracking-[0.35em] uppercase mb-2">
              Floor {selection.floor} · {selection.tower?.name}
            </p>
            <h2 className="text-white text-2xl md:text-3xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
              Select Unit
            </h2>
            <div className="w-8 h-px bg-[#c49a3c]/60 mt-3" />
          </motion.div>

          {FLATS.map((flat, i) => {
            const isHov = hovered === flat.id;
            return (
              <motion.div
                key={flat.id}
                className={`relative glass-dark rounded-xl p-4 cursor-pointer border overflow-hidden transition-all duration-300
                  ${isHov ? 'border-[#c49a3c]/60' : 'border-white/6 hover:border-white/18'}`}
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.09 }}
                onHoverStart={() => setHovered(flat.id)}
                onHoverEnd={() => setHovered(null)}
                onClick={() => onSelectFlat(flat)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Shimmer line on hover */}
                <motion.div
                  className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#c49a3c]/60 to-transparent"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isHov ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium text-sm">Unit {flat.unit} · {flat.type}</p>
                    <p className="text-white/35 text-xs mt-0.5">{flat.area} · {flat.facing} Facing</p>
                  </div>
                  <span className="text-[#c49a3c] text-sm font-light">{flat.price}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      </div>
    </motion.div>
  );
}
