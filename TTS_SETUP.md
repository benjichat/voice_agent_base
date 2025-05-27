# Text-to-Speech (TTS) Setup Guide

## Overview
The application now supports text-to-speech functionality using ElevenLabs API. AI responses are automatically converted to speech and sent back to the client for playback.

## 🚀 Quick Setup

### 1. Environment Configuration
Create a `.env` file in the **root directory** (`/news_app/.env`) with your ElevenLabs API key:

```env
# OpenAI API Configuration (existing)
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API Configuration (new)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

**Get your ElevenLabs API key from:** https://elevenlabs.io/app/settings/api-keys

### 2. Voice Configuration
The default voice ID (`21m00Tcm4TlvDq8ikWAM`) is Rachel's voice. You can:
- Use any ElevenLabs voice ID by setting `ELEVENLABS_VOICE_ID`
- Browse available voices at: https://elevenlabs.io/app/voice-library
- Leave it unset to use the default Rachel voice

### 3. Start the Application
```bash
# Terminal 1: Start LangGraph server
cd apps/agents && pnpm dev

# Terminal 2: Start web app
cd apps/web && pnpm dev
```

## 🔄 How It Works

### Workflow Flow:
1. **User Input** → Speech-to-Text (if voice) or direct to AI
2. **AI Processing** → Simple LangChain model generates response
3. **TTS Processing** → AI response converted to speech via ElevenLabs
4. **Client Playback** → Audio sent to frontend for playback

### Graph Structure:
```
__start__ → speech_to_text → ai_node → text_to_speech → __end__
```

### Node Functions:
- **`speech_to_text`**: Converts voice input to text using OpenAI Whisper (passes through if no audio)
- **`ai_node`**: Processes input and generates AI response using LangChain (no tools)
- **`text_to_speech`**: Converts AI response to speech using ElevenLabs

### Completely Linear Flow:
This is now a completely linear flow where every input goes through all three nodes:
1. **All inputs** go to `speech_to_text` first (audio gets transcribed, text passes through)
2. **All inputs** then go to `ai_node` for AI processing
3. **All AI responses** go to `text_to_speech` for audio generation

## 🎵 TTS Features

### Automatic Processing:
- **All AI responses** are automatically converted to speech
- **Local file saving** - TTS outputs are saved to `apps/agents/tts-outputs/` for testing
- **Error handling** - TTS failures don't break the conversation
- **Base64 encoding** for efficient transmission
- **MP3 format** for broad compatibility

### Local Testing:
- TTS audio files are automatically saved to `apps/agents/tts-outputs/`
- Files are named with timestamps: `tts-output-2024-01-15T10-30-45-123Z.mp3`
- You can play these files directly to test TTS quality
- Files are saved even if frontend playback fails

### Voice Settings:
- **Stability**: 0.5 (balance between consistency and expressiveness)
- **Similarity Boost**: 0.5 (voice similarity to original)
- **Style**: 0.0 (neutral style)
- **Speaker Boost**: true (enhanced clarity)

### Model Used:
- **eleven_monolingual_v1** - Optimized for English, good quality/speed balance
- Can be changed in `speech-processor.ts` if needed

## 🐛 Debugging & Troubleshooting

### Step 1: Check Environment Variables
The console will show:
```
🔑 ElevenLabs API key found, length: 32
```
If you see:
```
🔑 ELEVENLABS_API_KEY not found in environment variables
```
Then your .env file isn't being loaded correctly.

### Step 2: Check TTS Processing
Successful processing logs:
```
🔊 TTS Debug - Messages in state: {
  totalMessages: 2,
  lastMessageType: "AIMessage",
  lastMessageContent: "string",
  lastMessagePreview: "Hello! How can I help you today?..."
}
🔊 Converting text to speech: {
  textLength: 45,
  textPreview: "Hello! How can I help you today?..."
}
🎵 Audio generated successfully
✅ Audio buffer created, size: 15234 bytes
💾 TTS audio saved locally: /path/to/tts-outputs/tts-output-2024-01-15T10-30-45-123Z.mp3
🔊 TTS processing completed successfully
```

**🚨 Problem Signs:**
```
🔊 No AI message to convert to speech - lastMessage: {
  exists: true,
  type: "HumanMessage",
  isAIMessage: false
}
```
This means the AI node isn't generating AI messages properly.

### Step 2.1: Debug AI Message Generation
If you see "No AI message to convert to speech", check:
1. **AI node is working**: Look for successful AI responses in logs
2. **Message types**: The debug logs show what type of message is being passed
3. **Message flow**: Ensure the linear flow is working: speech_to_text → ai_node → text_to_speech

### Step 3: Check Frontend Playback
The frontend should receive TTS output in the state:
```javascript
{
  ttsOutput: {
    audioData: "base64_encoded_audio_data",
    mimeType: "audio/mpeg",
    size: 15234
  }
}
```

## 🔧 Common Issues

### Issue: "ElevenLabs API key not configured"
**Cause:** Missing or incorrect API key
**Solutions:**
1. **Check .env file** exists in root directory
2. **Verify API key** is correct (32 characters)
3. **Restart the server** after adding the key
4. **Check API key permissions** on ElevenLabs dashboard

### Issue: "Voice ID not found"
**Cause:** Invalid voice ID
**Solutions:**
1. **Use default voice** by removing `ELEVENLABS_VOICE_ID` from .env
2. **Check voice ID** on ElevenLabs voice library
3. **Verify voice access** (some voices require subscription)

### Issue: TTS processing fails silently
**Cause:** API quota exceeded or network issues
**Solutions:**
1. **Check ElevenLabs quota** on your dashboard
2. **Verify internet connection**
3. **Check console logs** for detailed error messages

## 🎯 Testing Checklist

### Backend TTS Test:
1. ✅ Environment variables loaded correctly
2. ✅ ElevenLabs API key valid
3. ✅ AI response triggers TTS processing
4. ✅ Audio buffer generated successfully
5. ✅ Base64 encoding completed

### Frontend Integration Test:
1. ✅ TTS output received in state
2. ✅ Audio playback initiated
3. ✅ User hears AI response
4. ✅ Error handling for TTS failures

## 🔍 Advanced Configuration

### Custom Voice Settings:
Edit `speech-processor.ts` to customize:
```typescript
voiceSettings: {
  stability: 0.7,        // 0-1, higher = more consistent
  similarityBoost: 0.8,  // 0-1, higher = more similar to original
  style: 0.2,            // 0-1, higher = more expressive
  useSpeakerBoost: true  // Enhanced clarity
}
```

### Different Models:
Available models:
- `eleven_monolingual_v1` - English only, fast
- `eleven_multilingual_v2` - Multiple languages, slower
- `eleven_flash_v2_5` - Ultra-fast, lower quality

### Voice Selection:
Popular voice IDs:
- `21m00Tcm4TlvDq8ikWAM` - Rachel (default)
- `AZnzlk1XvdvUeBnXmlld` - Domi
- `EXAVITQu4vr4xnSDxMaL` - Bella
- `ErXwobaYiN019PkySvjV` - Antoni

## 📱 Browser Compatibility

### Fully Supported:
- ✅ Chrome (desktop & mobile)
- ✅ Firefox (desktop & mobile)
- ✅ Safari (desktop & mobile)
- ✅ Edge (desktop)

### Requirements:
- 🔊 **Audio playback** support
- 🌐 **Base64 decoding** support
- 📱 **Modern browser** (ES6+)

---

## 🎉 Success Indicators

When everything is working correctly, you should see:
- 🔊 **Console logs** showing successful TTS processing
- 🎵 **Audio playback** of AI responses
- 📊 **No TTS errors** in console
- 🤖 **Seamless voice conversation** experience

If you encounter any issues not covered here, check the console logs for detailed error messages! 