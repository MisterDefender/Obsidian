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

    // ember tone drifts across the facets over time
    float t = 0.5 + 0.5 * sin(uTime * 0.5 + N.y * 3.0 + N.x * 1.5);
    vec3 ember = mix(uEmber, uEmberGlow, t);

    // faint oil-on-glass iridescence in the dark body
    float irid = 0.5 + 0.5 * sin(N.x * 9.0 + N.z * 7.0 + uTime * 0.3);
    vec3 base = uColorBase + uIris * irid * 0.05;

    vec3 color = mix(base, ember, fres);
    color += ember * pow(fres, 3.0) * 0.8; // molten edge bloom feed

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CrystalProps {
    /** Disable rotation / time animation for reduced-motion or low power. */
    animate?: boolean;
    /** Ember accent reacts to pointer position [-1, 1]. */
    pointer?: React.RefObject<{ x: number; y: number }>;
}

export function Crystal({ animate = true }: CrystalProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Faceted obsidian gem: icosahedron with flat (per-face) normals.
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

    useFrame((state, delta) => {
        if (!animate) return;
        material.uniforms.uTime.value = state.clock.elapsedTime;
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.18;
            meshRef.current.rotation.x += delta * 0.05;
            // subtle parallax lean toward the pointer
            const px = state.pointer.x * 0.25;
            const py = state.pointer.y * 0.2;
            meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, px, 0.05);
            meshRef.current.position.y = THREE.MathUtils.lerp(
                meshRef.current.position.y,
                py * 0.3,
                0.05
            );
        }
    });

    return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
