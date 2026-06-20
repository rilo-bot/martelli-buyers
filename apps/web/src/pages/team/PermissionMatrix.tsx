import { PERMISSION_MODULES, JOURNEY_TABS, journeyTabPerm } from '@/types';
import { cn } from '@/lib/utils';

const ACTION_LABEL: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  send: 'Send',
  manage: 'Manage',
};

/**
 * A checkbox grid of every `${module}:${action}` permission, grouped by module.
 * Controlled: `value` is the selected permission strings; `onChange` returns the
 * next set. `readOnly` renders disabled checkboxes (for non–super-admin viewers).
 */
export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
}: {
  value: string[];
  onChange?: (next: string[]) => void;
  readOnly?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (perm: string) => {
    if (readOnly || !onChange) return;
    const next = new Set(selected);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    onChange([...next]);
  };

  return (
    <div className="space-y-1.5">
      {PERMISSION_MODULES.map((m) => (
        <div
          key={m.key}
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
        >
          <span className="w-32 shrink-0 text-[13px] font-medium text-foreground">{m.label}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {m.actions.map((a) => {
              const perm = `${m.key}:${a}`;
              const checked = selected.has(perm);
              return (
                <label
                  key={perm}
                  className={cn('flex items-center gap-1.5 text-[12.5px]', readOnly ? 'cursor-default' : 'cursor-pointer')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => toggle(perm)}
                    className="h-3.5 w-3.5 rounded border-input accent-primary"
                  />
                  <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>
                    {ACTION_LABEL[a] ?? a}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Buyer-journey tabs — gate which detail tabs this role can see. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
        <span className="w-32 shrink-0 text-[13px] font-medium text-foreground">Journey Tabs</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {JOURNEY_TABS.map((t) => {
            const perm = journeyTabPerm(t.key);
            const checked = selected.has(perm);
            return (
              <label
                key={perm}
                className={cn('flex items-center gap-1.5 text-[12.5px]', readOnly ? 'cursor-default' : 'cursor-pointer')}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => toggle(perm)}
                  className="h-3.5 w-3.5 rounded border-input accent-primary"
                />
                <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{t.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
