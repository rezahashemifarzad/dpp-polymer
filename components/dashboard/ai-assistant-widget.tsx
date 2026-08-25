"use client";

/**
 * components/dashboard/ai-assistant-widget.tsx
 * -----------------------------------------------------------------------
 * In-Page Floating AI Assistant Widget — a collapsible chat drawer fixed
 * to the bottom-right corner of the admin console, mounted once from
 * components/SiteNav.tsx (same "one shared component, admin-only" pattern
 * GlobalSearchPalette already established there — see that file's own
 * import comment).
 *
 * Answers come from lib/actions/ask-assistant.ts, which is a deterministic
 * question-router over this app's own existing services (batch lookup,
 * supplier rankings, certificate expiry, a compliance glossary, page
 * navigation) — not a wrapped external LLM call. See
 * lib/services/ai-assistant.ts's own file banner for why, and the welcome
 * message below states this plainly rather than letting the "AI
 * Assistant" name imply otherwise.
 *
 * `position: fixed` means this never participates in document flow —
 * collapsed or expanded, it cannot shift or overflow any other page
 * content, satisfying "no visual layout disruption when collapsed" by
 * construction rather than by careful sizing.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X, Send, Loader2, Sparkles, ArrowUpRight } from "lucide-react";
import { askAssistantAction } from "@/lib/actions/ask-assistant";
import type { AssistantLink } from "@/lib/services/ai-assistant";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: AssistantLink[];
  isError?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — I'm the Polymer DPP Assistant. I answer from this platform's own live data and a built-in compliance glossary (not a general-purpose AI), so ask me about a batch, certificate expirations, supplier performance, a compliance term, or where to find something.",
};

// Deterministic ids for messages created client-side, so React keys never
// depend on Date.now()/Math.random() colliding across fast double-sends —
// a simple incrementing counter is all this needs.
let messageCounter = 0;
function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setMessages((prev) => [...prev, { id: nextMessageId("user"), role: "user", content: question }]);
    setInput("");
    setSending(true);

    try {
      const result = await askAssistantAction(question);
      if (result.ok && result.data) {
        setMessages((prev) => [
          ...prev,
          { id: nextMessageId("assistant"), role: "assistant", content: result.data!.answer, links: result.data!.links },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId("assistant-error"),
            role: "assistant",
            content: result.error || "Something went wrong answering that — try again in a moment.",
            isError: true,
          },
        ]);
      }
    } catch (err) {
      console.error("AiAssistantWidget: askAssistantAction failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("assistant-error"),
          role: "assistant",
          content: "Something went wrong answering that — try again in a moment.",
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 font-mono">
      {open && (
        <div
          role="dialog"
          aria-label="AI Assistant chat"
          className="ai-assistant-panel w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">AI Assistant</p>
                <p className="text-[10px] text-slate-500 truncate">Answers from live platform data</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI Assistant"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                    message.role === "user"
                      ? "bg-emerald-500 text-slate-950 font-medium"
                      : message.isError
                      ? "bg-red-500/10 border border-red-500/30 text-red-300"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {message.content}
                  {message.links && message.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 text-[10px] font-semibold transition-colors"
                        >
                          {link.label}
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[11px]">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2.5 border-t border-slate-800 shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a batch, supplier, or compliance term..."
              maxLength={500}
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send question"
              className="shrink-0 p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 rounded-xl transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        className="ai-assistant-toggle w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-2xl shadow-black/40 flex items-center justify-center transition-colors shrink-0"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      <style>{`
        .ai-assistant-panel {
          animation: aiAssistantExpand 160ms ease-out;
          transform-origin: bottom right;
        }
        @keyframes aiAssistantExpand {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .ai-assistant-toggle {
          animation: aiAssistantPop 160ms ease-out;
        }
        @keyframes aiAssistantPop {
          from { transform: scale(0.9); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
