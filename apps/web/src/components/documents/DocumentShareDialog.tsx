import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Search, Users } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useUsersStore } from '@/stores/usersStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { Document } from '@/types';

/**
 * Admin-only: choose which internal users a document is shared with. Shared users
 * get preview-only access (they can never download). Pre-selects the document's
 * current `sharedWith`; the uploader and the current admin are excluded from the
 * list (the uploader already owns the file).
 */
export function DocumentShareDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: Document }) {
  const shareDocument = useDocumentsStore((s) => s.shareDocument);
  const users = useUsersStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set(doc.sharedWith ?? []));
      setSearch('');
    }
  }, [open, doc]);

  // Internal users available to share with — never the uploader or the admin
  // doing the sharing (both already have access).
  const candidates = useMemo(() => {
    const excluded = new Set([doc.uploadedBy, currentUser?.id].filter(Boolean) as string[]);
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => !excluded.has(u.id))
      .filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [users, doc.uploadedBy, currentUser?.id, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await shareDocument(doc.id, [...selected]);
      toast.success(selected.size ? `Shared with ${selected.size} ${selected.size === 1 ? 'person' : 'people'}.` : 'Sharing removed.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <SheetContent size="lg">
        <SheetHeader><SheetTitle>Share “{doc.name}”</SheetTitle></SheetHeader>

        <SheetBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selected users can <strong className="text-foreground">preview</strong> this document — they cannot download it.
          </p>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teammates…" className="pl-9" />
          </div>

          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
              <Users className="mb-2 h-6 w-6 opacity-40" />
              {users.length <= 1 ? 'No other team members to share with yet.' : 'No teammates match your search.'}
            </div>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              {candidates.map((u) => {
                const on = selected.has(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}>
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.name || u.email}</span>
                        {u.name && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild><Button variant="ghost" disabled={busy}>Cancel</Button></SheetClose>
          <Button onClick={save} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save sharing'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
