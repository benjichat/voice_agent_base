"use client";

import { useState, useEffect } from "react";
import { AudioVisualizer3D } from "./audio-visualizer-3d";
import { AudioVisualizerFallback } from "./audio-visualizer-fallback";

interface AudioVisualizerWithFallbackProps {
  audioLevel: number;
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  className?: string;
  frequencyData?: Uint8Array;
}

export function AudioVisualizerWithFallback(props: AudioVisualizerWithFallbackProps) {
  const [use3D, setUse3D] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Check for WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('WebGL not supported, falling back to 2D visualizer');
        setUse3D(false);
      }
    } catch (error) {
      console.warn('WebGL check failed, falling back to 2D visualizer:', error);
      setUse3D(false);
    }
  }, []);

  // Error handler for Three.js failures
  const handle3DError = (error: Error) => {
    console.warn('3D visualizer error, falling back to 2D:', error);
    setHasError(true);
    setUse3D(false);
  };

  if (!use3D || hasError) {
    return <AudioVisualizerFallback {...props} />;
  }

  return (
    <ErrorBoundary onError={handle3DError}>
      <AudioVisualizer3D {...props} />
    </ErrorBoundary>
  );
}

// Simple error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: (error: Error) => void;
}

function ErrorBoundary({ children, onError }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Caught error in audio visualizer:', event.error);
      setHasError(true);
      onError(event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Caught promise rejection in audio visualizer:', event.reason);
      setHasError(true);
      onError(new Error(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [onError]);

  if (hasError) {
    return null; // Let parent handle fallback
  }

  try {
    return <>{children}</>;
  } catch (error) {
    console.error('Error boundary caught error:', error);
    setHasError(true);
    onError(error as Error);
    return null;
  }
} 