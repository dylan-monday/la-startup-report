"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// Starter questions — scoped to single tool calls so they never hit iteration limits
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      className={`msg-copy-btn ${copied ? "msg-copy-btn--copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy response"}
      aria-label={copied ? "Copied to clipboard" : "Copy response to clipboard"}
    >
      {copied ? (
        // Checkmark
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 6.5L5.2 10L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        // Clipboard icon
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 3H2.5C1.67 3 1 3.67 1 4.5v7C1 12.33 1.67 13 2.5 13h6c.83 0 1.5-.67 1.5-1.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

export default function ChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [startersVisible, setStartersVisible] = useState(true);
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

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.response },
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Something went wrong connecting to the API. Check that the server is running and the API key is configured.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleStarterClick(question) {
    sendMessage(question);
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
      {/* Backdrop overlay when drawer is open */}
      {isOpen && (
        <div className="drawer-backdrop" onClick={() => setIsOpen(false)} />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`chat-drawer ${isOpen ? "chat-drawer-open" : ""}`}
      >
        {/* Tab / handle (visible when closed, also acts as header when open) */}
        <div
          className="drawer-handle"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="drawer-handle-inner">
            <div className="drawer-dot" />
            <span className="drawer-label">Ask the data anything</span>
            <span className="drawer-toggle">
              {isOpen ? "✕" : "↑"}
            </span>
          </div>
        </div>

        {/* Drawer content */}
        <div className="drawer-content">
          {/* Starter questions — show on open with no messages, or when user toggles back */}
          {startersVisible && (
            <div className="starter-questions">
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="starter-q"
                  onClick={() => handleStarterClick(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages area */}
          <div className="messages-area">
            {messages.map((msg, i) => (
              <div key={i} className={`msg msg-${msg.role}`}>
                {msg.role === "assistant" ? (
                  <>
                    <CopyButton text={msg.content} />
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <div className="msg-loading">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
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
            {/* Re-surface starters button — only shows after conversation starts */}
            {hasMessages && !startersVisible && (
              <button
                className="starters-toggle-btn"
                onClick={() => setStartersVisible(true)}
                title="Show suggested questions"
                aria-label="Show suggested questions"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5.5 6C5.5 4.9 6.3 4 7.5 4C8.7 4 9.5 4.8 9.5 5.8C9.5 6.7 9 7.2 8.1 7.7C7.7 7.9 7.5 8.2 7.5 8.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="7.5" cy="11" r="0.7" fill="currentColor"/>
                </svg>
              </button>
            )}
            {hasMessages && startersVisible && (
              <button
                className="starters-toggle-btn starters-toggle-btn--active"
                onClick={() => setStartersVisible(false)}
                title="Hide suggestions"
                aria-label="Hide suggestions"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5.5 6C5.5 4.9 6.3 4 7.5 4C8.7 4 9.5 4.8 9.5 5.8C9.5 6.7 9 7.2 8.1 7.7C7.7 7.9 7.5 8.2 7.5 8.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="7.5" cy="11" r="0.7" fill="currentColor"/>
                </svg>
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

          {/* Footer */}
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
