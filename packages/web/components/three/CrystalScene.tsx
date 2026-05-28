'use client';

import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useReducedMotion } from 'motion/react';
import { Crystal } from './Crystal';

/**
 * The obsidian crystal centerpiece. Transparent canvas so the CSS ambient
 * gradient shows through; bloom gives the ember edges (and shards) their glow.
 * Loaded client-only (dynamic import) — three.js can't SSR.
 */
export default function CrystalScene({
    shards = 0,
    cameraZ = 6,
}: {
    shards?: number;
    cameraZ?: number;
}) {
    const reduceMotion = useReducedMotion();

    return (
        <Canvas
            camera={{ position: [0, 0, cameraZ], fov: 42 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
            <Crystal animate={!reduceMotion} shards={shards} />
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
