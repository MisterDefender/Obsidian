'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 250;

export function BackgroundParticles() {
    const groupRef = useRef<THREE.Group>(null);
    const pointsRef = useRef<THREE.Points>(null);

    // Initialize positions, velocities, and colors
    const [positions, velocities, colors] = useMemo(() => {
        const pos = new Float32Array(PARTICLE_COUNT * 3);
        const vels: THREE.Vector3[] = [];
        const cols = new Float32Array(PARTICLE_COUNT * 3);

        const palette = [
            new THREE.Color('#ff5a1f'), // Ember
            new THREE.Color('#ffb020'), // Ember Glow
            new THREE.Color('#7c5cff'), // Iris
            new THREE.Color('#2a2a31'), // Ash (dim)
        ];

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Position: spread in a wide box behind the crystal (z is negative)
            pos[i * 3] = (Math.random() - 0.5) * 24;      // x
            pos[i * 3 + 1] = (Math.random() - 0.5) * 18;  // y
            pos[i * 3 + 2] = -12 + Math.random() * 10;    // z: from -12 to -2

            // Velocity: slow random drift
            vels.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 0.08,
                    (Math.random() - 0.5) * 0.08,
                    (Math.random() - 0.5) * 0.05
                )
            );

            // Color: random pick from palette
            const color = palette[Math.floor(Math.random() * palette.length)];
            // Add slight randomness to color intensity
            const intensity = 0.4 + Math.random() * 0.6;
            cols[i * 3] = color.r * intensity;
            cols[i * 3 + 1] = color.g * intensity;
            cols[i * 3 + 2] = color.b * intensity;
        }

        return [pos, vels, cols];
    }, []);

    useFrame((state, delta) => {
        if (!pointsRef.current || !groupRef.current) return;

        const attr = pointsRef.current.geometry.attributes.position;
        const arr = attr.array as Float32Array;

        // Update positions based on velocities
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            arr[i * 3] += velocities[i].x * delta;
            arr[i * 3 + 1] += velocities[i].y * delta;
            arr[i * 3 + 2] += velocities[i].z * delta;

            // Boundary wrapping
            // x
            if (arr[i * 3] > 12) arr[i * 3] = -12;
            else if (arr[i * 3] < -12) arr[i * 3] = 12;

            // y
            if (arr[i * 3 + 1] > 9) arr[i * 3 + 1] = -9;
            else if (arr[i * 3 + 1] < -9) arr[i * 3 + 1] = 9;

            // z (between -12 and -2)
            if (arr[i * 3 + 2] > -2) arr[i * 3 + 2] = -12;
            else if (arr[i * 3 + 2] < -12) arr[i * 3 + 2] = -2;
        }

        attr.needsUpdate = true;

        // Apply mouse parallax to the entire group
        const targetX = state.pointer.x * 1.5;
        const targetY = state.pointer.y * 1.0;
        
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.05);
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.05);
    });

    return (
        <group ref={groupRef}>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[positions, 3]}
                        count={PARTICLE_COUNT}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        args={[colors, 3]}
                        count={PARTICLE_COUNT}
                        array={colors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.06}
                    sizeAttenuation={true}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.7}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </points>
        </group>
    );
}
