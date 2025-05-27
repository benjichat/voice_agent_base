"use client";

import { useStreamContext } from "@/providers/Stream";
import { useEffect, useRef } from "react";

export function DebugStream() {
  const stream = useStreamContext();
  const lastLogRef = useRef<number>(0);
  
  useEffect(() => {
    // Only log once per second to avoid flooding the console
    const now = Date.now();
    if (now - lastLogRef.current < 1000) {
      return;
    }
    lastLogRef.current = now;
    
    // Log only essential information
    console.log("🔍 Stream state:", {
      messageCount: stream.messages?.length || 0,
      lastMessageType: stream.messages?.[stream.messages.length - 1]?.type,
      isLoading: stream.isLoading,
      error: !!stream.error,
      streamKeys: Object.keys(stream),
    });
  }, [stream.messages?.length, stream.isLoading]);
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg max-w-md text-xs font-mono">
      <div className="mb-2 font-bold">Stream Debug</div>
      <div>Messages: {stream.messages?.length || 0}</div>
      <div>Loading: {stream.isLoading ? 'Yes' : 'No'}</div>
      <div>Last msg: {stream.messages?.[stream.messages.length - 1]?.type || 'none'}</div>
    </div>
  );
} 