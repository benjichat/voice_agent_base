"use client";

import { VoiceOnlyInterface } from "@/components/voice-only-interface";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { Toaster } from "@/components/ui/sonner";
import React from "react";

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <VoiceOnlyInterface />
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
