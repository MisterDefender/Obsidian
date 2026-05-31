'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'motion/react';

const NODE_COUNT = 45;
const MAX_DISTANCE = 2.2; // Maximum distance to draw a line
const MAX_LINES = (NODE_COUNT * (NODE_COUNT - 1)) / 2;

function Constellation() {
    const pointsRef = useRef<THREE.Points>(null);
    const linesRef = useRef<THREE.LineSegments>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    // Track mouse movement
    useMemo(() => {
        if (typeof window === 'undefined') return;
        const handleMouseMove = (e: MouseEvent) => {
            // Map mouse to 3D coords roughly
            mouseRef.current.x = (e.clientX / window.innerWidth) * 8 - 4;
            mouseRef.current.y = -(e.clientY / window.innerHeight) * 6 + 3;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Initialize node positions and velocities
    const [nodes, velocities] = useMemo(() => {
        const nds: THREE.Vector3[] = [];
        const vels: THREE.Vector3[] = [];
        for (let i = 0; i < NODE_COUNT; i++) {
            nds.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 4
                )
            );
            vels.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15,
                    (Math.random() - 0.5) * 0.15,
                    (Math.random() - 0.5) * 0.1
                )
            );
        }
        return [nds, vels];
    }, []);

    // Flatten positions array for the Points geometry
    const pointsPositions = useMemo(() => {
        const pos = new Float32Array(NODE_COUNT * 3);
        for (let i = 0; i < NODE_COUNT; i++) {
            pos[i * 3] = nodes[i].x;
            pos[i * 3 + 1] = nodes[i].y;
            pos[i * 3 + 2] = nodes[i].z;
        }
        return pos;
    }, [nodes]);

    // Pre-allocate lines positions buffer
    const linePositions = useMemo(() => new Float32Array(MAX_LINES * 2 * 3), []);

    useFrame((state, delta) => {
        if (!pointsRef.current || !linesRef.current) return;

        const pointsAttr = pointsRef.current.geometry.attributes.position;
        const pointsArray = pointsAttr.array as Float32Array;

        const linesAttr = linesRef.current.geometry.attributes.position;
        const linesArray = linesAttr.array as Float32Array;

        let lineIndex = 0;

        // Update node positions and apply velocities
        for (let i = 0; i < NODE_COUNT; i++) {
            // Apply constant drift
            nodes[i].addScaledVector(velocities[i], delta);

            // Attract/influence nodes slightly based on mouse proximity
            const dx = mouseRef.current.x - nodes[i].x;
            const dy = mouseRef.current.y - nodes[i].y;
            const distToMouse = Math.sqrt(dx * dx + dy * dy);
            if (distToMouse < 3) {
                // Gentle pull towards cursor
                nodes[i].x += dx * 0.005;
                nodes[i].y += dy * 0.005;
            }

            // Boundary wrapping
            if (nodes[i].x > 6) {
                nodes[i].x = -6;
            } else if (nodes[i].x < -6) {
                nodes[i].x = 6;
            }
            if (nodes[i].y > 4.5) {
                nodes[i].y = -4.5;
            } else if (nodes[i].y < -4.5) {
                nodes[i].y = 4.5;
            }
            if (nodes[i].z > 3) {
                nodes[i].z = -3;
            } else if (nodes[i].z < -3) {
                nodes[i].z = 3;
            }

            // Write to points buffer
            pointsArray[i * 3] = nodes[i].x;
            pointsArray[i * 3 + 1] = nodes[i].y;
            pointsArray[i * 3 + 2] = nodes[i].z;
        }
        pointsAttr.needsUpdate = true;

        // Calculate distances and build dynamic connection lines
        for (let i = 0; i < NODE_COUNT; i++) {
            for (let j = i + 1; j < NODE_COUNT; j++) {
                const dist = nodes[i].distanceTo(nodes[j]);
                if (dist < MAX_DISTANCE) {
                    // Node 1
                    linesArray[lineIndex * 6] = nodes[i].x;
                    linesArray[lineIndex * 6 + 1] = nodes[i].y;
                    linesArray[lineIndex * 6 + 2] = nodes[i].z;

                    // Node 2
                    linesArray[lineIndex * 6 + 3] = nodes[j].x;
                    linesArray[lineIndex * 6 + 4] = nodes[j].y;
                    linesArray[lineIndex * 6 + 5] = nodes[j].z;

                    lineIndex++;
                }
            }
        }

        // Update lines rendering bounds
        linesRef.current.geometry.setDrawRange(0, lineIndex * 2);
        linesAttr.needsUpdate = true;
    });

    return (
        <group>
            {/* The nodes */}
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[pointsPositions, 3]}
                        count={NODE_COUNT}
                        array={pointsPositions}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    color="#ffb020"
                    size={0.04}
                    sizeAttenuation={true}
                    transparent={true}
                    opacity={0.65}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </points>

            {/* The connection lines */}
            <lineSegments ref={linesRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[linePositions, 3]}
                        count={linePositions.length / 3}
                        array={linePositions}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial
                    color="#ff5a1f"
                    transparent={true}
                    opacity={0.12}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </lineSegments>
        </group>
    );
}

export default function VaultBackground() {
    const reduceMotion = useReducedMotion();

    return (
        <div className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden opacity-75">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 1.5]}
            >
                {!reduceMotion && <Constellation />}
            </Canvas>
        </div>
    );
}
