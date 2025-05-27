"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "./button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioData: string; // base64 encoded audio
  mimeType: string;
  className?: string;
  autoPlay?: boolean;
}

export function AudioPlayer({ 
  audioData, 
  mimeType, 
  className,
  autoPlay = false 
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Create audio URL from base64 data
  const createAudioUrl = useCallback(() => {
    if (!audioData) return null;
    
    try {
      // Clean up previous URL if it exists
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      // Convert base64 to blob
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      return url;
    } catch (error) {
      console.error("Error creating audio URL:", error);
      setError("Failed to create audio URL");
      return null;
    }
  }, [audioData, mimeType]);

  // Cleanup URL when component unmounts or audioData changes
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [audioData]);

  // Handle audio setup and events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setError(null);

    const audioUrl = createAudioUrl();
    if (!audioUrl) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      
      // Try autoplay after metadata is loaded
      if (autoPlay) {
        audio.play().catch((error) => {
          console.log("Autoplay failed (this is normal in many browsers):", error);
          // Don't set this as an error since autoplay blocking is expected
        });
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setError("Failed to load audio");
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    // Add event listeners
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    // Set the audio source
    audio.src = audioUrl;
    audio.load(); // Explicitly load the audio

    return () => {
      // Remove event listeners
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
      
      // Pause and reset audio
      audio.pause();
      audio.src = "";
    };
  }, [audioData, mimeType, autoPlay, createAudioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || isLoading || error) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setError("Failed to play audio");
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration || isLoading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className={cn("text-sm text-red-500 p-2 bg-red-50 rounded", className)}>
        {error}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 p-3 bg-muted rounded-lg", className)}>
      <audio ref={audioRef} preload="metadata" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || !!error}
        className="h-8 w-8 p-0"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        <div 
          className="flex-1 h-2 bg-background rounded-full cursor-pointer relative"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-primary rounded-full transition-all"
            style={{ 
              width: duration ? `${(currentTime / duration) * 100}%` : "0%" 
            }}
          />
        </div>
        
        <span className="text-xs text-muted-foreground min-w-[40px]">
          {isLoading ? "..." : formatTime(currentTime)}
        </span>
        
        <span className="text-xs text-muted-foreground">/</span>
        
        <span className="text-xs text-muted-foreground min-w-[40px]">
          {isLoading ? "..." : formatTime(duration)}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMute}
        disabled={isLoading || !!error}
        className="h-8 w-8 p-0"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
} 