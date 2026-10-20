import { LazyMotion, MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

// Animation features load in a separate chunk so they never weigh on the main bundle.
const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default);

/** Restrained motion: short durations, and the user's reduced-motion setting is honoured. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
