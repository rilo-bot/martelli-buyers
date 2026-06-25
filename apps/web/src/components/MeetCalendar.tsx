import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Video, Users, ExternalLink, Copy, Check, Plus, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Meeting, MeetingStatus } from '@/types';

// ---------------------------------------------------------------------------
// MeetCalendar — a dependency-free month calendar for RILO Meet.
//
// Lays scheduled meetings out on a month grid (Monday-start) with a per-day
// agenda panel. Built on the Sage Estate design tokens so it themes for free
// in light/dark mode. Only meetings with a `scheduledStartAt` appear on the
// grid — instant/ad-hoc meetings have no point in time to place.
// ---------------------------------------------------------------------------

interface MeetCalendarProps {
  meetings: Meeting[];
  /** Open/join a meeting (external link). */
  onOpen: (m: Meeting) => void;
  /** Copy a meeting's link to the clipboard. */
  onCopy: (m: Meeting) => void;
  /** id of the meeting whose link was just copied (for transient feedback). */
  copiedId: string | null;
  /** Start the create flow, optionally seeded with a chosen date (local). */
  onCreate?: (date?: Date) => void;
  /** Whether the current user may create meetings. */
  canCreate?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Tone for a meeting dot/label by status. */
function statusDot(status: MeetingStatus): string {
  switch (status) {
    case 'live': return 'bg-success';
    case 'scheduled': return 'bg-info';
    case 'ended': return 'bg-muted-foreground/40';
    default: return 'bg-muted-foreground/40';
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** Days from Monday: Sun(0)→6, Mon(1)→0, … so the grid starts on Monday. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MeetCalendar({
  meetings, onOpen, onCopy, copiedId, onCreate, canCreate,
}: MeetCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  // Bucket schedulable meetings by their local day key (YYYY-M-D).
  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!m.scheduledStartAt) continue;
      const d = new Date(m.scheduledStartAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    // Sort each day's meetings chronologically.
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledStartAt!).getTime() - new Date(b.scheduledStartAt!).getTime());
    }
    return map;
  }, [meetings]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const meetingsOn = (d: Date) => byDay.get(dayKey(d)) ?? [];

  // Build the 6-week (42-cell) grid for the visible month.
  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lead = mondayIndex(first);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedMeetings = meetingsOn(selected);
  const scheduledThisMonth = useMemo(
    () => cells.filter((d) => d.getMonth() === viewMonth.getMonth()).reduce((n, d) => n + meetingsOn(d).length, 0),
    [cells, viewMonth, byDay], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const goToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Calendar ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight truncate">{monthLabel}</h2>
            <p className="text-[11px] text-muted-foreground">
              {scheduledThisMonth} scheduled this month
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setViewMonth((m) => addMonths(m, -1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selected);
            const dayMeetings = meetingsOn(d);
            const shown = dayMeetings.slice(0, 3);
            const overflow = dayMeetings.length - shown.length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(startOfDay(d))}
                aria-label={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                aria-pressed={isSelected}
                className={cn(
                  'group relative flex min-h-[92px] flex-col gap-1 border-b border-r border-border/50 p-1.5 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  (i + 1) % 7 === 0 && 'border-r-0',
                  i >= 35 && 'border-b-0',
                  !inMonth && 'bg-muted/20',
                  isSelected ? 'bg-primary/8' : 'hover:bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      !inMonth && 'text-muted-foreground/50',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && inMonth && 'text-foreground',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {canCreate && inMonth && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); onCreate?.(startOfDay(d)); }}
                      className="hidden h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary/15 hover:text-primary group-hover:opacity-100 group-hover:flex"
                      aria-label="Schedule a meeting on this day"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {/* Meeting chips */}
                <div className="flex flex-col gap-0.5">
                  {shown.map((m) => (
                    <span
                      key={m.meetingId}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-foreground/90 bg-card border border-border/60"
                      title={m.title || 'Untitled meeting'}
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot(m.status))} />
                      <span className="tabular-nums text-muted-foreground">{timeLabel(m.scheduledStartAt)}</span>
                      <span className="truncate">{m.title || 'Untitled'}</span>
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[10px] font-semibold text-primary">+{overflow} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected-day agenda ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isSameDay(selected, today) ? 'Today' : selected.toLocaleDateString(undefined, { weekday: 'long' })}
            </p>
            <h3 className="text-sm font-bold">
              {selected.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
            </h3>
          </div>
          {canCreate && (
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => onCreate?.(selected)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add
            </Button>
          )}
        </div>

        <div className="max-h-[520px] overflow-y-auto p-3">
          {selectedMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
                <CalendarClock className="h-5 w-5 text-primary/40" />
              </div>
              <p className="text-sm font-semibold">Nothing scheduled</p>
              <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
                No meetings on this day.{canCreate ? ' Use “Add” to schedule one.' : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedMeetings.map((m) => {
                const participantCount = m.participants?.length ?? 0;
                return (
                  <div key={m.meetingId} className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.title || 'Untitled meeting'}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(m.status))} />
                          <span className="tabular-nums">{timeLabel(m.scheduledStartAt)}</span>
                          {m.scheduledDurationMinutes ? <span>· {m.scheduledDurationMinutes} min</span> : null}
                          {participantCount > 0 && (
                            <span className="flex items-center gap-1">· <Users className="h-3 w-3" />{participantCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        disabled={!m.meetingLinkUrl}
                        onClick={() => onOpen(m)}
                      >
                        <ExternalLink className="mr-1.5 h-3 w-3" />
                        {m.status === 'scheduled' ? 'Open' : 'Join'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5"
                        disabled={!m.meetingLinkUrl}
                        onClick={() => onCopy(m)}
                        aria-label="Copy meeting link"
                      >
                        {copiedId === m.meetingId
                          ? <Check className="h-3.5 w-3.5 text-success" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
