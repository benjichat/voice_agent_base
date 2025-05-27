"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Volume2, VolumeX, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useSpeechRecording } from "@/hooks/useSpeechRecording";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Message } from "@langchain/langgraph-sdk";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import { AudioVisualizerWithFallback } from "./audio-visualizer-with-fallback";

export function VoiceOnlyInterface() {
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128));
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [processingTimeoutId, setProcessingTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  
  const stream = useStreamContext();
  const {
    recordingState,
    isRecording,
    audioLevel: micAudioLevel,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useSpeechRecording();

  // Cleanup function for audio resources
  const cleanupAudio = useCallback(() => {
    console.log('🧹 Cleaning up audio resources...');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(error => {
        console.warn('Error closing audio context:', error);
      });
      audioContextRef.current = null;
    }
    
    if (processingTimeoutId) {
      clearTimeout(processingTimeoutId);
      setProcessingTimeoutId(null);
    }
    
    setIsPlayingAudio(false);
    setAudioLevel(0);
    setFrequencyData(new Uint8Array(128));
    setIsProcessingVoice(false);
  }, [processingTimeoutId]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupAudio;
  }, [cleanupAudio]);

  // Update audio level for visual feedback during recording
  useEffect(() => {
    if (recordingState === 'recording') {
      setAudioLevel(micAudioLevel);
      // When recording, we don't have frequency data from the mic yet
      // So we'll simulate some based on the audio level
      const simulatedFrequency = new Uint8Array(128);
      for (let i = 0; i < 128; i++) {
        // Create a frequency distribution that emphasizes lower frequencies for voice
        const freq = i / 128;
        const voiceEmphasis = Math.exp(-freq * 4); // Exponential decay for voice frequencies
        simulatedFrequency[i] = Math.floor(micAudioLevel * 255 * voiceEmphasis * (0.5 + Math.random() * 0.5));
      }
      setFrequencyData(simulatedFrequency);
    } else if (recordingState === 'requesting') {
      // Show immediate visual feedback when requesting microphone
      setAudioLevel(0.2);
      const startupFrequency = new Uint8Array(128);
      for (let i = 0; i < 128; i++) {
        startupFrequency[i] = Math.floor(30 + Math.random() * 20);
      }
      setFrequencyData(startupFrequency);
    }
  }, [micAudioLevel, recordingState]);

  // Handle recording errors
  useEffect(() => {
    if (recordingError) {
      toast.error("Recording failed", {
        description: recordingError,
      });
    }
  }, [recordingError]);

  // Handle stream messages for audio playback - Refactored to prevent infinite loops
  useEffect(() => {
    // Early return if no stream values or still loading
    if (!stream.values || stream.isLoading) {
      return;
    }

    // Check for ttsOutput directly in the stream values (this is where ElevenLabs audio should be)
    if (stream.values.ttsOutput && stream.values.ttsOutput.audioData) {
      const ttsOutput = stream.values.ttsOutput;
      console.log('🎵 Found TTS output in stream values:', {
        audioDataLength: ttsOutput.audioData.length,
        mimeType: ttsOutput.mimeType,
        size: ttsOutput.size,
        hasUserInteracted: hasUserInteracted
      });
      
      // Use a combination of message count and TTS data length as unique identifier to prevent re-processing
      const currentTtsId = `tts_${stream.messages.length}_${ttsOutput.audioData.length}`;
      if (currentTtsId !== lastProcessedMessageId) {
        console.log('🎵 Playing new TTS audio from stream values');
        setLastProcessedMessageId(currentTtsId);
        
        // Only play audio if user has interacted with the page
        if (hasUserInteracted) {
          playAudioFromBase64(ttsOutput.audioData).catch(error => {
            console.error('🎵 Error playing TTS audio:', error);
          });
        } else {
          console.log('🎵 Waiting for user interaction before playing audio');
          toast.info("Audio response ready", {
            description: "Click the record button to enable audio playback",
            duration: 3000,
          });
        }
      }
    }
  }, [stream.values?.ttsOutput, stream.isLoading, lastProcessedMessageId, hasUserInteracted]);

  // Handle AI messages for audio playback - Separate effect to reduce complexity
  useEffect(() => {
    if (stream.isLoading || !stream.messages.length) {
      return;
    }

    const lastMessage = stream.messages[stream.messages.length - 1];
    
    // Only process AI messages that we haven't processed before
    if (
      lastMessage?.type === "ai" && 
      lastMessage.id && 
      lastMessage.id !== lastProcessedMessageId
    ) {
      console.log('🎵 Processing AI message for audio:', {
        messageId: lastMessage.id,
        messageType: lastMessage.type
      });
      
      // Check for ttsOutput field (this is where ElevenLabs audio is stored)
      const ttsOutput = (lastMessage as any).ttsOutput;
      if (ttsOutput && ttsOutput.audioData) {
        console.log('🎵 Found TTS output in message:', {
          audioDataLength: ttsOutput.audioData.length,
          mimeType: ttsOutput.mimeType,
          size: ttsOutput.size
        });
        setLastProcessedMessageId(lastMessage.id);
        playAudioFromBase64(ttsOutput.audioData).catch(error => {
          console.error('🎵 Error playing message TTS audio:', error);
        });
        return;
      }
      
      // Check additional_kwargs for audio
      const additionalKwargs = (lastMessage as any).additional_kwargs;
      if (additionalKwargs?.ttsOutput && additionalKwargs.ttsOutput.audioData) {
        console.log('🎵 Found TTS output in additional_kwargs');
        setLastProcessedMessageId(lastMessage.id);
        playAudioFromBase64(additionalKwargs.ttsOutput.audioData).catch(error => {
          console.error('🎵 Error playing additional_kwargs TTS audio:', error);
        });
        return;
      }
      
      // Check response_metadata for audio
      const responseMetadata = (lastMessage as any).response_metadata;
      if (responseMetadata?.ttsOutput && responseMetadata.ttsOutput.audioData) {
        console.log('🎵 Found TTS output in response_metadata');
        setLastProcessedMessageId(lastMessage.id);
        playAudioFromBase64(responseMetadata.ttsOutput.audioData).catch(error => {
          console.error('🎵 Error playing response_metadata TTS audio:', error);
        });
        return;
      }
      
      console.log('❌ No audio data found in AI message');
    }
  }, [stream.messages, stream.isLoading, lastProcessedMessageId]);

  const setupAudioVisualization = (audioElement: HTMLAudioElement) => {
    try {
      // Create a new AudioContext for each audio playback since we close it after each use
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const audioContext = audioContextRef.current;
      
      // Resume audio context if it's suspended (common in modern browsers)
      if (audioContext.state === 'suspended') {
        console.log('🎵 Audio context suspended, resuming...');
        audioContext.resume().then(() => {
          console.log('🎵 Audio context resumed successfully');
        });
      }
      
      const source = audioContext.createMediaElementSource(audioElement);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      analyserRef.current = analyser;
      
      console.log('🎵 Audio visualization setup complete - analyser created');
      
      let isAnimating = true;
      
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isAnimating) {
          console.log('🎵 updateAudioLevel early return - analyser:', !!analyserRef.current, 'animating:', isAnimating);
          return;
        }
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Update frequency data for visualizer
        setFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
        
        // Log frequency data for debugging
        const maxFreq = Math.max(...dataArray);
        if (maxFreq > 0) {
          console.log('🎵 Frequency data - max:', maxFreq, 'avg:', average.toFixed(2), 'normalized:', normalizedLevel.toFixed(2));
        }
        
        setAudioLevel(normalizedLevel);
        
        if (isAnimating) {
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      // Store cleanup function on the audio element
      (audioElement as any).stopVisualization = () => {
        console.log('🎵 Stopping visualization');
        isAnimating = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
      
      // Start the visualization loop immediately
      updateAudioLevel();
    } catch (error) {
      console.warn('Audio visualization setup failed:', error);
      // Fallback to simple random visualization
      let fallbackInterval: NodeJS.Timeout;
      const startFallback = () => {
        fallbackInterval = setInterval(() => {
          if (!isPlayingAudio) {
            clearInterval(fallbackInterval);
            return;
          }
          const simLevel = Math.random() * 0.6 + 0.2;
          setAudioLevel(simLevel);
          
          // Simulate frequency data
          const simFreq = new Uint8Array(128);
          for (let i = 0; i < 128; i++) {
            simFreq[i] = Math.floor(Math.random() * simLevel * 255);
          }
          setFrequencyData(simFreq);
        }, 100);
      };
      startFallback();
    }
  };

  const playAudioFromUrl = async (audioUrl: string) => {
    console.log('🎵 playAudioFromUrl called with:', audioUrl);
    try {
      setIsPlayingAudio(true);
      setAudioLevel(0);
      
      if (audioRef.current) {
        console.log('🎵 Setting audio source to:', audioUrl);
        audioRef.current.src = audioUrl;
        audioRef.current.onloadeddata = () => {
          console.log('🎵 Audio loaded successfully');
          if (audioRef.current) {
            setupAudioVisualization(audioRef.current);
          }
        };
        
        audioRef.current.onended = () => {
          console.log('🎵 Audio playback ended');
          if ((audioRef.current as any).stopVisualization) {
            (audioRef.current as any).stopVisualization();
          }
          setIsPlayingAudio(false);
          setAudioLevel(0);
          setFrequencyData(new Uint8Array(128));
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        };
        
        audioRef.current.onerror = (e) => {
          console.error('🎵 Audio error:', e);
          setIsPlayingAudio(false);
          setAudioLevel(0);
          setFrequencyData(new Uint8Array(128));
          toast.error("Failed to play audio response");
        };
        
        console.log('🎵 Attempting to play audio...');
        await audioRef.current.play();
        console.log('🎵 Audio play() succeeded');
        toast.success("Playing response");
      } else {
        console.error('🎵 audioRef.current is null');
      }
    } catch (error) {
      console.error('🎵 Error playing audio from URL:', error);
      setIsPlayingAudio(false);
      setAudioLevel(0);
      setFrequencyData(new Uint8Array(128));
      
      // Handle autoplay policy errors specifically
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('🎵 Autoplay blocked - this is normal browser behavior');
        toast.info("Audio ready to play", {
          description: "Click the record button to enable audio playback",
          duration: 3000,
        });
      } else {
        toast.error("Failed to play audio response");
      }
    }
  };

  const playAudioFromBase64 = async (base64Audio: string) => {
    console.log('🎵 playAudioFromBase64 called with base64 length:', base64Audio.length);
    
    // Prevent playing if already playing to avoid conflicts
    if (isPlayingAudio) {
      console.log('🎵 Audio already playing, skipping new request');
      return;
    }

    // Validate base64 data
    if (!base64Audio || base64Audio.length === 0) {
      console.error('🎵 Invalid base64 audio data');
      toast.error("Invalid audio data");
      return;
    }

    // Check for extremely large audio data that might cause issues
    const maxBase64Length = 100 * 1024 * 1024; // ~75MB when decoded
    if (base64Audio.length > maxBase64Length) {
      console.error('🎵 Base64 audio data too large:', base64Audio.length);
      toast.error("Audio response too large to play");
      return;
    }

    try {
      // Clean up any existing audio resources first
      if (animationFrameRef.current) {
        console.log('🧹 Cancelling animation frame');
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (currentAudioUrlRef.current) {
        console.log('🧹 Cleaning up existing audio URL');
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      
      // Clean up existing audio context and analyser
      if (audioContextRef.current) {
        console.log('🧹 Cleaning up existing audio context');
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (analyserRef.current) {
        console.log('🧹 Cleaning up existing analyser');
        analyserRef.current = null;
      }

      setIsPlayingAudio(true);
      setAudioLevel(0);
      
      // Convert base64 to blob with error handling
      console.log('🎵 Converting base64 to blob...');
      let binaryString: string;
      let audioBlob: Blob;
      let audioUrl: string;
      
      try {
        binaryString = atob(base64Audio);
      } catch (decodeError) {
        console.error('🎵 Base64 decode failed:', decodeError);
        throw new Error('Invalid base64 audio format');
      }
      
      try {
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        audioBlob = new Blob([bytes], { type: 'audio/wav' });
        audioUrl = URL.createObjectURL(audioBlob);
        console.log('🎵 Created blob URL:', audioUrl);
      } catch (blobError) {
        console.error('🎵 Blob creation failed:', blobError);
        throw new Error('Failed to create audio blob');
      }

      // Store the current URL for cleanup
      currentAudioUrlRef.current = audioUrl;

      // Create a fresh audio element for this playback
      const audio = new Audio();
      audioRef.current = audio;
      
      console.log('🎵 Created fresh audio element');

      // Set up event handlers
      const cleanup = () => {
        console.log('🎵 Cleaning up audio playback');
        setIsPlayingAudio(false);
        setAudioLevel(0);
        setFrequencyData(new Uint8Array(128));
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current = null;
        }
      };

      audio.onloadeddata = () => {
        console.log('🎵 Base64 audio loaded successfully');
        // Small delay to ensure audio is ready
        setTimeout(() => {
          setupAudioVisualization(audio);
        }, 100);
      };
      
      audio.onended = () => {
        console.log('🎵 Base64 audio playback ended');
        if ((audio as any).stopVisualization) {
          (audio as any).stopVisualization();
        }
        cleanup();
      };
      
      audio.onerror = (e) => {
        console.error('🎵 Base64 audio error:', e);
        cleanup();
        
        // Handle autoplay policy errors specifically
        if (e instanceof Error && e.name === 'NotAllowedError') {
          console.log('🎵 Autoplay blocked - this is normal browser behavior');
          toast.info("Audio ready to play", {
            description: "Click the record button to enable audio playback",
            duration: 3000,
          });
        } else {
          toast.error("Failed to play audio response");
        }
      };

      audio.onplay = () => {
        console.log('🎵 Audio started playing');
      };

      audio.onpause = () => {
        console.log('🎵 Audio paused');
      };
      
      // Set the source and attempt to play
      audio.src = audioUrl;
      console.log('🎵 Attempting to play base64 audio...');
      await audio.play();
      console.log('🎵 Base64 audio play() succeeded');
      toast.success("Playing response");
      
    } catch (error) {
      console.error('🎵 Error playing audio from base64:', error);
      setIsPlayingAudio(false);
      setAudioLevel(0);
      setFrequencyData(new Uint8Array(128));
      
      // Handle autoplay policy errors specifically
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('🎵 Autoplay blocked - this is normal browser behavior');
        toast.info("Audio ready to play", {
          description: "Click the record button to enable audio playback",
          duration: 3000,
        });
      } else {
        toast.error("Failed to play audio response");
      }
    }
  };

  const playAudioFromData = async (audioData: any) => {
    console.log('🎵 playAudioFromData called with:', typeof audioData, audioData);
    if (typeof audioData === 'string') {
      console.log('🎵 Audio data is string, treating as base64');
      // Assume it's base64 if it's a string
      await playAudioFromBase64(audioData);
    } else if (audioData instanceof Blob) {
      console.log('🎵 Audio data is Blob');
      // Handle blob data
      const audioUrl = URL.createObjectURL(audioData);
      await playAudioFromUrl(audioUrl);
    } else if (audioData.url) {
      console.log('🎵 Audio data has URL property:', audioData.url);
      // Handle object with URL
      await playAudioFromUrl(audioData.url);
    } else if (audioData.base64) {
      console.log('🎵 Audio data has base64 property');
      // Handle object with base64
      await playAudioFromBase64(audioData.base64);
    } else {
      console.warn('🎵 Unknown audio data format:', audioData);
      toast.error("Unsupported audio format");
    }
  };

  const handleRecordingToggle = async () => {
    if (isProcessingVoice || stream.isLoading) return;

    // Mark that user has interacted with the page
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      console.log('🎵 User interaction detected, audio playback now enabled');
    }

    if (recordingState === 'idle') {
      // Immediate visual feedback before starting recording
      setAudioLevel(0.1);
      const clickFrequency = new Uint8Array(128);
      for (let i = 0; i < 128; i++) {
        clickFrequency[i] = Math.floor(20 + Math.sin(i * 0.1) * 20);
      }
      setFrequencyData(clickFrequency);
      
      await startRecording();
    } else if (recordingState === 'recording') {
      // Show stopping animation
      setAudioLevel(0.05);
      
      const audioBlob = await stopRecording();
      if (audioBlob) {
        await handleVoiceRecordingComplete(audioBlob);
      }
    }
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    if (stream.isLoading) return;
    
    setIsProcessingVoice(true);

    // Set a timeout to prevent hanging if processing takes too long
    const timeoutId = setTimeout(() => {
      console.error('🚨 Voice processing timed out');
      setIsProcessingVoice(false);
      toast.error("Processing timed out", {
        description: "Please try recording a shorter message.",
      });
    }, 60000); // 60 second timeout

    setProcessingTimeoutId(timeoutId);
    
    try {
      console.log(`🎤 Processing audio blob:`, {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Check for extremely large files that might cause memory issues
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (audioBlob.size > maxSize) {
        console.error('🚨 Audio file too large:', audioBlob.size, 'bytes');
        toast.error("Audio file too large", {
          description: "Please record a shorter message (max 50MB).",
        });
        return;
      }

      // Convert blob to base64 for transmission with memory-efficient approach
      let base64Audio: string;
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Use chunks to prevent call stack overflow for large files
        const chunkSize = 8192; // 8KB chunks
        let binaryString = '';
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode(...chunk);
        }
        
        base64Audio = btoa(binaryString);
        console.log('✅ Base64 conversion completed, length:', base64Audio.length);
      } catch (conversionError) {
        console.error('🚨 Base64 conversion failed:', conversionError);
        toast.error("Failed to process audio", {
          description: "Audio file format not supported.",
        });
        return;
      }
      
      // Submit audio data to LangGraph workflow
      const toolMessages = ensureToolCallsHaveResponses(stream.messages);
      stream.submit(
        { 
          audioInput: {
            audioData: base64Audio,
            mimeType: audioBlob.type,
            size: audioBlob.size
          }
        },
        {
          streamMode: ["values"],
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              ...toolMessages,
              {
                id: uuidv4(),
                type: "human",
                content: "🎤 Voice message",
              } as Message,
            ],
          }),
        },
      );

      toast.success("Voice message sent!", {
        description: "Processing your request...",
      });
      
    } catch (error) {
      console.error('Error processing voice recording:', error);
      toast.error("Failed to process voice recording", {
        description: "Please try again.",
      });
    } finally {
      // Clear the timeout and reset processing state
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        setProcessingTimeoutId(null);
      }
      setIsProcessingVoice(false);
    }
  };

  const getButtonState = () => {
    if (recordingError) return 'error';
    if (isProcessingVoice || stream.isLoading) return 'processing';
    if (isPlayingAudio) return 'playing';
    if (recordingState === 'recording') return 'recording';
    if (recordingState === 'requesting') return 'requesting';
    return 'idle';
  };

  const getButtonIcon = () => {
    const state = getButtonState();
    switch (state) {
      case 'recording':
        return <Square className="w-10 h-10 fill-current" />;
      case 'processing':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Waves className="w-10 h-10" />
          </motion.div>
        );
      case 'requesting':
        return (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Mic className="w-10 h-10" />
          </motion.div>
        );
      case 'playing':
        return (
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Volume2 className="w-10 h-10" />
          </motion.div>
        );
      case 'error':
        return <VolumeX className="w-10 h-10" />;
      default:
        return <Mic className="w-10 h-10" />;
    }
  };

  const getOrbStyles = () => {
    const state = getButtonState();
    const baseIntensity = audioLevel * 0.6 + 0.4; // 0.4 to 1.0 range
    
    switch (state) {
      case 'recording':
        if (audioLevel > 0) {
          // Dynamic emerald glow based on audio level
          return {
            background: `radial-gradient(circle, 
              rgba(16, 185, 129, ${0.9 + audioLevel * 0.1}) 0%, 
              rgba(16, 185, 129, ${0.7 + audioLevel * 0.2}) 30%, 
              rgba(16, 185, 129, ${0.4 + audioLevel * 0.3}) 60%, 
              rgba(16, 185, 129, 0.1) 100%)`,
            boxShadow: `
              0 0 ${20 + audioLevel * 40}px rgba(16, 185, 129, ${0.4 + audioLevel * 0.4}),
              0 0 ${40 + audioLevel * 60}px rgba(16, 185, 129, ${0.2 + audioLevel * 0.3}),
              inset 0 0 ${10 + audioLevel * 20}px rgba(16, 185, 129, 0.1)
            `,
            borderColor: `rgba(16, 185, 129, ${0.6 + audioLevel * 0.4})`,
            scale: 1 + audioLevel * 0.05,
          };
        } else {
          // Gentle amber when no audio detected
          return {
            background: `radial-gradient(circle, 
              rgba(245, 158, 11, 0.8) 0%, 
              rgba(245, 158, 11, 0.6) 30%, 
              rgba(245, 158, 11, 0.3) 60%, 
              rgba(245, 158, 11, 0.1) 100%)`,
            boxShadow: `
              0 0 30px rgba(245, 158, 11, 0.3),
              0 0 60px rgba(245, 158, 11, 0.2),
              inset 0 0 15px rgba(245, 158, 11, 0.1)
            `,
            borderColor: 'rgba(245, 158, 11, 0.5)',
            scale: 1,
          };
        }
      case 'playing':
        // Dynamic violet glow based on audio level
        return {
          background: `radial-gradient(circle, 
            rgba(139, 92, 246, ${0.8 + audioLevel * 0.2}) 0%, 
            rgba(139, 92, 246, ${0.6 + audioLevel * 0.2}) 30%, 
            rgba(139, 92, 246, ${0.3 + audioLevel * 0.3}) 60%, 
            rgba(139, 92, 246, 0.1) 100%)`,
          boxShadow: `
            0 0 ${25 + audioLevel * 35}px rgba(139, 92, 246, ${0.4 + audioLevel * 0.3}),
            0 0 ${50 + audioLevel * 50}px rgba(139, 92, 246, ${0.2 + audioLevel * 0.2}),
            inset 0 0 ${10 + audioLevel * 15}px rgba(139, 92, 246, 0.1)
          `,
          borderColor: `rgba(139, 92, 246, ${0.6 + audioLevel * 0.3})`,
          scale: 1 + audioLevel * 0.03,
        };
      case 'processing':
        return {
          background: `radial-gradient(circle, 
            rgba(59, 130, 246, 0.8) 0%, 
            rgba(59, 130, 246, 0.6) 30%, 
            rgba(59, 130, 246, 0.3) 60%, 
            rgba(59, 130, 246, 0.1) 100%)`,
          boxShadow: `
            0 0 35px rgba(59, 130, 246, 0.4),
            0 0 70px rgba(59, 130, 246, 0.2),
            inset 0 0 20px rgba(59, 130, 246, 0.1)
          `,
          borderColor: 'rgba(59, 130, 246, 0.6)',
          scale: 1,
        };
      case 'requesting':
        return {
          background: `radial-gradient(circle, 
            rgba(14, 165, 233, 0.7) 0%, 
            rgba(14, 165, 233, 0.5) 30%, 
            rgba(14, 165, 233, 0.3) 60%, 
            rgba(14, 165, 233, 0.1) 100%)`,
          boxShadow: `
            0 0 30px rgba(14, 165, 233, 0.3),
            0 0 60px rgba(14, 165, 233, 0.2),
            inset 0 0 15px rgba(14, 165, 233, 0.1)
          `,
          borderColor: 'rgba(14, 165, 233, 0.5)',
          scale: 1,
        };
      case 'error':
        return {
          background: `radial-gradient(circle, 
            rgba(239, 68, 68, 0.8) 0%, 
            rgba(239, 68, 68, 0.6) 30%, 
            rgba(239, 68, 68, 0.3) 60%, 
            rgba(239, 68, 68, 0.1) 100%)`,
          boxShadow: `
            0 0 30px rgba(239, 68, 68, 0.4),
            0 0 60px rgba(239, 68, 68, 0.2),
            inset 0 0 15px rgba(239, 68, 68, 0.1)
          `,
          borderColor: 'rgba(239, 68, 68, 0.6)',
          scale: 1,
        };
      default:
        return {
          background: `radial-gradient(circle, 
            rgba(148, 163, 184, 0.3) 0%, 
            rgba(148, 163, 184, 0.2) 30%, 
            rgba(148, 163, 184, 0.1) 60%, 
            rgba(148, 163, 184, 0.05) 100%)`,
          boxShadow: `
            0 0 20px rgba(148, 163, 184, 0.2),
            0 0 40px rgba(148, 163, 184, 0.1),
            inset 0 0 10px rgba(148, 163, 184, 0.05)
          `,
          borderColor: 'rgba(148, 163, 184, 0.3)',
          scale: 1,
        };
    }
  };

  const getStatusText = () => {
    const state = getButtonState();
    switch (state) {
      case 'recording':
        return audioLevel > 0 ? "Listening... Keep speaking" : "Listening... Speak a bit louder";
      case 'processing':
        return "Processing your voice...";
      case 'playing':
        return "Playing response...";
      case 'requesting':
        return "Requesting microphone access...";
      case 'error':
        return "Something went wrong";
      default:
        return "Tap to start speaking";
    }
  };

  const getSubtitleText = () => {
    const state = getButtonState();
    switch (state) {
      case 'recording':
        return "Tap again to finish";
      case 'processing':
        return "Please wait a moment";
      case 'playing':
        return "Audio response playing";
      case 'requesting':
        return "Allow microphone access";
      case 'error':
        return "Please try again";
      default:
        return "Speak naturally";
    }
  };

  const buttonState = getButtonState();
  const orbStyles = getOrbStyles();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
      />
      
      {/* Gentle background ambient animation for dark theme */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%)"
          }}
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 100%)"
          }}
          animate={{ 
            scale: [1, 1.25, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 15, 
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center space-y-12 max-w-md mx-auto text-center">
        {/* App title - Static, no movement */}
        <div className="space-y-3">
        </div>

        {/* Main audio visualization - dots only */}
        <div className="relative w-96 h-96 flex items-center justify-center">
          {/* 3D Audio Visualizer */}
          <div 
            className="w-full h-full cursor-pointer"
            onClick={handleRecordingToggle}
          >
            <AudioVisualizerWithFallback
              audioLevel={audioLevel}
              isRecording={recordingState === 'recording'}
              isPlaying={isPlayingAudio}
              isProcessing={isProcessingVoice || stream.isLoading}
              frequencyData={frequencyData}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Status text - Static positioning, no movement */}
        <div className="space-y-2 h-16 flex flex-col justify-center">
          <p className="text-xl font-semibold text-gray-200">
            {getStatusText()}
          </p>
          <p className="text-sm text-gray-400 font-medium">
            {getSubtitleText()}
          </p>
        </div>
      </div>
    </div>
  );
}