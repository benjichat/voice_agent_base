import { RunnableConfig } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { loadChatModel } from "./utils.js";
import { SpeechAnnotation, speech_to_text } from "./speech-to-text.js";
import { text_to_speech } from "./text-to-speech.js";
import { TOOLS } from "./tools.js";

/**
 * ReAct agent node using the prebuilt createReactAgent
 * This replaces the manual ai_node + tools pattern with LangGraph's prebuilt agent
 */
async function react_agent_node(
  state: typeof SpeechAnnotation.State,
  config: RunnableConfig,
): Promise<typeof SpeechAnnotation.Update> {
  const configuration = ensureConfiguration(config);

  // Load the model for the ReAct agent
  const model = await loadChatModel(configuration.model);

  // Create the ReAct agent with the model and tools
  const reactAgent = createReactAgent({ 
    llm: model, 
    tools: TOOLS,
    messageModifier: configuration.systemPromptTemplate.replace(
      "{system_time}",
      new Date().toISOString(),
    ),
  });

  // Run the agent with the current state
  const result = await reactAgent.invoke({
    messages: state.messages
  }, config);

  // Return only the new messages that the agent generated
  const newMessages = result.messages.slice(state.messages.length);
  return { messages: newMessages };
}

/**
 * Build a ReAct‑style StateGraph with prebuilt ReAct agent:
 *   start → STT → ReAct Agent → TTS → end
 * 
 * The prebuilt ReAct agent handles all tool execution internally,
 * so we have a simpler linear flow.
 */
const workflow = new StateGraph(SpeechAnnotation, ConfigurationSchema)
  // 1️⃣ Transcribe user speech
  .addNode("speech_to_text", speech_to_text)
  // 2️⃣ Use the prebuilt ReAct agent for reasoning and tool execution
  .addNode("react_agent", react_agent_node)
  // 3️⃣ Convert the final answer back to audio
  .addNode("text_to_speech", text_to_speech)
  // ─────────────────────────── Edges ───────────────────────────
  .addEdge("__start__", "speech_to_text")
  .addEdge("speech_to_text", "react_agent")
  .addEdge("react_agent", "text_to_speech")
  .addEdge("text_to_speech", "__end__");

// Compile the graph so it becomes an executable Runnable
export const graph = workflow.compile({
  interruptBefore: [],
  interruptAfter: [],
});
