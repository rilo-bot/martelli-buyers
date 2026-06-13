import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRightLeft, FileSignature, FileText, Loader2, Clock } from 'lucide-react';
import { getDealTimeline } from '@/lib/timeline';
import type { AuditEvent } from '@/types';

/** Friendly title for an audit action. */
function describe(ev: AuditEvent): string {
  switch (ev.action) {
    case 'stage_changed': return 'Stage changed';
    case 'agreement_sent': return 'Agreement sent';
    case 'agreement_signed': return 'Agreement signed';
    case 'agreement_status_changed': return 'Agreement status changed';
    case 'offer_created': return 'Offer created';
    case 'offer_status_changed': return 'Offer status changed';
    default: return ev.action.replace(/_/g, ' ');
  }
}

function iconFor(action: string) {
  if (action.startsWith('agreement')) return FileSignature;
  if (action.startsWith('offer')) return FileText;
  return ArrowRightLeft;
}

const label = (v: string) => v.replace(/_/g, ' ');

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TimelineTab({ dealId }: { dealId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDealTimeline(dealId)
      .then((e) => { if (active) setEvents(e); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading timeline…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-dashed border-primary/30 mb-3">
            <Clock className="h-6 w-6 text-primary/40" />
          </div>
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">Stage changes, offers, and agreement events will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="relative ml-3 border-l border-border/60">
          {events.map((ev) => {
            const Icon = iconFor(ev.action);
            return (
              <li key={ev.id} className="mb-6 ml-6 last:mb-0">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-4 ring-background">
                  <Icon className="h-3 w-3 text-primary" />
                </span>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium">{describe(ev)}</p>
                  <span className="text-xs text-muted-foreground" title={new Date(ev.at || ev.createdAt).toLocaleString('en-NZ')}>
                    {relTime(ev.at || ev.createdAt)}
                  </span>
                </div>
                {(ev.fromValue || ev.toValue) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.fromValue && <span className="capitalize">{label(ev.fromValue)}</span>}
                    {ev.fromValue && ev.toValue && ' → '}
                    {ev.toValue && <span className="capitalize font-medium text-foreground">{label(ev.toValue)}</span>}
                  </p>
                )}
                {ev.actorName && <p className="text-xs text-muted-foreground mt-0.5">by {ev.actorName}</p>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
