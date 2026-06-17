import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Trash2, CheckCircle, Circle, Loader2, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTasksStore } from '@/stores/tasksStore';
import { useUsersStore } from '@/stores/usersStore';
import { useAuthStore } from '@/stores/authStore';
import type { Task, TaskType, TaskPriority, Property } from '@/types';

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'call', label: 'Call client' },
  { value: 'viewing', label: 'Arrange viewing' },
  { value: 'lim', label: 'Request LIM report' },
  { value: 'builders_report', label: "Review builder's report" },
  { value: 'finance', label: 'Follow up mortgage broker' },
  { value: 'agreement', label: 'Send agreement' },
  { value: 'other', label: 'Other' },
];
const TYPE_LABEL: Record<TaskType, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<TaskType, string>;

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'normal', 'high'];
const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  normal: 'bg-primary/10 text-primary border-primary/20',
  high: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
};

interface TaskForm {
  title: string;
  type: TaskType;
  assignedTo: string;
  dueDate: string;
  priority: TaskPriority;
  propertyId: string;
  notes: string;
}

const emptyForm = (assignedTo: string): TaskForm => ({
  title: '', type: 'other', assignedTo, dueDate: '', priority: 'normal', propertyId: '', notes: '',
});

const isOverdue = (t: Task) => !t.completed && !!t.dueDate && new Date(t.dueDate).getTime() < Date.now();

export function TasksTab({ dealId, properties }: { dealId: string; properties: Property[] }) {
  const tasks = useTasksStore((s) => s.tasks);
  const addTask = useTasksStore((s) => s.addTask);
  const updateTask = useTasksStore((s) => s.updateTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const toggleComplete = useTasksStore((s) => s.toggleComplete);
  const users = useUsersStore((s) => s.users);
  const nameFor = useUsersStore((s) => s.nameFor);
  const currentUser = useAuthStore((s) => s.currentUser);

  const dealTasks = useMemo(() => tasks.filter((t) => t.dealId === dealId), [tasks, dealId]);
  const open = useMemo(
    () => dealTasks.filter((t) => !t.completed).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    [dealTasks],
  );
  const done = useMemo(() => dealTasks.filter((t) => t.completed), [dealTasks]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm(currentUser?.id ?? ''));
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const propertyLabel = (id: string) => properties.find((p) => p.id === id)?.address || '';

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(currentUser?.id ?? ''));
    setDialogOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    setForm({ title: t.title, type: t.type, assignedTo: t.assignedTo, dueDate: t.dueDate, priority: t.priority, propertyId: t.propertyId, notes: t.notes });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      dealId,
      propertyId: form.propertyId,
      title: form.title.trim(),
      type: form.type,
      assignedTo: form.assignedTo,
      dueDate: form.dueDate,
      priority: form.priority,
      notes: form.notes.trim(),
      completed: false,
      completedAt: '',
    };
    try {
      if (editingId) await updateTask(editingId, payload);
      else await addTask(payload);
      toast.success(editingId ? 'Task updated.' : 'Task added.');
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteTask(id);
      toast.success('Task deleted.');
      setConfirmDeleteId(null);
    } catch {
      toast.error('Failed to delete task.');
    } finally {
      setDeleting(false);
    }
  };

  const row = (t: Task) => (
    <div key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
      <button type="button" onClick={() => toggleComplete(t.id, !t.completed)} className="mt-0.5 shrink-0" aria-label="Toggle complete">
        {t.completed
          ? <CheckCircle className="h-5 w-5 text-emerald-500" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-medium', t.completed && 'line-through text-muted-foreground')}>{t.title}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-semibold', PRIORITY_BADGE[t.priority])}>{t.priority}</span>
          {isOverdue(t) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-semibold">Overdue</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
          <span>{TYPE_LABEL[t.type]}</span>
          {t.dueDate && <span>Due {t.dueDate}</span>}
          {t.assignedTo && <span>· {nameFor(t.assignedTo) || 'Assigned'}</span>}
          {t.propertyId && propertyLabel(t.propertyId) && <span>· {propertyLabel(t.propertyId)}</span>}
        </div>
        {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(t)}>Edit</Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(t.id)} aria-label="Delete task">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{open.length} open · {done.length} done</p>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-3.5 w-3.5" />New Task</Button>
      </div>

      {dealTasks.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              compact
              icon={ListTodo}
              title="No tasks yet"
              description="Track the next actions for this journey — calls, viewings, LIM requests…"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <Card className="border-border/70 overflow-hidden">
              <div className="divide-y divide-border/60">{open.map(row)}</div>
            </Card>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Completed ({done.length})</p>
              <Card className="border-border/70 overflow-hidden opacity-80">
                <div className="divide-y divide-border/60">{done.map(row)}</div>
              </Card>
            </div>
          )}
        </>
      )}

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent size="lg">
          <SheetHeader><SheetTitle>{editingId ? 'Edit Task' : 'New Task'}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tk-title">Title</Label>
              <Input id="tk-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Call client about offer" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tk-type">Type</Label>
                <Select id="tk-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TaskType }))} className="h-10 w-full">
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tk-priority">Priority</Label>
                <Select id="tk-priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))} className="h-10 w-full capitalize">
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tk-due">Due date</Label>
                <Input id="tk-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tk-assignee">Assigned to</Label>
                <Select id="tk-assignee" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} className="h-10 w-full">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </Select>
              </div>
            </div>
            {properties.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="tk-prop">Related property (optional)</Label>
                <Select id="tk-prop" value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} className="h-10 w-full">
                  <option value="">None</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.address || p.suburb || 'Property'}</option>)}
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="tk-notes">Notes</Label>
              <Textarea id="tk-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={saving || !form.title.trim()}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : editingId ? 'Save Changes' : 'Add Task'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o && !deleting) setConfirmDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>This permanently removes the task. This can’t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" disabled={deleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" loading={deleting} onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              {deleting ? 'Deleting…' : 'Delete task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
