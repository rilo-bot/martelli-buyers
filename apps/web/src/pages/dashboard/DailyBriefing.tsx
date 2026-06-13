import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import { useDailySummaryStore } from '@/stores/dailySummaryStore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * AI daily briefing card. Content is generated server-side and scoped to the
 * signed-in user's RBAC permissions, so each role sees a relevant summary.
 * Hidden entirely when AI isn't configured.
 */
export function DailyBriefing() {
  const hasAi = useConfigStore((s) => s.hasAi);
  const { summary, status, error, fetch } = useDailySummaryStore();

  useEffect(() => {
    if (hasAi) void fetch();
  }, [hasAi, fetch]);

  if (!hasAi) return null;

  const loading = status === 'loading';
  const generatedTime = summary?.generatedAt
    ? new Date(summary.generatedAt).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Your daily briefing
            </p>
            {generatedTime && !loading && (
              <span className="text-[11px] text-muted-foreground/70">· updated {generatedTime}</span>
            )}
          </div>

          {/* Headline */}
          {loading ? (
            <Skeleton className="mt-1.5 h-5 w-3/4" />
          ) : status === 'error' ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <AlertCircle className="h-4 w-4 text-warning" />
              {error || 'Could not load your daily briefing.'}
            </p>
          ) : (
            <p className="mt-0.5 text-[15px] font-semibold leading-snug text-foreground">
              {summary?.headline}
            </p>
          )}

          {/* Insights */}
          {loading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            summary && summary.insights.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {summary.insights.map((insight, i) => {
                  const body = (
                    <span className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span className="text-sm leading-relaxed text-foreground">{insight.text}</span>
                    </span>
                  );
                  return (
                    <li key={i}>
                      {insight.to ? (
                        <Link
                          to={insight.to}
                          className="group flex items-start justify-between gap-2 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-muted"
                        >
                          {body}
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      ) : (
                        <div className="px-2 py-1 -mx-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* Focus */}
          {!loading && summary?.focus && (
            <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-[13px] text-foreground">
              <span className="font-semibold">Focus today: </span>
              {summary.focus}
            </p>
          )}
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => fetch(true)}
          disabled={loading}
          aria-label="Refresh briefing"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
