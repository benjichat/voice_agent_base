import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface TTSOutput {
  audioData: string; // base64 encoded audio data
  mimeType: string;
  size: number;
}

export function useTTSPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTTSUrl, setCurrentTTSUrl] = useState<string | null>(null);
  const lastPlayedDataRef = useRef<string | null>(null);

  // Clean up any existing audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (currentTTSUrl) {
        URL.revokeObjectURL(currentTTSUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const playTTS = useCallback(async (ttsOutput: TTSOutput) => {
    console.group('🔊 TTS Player - playTTS called');
    console.log('Input received:', {
      size: ttsOutput.size,
      mimeType: ttsOutput.mimeType,
      audioDataLength: ttsOutput.audioData?.length,
      audioDataStart: ttsOutput.audioData?.substring(0, 20)
    });

    try {
      // Create a unique hash for this audio to prevent duplicates
      const audioHash = `${ttsOutput.size}-${ttsOutput.audioData.substring(0, 50)}`;
      
      console.log('Generated audio hash:', audioHash);
      console.log('Last played hash:', lastPlayedDataRef.current);
      
      // Prevent duplicate playback of the same audio
      if (lastPlayedDataRef.current === audioHash) {
        console.log('❌ Skipping duplicate TTS playback for hash:', audioHash);
        console.groupEnd();
        return;
      }
      
      lastPlayedDataRef.current = audioHash;
      console.log('✅ Proceeding with TTS playback');

      // Clean up any existing audio
      if (audioRef.current) {
        console.log('🧹 Cleaning up existing audio');
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }

      // Clean up previous URL
      if (currentTTSUrl) {
        console.log('🧹 Cleaning up previous URL');
        URL.revokeObjectURL(currentTTSUrl);
        setCurrentTTSUrl(null);
      }

      console.log('🔄 Converting base64 to ArrayBuffer...');
      // Convert base64 to ArrayBuffer
      const binaryString = atob(ttsOutput.audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;
      console.log('✅ ArrayBuffer created, size:', arrayBuffer.byteLength);

      // Create blob with explicit MIME type
      const audioBlob = new Blob([arrayBuffer], { 
        type: 'audio/mpeg' // Force MP3 type regardless of input
      });

      console.log('🔊 Created audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      if (audioBlob.size === 0) {
        console.error('❌ Audio blob is empty');
        console.groupEnd();
        throw new Error('Audio blob is empty');
      }

      // Create blob URL
      const audioUrl = URL.createObjectURL(audioBlob);
      setCurrentTTSUrl(audioUrl);
      
      console.log('🔗 Created blob URL:', audioUrl);

      // Simplified audio approach for testing
      const audio = new Audio();
      console.log('🎵 Created new Audio element');
      
      // Simple event handlers for testing
      audio.addEventListener('loadstart', () => {
        console.log('📥 Audio loadstart event');
        setIsPlaying(true);
      });
      
      audio.addEventListener('canplay', () => {
        console.log('▶️  Audio canplay event');
      });
      
      audio.addEventListener('playing', () => {
        console.log('🎶 Audio playing event');
        toast.success('🔊 Playing AI response', {
          description: 'AI voice response is now playing',
          duration: 2000,
        });
      });
      
      audio.addEventListener('ended', () => {
        console.log('🔚 Audio ended event');
        setIsPlaying(false);
        lastPlayedDataRef.current = null;
        if (currentTTSUrl) {
          URL.revokeObjectURL(currentTTSUrl);
          setCurrentTTSUrl(null);
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio error event:', e);
        console.error('Error details:', {
          error: audio.error,
          code: audio.error?.code,
          message: audio.error?.message,
          networkState: audio.networkState,
          readyState: audio.readyState,
          src: audio.src
        });
        setIsPlaying(false);
        lastPlayedDataRef.current = null;
      });

      // Set source and try to play
      console.log('🎯 Setting audio source...');
      audio.src = audioUrl;
      audioRef.current = audio;
      
      console.log('📋 Audio properties after setting src:', {
        src: audio.src,
        currentSrc: audio.currentSrc,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
      
      console.log('▶️  Attempting to play audio...');
      await audio.play();
      console.log('✅ Audio play() successful');
      console.groupEnd();

    } catch (error) {
      console.error('❌ Error in TTS playback:', error);
      console.groupEnd();
      setIsPlaying(false);
      lastPlayedDataRef.current = null;
      
      if (currentTTSUrl) {
        URL.revokeObjectURL(currentTTSUrl);
        setCurrentTTSUrl(null);
      }
      
      toast.error('TTS playback failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000
      });
    }
  }, [currentTTSUrl]);

  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    lastPlayedDataRef.current = null;
  }, []);

  return {
    playTTS,
    stopTTS,
    isPlaying,
  };
} 