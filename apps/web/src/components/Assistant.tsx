import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useConfigStore } from '@/stores/configStore';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'How do I qualify a lead?',
  "What's the campaign workflow?",
  'How do I send an invoice to Xero?',
  'How does the e-sign agreement work?',
];

const GREETING =
  "Hi! I'm the Martelli Assistant. Ask me how to do anything in the CRM — " +
  'qualifying leads, running campaigns, due diligence, invoicing, and more.';

/**
 * Floating in-app guide. Streams how-to answers from /api/ai/assistant and
 * renders in-app links as real navigation. Hidden when AI isn't configured.
 */
export function Assistant() {
  const hasAi = useConfigStore((s) => s.hasAi);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const location = useLocation();
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the transcript scrolled to the latest content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  if (!hasAi) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const history: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(apiUrl('/api/ai/assistant'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, currentPath: location.pathname }),
      });

      if (!res.ok || !res.body) {
        throw new Error('request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: acc };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: 'Sorry — I had trouble answering just then. Please try again.',
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-24 right-5 z-50 flex h-[min(560px,calc(100vh-7rem))] w-[min(384px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3" style={{ background: 'hsl(var(--sidebar-bg))' }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Martelli Assistant</p>
                <p className="text-[11px] text-muted-foreground">How-to guide · always here to help</p>
              </div>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <Bubble role="assistant" content={GREETING} />
                  <div className="space-y-1.5">
                    <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Try asking</p>
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="flex w-full items-center rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <Bubble
                    key={i}
                    role={m.role}
                    content={m.content}
                    pending={streaming && i === messages.length - 1 && m.content === ''}
                  />
                ))
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/40">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask how to do something…"
                  className="max-h-28 flex-1 resize-none bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={streaming || !input.trim()}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** A single chat bubble; assistant messages render lightweight markdown. */
function Bubble({ role, content, pending }: { role: 'user' | 'assistant'; content: string; pending?: boolean }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-foreground">
        {pending ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </span>
        ) : (
          <Markdown text={content} />
        )}
      </div>
    </div>
  );
}

/**
 * Minimal markdown renderer for assistant replies. Supports paragraphs, bullet
 * and numbered lists, **bold**, and [label](link) — with in-app routes turned
 * into SPA navigation. Deliberately tiny to avoid a markdown dependency.
 */
function Markdown({ text }: { text: string }) {
  const navigate = useNavigate();
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={key} className={cn('my-1 space-y-1 pl-5', list.ordered ? 'list-decimal' : 'list-disc')}>
        {list.items.map((it, i) => (
          <li key={i}>{renderInline(it, navigate)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ordered = /^\s*\d+\.\s+/.test(line);
    const bullet = /^\s*[-*]\s+/.test(line);
    if (ordered || bullet) {
      const item = line.replace(/^\s*(?:\d+\.|[-*])\s+/, '');
      if (!list || list.ordered !== ordered) {
        flushList(`l-${idx}`);
        list = { items: [], ordered };
      }
      list.items.push(item);
      return;
    }
    flushList(`l-${idx}`);
    if (line.trim() === '') return;
    blocks.push(
      <p key={`p-${idx}`} className="my-1 first:mt-0 last:mb-0 leading-relaxed">
        {renderInline(line, navigate)}
      </p>,
    );
  });
  flushList('l-end');

  return <div className="space-y-0.5">{blocks}</div>;
}

/** Inline parsing: **bold** and [label](link). */
function renderInline(text: string, navigate: (to: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on links first, then handle bold inside the remaining text.
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderBold(text.slice(last, m.index), key++));
    const label = m[1];
    const href = m[2];
    const internal = href.startsWith('/');
    if (internal) {
      nodes.push(
        <button
          key={`a-${key++}`}
          type="button"
          onClick={() => navigate(href)}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {label}
        </button>,
      );
    } else {
      nodes.push(
        <a key={`a-${key++}`} href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          {label}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), key++));
  return nodes;
}

/** Split a plain string into runs, bolding **segments**. */
function renderBold(text: string, baseKey: number): React.ReactNode[] {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`b-${baseKey}-${i}`} className="font-semibold">
        {part}
      </strong>
    ) : (
      <span key={`t-${baseKey}-${i}`}>{part}</span>
    ),
  );
}
