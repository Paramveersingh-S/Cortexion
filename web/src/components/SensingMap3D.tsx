'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';

interface SensingMap3DProps {
  present: boolean;
  targetDistM: number;
  motionState: string;
  gateEnergy: number[];
}

const CarChassis = () => {
  // Simple wireframe chassis for a premium look
  const points = useMemo(() => {
    const pts = [];
    // Base rectangle
    pts.push(new THREE.Vector3(-1, 0, -2));
    pts.push(new THREE.Vector3(1, 0, -2));
    pts.push(new THREE.Vector3(1, 0, 2));
    pts.push(new THREE.Vector3(-1, 0, 2));
    pts.push(new THREE.Vector3(-1, 0, -2));
    
    // Roof
    pts.push(new THREE.Vector3(-0.8, 1.2, -0.5));
    pts.push(new THREE.Vector3(0.8, 1.2, -0.5));
    pts.push(new THREE.Vector3(0.8, 1.2, 1));
    pts.push(new THREE.Vector3(-0.8, 1.2, 1));
    pts.push(new THREE.Vector3(-0.8, 1.2, -0.5));
    return pts;
  }, []);

  return (
    <group position={[0, -0.5, 0]}>
      {/* Base plane with grid */}
      <gridHelper args={[10, 20, 0x0070ff, 0x002050]} position={[0, -0.01, 0]} />
      
      {/* Car Outline */}
      <Line points={points} color="#00c8ff" lineWidth={2} dashed dashScale={10} dashSize={1} gapSize={0.5} />
      
      {/* Wheels */}
      {[-1, 1].map(x => 
        [-1.5, 1.5].map(z => (
          <mesh key={`${x}-${z}`} position={[x*1.1, 0.3, z]} rotation={[Math.PI/2, 0, Math.PI/2]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshBasicMaterial color="#0c0d14" wireframe />
          </mesh>
        ))
      )}
      
      {/* Seats (Representational) */}
      <mesh position={[0.4, 0.2, -0.5]}>
         <boxGeometry args={[0.5, 0.1, 0.6]} />
         <meshBasicMaterial color="#1a1c29" wireframe />
      </mesh>
      <mesh position={[-0.4, 0.2, -0.5]}>
         <boxGeometry args={[0.5, 0.1, 0.6]} />
         <meshBasicMaterial color="#1a1c29" wireframe />
      </mesh>
      <mesh position={[0, 0.2, 1.2]}>
         <boxGeometry args={[1.5, 0.1, 0.6]} />
         <meshBasicMaterial color="#1a1c29" wireframe />
      </mesh>
      
      {/* Dashboard (Sensor Location) */}
      <mesh position={[0, 0.6, -1.2]}>
         <boxGeometry args={[1.8, 0.2, 0.4]} />
         <meshBasicMaterial color="#0070ff" opacity={0.3} transparent />
      </mesh>
    </group>
  );
};

const HumanTarget = ({ present, targetDistM, motionState }: { present: boolean, targetDistM: number, motionState: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Bobbing effect for motion
      if (motionState !== 'stationary' && motionState !== 'none') {
        meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
      } else {
        meshRef.current.position.y = 0.5;
      }
      
      // Pulse effect based on motion state
      if (materialRef.current) {
         materialRef.current.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.5;
      }
    }
  });

  if (!present) return null;

  // The sensor is at z = -1.2. The target distance goes back into the car (positive z).
  const targetZ = -1.2 + targetDistM;
  // We assume driver seat (x = 0.4) for single target demo
  const targetX = 0.4; 

  const getColor = () => {
    switch(motionState) {
      case 'micro': return '#00e87b'; // Breathing -> Green
      case 'moving': return '#00c8ff'; // Moving -> Cyan
      case 'stationary': return '#ff9500'; // Still -> Orange
      default: return '#7a8098'; // Unknown
    }
  };

  const color = getColor();

  return (
    <mesh ref={meshRef} position={[targetX, 0.5, targetZ]}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial 
        ref={materialRef}
        color={color} 
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.8}
        wireframe
      />
      {/* Core glow */}
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </mesh>
  );
};

const RadarWaves = ({ gateEnergy }: { gateEnergy: number[] }) => {
  // Render rings or planes representing the distance gates
  return (
    <group position={[0, 0, -1.2]}>
       {gateEnergy.map((energy, index) => {
         if (energy < 50) return null; // Only show active gates
         const dist = index * 0.7; // Gate width approx 0.7m
         const opacity = Math.min(energy / 500, 0.6);
         return (
           <mesh key={index} position={[0, 0, dist]} rotation={[Math.PI/2, 0, 0]}>
             <torusGeometry args={[dist, 0.02, 8, 32]} />
             <meshBasicMaterial color="#0070ff" transparent opacity={opacity} />
           </mesh>
         );
       })}
    </group>
  );
};

export default function SensingMap3D({ present, targetDistM, motionState, gateEnergy }: SensingMap3DProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', background: 'transparent' }}>
      <Canvas camera={{ position: [3, 3, 5], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2 + 0.1}
          minDistance={2}
          maxDistance={10}
        />
        <CarChassis />
        <HumanTarget present={present} targetDistM={targetDistM} motionState={motionState} />
        <RadarWaves gateEnergy={gateEnergy} />
      </Canvas>
    </div>
  );
}
