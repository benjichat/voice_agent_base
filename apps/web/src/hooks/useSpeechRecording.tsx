import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping';

interface UseSpeechRecordingReturn {
  recordingState: RecordingState;
  isRecording: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  error: string | null;
}

export function useSpeechRecording(): UseSpeechRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up audio resources...');
    
    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('🛑 Stopping track:', track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset MediaRecorder
    mediaRecorderRef.current = null;
    
    setAudioLevel(0);
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setRecordingState('requesting');
      console.log('🎤 Requesting microphone access...');

      // Request microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });

      console.log('✅ Microphone access granted');
      console.log('🎵 Audio tracks:', stream.getAudioTracks().map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));

      streamRef.current = stream;

      // Set up audio context for visual feedback
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      console.log('🔊 Audio context created and connected');

      // Try different MIME types in order of preference for OpenAI compatibility
      const mimeTypes = [
        'audio/wav',
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];

      let selectedMimeType = 'audio/webm'; // fallback
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`🎤 Using MIME type: ${mimeType}`);
          break;
        }
      }

      // Set up MediaRecorder with the best supported format
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('📦 Received audio chunk:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstart = () => {
        console.log('▶️ Recording started');
        setRecordingState('recording');
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording failed. Please try again.');
        cleanup();
        setRecordingState('idle');
      };

      // Start recording with smaller time slices for more frequent data
      mediaRecorderRef.current.start(250); // Collect data every 250ms

      // Start audio level monitoring for visual feedback
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate RMS for better audio level detection
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(rms / 128, 1); // Normalize to 0-1
        
        setAudioLevel(normalizedLevel);
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

    } catch (err) {
      console.error('❌ Error starting recording:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone permissions and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError(`Unable to access microphone: ${err.message}`);
        }
      } else {
        setError('Unable to access microphone. Please check permissions.');
      }
      cleanup();
      setRecordingState('idle');
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || recordingState !== 'recording') {
        console.log('⚠️ No active recording to stop');
        resolve(null);
        return;
      }

      console.log('🛑 Stopping recording...');
      setRecordingState('stopping');

      mediaRecorderRef.current.onstop = () => {
        console.log('✅ Recording stopped');
        console.log('📊 Audio chunks collected:', chunksRef.current.length);
        
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
        const audioBlob = new Blob(chunksRef.current, { type: actualMimeType });
        
        console.log(`🎵 Recording completed:`, {
          size: audioBlob.size,
          type: audioBlob.type,
          actualMimeType,
          chunks: chunksRef.current.length
        });
        
        if (audioBlob.size < 1000) {
          console.error('⚠️ Audio blob is suspiciously small:', audioBlob.size, 'bytes');
        }
        
        cleanup();
        setRecordingState('idle');
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [recordingState, cleanup]);

  const cancelRecording = useCallback(() => {
    console.log('❌ Cancelling recording...');
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setRecordingState('idle');
  }, [recordingState, cleanup]);

  return {
    recordingState,
    isRecording: recordingState === 'recording',
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
} 