import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, Loader2, AlertCircle, Volume2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useSpeechRecording } from "@/hooks/useSpeechRecording";
import { useEffect } from "react";

interface VoiceRecorderButtonProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onRecordingError?: (error: string) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function VoiceRecorderButton({
  onRecordingComplete,
  onRecordingError,
  disabled = false,
  size = "md",
  className,
}: VoiceRecorderButtonProps) {
  const {
    recordingState,
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  } = useSpeechRecording();

  // Handle errors
  useEffect(() => {
    if (error && onRecordingError) {
      onRecordingError(error);
    }
  }, [error, onRecordingError]);

  const handleClick = async () => {
    if (disabled) return;

    if (recordingState === 'idle') {
      await startRecording();
    } else if (recordingState === 'recording') {
      const audioBlob = await stopRecording();
      if (audioBlob && onRecordingComplete) {
        onRecordingComplete(audioBlob);
      }
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelRecording();
  };

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-14 w-14",
  };

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 26,
  };

  const getButtonContent = () => {
    switch (recordingState) {
      case 'requesting':
        return (
          <motion.div 
            className="flex flex-col items-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="relative">
              <Mic size={iconSizes[size]} className="text-blue-600" />
              <motion.div
                className="absolute -inset-1 border-2 border-blue-400 rounded-full"
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </motion.div>
        );
      case 'recording':
        return (
          <motion.div 
            className="flex flex-col items-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Square size={iconSizes[size]} className="fill-current text-white" />
          </motion.div>
        );
      case 'stopping':
        return (
          <motion.div 
            className="flex flex-col items-center"
            animate={{ scale: [1, 0.9, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Volume2 size={iconSizes[size]} className="text-emerald-600" />
          </motion.div>
        );
      default:
        return (
          <motion.div 
            className="flex flex-col items-center"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            {error ? (
              <AlertCircle size={iconSizes[size]} className="text-rose-500" />
            ) : (
              <Mic size={iconSizes[size]} className="text-slate-600" />
            )}
          </motion.div>
        );
    }
  };

  const getButtonStyles = () => {
    if (error) {
      return "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 shadow-sm hover:shadow-md";
    }
    if (isRecording && audioLevel > 0) {
      // Gentle emerald when recording and detecting audio
      return "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-emerald-500 shadow-lg hover:shadow-xl";
    }
    if (isRecording && audioLevel === 0) {
      // Soft amber when recording but no audio detected
      return "bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white border-amber-400 shadow-lg hover:shadow-xl";
    }
    if (recordingState === 'requesting') {
      return "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 text-blue-600 border-blue-200 shadow-md";
    }
    if (recordingState === 'stopping') {
      return "bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-150 text-emerald-600 border-emerald-200 shadow-md";
    }
    return "bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 text-slate-600 border-slate-200 shadow-sm hover:shadow-md";
  };

  return (
    <div className="relative">
      {/* Gentle breathing animation rings when recording with audio */}
      <AnimatePresence>
        {isRecording && audioLevel > 0 && (
          <>
            {/* Outer gentle pulse */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 70%, transparent 100%)"
              }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.4, 1], 
                opacity: [0, 0.6, 0] 
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Inner gentle pulse */}
            <motion.div
              className="absolute inset-0 rounded-full border border-emerald-300/30"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.2, 1], 
                opacity: [0.3, 0.6, 0.3] 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />

            {/* Audio level responsive ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
              animate={{ 
                scale: 1 + (audioLevel * 0.3), 
                opacity: 0.4 + (audioLevel * 0.3) 
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Gentle waiting indicator when no audio detected */}
      <AnimatePresence>
        {isRecording && audioLevel === 0 && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.04) 70%, transparent 100%)"
              }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.3, 1], 
                opacity: [0, 0.5, 0] 
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-amber-300/40"
              animate={{ 
                scale: [1, 1.1, 1], 
                opacity: [0.4, 0.7, 0.4] 
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Requesting permission - gentle rotating rings */}
      <AnimatePresence>
        {recordingState === 'requesting' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, rgba(59, 130, 246, 0.03) 70%, transparent 100%)"
              }}
              animate={{ 
                scale: [1, 1.2, 1], 
                opacity: [0, 0.4, 0] 
              }}
              transition={{ 
                duration: 2.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-blue-300/30"
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 8, 
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Processing indicator */}
      <AnimatePresence>
        {recordingState === 'stopping' && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.04) 70%, transparent 100%)"
            }}
            animate={{ 
              scale: [1, 1.15, 1], 
              opacity: [0.3, 0.6, 0.3] 
            }}
            transition={{ 
              duration: 1.8, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(
            sizeClasses[size],
            "relative overflow-hidden transition-all duration-300 ease-out rounded-full border-2",
            getButtonStyles(),
            (recordingState === 'requesting' || recordingState === 'stopping') && 
              "cursor-not-allowed",
            className
          )}
          onClick={handleClick}
          disabled={disabled || recordingState === 'requesting' || recordingState === 'stopping'}
          title={
            error ? `Error: ${error}` :
            recordingState === 'requesting' ? 'Requesting microphone access...' :
            recordingState === 'recording' ? 
              (audioLevel > 0 ? 'Recording audio - click to stop' : 'Recording but no audio detected - speak a bit louder') :
            recordingState === 'stopping' ? 'Processing your recording...' :
            'Click to start recording'
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${recordingState}-${!!error}`}
              initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {getButtonContent()}
            </motion.div>
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Gentle cancel button when recording */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            className="absolute -top-1 -right-1"
            initial={{ scale: 0, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full shadow-md hover:shadow-lg bg-white/90 backdrop-blur-sm border-slate-200 hover:bg-slate-50 transition-all duration-200"
                onClick={handleCancel}
                title="Cancel recording"
              >
                <MicOff size={14} className="text-slate-600" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gentle status indicator */}
      <AnimatePresence>
        {recordingState !== 'idle' && (
          <motion.div
            className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: -5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="text-xs text-center px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm">
              {recordingState === 'requesting' && (
                <motion.span 
                  className="text-blue-600 font-medium flex items-center gap-1"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  Requesting access...
                </motion.span>
              )}
              {recordingState === 'recording' && (
                <span className={cn(
                  "font-medium flex items-center gap-1",
                  audioLevel > 0 ? "text-emerald-600" : "text-amber-600"
                )}>
                  <motion.div 
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      audioLevel > 0 ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  {audioLevel > 0 ? "Recording..." : "Speak a bit louder"}
                </span>
              )}
              {recordingState === 'stopping' && (
                <motion.span 
                  className="text-emerald-600 font-medium flex items-center gap-1"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Processing...
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}