import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Paperclip, ArrowDownLeft, ArrowUpRight, Link2, Link2Off, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { attachmentUrl } from '@/lib/outlook';
import type { EmailMessage } from '@/types';

interface Props {
  emails: EmailMessage[];
  /** Show the "Link" / "Unlink" action on each row (inbox view). */
  showLinkAction?: boolean;
  onLink?: (email: EmailMessage) => void;
  onUnlink?: (email: EmailMessage) => void;
  emptyText?: string;
}

function fmtDate(e: EmailMessage): string {
  const iso = e.receivedAt || e.sentAt || e.createdAt;
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function EmailRow({ email, showLinkAction, onLink, onUnlink }: {
  email: EmailMessage;
  showLinkAction?: boolean;
  onLink?: (e: EmailMessage) => void;
  onUnlink?: (e: EmailMessage) => void;
}) {
  const [open, setOpen] = useState(false);
  const to = email.toRecipients.map((r) => r.name || r.address).join(', ');
  const isLinked = Boolean(email.clientId || email.dealId);

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {email.direction === 'outbound'
              ? <ArrowUpRight className="h-4 w-4" />
              : <ArrowDownLeft className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{email.subject || '(no subject)'}</p>
              {email.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {email.direction === 'outbound' ? `To ${to || '—'}` : `From ${email.fromName || email.fromAddress}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(email)}</span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] capitalize">{email.folder}</Badge>
              {email.linkSource === 'auto' && <Badge variant="secondary" className="text-[10px]">Auto-linked</Badge>}
              {email.linkSource === 'manual' && <Badge variant="secondary" className="text-[10px]">Linked</Badge>}
            </div>
          </div>
        </button>

        {open && (
          <div className="border-t border-border/60 px-4 py-3 space-y-3">
            <div className="grid gap-1 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">From:</span> {email.fromName} &lt;{email.fromAddress}&gt;</div>
              {to && <div><span className="font-medium text-foreground">To:</span> {to}</div>}
              {email.ccRecipients.length > 0 && (
                <div><span className="font-medium text-foreground">Cc:</span> {email.ccRecipients.map((r) => r.name || r.address).join(', ')}</div>
              )}
            </div>

            {/* Email HTML rendered in a sandboxed iframe so arbitrary mail markup
                can never script into the app. Falls back to the text preview. */}
            {email.bodyHtml ? (
              <iframe
                title={`email-${email.id}`}
                sandbox=""
                srcDoc={email.bodyHtml}
                className="h-72 w-full rounded-md border border-border/60 bg-white"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{email.bodyPreview}</p>
            )}

            {email.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {email.attachments.filter((a) => !a.isInline).map((a) => (
                  <a
                    key={a.graphId}
                    href={attachmentUrl(email.id, a.graphId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs hover:bg-muted/50"
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.name || 'attachment'}
                  </a>
                ))}
              </div>
            )}

            {showLinkAction && (
              <div className="flex justify-end gap-2 pt-1">
                {isLinked && onUnlink && (
                  <Button variant="ghost" size="sm" onClick={() => onUnlink(email)}>
                    <Link2Off className="mr-1.5 h-3.5 w-3.5" />Unlink
                  </Button>
                )}
                {onLink && (
                  <Button variant="outline" size="sm" onClick={() => onLink(email)}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />{isLinked ? 'Change link' : 'Link to case'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmailList({ emails, showLinkAction, onLink, onUnlink, emptyText }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
          <Mail className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="text-base font-semibold">No emails</h3>
        <p className={cn('mt-1.5 text-sm text-muted-foreground max-w-xs')}>
          {emptyText ?? 'Synced Outlook emails will appear here.'}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {emails.map((email) => (
        <EmailRow
          key={email.id}
          email={email}
          showLinkAction={showLinkAction}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      ))}
    </div>
  );
}
