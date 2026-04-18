import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "../../../lib/data-tools";
import { systemPrompt } from "../../../lib/system-prompt";

// Raise Vercel function timeout — requires Pro plan.
// On Hobby plan this is ignored and the hard limit is 10s.
// Upgrade at vercel.com/dashboard -> project -> Settings -> Functions
export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req) {
  const { messages } = await req.json();

  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let currentMessages = [...anthropicMessages];
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,  // Reduced from 4096 — keeps responses focused and faster
      system: systemPrompt,
      tools: toolDefinitions,
      messages: currentMessages,
    });

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      currentMessages.push({ role: "assistant", content: response.content });

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

    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return Response.json({ response: textContent });
  }

  return Response.json({
    response:
      "I hit the iteration limit on that one. Try breaking it into two separate questions — for example, ask about Healthcare first, then Manufacturing.",
  });
}
