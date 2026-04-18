"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";

// Lazy-load the chart modal (canvas API, not needed on first paint)
const ChartModal = dynamic(() => import("./ChartModal"), { ssr: false });

// Starter questions — scoped to single tool calls
const STARTER_QUESTIONS = [
  "What does the typical GNO startup look like?",
  "Which funding sources have the biggest gap between attempted and successful?",
  "How has AI impacted local businesses?",
  "What industries are most represented in the survey?",
  "What percentage of companies plan to hire in the next 12 months?",
  "How do workspace types break down across the cohort?",
  "What does the revenue distribution look like from 2020 to 2025?",
  "What is the founder gender and racial breakdown?",
];

// ============================================================
// Parse a chart-config fenced block out of assistant response text.
// Returns { displayText, chartConfig } where chartConfig may be null.
// ============================================================
function parseChartConfig(text) {
  if (!text) return { displayText: text, chartConfig: null };

  const match = text.match(/```chart-config\s*([\s\S]*?)```/);
  if (!match) return { displayText: text, chartConfig: null };

  let chartConfig = null;
  try {
    chartConfig = JSON.parse(match[1].trim());
  } catch {
    // Malformed JSON — don't surface the button, just strip the block
  }

  const displayText = text.replace(/\n?```chart-config[\s\S]*?```\n?/, "").trim();
  return { displayText, chartConfig };
}

// ============================================================
// Copy button for assistant messages
// ============================================================
const COPY_ATTRIBUTION = "\n\nSource: Louisiana Startup Report 2026, Greater New Orleans cohort (n=112). Albert Lepage Center for Entrepreneurship & Innovation, Tulane University · LA.io · mondayandpartners.com";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const textWithAttribution = text + COPY_ATTRIBUTION;
    try {
      await navigator.clipboard.writeText(textWithAttribution);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = textWithAttribution;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      className={`msg-copy-btn ${copied ? "msg-copy-btn--copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy response"}
      aria-label={copied ? "Copied to clipboard" : "Copy response to clipboard"}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 6.5L5.2 10L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 3H2.5C1.67 3 1 3.67 1 4.5v7C1 12.33 1.67 13 2.5 13h6c.83 0 1.5-.67 1.5-1.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

// ============================================================
// Single assistant message — handles display + chart button
// ============================================================
function AssistantMessage({ content }) {
  const [chartOpen, setChartOpen] = useState(false);
  const { displayText, chartConfig } = parseChartConfig(content);

  return (
    <div className="msg msg-assistant">
      <CopyButton text={displayText} />
      <ReactMarkdown>{displayText}</ReactMarkdown>
      {chartConfig && (
        <>
          <button
            className="visualize-btn"
            onClick={() => setChartOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="6" width="3" height="7" rx="1" fill="currentColor"/>
              <rect x="5.5" y="3" width="3" height="10" rx="1" fill="currentColor"/>
              <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor"/>
            </svg>
            Visualize
          </button>
          {chartOpen && (
            <ChartModal config={chartConfig} onClose={() => setChartOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Main drawer component
// ============================================================
const DATA_REQUEST_NUDGE_AFTER = 8; // user queries before showing nudge

export default function ChatDrawer({ onRequestData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [startersVisible, setStartersVisible] = useState(true);
  const [queryCount, setQueryCount] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStartersVisible(false);
    setQueryCount(c => c + 1);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "status") {
            setLoadingStatus(event.message);
          } else if (event.type === "delta") {
            accumulated += event.content;
            setStreamingContent(accumulated);
          } else if (event.type === "done") {
            // Streaming complete — commit to messages
            setMessages([...newMessages, { role: "assistant", content: accumulated }]);
            setStreamingContent("");
            setLoadingStatus("");
          } else if (event.type === "done_text") {
            // Non-streaming fallback (iteration limit, error)
            setMessages([...newMessages, { role: "assistant", content: event.content }]);
            setStreamingContent("");
            setLoadingStatus("");
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err.name === "AbortError";
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: isTimeout
            ? "That query took too long. Try a more specific question — for example, ask about one industry at a time."
            : "Something went wrong connecting to the API.",
        },
      ]);
      setStreamingContent("");
      setLoadingStatus("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {isOpen && (
        <div className="drawer-backdrop" onClick={() => setIsOpen(false)} />
      )}

      <div
        ref={drawerRef}
        className={`chat-drawer ${isOpen ? "chat-drawer-open" : ""}`}
      >
        <div className="drawer-handle" onClick={() => setIsOpen(!isOpen)}>
          <div className="drawer-handle-inner">
            <div className="drawer-dot" />
            <span className="drawer-label">Ask the data anything</span>
            <span className="drawer-toggle">{isOpen ? "✕" : "↑"}</span>
          </div>
        </div>

        <div className="drawer-content">
          {/* Initial starters — shown before any messages */}
          {!hasMessages && startersVisible && (
            <div className="starter-questions">
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="starter-q"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="messages-area">
            {messages.map((msg, i) =>
              msg.role === "assistant" ? (
                <AssistantMessage key={i} content={msg.content} />
              ) : (
                <div key={i} className="msg msg-user">{msg.content}</div>
              )
            )}

            {/* In-progress streaming message */}
            {streamingContent && (
              <AssistantMessage content={streamingContent} streaming />
            )}

            {/* Status / loading indicator */}
            {loading && !streamingContent && (
              <div className="msg-loading">
                {loadingStatus ? (
                  <span className="msg-loading-status">{loadingStatus}</span>
                ) : (
                  <>
                    <div className="dot" />
                    <div className="dot" />
                    <div className="dot" />
                  </>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Data access nudge — appears after heavy use */}
          {!nudgeDismissed && queryCount >= DATA_REQUEST_NUDGE_AFTER && onRequestData && (
            <div className="data-nudge">
              <div className="data-nudge-text">
                <strong>Need deeper access?</strong> Request the raw dataset directly from Tulane for your own analysis.
              </div>
              <div className="data-nudge-actions">
                <button
                  className="data-nudge-cta"
                  onClick={() => { onRequestData(); setNudgeDismissed(true); }}
                >
                  Request access
                </button>
                <button
                  className="data-nudge-dismiss"
                  onClick={() => setNudgeDismissed(true)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Mid-conversation suggestions shelf — sits above input */}
          {hasMessages && startersVisible && (
            <div className="suggestions-shelf">
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => { sendMessage(q); setStartersVisible(false); }}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="input-area">
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Ask about the startup ecosystem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            {hasMessages && (
              <button
                className={`starters-toggle-btn ${startersVisible ? "starters-toggle-btn--active" : ""}`}
                onClick={() => setStartersVisible(v => !v)}
                title={startersVisible ? "Hide suggestions" : "Suggested questions"}
              >
                Suggest
              </button>
            )}
            <button
              className="chat-send"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>

          <div className="chat-footer">
            <span className="chat-footer-text">
              Tulane Lepage Center + LA.io · Monday + Partners
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
