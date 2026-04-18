import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "../../../lib/data-tools";
import { systemPrompt } from "../../../lib/system-prompt";

const anthropic = new Anthropic();

export async function POST(req) {
  const { messages } = await req.json();

  // Convert our message format to Anthropic format
  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Run the agentic loop: Claude may call tools multiple times
  let currentMessages = [...anthropicMessages];
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDefinitions,
      messages: currentMessages,
    });

    // If Claude wants to use tools, execute them and continue
    if (response.stop_reason === "tool_use") {
      // Collect all tool use blocks
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      // Add the assistant's response (which includes tool_use blocks)
      currentMessages.push({ role: "assistant", content: response.content });

      // Execute each tool and build the tool_result array
      const toolResults = toolUseBlocks.map((toolUse) => {
        const result = executeTool(toolUse.name, toolUse.input);
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      });

      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Claude is done, extract the text response
    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return Response.json({ response: textContent });
  }

  return Response.json({
    response:
      "I ran into complexity limits processing that question. Could you try a more specific query?",
  });
}
