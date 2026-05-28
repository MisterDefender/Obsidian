'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorBase;
  uniform vec3 uEmber;
  uniform vec3 uEmberGlow;
  uniform vec3 uIris;
  uniform float uFresnelPower;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPower);
    float t = 0.5 + 0.5 * sin(uTime * 0.5 + N.y * 3.0 + N.x * 1.5);
    vec3 ember = mix(uEmber, uEmberGlow, t);
    float irid = 0.5 + 0.5 * sin(N.x * 9.0 + N.z * 7.0 + uTime * 0.3);
    vec3 base = uColorBase + uIris * irid * 0.05;
    vec3 color = mix(base, ember, fres);
    color += ember * pow(fres, 3.0) * 0.8;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const SHARD_CAP = 28;

// Deterministic points spread over a sphere (Fibonacci lattice).
function fibonacciPoints(count: number, radius: number): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / Math.max(1, count - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        pts.push(
            new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius)
        );
    }
    return pts;
}

export interface CrystalProps {
    animate?: boolean;
    /** Number of glowing shards to show (e.g. the anonymity set). */
    shards?: number;
}

export function Crystal({ animate = true, shards = 0 }: CrystalProps) {
    const groupRef = useRef<THREE.Group>(null);

    const geometry = useMemo(() => {
        const geo = new THREE.IcosahedronGeometry(1.6, 1).toNonIndexed();
        geo.computeVertexNormals();
        return geo;
    }, []);

    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    uColorBase: { value: new THREE.Color('#0b0b0e') },
                    uEmber: { value: new THREE.Color('#ff5a1f') },
                    uEmberGlow: { value: new THREE.Color('#ffb020') },
                    uIris: { value: new THREE.Color('#7c5cff') },
                    uFresnelPower: { value: 2.6 },
                },
            }),
        []
    );

    const shardPositions = useMemo(() => fibonacciPoints(SHARD_CAP, 1.9), []);
    const shardGeometry = useMemo(() => new THREE.SphereGeometry(0.06, 12, 12), []);
    const shardMaterial = useMemo(
        () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb020') }),
        []
    );
    const visibleShards = Math.max(0, Math.min(SHARD_CAP, Math.floor(shards)));

    useFrame((state, delta) => {
        material.uniforms.uTime.value = state.clock.elapsedTime;
        if (!animate || !groupRef.current) return;
        groupRef.current.rotation.y += delta * 0.18;
        groupRef.current.rotation.x += delta * 0.05;
        const px = state.pointer.x * 0.25;
        const py = state.pointer.y * 0.2;
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, px, 0.05);
        groupRef.current.position.y = THREE.MathUtils.lerp(
            groupRef.current.position.y,
            py * 0.3,
            0.05
        );
    });

    return (
        <group ref={groupRef}>
            <mesh geometry={geometry} material={material} />
            {shardPositions.slice(0, visibleShards).map((p, i) => (
                <mesh
                    key={i}
                    geometry={shardGeometry}
                    material={shardMaterial}
                    position={[p.x, p.y, p.z]}
                />
            ))}
        </group>
    );
}
