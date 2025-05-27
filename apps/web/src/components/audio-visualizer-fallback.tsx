"use client";

import { motion } from "framer-motion";

interface AudioVisualizerFallbackProps {
  audioLevel: number;
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  className?: string;
}

export function AudioVisualizerFallback({
  audioLevel,
  isRecording,
  isPlaying,
  isProcessing,
  className = ""
}: AudioVisualizerFallbackProps) {
  const isActive = isRecording || isPlaying || isProcessing;

  const getColor = () => {
    if (isRecording && audioLevel > 0) {
      return "rgba(52, 211, 153, 0.9)"; // Bright emerald
    } else if (isRecording) {
      return "rgba(251, 191, 36, 0.9)"; // Bright amber
    } else if (isPlaying) {
      return "rgba(167, 139, 250, 0.9)"; // Bright purple
    } else if (isProcessing) {
      return "rgba(96, 165, 250, 0.9)"; // Bright blue
    } else {
      return "rgba(203, 213, 225, 0.6)"; // Light gray
    }
  };

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      {/* Large central blob */}
      <motion.div
        className="absolute w-32 h-32 rounded-full"
        style={{
          background: `radial-gradient(circle, ${getColor()} 0%, ${getColor().replace('0.8', '0.4')} 50%, transparent 100%)`,
          filter: 'blur(2px)',
        }}
        animate={{
          scale: isActive ? [1, 1.5 + audioLevel * 1.5, 1] : 1,
          opacity: isActive ? [0.8, 1, 0.8] : 0.5,
        }}
        transition={{
          duration: 1.2,
          repeat: isActive ? Infinity : 0,
          ease: "easeInOut"
        }}
      />

      {/* Inner core */}
      <motion.div
        className="absolute w-24 h-24 rounded-full"
        style={{
          background: `radial-gradient(circle, ${getColor()} 0%, transparent 70%)`,
        }}
        animate={{
          scale: isActive ? [1, 1.4 + audioLevel * 1.0, 1] : 1,
          opacity: isActive ? [0.9, 1, 0.9] : 0.6,
        }}
        transition={{
          duration: 1.0,
          repeat: isActive ? Infinity : 0,
          ease: "easeInOut"
        }}
      />
    </div>
  );
} 