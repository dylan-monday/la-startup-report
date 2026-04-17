"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const STARTER_QUESTIONS = [
  "What does the typical GNO startup look like?",
  "What funding sources are companies actually using vs. trying to access?",
  "How has AI impacted local businesses?",
  "What industries are most represented in the survey?",
  "What are the hiring trends across the ecosystem?",
  "How do software companies compare to the rest of the cohort?",
  "What does the revenue distribution look like over time?",
  "What workspace types are most common?",
];

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
    setInput(question);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

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

        {/* Drawer content (only renders meaningfully when open) */}
        <div className="drawer-content">
          {/* Starter questions */}
          {startersVisible && messages.length === 0 && (
            <div className="starter-questions">
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="starter-q"
                  onClick={() => handleStarterClick(q)}
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
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
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
