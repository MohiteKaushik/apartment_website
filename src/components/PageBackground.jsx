import React from 'react';
import { motion } from 'framer-motion';

const blurPx = { light: '6px', medium: '14px', heavy: '26px' };

/**
 * Must be the FIRST child inside the page wrapper.
 * Uses position:absolute + zIndex:0 (NOT -1) so Framer Motion's
 * stacking context doesn't swallow it.
 * All content siblings should have position:relative / zIndex:1+.
 */
export default function PageBackground({ src, intensity = 'medium' }) {
  const blur = blurPx[intensity] ?? '14px';

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.0, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Blurred photo — scaled up to hide blur edge artifacts */}
      <div
        style={{
          position: 'absolute',
          inset: '-8%',           /* bigger than 100% so blur edges never show */
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: `blur(${blur})`,
        }}
      />
      {/* Dark overlay — keeps text legible */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />
      {/* Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 10%, rgba(0,0,0,0.5) 100%)',
      }} />
    </motion.div>
  );
}
