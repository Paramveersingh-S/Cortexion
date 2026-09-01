'use client';

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Environment, ContactShadows, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface SensingMap3DProps {
  present: boolean;
  targetDistM: number;
  motionState: string;
  gateEnergy: number[];
}

const CarChassis = () => {
  // Load the highly realistic GLB car model
  const { scene } = useGLTF('/CarConcept.glb');
  
  return (
    <group position={[0, -0.5, 0]}>
      {/* Base plane with subtle grid */}
      <gridHelper args={[15, 30, 0x0070ff, 0x002050]} position={[0, 0, 0]} />
      
      {/* Sleek Underbody Glow */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 5]} />
        <meshBasicMaterial color="#0050ff" transparent opacity={0.15} />
      </mesh>

      {/* Realistic Car Model */}
      {/* Adjusting scale and rotation to match the typical car coordinate system in three.js */}
      <primitive object={scene} scale={0.5} position={[0, 0, 0]} rotation={[0, Math.PI, 0]} />
      
      {/* Sensor Array / Radar Unit */}
      <mesh position={[0, 0.7, -1.1]}>
         <boxGeometry args={[0.6, 0.15, 0.3]} />
         <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};
// Preload the model
useGLTF.preload('/CarConcept.glb');

const HumanTarget = ({ present, targetDistM, motionState }: { present: boolean, targetDistM: number, motionState: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      if (motionState !== 'stationary' && motionState !== 'none') {
        meshRef.current.position.y = 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.04;
      } else {
        meshRef.current.position.y = 0.6;
      }
      
      if (materialRef.current) {
         materialRef.current.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      }
    }
  });

  if (!present) return null;

  // Sensor array is at z = -1.1 relative to the car group.
  const targetZ = -1.1 + targetDistM;
  // Representing the driver seat (approx left-hand side or generalized)
  const targetX = 0.45; 

  const getColor = () => {
    switch(motionState) {
      case 'micro': return '#00ffaa'; // Breathing
      case 'moving': return '#00ffff'; // Moving
      case 'stationary': return '#ffaa00'; // Still
      default: return '#7a8098'; // Unknown
    }
  };

  const color = getColor();

  return (
    <group position={[targetX, 0, targetZ]}>
      {/* Glowing point cloud/holographic representation of human presence */}
      <mesh ref={meshRef} position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.25, 0.5, 16, 32]} />
        <meshPhysicalMaterial 
          ref={materialRef}
          color={color} 
          emissive={color}
          emissiveIntensity={0.8}
          transmission={0.5}
          roughness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Ground projection */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};

const RadarWaves = ({ gateEnergy }: { gateEnergy: number[] }) => {
  return (
    <group position={[0, 0.2, -1.1]}>
       {gateEnergy.map((energy, index) => {
         if (energy < 40) return null; // Filter noise
         const dist = index * 0.7; // Approx 0.7m per gate
         const opacity = Math.min(energy / 400, 0.5);
         return (
           <mesh key={index} position={[0, 0, dist]} rotation={[Math.PI/2, 0, 0]}>
             <torusGeometry args={[dist, 0.015, 16, 64]} />
             <meshBasicMaterial color="#0088ff" transparent opacity={opacity} />
           </mesh>
         );
       })}
    </group>
  );
};

export default function SensingMap3D({ present, targetDistM, motionState, gateEnergy }: SensingMap3DProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px', background: 'radial-gradient(circle at center, #0a0e17 0%, #030508 100%)' }}>
      <Canvas camera={{ position: [4, 4, 6], fov: 40 }}>
        {/* Advanced Lighting Setup */}
        <ambientLight intensity={0.4} />
        <spotLight position={[0, 10, 0]} intensity={1.5} penumbra={1} color="#0055ff" />
        <pointLight position={[5, 2, 5]} intensity={0.5} color="#00aaff" />
        <pointLight position={[-5, 2, -5]} intensity={0.5} color="#00aaff" />
        
        {/* Environment Map for Glass Reflections */}
        <Suspense fallback={null}>
          <Environment preset="night" />
        </Suspense>
        
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
          minPolarAngle={0}
          minDistance={3}
          maxDistance={12}
          autoRotate
          autoRotateSpeed={0.5}
        />
        
        <group position={[0, -0.5, 0]}>
          <CarChassis />
          <HumanTarget present={present} targetDistM={targetDistM} motionState={motionState} />
          <RadarWaves gateEnergy={gateEnergy} />
          <Suspense fallback={null}>
            <ContactShadows position={[0, -0.49, 0]} opacity={0.6} scale={10} blur={2} far={2} />
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}
