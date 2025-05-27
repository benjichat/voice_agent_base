/**
 * Simple test script to debug TTS functionality
 * Run with: node test-tts.js
 */

import dotenv from 'dotenv';
import { graph } from './dist/react-agent/graph.js';

// Load environment variables from root .env file
dotenv.config({ path: '../../.env' });

async function testTTS() {
  console.log('🧪 Testing TTS functionality...');
  console.log('🔑 Environment check:', {
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
    openAILength: process.env.OPENAI_API_KEY?.length,
    elevenLabsLength: process.env.ELEVENLABS_API_KEY?.length
  });
  
  try {
    // Test with a simple text input (no audio)
    const testState = {
      messages: [
        {
          type: 'human',
          content: 'Hello, can you say something?'
        }
      ],
      audioInput: undefined,
      ttsOutput: undefined
    };

    console.log('📤 Input state:', testState);
    
    // Run the graph
    const result = await graph.invoke(testState);
    
    console.log('📥 Output state:', {
      messageCount: result.messages?.length,
      lastMessageType: result.messages?.[result.messages.length - 1]?.constructor?.name,
      lastMessageContent: result.messages?.[result.messages.length - 1]?.content?.substring(0, 100),
      hasTTSOutput: !!result.ttsOutput,
      ttsOutputSize: result.ttsOutput?.size
    });
    
    if (result.ttsOutput) {
      console.log('✅ TTS output generated successfully!');
      console.log('🔊 Check the tts-outputs directory for the audio file');
    } else {
      console.log('❌ No TTS output generated');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTTS(); 