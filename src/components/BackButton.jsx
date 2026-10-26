import React from 'react';
import { motion } from 'framer-motion';

/* ── Back ────────────────────────────────────────────────
   One back control for every page: a 40 px round button with a long
   arrow and, on wider screens, the word "Back" (or the page it returns
   to). The arrow slides left on hover; the ring warms to gold. */
export default function BackButton({ onClick, label = 'Back', className = '', compact = false }) {
  return (
    <motion.button
      onClick={onClick}
      title={label}
      className={`group flex items-center gap-2.5 ${className}`}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
      <span className="btn-ghost relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center overflow-hidden">
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden="true"
          className="transition-transform duration-300 group-hover:-translate-x-1">
          <path d="M19 6H2M7 1 2 6l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden sm:inline text-[10.5px] tracking-[0.28em] uppercase text-white/55 group-hover:text-[#e6cf93] transition-colors duration-300">
          {label}
        </span>
      )}
    </motion.button>
  );
}
