"use client";

/**
 * components/dashboard/ai-assistant-widget.tsx
 * -----------------------------------------------------------------------
 * In-Page Floating AI Assistant Widget — a collapsible chat drawer fixed
 * to the bottom-right corner. Mounted in two places, each with its own
 * theme and data scope:
 *
 *   - components/SiteNav.tsx — admin console, dark theme (unchanged from
 *     this widget's original delivery — `theme`/`scope` both default to
 *     the admin values so that existing <AiAssistantWidget /> call needed
 *     no edit).
 *   - components/PublicScanPage.tsx — the public, unauthenticated GS1
 *     scan page a customer or auditor lands on after scanning a product's
 *     QR code. That page is permanently light-themed (bg-slate-50, no
 *     dark: variants anywhere in it — see its own file banner), so this
 *     widget is rendered there with `theme="light"` to match, and
 *     `scope="public"` so it calls askPublicAssistantAction() instead of
 *     the admin action (see that action's own file banner for why these
 *     are two separate Server Actions, not one with a client-supplied
 *     permission flag).
 *
 * Answers come from lib/actions/ask-assistant.ts, which routes to a
 * deterministic question-router over this app's own existing services —
 * not a wrapped external LLM call. See lib/services/ai-assistant.ts's own
 * file banner for why, and the welcome message below states this plainly
 * rather than letting the "AI Assistant" name imply otherwise.
 *
 * `position: fixed` means this never participates in document flow —
 * collapsed or expanded, it cannot shift or overflow any other page
 * content, satisfying "no visual layout disruption when collapsed" by
 * construction rather than by careful sizing.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X, Send, Loader2, Sparkles, ArrowUpRight } from "lucide-react";
import { askAssistantAction, askPublicAssistantAction } from "@/lib/actions/ask-assistant";
import type { AssistantLink } from "@/lib/services/ai-assistant";

import { useLanguage } from "@/lib/hooks/use-language";
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: AssistantLink[];
  isError?: boolean;
}

// Full, literal Tailwind class strings per theme — never built by
// concatenating partial color-name fragments, since Tailwind's build-time
// class scanner needs to see each complete class name in source to
// include it in the compiled CSS.
const THEME_STYLES = {
  dark: {
    root: "fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 font-mono",
    panel:
      "ai-assistant-panel w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden",
    header: "flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0",
    iconBox: "w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0",
    icon: "w-3.5 h-3.5 text-emerald-400",
    title: "text-xs font-bold text-white truncate",
    subtitle: "text-[10px] text-slate-500 truncate",
    closeBtn: "text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0",
    messagesWrap: "flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0",
    userBubble: "bg-emerald-500 text-slate-950 font-medium",
    assistantBubble: "bg-slate-800 text-slate-200",
    errorBubble: "bg-red-500/10 border border-red-500/30 text-red-300",
    linkChip:
      "inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 text-[10px] font-semibold transition-colors",
    thinkingBubble: "bg-slate-800 text-slate-400 rounded-xl px-3 py-2 flex items-center gap-1.5",
    formWrap: "flex items-center gap-2 p-2.5 border-t border-slate-800 shrink-0",
    input:
      "flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500",
    sendBtn:
      "shrink-0 p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 rounded-xl transition-colors",
    toggleBtn:
      "ai-assistant-toggle w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-2xl shadow-black/40 flex items-center justify-center transition-colors shrink-0",
  },
  light: {
    root: "fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3",
    panel:
      "ai-assistant-panel w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 flex flex-col overflow-hidden",
    header: "flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0",
    iconBox: "w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0",
    icon: "w-3.5 h-3.5 text-emerald-600",
    title: "text-xs font-bold text-slate-900 truncate",
    subtitle: "text-[10px] text-slate-500 truncate",
    closeBtn: "text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0",
    messagesWrap: "flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0",
    userBubble: "bg-emerald-600 text-white font-medium",
    assistantBubble: "bg-slate-100 text-slate-700",
    errorBubble: "bg-rose-50 border border-rose-200 text-rose-700",
    linkChip:
      "inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-300 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400 text-[10px] font-semibold transition-colors",
    thinkingBubble: "bg-slate-100 text-slate-500 rounded-xl px-3 py-2 flex items-center gap-1.5",
    formWrap: "flex items-center gap-2 p-2.5 border-t border-slate-200 shrink-0",
    input:
      "flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-3 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500",
    sendBtn:
      "shrink-0 p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors",
    toggleBtn:
      "ai-assistant-toggle w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl shadow-slate-900/20 flex items-center justify-center transition-colors shrink-0",
  },
} as const;

const COPY = {
  admin: {
    subtitle: "ui.ai.answersFromLivePlatformData",
    placeholder: "ui.ai.askAboutABatchSupplierOr",
    welcome: "ui.ai.hiIMThePolymerDpp",
  },
  public: {
    subtitle: "ui.ai.askAboutThisProduct",
    placeholder: "ui.ai.askAboutThisProductOrA",
    welcome: "ui.ai.hiIMThePolymerDpp2",
  },
} as const;

// Deterministic ids for messages created client-side, so React keys never
// depend on Date.now()/Math.random() colliding across fast double-sends —
// a simple incrementing counter is all this needs.
let messageCounter = 0;
function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

interface AiAssistantWidgetProps {
  /** Visual theme — "dark" for the admin console (default), "light" for the permanently light-themed public scan page. */
  theme?: "dark" | "light";
  /** Data scope — "admin" (default) calls the full-intent admin action; "public" calls the restricted public action. */
  scope?: "admin" | "public";
  /** Public scope only: the passport currently on-screen, so "is this certified?" works without typing a batch ID. */
  contextBatchId?: string;
}

export function AiAssistantWidget({ theme = "dark", scope = "admin", contextBatchId }: AiAssistantWidgetProps) {
  const { t } = useLanguage();
  const styles = THEME_STYLES[theme];
  const copy = COPY[scope];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", content: t(copy.welcome) }]);
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
      const result =
        scope === "public" ? await askPublicAssistantAction(question, contextBatchId) : await askAssistantAction(question);
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
      console.error("AiAssistantWidget: assistant action failed:", err);
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
    <div className={styles.root}>
      {open && (
        <div role="dialog" aria-label={t("ui.ai.aiAssistantChat")} className={styles.panel}>
          <div className={styles.header}>
            <div className="flex items-center gap-2 min-w-0">
              <div className={styles.iconBox}>
                <Sparkles className={styles.icon} />
              </div>
              <div className="min-w-0">
                <p className={styles.title}>{t("ui.ai.aiAssistant")}</p>
                <p className={styles.subtitle}>{t(copy.subtitle)}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("ui.ai.closeAiAssistant")} className={styles.closeBtn}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className={styles.messagesWrap}>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                    message.role === "user" ? styles.userBubble : message.isError ? styles.errorBubble : styles.assistantBubble
                  }`}
                >
                  {message.content}
                  {message.links && message.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.links.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={styles.linkChip}>
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
                <div className={styles.thinkingBubble}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[11px]">{t("ui.ai.thinking")}</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className={styles.formWrap}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(copy.placeholder)}
              maxLength={500}
              className={styles.input}
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label={t("ui.ai.sendQuestion")} className={styles.sendBtn}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("ui.ai.closeAiAssistant") : t("ui.ai.openAiAssistant")}
        className={styles.toggleBtn}
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
