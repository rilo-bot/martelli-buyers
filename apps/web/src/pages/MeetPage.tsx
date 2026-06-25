import { useEffect, useMemo, useState } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import { useConfigStore } from '@/stores/configStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import {
  Video, Plus, Loader2, Copy, ExternalLink, CalendarClock, Users, Link2, AlertTriangle, Check,
  LayoutGrid, CalendarDays,
} from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/motion';
import MeetCalendar from '@/components/MeetCalendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Meeting, MeetingStatus } from '@/types';

type StatusFilter = 'all' | 'live' | 'scheduled';
type ViewMode = 'list' | 'calendar';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
];

/** Map a RILO status to a StatusPill tone + label. */
function statusTone(status: MeetingStatus): { tone: 'live' | 'info' | 'muted'; label: string } {
  switch (status) {
    case 'live': return { tone: 'live', label: 'Live' };
    case 'scheduled': return { tone: 'info', label: 'Scheduled' };
    case 'ended': return { tone: 'muted', label: 'Ended' };
    default: return { tone: 'muted', label: status || 'Unknown' };
  }
}

/** Friendly date for a scheduled start time. */
function formatSchedule(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const isSameDayLocal = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Format a Date as the local value a `datetime-local` input expects. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  title: '',
  hostEmail: '',
  participants: '',
  scheduled: false,
  scheduledStartAt: '',
  scheduledDurationMinutes: '45',
};

export default function MeetPage() {
  const meetings = useMeetStore((s) => s.meetings);
  const loaded = useMeetStore((s) => s.loaded);
  const loading = useMeetStore((s) => s.loading);
  const fetchMeetings = useMeetStore((s) => s.fetch);
  const createMeeting = useMeetStore((s) => s.create);
  const hasMeet = useConfigStore((s) => s.hasMeet);
  const configLoaded = useConfigStore((s) => s.loaded);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { can } = usePermissions();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('calendar');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load meetings once Meet is known to be configured. Done here (not in
  // bootstrap) so a slow/erroring external service never blocks app start-up.
  useEffect(() => {
    if (hasMeet && can('meet:view')) {
      fetchMeetings().catch(() => toast.error('Could not load meetings from RILO Meet.'));
    }
  }, [hasMeet, can, fetchMeetings]);

  const filtered = useMemo(() => {
    if (filter === 'all') return meetings;
    return meetings.filter((m) => m.status === filter);
  }, [meetings, filter]);

  const liveCount = useMemo(() => meetings.filter((m) => m.status === 'live').length, [meetings]);

  const openCreate = (date?: Date) => {
    // Seed a scheduled meeting when launched from a calendar day. Default the
    // time to the next clean hour so the picker isn't stuck at midnight.
    let scheduledFields = {};
    if (date) {
      const start = new Date(date);
      const now = new Date();
      start.setHours(isSameDayLocal(date, now) ? now.getHours() + 1 : 9, 0, 0, 0);
      scheduledFields = { scheduled: true, scheduledStartAt: toLocalInputValue(start) };
    }
    setForm({ ...EMPTY_FORM, hostEmail: currentUser?.email ?? '', ...scheduledFields });
    setShowCreate(true);
  };

  const copyLink = async (m: Meeting) => {
    if (!m.meetingLinkUrl) return;
    try {
      await navigator.clipboard.writeText(m.meetingLinkUrl);
      setCopiedId(m.meetingId);
      setTimeout(() => setCopiedId((id) => (id === m.meetingId ? null : id)), 1500);
      toast.success('Meeting link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const hostEmail = form.hostEmail.trim().toLowerCase();
    if (!title) { toast.error('A meeting title is required.'); return; }
    if (!hostEmail) { toast.error('A host email is required.'); return; }

    const participants = form.participants
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const payload: Parameters<typeof createMeeting>[0] = { title, hostEmail, participants };

    if (form.scheduled) {
      if (!form.scheduledStartAt) { toast.error('Pick a start time for the scheduled meeting.'); return; }
      const startIso = new Date(form.scheduledStartAt).toISOString();
      const duration = Number(form.scheduledDurationMinutes);
      if (!Number.isFinite(duration) || duration <= 0) { toast.error('Enter a valid duration in minutes.'); return; }
      payload.scheduledStartAt = startIso;
      payload.scheduledDurationMinutes = duration;
    }

    setSaving(true);
    try {
      const meeting = await createMeeting(payload);
      setShowCreate(false);
      // Refresh so the list reflects upstream state (status, ordering, etc.).
      void fetchMeetings().catch(() => {});
      if (meeting?.meetingLinkUrl && !form.scheduled) {
        toast.success('Meeting created.', {
          action: { label: 'Join', onClick: () => window.open(meeting.meetingLinkUrl, '_blank', 'noopener') },
        });
      } else {
        toast.success(form.scheduled ? 'Meeting scheduled.' : 'Meeting created.');
      }
    } catch (err) {
      // Keep the sheet open so the user's input survives a failed create.
      toast.error(err instanceof Error ? err.message : 'Could not create the meeting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1.5">Collaboration</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Meet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Start instant video meetings or schedule them with clients and agents, powered by RILO Meet.
          </p>
        </div>
        {can('meet:create') && hasMeet && (
          <Button onClick={() => openCreate()} className="shadow-md shadow-primary/25 h-9">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Meeting
          </Button>
        )}
      </div>

      {/* Not configured notice */}
      {configLoaded && !hasMeet ? (
        <Card className="border-amber-300/60 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/10">
          <CardContent className="flex items-start gap-3 py-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/25">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">RILO Meet isn’t configured yet</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Add your <code className="rounded bg-muted px-1 py-0.5 text-xs">RILO_MEET_API_KEY</code> to the server
                environment and restart it to enable meetings. The key stays server-side and is never exposed to the browser.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Toolbar: status filters + view switcher */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all h-9',
                      active ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border hover:bg-muted text-muted-foreground',
                    )}
                  >
                    {f.label}
                    {f.key === 'live' && liveCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-success/15 px-1.5 text-[11px] font-bold text-success">
                        {liveCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* View switcher */}
            <div className="inline-flex h-9 items-center rounded-lg border border-border bg-card p-0.5" role="tablist" aria-label="View mode">
              {([
                { key: 'list' as const, label: 'List', Icon: LayoutGrid },
                { key: 'calendar' as const, label: 'Calendar', Icon: CalendarDays },
              ]).map(({ key, label, Icon }) => {
                const active = view === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all',
                      active ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body: list or calendar */}
          {!loaded && loading ? (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-border/70">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </CardContent>
                </Card>
              ))}
            </Stagger>
          ) : view === 'calendar' ? (
            <MeetCalendar
              meetings={filtered}
              onOpen={(m) => m.meetingLinkUrl && window.open(m.meetingLinkUrl, '_blank', 'noopener')}
              onCopy={copyLink}
              copiedId={copiedId}
              onCreate={can('meet:create') ? openCreate : undefined}
              canCreate={can('meet:create')}
            />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
                <Video className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-lg font-bold">
                {filter === 'all' ? 'No meetings yet' : `No ${filter} meetings`}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                {filter === 'all'
                  ? 'Spin up an instant video room or schedule one ahead of time. Participants wait in the lobby until the host admits them.'
                  : 'Try a different filter, or start a new meeting.'}
              </p>
              {can('meet:create') && (
                <Button className="mt-5 shadow-md shadow-primary/20" onClick={() => openCreate()}>
                  <Plus className="mr-2 h-4 w-4" />Start a meeting
                </Button>
              )}
            </div>
          ) : (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m) => {
                const tone = statusTone(m.status);
                const schedule = formatSchedule(m.scheduledStartAt);
                const participantCount = m.participants?.length ?? 0;
                return (
                  <StaggerItem key={m.meetingId}>
                    <Card className="group h-full border-border/70 card-interactive">
                      <CardContent className="flex h-full flex-col gap-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shrink-0">
                              <Video className="h-[18px] w-[18px] text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold truncate">{m.title || 'Untitled meeting'}</p>
                              {m.hostEmail && (
                                <p className="text-[11px] text-muted-foreground truncate">Host: {m.hostEmail}</p>
                              )}
                            </div>
                          </div>
                          <StatusPill tone={tone.tone} className="shrink-0">{tone.label}</StatusPill>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          {schedule && (
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {schedule}
                                {m.scheduledDurationMinutes ? ` · ${m.scheduledDurationMinutes} min` : ''}
                              </span>
                            </div>
                          )}
                          {participantCount > 0 && (
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span>{participantCount} participant{participantCount === 1 ? '' : 's'}</span>
                            </div>
                          )}
                          {m.meetingCode && (
                            <div className="flex items-center gap-2">
                              <Link2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-mono">{m.meetingCode}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-auto flex gap-2 pt-2 border-t border-border/50">
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs shadow-sm shadow-primary/20"
                            disabled={!m.meetingLinkUrl}
                            onClick={() => m.meetingLinkUrl && window.open(m.meetingLinkUrl, '_blank', 'noopener')}
                          >
                            <ExternalLink className="mr-1.5 h-3 w-3" />
                            {m.status === 'scheduled' ? 'Open' : 'Join'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            disabled={!m.meetingLinkUrl}
                            onClick={() => copyLink(m)}
                            aria-label="Copy meeting link"
                          >
                            {copiedId === m.meetingId
                              ? <Check className="h-3.5 w-3.5 text-success" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </>
      )}

      {/* Create drawer */}
      <Sheet open={showCreate} onOpenChange={(open) => { if (!saving) setShowCreate(open); }}>
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>New Meeting</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meetTitle">Title *</Label>
                <Input
                  id="meetTitle"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Quick Sync"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meetHost">Host email *</Label>
                <Input
                  id="meetHost"
                  type="email"
                  value={form.hostEmail}
                  onChange={(e) => setForm((f) => ({ ...f, hostEmail: e.target.value }))}
                  placeholder="you@yourfirm.com"
                />
                <p className="text-[11px] text-muted-foreground">Must be an existing RILO user.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meetParticipants">Participants</Label>
                <Textarea
                  id="meetParticipants"
                  value={form.participants}
                  onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
                  rows={2}
                  placeholder="alice@acme.com, bob@acme.com"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma- or space-separated emails. They wait in the lobby until the host admits them.
                </p>
              </div>

              <label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-muted transition-colors">
                <input
                  type="checkbox"
                  checked={form.scheduled}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.checked }))}
                  className="rounded"
                />
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Schedule for later</span>
              </label>

              {form.scheduled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="meetStart">Start time *</Label>
                    <Input
                      id="meetStart"
                      type="datetime-local"
                      value={form.scheduledStartAt}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledStartAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meetDuration">Duration (min) *</Label>
                    <Input
                      id="meetDuration"
                      type="number"
                      min={1}
                      value={form.scheduledDurationMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledDurationMinutes: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost" disabled={saving}>Cancel</Button></SheetClose>
              <Button type="submit" disabled={saving || !form.title.trim() || !form.hostEmail.trim()} className="shadow-sm shadow-primary/20">
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                  : <><Video className="mr-2 h-4 w-4" />{form.scheduled ? 'Schedule Meeting' : 'Start Meeting'}</>}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
