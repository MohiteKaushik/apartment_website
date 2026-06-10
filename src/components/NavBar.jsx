import React from 'react';
import { motion } from 'framer-motion';

const STEPS = ['Intro', 'Tower', 'Floor', 'Unit', 'Floor Plan', 'Walkthrough'];

export default function NavBar({ step, onBack }) {
  return (
    <motion.nav
      className="relative flex items-center justify-between px-8 py-4 z-10 border-b border-white/6"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo + back */}
      <div className="flex items-center gap-4 w-40">
        {onBack && (
          <motion.button
            onClick={onBack}
            className="text-white/35 hover:text-[#c49a3c] transition-colors duration-200 text-base leading-none"
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.9 }}
            title="Go back"
          >
            ←
          </motion.button>
        )}
        <span
          className="text-white text-xl font-light tracking-[0.25em]"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          VAYAM
        </span>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1.5">
        {STEPS.slice(1).map((label, i) => {
          const stepNum = i + 2;
          const active  = step === stepNum;
          const done    = step > stepNum;
          return (
            <React.Fragment key={label}>
              <motion.div
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
              >
                <motion.div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium transition-all duration-400
                    ${active ? 'bg-[#c49a3c] text-black shadow-lg shadow-[#c49a3c]/30'
                      : done  ? 'bg-[#c49a3c]/25 text-[#c49a3c] border border-[#c49a3c]/40'
                      : 'border border-white/12 text-white/20'}`}
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {done ? '✓' : stepNum - 1}
                </motion.div>
                <span className={`text-[8px] tracking-wider uppercase transition-colors duration-300
                  ${active ? 'text-[#c49a3c]' : done ? 'text-[#c49a3c]/50' : 'text-white/15'}`}>
                  {label}
                </span>
              </motion.div>
              {i < 4 && (
                <motion.div
                  className="w-6 h-px mb-4 transition-colors duration-500"
                  style={{ background: done ? 'rgba(196,154,60,0.5)' : 'rgba(255,255,255,0.08)' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right label */}
      <div className="w-40 flex justify-end">
        <span className="text-white/15 text-[10px] tracking-[0.25em] uppercase">Luxury Residences</span>
      </div>
    </motion.nav>
  );
}
