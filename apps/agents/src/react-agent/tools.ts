/**
 * This file defines the tools available to the ReAct agent.
 * Tools are functions that the agent can use to interact with external systems or perform specific tasks.
 */
import { TavilySearch } from "@langchain/tavily";

/**
 * Tavily search tool configuration
 * This tool allows the agent to perform web searches using the Tavily API.
 * 
 * The TAVILY_API_KEY environment variable must be set in the .env file in the root folder.
 * Get your API key from: https://tavily.com/
 */
const searchTavily = new TavilySearch({
  maxResults: 5,
  topic: "general",
  // Optional parameters:
  // includeAnswer: false,
  // includeRawContent: false,
  // includeImages: false,
  // includeImageDescriptions: false,
  // searchDepth: "basic", // "basic" or "advanced"
  // timeRange: "day", // "day", "week", "month", "year"
  // includeDomains: [],
  // excludeDomains: [],
});

/**
 * Export an array of all available tools
 * Add new tools to this array to make them available to the agent
 *
 * Note: You can create custom tools by implementing the Tool interface from @langchain/core/tools
 * and add them to this array.
 * See https://js.langchain.com/docs/how_to/custom_tools/#tool-function for more information.
 */
export const TOOLS = [searchTavily];
