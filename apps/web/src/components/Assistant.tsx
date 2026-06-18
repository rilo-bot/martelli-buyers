import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X, Send, Loader2, SquarePen } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useConfigStore } from '@/stores/configStore';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'What needs my attention today?',
  'How many leads are open right now?',
  'Which buyer journeys are stalled?',
  'How do I send an invoice to Xero?',
];

const GREETING =
  "Hi! I'm the Martelli Assistant. Ask me how to use the CRM, or about your own " +
  'data — open leads, stalled journeys, overdue invoices, and more.';

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

  // While streaming, the typewriter reveals text between message updates, so
  // pin the view to the bottom on a light interval to follow the live text.
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 120);
    return () => clearInterval(id);
  }, [streaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  if (!hasAi) return null;

  // Start a fresh conversation. No history is kept — just clear and refocus.
  function newChat() {
    if (streaming) return;
    setMessages([]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

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
            <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ background: 'hsl(var(--sidebar-bg))', borderColor: 'hsl(var(--sidebar-border))' }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm ring-1 ring-inset ring-white/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--sidebar-text))]">Martelli Assistant</p>
                <p className="text-[11px] text-[hsl(var(--sidebar-text-muted))]">Guidance + your portal data</p>
              </div>
              <button
                type="button"
                onClick={newChat}
                disabled={streaming || messages.length === 0}
                aria-label="New chat"
                title="New chat"
                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--sidebar-text-muted))] transition-colors hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-text))] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[hsl(var(--sidebar-text-muted))]"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
                messages.map((m, i) => {
                  const live = streaming && i === messages.length - 1;
                  return (
                    <Bubble
                      key={i}
                      role={m.role}
                      content={m.content}
                      pending={live && m.content === ''}
                      streaming={live}
                    />
                  );
                })
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
function Bubble({
  role,
  content,
  pending,
  streaming,
}: {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  streaming?: boolean;
}) {
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
        {pending ? <WaveLoader /> : <StreamingMarkdown text={content} live={!!streaming} />}
      </div>
    </div>
  );
}

/** Three dots rippling in a wave — the assistant's "typing" indicator. */
function WaveLoader() {
  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      role="status"
      aria-label="Assistant is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 0.16}s`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  );
}

/**
 * Renders assistant markdown, but while a reply is streaming it reveals the text
 * at a steady pace (a soft typewriter) so it reads smoothly regardless of how
 * bursty the network chunks arrive.
 */
function StreamingMarkdown({ text, live }: { text: string; live: boolean }) {
  const shown = useTypewriter(text, live);
  return <Markdown text={shown} />;
}

/**
 * Reveals `target` one slice at a time on each animation frame at a calm pace.
 * The speed has a low floor and only accelerates a little when it falls behind,
 * so it reads slowly and smoothly. It keeps revealing at that pace until caught
 * up — even after the network stream finishes — rather than snapping to the end.
 * Messages that were never live (history) render in full immediately.
 */
function useTypewriter(target: string, active: boolean): string {
  const [, force] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const shownLen = useRef(active ? 0 : target.length);
  const everLive = useRef(active);
  if (active) everLive.current = true;

  useEffect(() => {
    // History bubble that was never streamed — show it all at once.
    if (!everLive.current) {
      shownLen.current = targetRef.current.length;
      force((n) => n + 1);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const len = targetRef.current.length;
      if (shownLen.current < len) {
        const dt = now - last;
        const backlog = len - shownLen.current;
        // chars/sec: low floor, mild catch-up so it never lags too far behind.
        const speed = Math.max(11, backlog * 1.6);
        const advance = Math.max(1, Math.round((speed * dt) / 1000));
        shownLen.current = Math.min(len, shownLen.current + advance);
        force((n) => n + 1);
        last = now;
        raf = requestAnimationFrame(tick);
      } else if (active) {
        // Caught up but still streaming — wait for more text to arrive.
        last = now;
        raf = requestAnimationFrame(tick);
      }
      // Caught up and stream finished: nothing left to reveal, stop.
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return targetRef.current.slice(0, shownLen.current);
}

/**
 * Minimal markdown renderer for assistant replies. Supports headings (#–###),
 * paragraphs, bullet and numbered lists, **bold**, [label](link) — with in-app
 * routes turned into SPA navigation — and `---` dividers. Deliberately tiny to
 * avoid a markdown dependency, but tuned for an easy-to-scan chat bubble.
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
      <Tag
        key={key}
        className={cn(
          'my-1.5 space-y-1.5 pl-5 marker:text-muted-foreground',
          list.ordered ? 'list-decimal' : 'list-disc',
        )}
      >
        {list.items.map((it, i) => (
          <li key={i} className="pl-0.5 leading-relaxed">
            {renderInline(it, navigate)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();

    // Horizontal rule — a light divider between sections.
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushList(`l-${idx}`);
      blocks.push(<hr key={`hr-${idx}`} className="my-2.5 border-border/70" />);
      return;
    }

    // Headings (#, ##, ###+). Rendered as clear, scannable section titles
    // rather than leaking the raw `###` into the bubble.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`l-${idx}`);
      const level = heading[1].length;
      const body = heading[2].replace(/\s*#+\s*$/, '');
      blocks.push(
        <p
          key={`h-${idx}`}
          className={cn(
            'font-semibold text-foreground first:mt-0',
            level <= 1 ? 'mb-1 mt-3 text-[15px]' : 'mb-0.5 mt-2.5 text-[13px]',
          )}
        >
          {renderInline(body, navigate)}
        </p>,
      );
      return;
    }

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
      <p key={`p-${idx}`} className="my-1.5 leading-relaxed first:mt-0 last:mb-0">
        {renderInline(line, navigate)}
      </p>,
    );
  });
  flushList('l-end');

  return <div className="space-y-0.5 text-[13px]">{blocks}</div>;
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
