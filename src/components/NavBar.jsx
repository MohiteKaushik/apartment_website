import React from 'react';
import { motion } from 'framer-motion';
import BackButton from './BackButton';
import BRAND from '../data/brand';

const STEPS = ['Intro', 'Tower', 'Floor', 'Unit', 'Floor Plan', 'Walkthrough'];

export default function NavBar({ step, onBack, backLabel, transparent = false, action = null }) {
  return (
    <motion.nav
      className={`relative flex items-center justify-between px-3 sm:px-8 py-2.5 sm:py-3.5 z-10 ${transparent ? '' : 'border-b border-white/6'}`}
      style={transparent
        ? { background: 'linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0))' }
        : { background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left: back + wordmark */}
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 min-w-0">
        {onBack && <BackButton onClick={onBack} label={backLabel || (step > 2 ? STEPS[step - 2] : 'Back')} compact />}
        <span className="text-white text-[17px] sm:text-xl tracking-[0.28em] uppercase"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
          {BRAND.name}
        </span>
      </div>

      {/* Desktop: step progress */}
      <div className="hidden sm:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
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
                    ${active ? 'btn-gold text-black' : done ? 'text-[#c49a3c] border border-[#c49a3c]/45' : 'border border-white/12 text-white/25'}`}
                  style={done ? { background: 'linear-gradient(180deg, rgba(196,154,60,0.28), rgba(196,154,60,0.1))' } : undefined}
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {done ? '✓' : stepNum - 1}
                </motion.div>
                <span className={`text-[8px] tracking-wider uppercase transition-colors duration-300
                  ${active ? 'text-[#e6cf93]' : done ? 'text-[#c49a3c]/60' : 'text-white/20'}`}>
                  {label}
                </span>
              </motion.div>
              {i < 4 && (
                <div className="w-6 h-px mb-4 transition-colors duration-500"
                  style={{ background: done ? 'linear-gradient(90deg, rgba(196,154,60,0.6), rgba(196,154,60,0.25))' : 'rgba(255,255,255,0.08)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right: the page's action (e.g. Enquire) when it has one, else the
          current step on phones and the tagline on wider screens */}
      <div className="flex items-center justify-end gap-3 sm:w-48">
        {action}
        {!action && (
          <span className="flex sm:hidden text-gold-grad text-[11px] tracking-[0.2em] uppercase">{STEPS[step - 1] || ''}</span>
        )}
        {!action && (
          <span className="hidden sm:inline text-white/20 text-[10px] tracking-[0.25em] uppercase">{BRAND.tagline}</span>
        )}
      </div>
    </motion.nav>
  );
}
