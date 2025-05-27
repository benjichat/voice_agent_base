"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';



interface AudioOrbProps {
  audioLevel: number;
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
}

interface AudioOrbPropsExtended extends AudioOrbProps {
  frequencyData?: Uint8Array;
}

function FlowingParticleField({ audioLevel, isRecording, isPlaying, isProcessing, frequencyData }: AudioOrbPropsExtended) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 1000; // Many more particles for dense effect
  const currentColorRef = useRef(new THREE.Color(0.8, 0.8, 0.9));
  
  // Determine color based on state - brighter colors for dark background
  const targetColor = useMemo(() => {
    if (isRecording) {
      return audioLevel > 0 ? new THREE.Color(0.2, 1.0, 0.6) : new THREE.Color(1.0, 0.7, 0.2);
    } else if (isPlaying) {
      return new THREE.Color(0.7, 0.4, 1.0);
    } else if (isProcessing) {
      return new THREE.Color(0.4, 0.7, 1.0);
    } else {
      return new THREE.Color(0.8, 0.8, 0.9);
    }
  }, [isRecording, isPlaying, isProcessing, audioLevel]);

  const [positions, colors, scales, originalPositions] = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const originalPositions = new Float32Array(particleCount * 3);
    
    // Create particles in a spherical distribution
    for (let i = 0; i < particleCount; i++) {
      // Use fibonacci sphere for even distribution
      const y = 1 - (i / (particleCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = ((i + 1) % particleCount) * 2.399963229728653; // golden angle
      
      // Scale to desired sphere size
      const sphereRadius = 3;
      const x = Math.cos(theta) * radiusAtY * sphereRadius;
      const z = Math.sin(theta) * radiusAtY * sphereRadius;
      const finalY = y * sphereRadius;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = finalY;
      positions[i * 3 + 2] = z;
      
      // Store original positions for reference
      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = finalY;
      originalPositions[i * 3 + 2] = z;
      
      // Initial color (will be updated in useFrame)
      colors[i * 3] = 0.5;
      colors[i * 3 + 1] = 0.5;
      colors[i * 3 + 2] = 1.0;
      
      scales[i] = Math.random() * 0.3 + 0.7;
    }
    
    return [positions, colors, scales, originalPositions];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
      const time = state.clock.elapsedTime;
      
      // Get frequency data for real audio response
      const hasFrequencyData = frequencyData && frequencyData.length > 0;
      
      // Debug frequency data
      if (hasFrequencyData && isPlaying) {
        const maxFreq = Math.max(...frequencyData);
        const avgFreq = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
        if (state.clock.elapsedTime % 1 < 0.016) { // Log once per second
          console.log('🎵 3D Viz - Frequency data:', {
            max: maxFreq,
            avg: avgFreq.toFixed(2),
            length: frequencyData.length,
            isPlaying,
            audioLevel
          });
        }
      }
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Get original spherical position
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];
        
        // Calculate normalized Y position (-1 to 1)
        const yNormalized = (originalY / 3.0 + 1) / 2; // 0 to 1 from bottom to top
        
        let displacement = 0;
        let frequencyIntensity = 0;
        
        if (hasFrequencyData) {
          // Map particle position to frequency bins
          const binCount = frequencyData.length;
          
          // Use particle's Y position to determine which frequencies affect it
          // Lower particles respond to bass, middle to mids, upper to treble
          const frequencyRange = 0.4; // How much of the frequency spectrum each layer responds to
          
          const startBin = Math.floor(yNormalized * binCount * (1 - frequencyRange));
          const endBin = Math.floor(Math.min(binCount - 1, startBin + binCount * frequencyRange));
          
          // Calculate average frequency intensity for this particle's range
          for (let bin = startBin; bin <= endBin; bin++) {
            frequencyIntensity += frequencyData[bin] / 255.0;
          }
          frequencyIntensity /= (endBin - startBin + 1);
          
          // Smooth the frequency intensity
          frequencyIntensity = Math.pow(frequencyIntensity, 0.8); // Less smoothing for more response
          
          // Calculate more noticeable displacement
          const gentleTime = time * 0.8; // Slightly faster time progression
          const breathingFactor = 0.2 + Math.sin(gentleTime + i * 0.001) * 0.1; // More breathing
          displacement = frequencyIntensity * (1.2 + breathingFactor); // Much bigger displacement
          
          // Calculate position with more dramatic radial expansion
          const radius = Math.sqrt(originalX * originalX + originalY * originalY + originalZ * originalZ);
          const expandedRadius = radius + displacement * 1.5;
          const scale = expandedRadius / radius;
          
          // More noticeable wave motion
          const wavePhase = gentleTime + yNormalized * Math.PI * 2;
          const gentleWave = Math.sin(wavePhase) * 0.15;
          
          // Add some rotational displacement for more movement
          const angle = Math.atan2(originalZ, originalX);
          const rotationalOffset = frequencyIntensity * 0.3;
          
          positions[i3] = originalX * scale + Math.cos(angle + rotationalOffset) * gentleWave;
          positions[i3 + 1] = originalY * (scale + frequencyIntensity * 0.5); // More vertical movement
          positions[i3 + 2] = originalZ * scale + Math.sin(angle + rotationalOffset) * gentleWave;
          
        } else {
          // Fallback to more noticeable breathing animation when no frequency data
          const breathe = Math.sin(time * 1.0 + i * 0.002) * 0.15 + 1.0;
          const secondaryWave = Math.sin(time * 0.5 + i * 0.001) * 0.08;
          
          positions[i3] = originalX * (breathe + secondaryWave);
          positions[i3 + 1] = originalY * breathe;
          positions[i3 + 2] = originalZ * (breathe - secondaryWave);
          
          frequencyIntensity = Math.abs(breathe - 1.0) * 5;
        }
        
        // More dramatic color transitions based on frequency intensity
        const colorBoost = 0.4 + frequencyIntensity * 0.8; // Wider range
        
        // Less smoothing for more reactive colors
        const smoothIntensity = Math.pow(frequencyIntensity, 0.7);
        
        // Smooth color transition
        currentColorRef.current.lerp(targetColor, 0.1);
        
        if (hasFrequencyData && smoothIntensity > 0.2) {
          // Brighter glow for active frequencies
          colors[i3] = Math.min(1.0, currentColorRef.current.r * colorBoost + smoothIntensity * 0.5);
          colors[i3 + 1] = Math.min(1.0, currentColorRef.current.g * colorBoost + smoothIntensity * 0.5);
          colors[i3 + 2] = Math.min(1.0, currentColorRef.current.b * colorBoost + smoothIntensity * 0.7);
        } else {
          // Base color with more variation
          const pulseEffect = Math.sin(time + i * 0.001) * 0.1 + 0.9;
          colors[i3] = currentColorRef.current.r * colorBoost * pulseEffect;
          colors[i3 + 1] = currentColorRef.current.g * colorBoost * pulseEffect;
          colors[i3 + 2] = currentColorRef.current.b * colorBoost * pulseEffect;
        }
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
      
      // More noticeable rotation
      const baseRotation = 0.002;
      const audioBoost = hasFrequencyData ? audioLevel * 0.008 : 0;
      pointsRef.current.rotation.y += baseRotation + audioBoost;
      
      // Add slight wobble for more dynamic feel
      pointsRef.current.rotation.x = Math.sin(time * 0.3) * 0.05;
      pointsRef.current.rotation.z = Math.cos(time * 0.4) * 0.03;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
                 <bufferAttribute
           attach="attributes-position"
           count={particleCount}
           array={positions}
           itemSize={3}
           args={[positions, 3]}
         />
         <bufferAttribute
           attach="attributes-color"
           count={particleCount}
           array={colors}
           itemSize={3}
           args={[colors, 3]}
         />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}



interface AudioVisualizer3DProps {
  audioLevel: number;
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  className?: string;
  frequencyData?: Uint8Array;
}

export function AudioVisualizer3D({
  audioLevel,
  isRecording,
  isPlaying,
  isProcessing,
  className = "",
  frequencyData
}: AudioVisualizer3DProps) {
  const isActive = isRecording || isPlaying || isProcessing;

  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        {/* Lighting optimized for dark background */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />
        
        {/* Main audio-reactive particle field */}
        <group position={[0, 0.5, 0]}>
          <FlowingParticleField
            audioLevel={audioLevel}
            isRecording={isRecording}
            isPlaying={isPlaying}
            isProcessing={isProcessing}
            frequencyData={frequencyData}
          />
        </group>
      </Canvas>
    </div>
  );
} 