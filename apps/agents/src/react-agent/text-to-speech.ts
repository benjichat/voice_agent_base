import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import * as fs from "fs";
import * as path from "path";
import { SpeechAnnotation } from "./speech-to-text.js";

export interface TTSOutput {
  audioData: string; // base64 encoded audio data
  mimeType: string;
  size: number;
}

/**
 * Process AI message and convert it to speech using ElevenLabs TTS
 */
export async function text_to_speech(
  state: typeof SpeechAnnotation.State,
): Promise<typeof SpeechAnnotation.Update> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  console.log("🔊 TTS Debug - Messages in state:", {
    totalMessages: messages.length,
    lastMessageType: lastMessage?.constructor?.name,
    lastMessageContent: typeof lastMessage?.content,
    lastMessagePreview: typeof lastMessage?.content === 'string' ? lastMessage.content.substring(0, 50) + '...' : lastMessage?.content
  });
  
  // Only process AI messages (both AIMessage and AIMessageChunk)
  if (!lastMessage || !(lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk)) {
    console.log("🔊 No AI message to convert to speech - lastMessage:", {
      exists: !!lastMessage,
      type: lastMessage?.constructor?.name,
      isAIMessage: lastMessage instanceof AIMessage,
      isAIMessageChunk: lastMessage instanceof AIMessageChunk
    });
    return { ttsOutput: undefined };
  }

  const aiMessage = lastMessage as AIMessage | AIMessageChunk;
  const textContent = aiMessage.content as string;

  if (!textContent || typeof textContent !== "string") {
    console.log("🔊 No text content found in AI message:", {
      contentType: typeof textContent,
      content: textContent
    });
    return { ttsOutput: undefined };
  }

  try {
    // Check for ElevenLabs API key
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("🔑 ELEVENLABS_API_KEY not found in environment variables");
      console.error("🔑 Please ensure .env file exists in the root directory with ELEVENLABS_API_KEY=your_key");
      throw new Error("ElevenLabs API key not configured");
    }

    console.log("🔑 ElevenLabs API key found, length:", apiKey.length);

    // Initialize ElevenLabs client
    const elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });

    console.log("🔊 Converting text to speech:", {
      textLength: textContent.length,
      textPreview: textContent.substring(0, 100) + (textContent.length > 100 ? "..." : "")
    });

    // Generate speech using ElevenLabs
    // Using a default voice ID - you can customize this
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Default to Rachel voice
    
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: textContent,
      modelId: "eleven_flash_v2",
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.5,
        style: 0.0,
        useSpeakerBoost: true
      }
    });

    console.log("🎵 Audio generated successfully");

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log("✅ Audio buffer created, size:", audioBuffer.length, "bytes");

    // Save audio file locally for testing
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tts-output-${timestamp}.mp3`;
      const outputPath = path.join(process.cwd(), 'tts-outputs', filename);
      
      // Create directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Save the audio file
      fs.writeFileSync(outputPath, audioBuffer);
      console.log("💾 TTS audio saved locally:", outputPath);
    } catch (saveError) {
      console.error("⚠️ Failed to save TTS audio locally:", saveError);
      // Don't fail the whole process if file saving fails
    }

    // Convert to base64 for transmission
    const base64Audio = audioBuffer.toString('base64');

    const ttsOutput: TTSOutput = {
      audioData: base64Audio,
      mimeType: "audio/mpeg",
      size: audioBuffer.length
    };

    console.log("🔊 TTS processing completed successfully:", {
      outputSize: ttsOutput.size,
      mimeType: ttsOutput.mimeType,
      base64Length: base64Audio.length
    });

    return {
      ttsOutput: ttsOutput
    };

  } catch (error) {
    console.error("Error processing TTS:", error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error("TTS Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Return undefined TTS output on error - don't fail the whole flow
    return {
      ttsOutput: undefined
    };
  }
}

/**
 * Determine if we should process TTS (always process AI messages)
 */
export function shouldProcessTTS(state: typeof SpeechAnnotation.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Process TTS if the last message is from AI and has content
  if (lastMessage && (lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk) && lastMessage.content) {
    return "processTTS";
  }
  
  return "__end__";
} 