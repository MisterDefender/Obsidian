'use client';

import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useReducedMotion } from 'motion/react';
import { Crystal } from './Crystal';

/**
 * The obsidian crystal centerpiece. Transparent canvas so the CSS ambient
 * gradient shows through; bloom gives the ember edges their molten glow.
 * Loaded client-only (see the dynamic import in Hero) — three.js can't SSR.
 */
export default function CrystalScene() {
    const reduceMotion = useReducedMotion();

    return (
        <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
            <Crystal animate={!reduceMotion} />
            <EffectComposer>
                <Bloom
                    intensity={1.15}
                    luminanceThreshold={0.22}
                    luminanceSmoothing={0.5}
                    mipmapBlur
                />
            </EffectComposer>
        </Canvas>
    );
}
