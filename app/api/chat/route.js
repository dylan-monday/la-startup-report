import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "../../../lib/data-tools";
import { systemPrompt } from "../../../lib/system-prompt";
import { trackSession } from "../../../lib/analytics";

export const maxDuration = 60;

const anthropic = new Anthropic();

// Human-readable status lines shown during tool calls
const TOOL_STATUS = {
  get_dataset_summary:    "Reviewing survey overview...",
  get_distribution:       "Querying data distributions...",
  cross_tabulate:         "Running cross-analysis...",
  get_numeric_stats:      "Calculating statistics...",
  analyze_funding_gaps:   "Analyzing funding patterns...",
  get_revenue_trajectory: "Tracing revenue trends...",
  count_respondents:      "Counting respondents...",
  list_available_fields:  "Checking available fields...",
};

export async function POST(req) {
  const { messages } = await req.json();

  // Trim conversation history to control token cost.
  // Keep the first user message (establishes context) + the last N turns.
  const MAX_HISTORY_TURNS = 8; // 8 pairs = 16 messages max sent to API
  const raw = messages.map((m) => ({ role: m.role, content: m.content }));
  const anthropicMessages = raw.length > MAX_HISTORY_TURNS * 2 + 1
    ? [raw[0], ...raw.slice(-(MAX_HISTORY_TURNS * 2))]
    : raw;

  // Analytics — accumulate across all tool-use iterations in this request
  const sessionId      = crypto.randomUUID();
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  const toolsUsed       = [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch (_) {}
      }

      let currentMessages = [...anthropicMessages];
      const MAX_ITERATIONS = 10;

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          // Non-streaming call for tool-use turns — we need the full message
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: systemPrompt,
            tools: toolDefinitions,
            messages: currentMessages,
          });

          // Accumulate token usage for every API call in the loop
          if (response.usage) {
            totalInputTokens  += response.usage.input_tokens  || 0;
            totalOutputTokens += response.usage.output_tokens || 0;
          }

          if (response.stop_reason === "tool_use") {
            const toolUseBlocks = response.content.filter(
              (b) => b.type === "tool_use"
            );

            // Track which tools were called
            for (const toolUse of toolUseBlocks) {
              toolsUsed.push(toolUse.name);
            }

            // Send a status message for each tool being called
            for (const toolUse of toolUseBlocks) {
              send({
                type: "status",
                message: TOOL_STATUS[toolUse.name] || "Analyzing data...",
              });
            }

            currentMessages.push({ role: "assistant", content: response.content });

            const toolResults = toolUseBlocks.map((toolUse) => ({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(executeTool(toolUse.name, toolUse.input)),
            }));

            currentMessages.push({ role: "user", content: toolResults });
            continue;
          }

          // Final text response — extract it and stream word-by-word
          const textContent = response.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");

          send({ type: "status", message: "Writing response..." });

          // Stream words with a small delay so the client renders progressively
          const words = textContent.split(" ");
          for (let wi = 0; wi < words.length; wi++) {
            send({ type: "delta", content: (wi > 0 ? " " : "") + words[wi] });
            // Small yield so SSE actually flushes between chunks
            await new Promise((r) => setTimeout(r, 0));
          }

          // Log completed session to analytics store
          trackSession({
            sessionId,
            queryCount:   anthropicMessages.filter((m) => m.role === "user").length,
            inputTokens:  totalInputTokens,
            outputTokens: totalOutputTokens,
            toolsUsed,
          });

          send({ type: "done" });
          controller.close();
          return;
        }

        // Hit iteration limit
        send({
          type: "done_text",
          content:
            "I hit the iteration limit on that one. Try breaking it into two separate questions — for example, ask about one industry at a time.",
        });
        controller.close();
      } catch (err) {
        console.error("[chat/route] API error:", err?.status, err?.message, err?.error);
        const status = err?.status;
        let message = "Something went wrong. Please try again.";
        if (status === 401) {
          message = "API authentication failed. Check that ANTHROPIC_API_KEY is set correctly in Vercel environment variables.";
        } else if (status === 402 || status === 529) {
          message = "API credits exhausted. Add credits at console.anthropic.com and redeploy.";
        } else if (status === 429) {
          message = "Rate limit hit. Wait a moment and try again.";
        } else if (status === 500 || status === 503) {
          message = "Anthropic API is having issues. Try again in a moment.";
        }
        send({ type: "done_text", content: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
