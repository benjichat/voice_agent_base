import OpenAI from "openai";
import { Annotation } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { base64ToBuffer } from "./utils.js";
import { TTSOutput } from "./text-to-speech.js";

export interface SpeechInput {
  audioData: string; // base64 encoded audio
  mimeType?: string;
  size?: number;
}

export const SpeechAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  /**
   * Audio input to be processed
   */
  audioInput: Annotation<SpeechInput | undefined>,
  /**
   * TTS output to be sent to client
   */
  ttsOutput: Annotation<TTSOutput | undefined>,
});

/**
 * Process speech input and convert it to text using OpenAI Whisper
 */
export async function speech_to_text(
  state: typeof SpeechAnnotation.State,
): Promise<typeof SpeechAnnotation.Update> {
  const audioInput = state.audioInput;
  
  // If no audio input, just pass through - this handles text-only inputs
  if (!audioInput) {
    console.log("🎤 No audio input, passing through to AI node");
    return {};
  }

  try {
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("🔑 OPENAI_API_KEY not found in environment variables");
      console.error("🔑 Please ensure .env file exists in the root directory with OPENAI_API_KEY=your_key");
      throw new Error("OpenAI API key not configured");
    }

    console.log("🔑 OpenAI API key found, length:", apiKey.length);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Log debug information
    console.log("🎤 Processing audio input:", {
      audioDataLength: audioInput.audioData?.length,
      mimeType: audioInput.mimeType,
      size: audioInput.size
    });

    // Check if audio data exists and is reasonable size
    if (!audioInput.audioData || audioInput.audioData.length < 100) {
      console.error("🎤 Audio data is missing or too small:", audioInput.audioData?.length || 0, "characters");
      throw new Error("Audio data appears to be empty or too short");
    }

    // Convert base64 to buffer for Node.js compatibility
    console.log("🔄 Converting base64 to buffer...");
    const audioBuffer = base64ToBuffer(audioInput.audioData);
    console.log("✅ Buffer created, size:", audioBuffer.length, "bytes");

    // Function to attempt transcription with given buffer and format
    const attemptTranscription = async (buffer: Buffer, fileName: string, mimeType: string) => {
      console.log(`🎤 Attempting transcription:`, {
        fileName,
        bufferSize: buffer.length,
        mimeType
      });

      // Use OpenAI's toFile helper for Node.js compatibility
      const file = await OpenAI.toFile(buffer, fileName);

      return await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en",
        response_format: "text",
      });
    };

    // Try different formats in order of compatibility
    const formats = [
      { name: "audio.wav", type: "audio/wav" },
      { name: "audio.webm", type: "audio/webm" },
      { name: "audio.mp3", type: "audio/mp3" },
      { name: "audio.m4a", type: "audio/m4a" },
      { name: "audio.ogg", type: "audio/ogg" },
    ];

    let lastError: any = null;

    for (const format of formats) {
      try {
        console.log(`🎯 Trying format: ${format.name} (${format.type})`);
        
        const transcription = await attemptTranscription(
          audioBuffer, 
          format.name, 
          format.type
        );
        
        // If we get here, transcription succeeded
        const humanMessage = new HumanMessage({
          content: transcription,
        });

        console.log(`🎤 Speech transcribed successfully with ${format.name}: "${transcription}"`);
        return {
          messages: [humanMessage],
          audioInput: undefined,
        };

      } catch (error) {
        console.log(`❌ Format ${format.name} failed:`, error instanceof Error ? error.message : error);
        lastError = error;
        continue;
      }
    }

    // If all formats failed, throw the last error
    throw lastError || new Error("All audio formats failed");

  } catch (error) {
    console.error("Error processing speech - all formats failed:", error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Create an error message
    const errorMessage = new HumanMessage({
      content: "Sorry, I couldn't process your voice message. Please try again or type your message.",
    });

    return {
      messages: [errorMessage],
      audioInput: undefined,
    };
  }
} 