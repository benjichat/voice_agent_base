# Voice Agent Base

A voice-enabled AI agent application built with React, LangChain, and ElevenLabs.

## Features

- Voice input/output capabilities using OpenAI Whisper and ElevenLabs
- Web search functionality using Tavily
- React-based web interface
- LangChain-powered agent system

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.6.3 or higher)

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
# OpenAI API Key for Whisper (Speech-to-Text)
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs API Key for Text-to-Speech
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional: Default to Rachel voice

# Tavily API Key for web search
TAVILY_API_KEY=your_tavily_api_key
```

3. Start the development server:
```bash
pnpm dev
```

This will start both the web interface and the agent server concurrently.

## Available Tools

The agent has access to the following tools:

1. **Tavily Search**: Web search functionality with configurable parameters:
   - Max results: 5
   - Topic: General
   - Additional optional parameters available for customization

## Project Structure

- `apps/web/`: React-based web interface
- `apps/agents/`: LangChain agent implementation
  - `src/react-agent/`: Core agent logic
  - `tts-outputs/`: Generated audio files

## Development

- `pnpm dev`: Start development servers
- `pnpm build`: Build the application
- `pnpm lint`: Run linting
- `pnpm format`: Format code

## License

Private - All rights reserved
