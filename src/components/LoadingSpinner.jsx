import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Rotating ring */}
      <div className="relative w-12 h-12">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#c49a3c]/20"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#c49a3c]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <p className="text-white/40 text-xs tracking-[0.25em] uppercase">{label}</p>
    </motion.div>
  );
}
