import { useSearchParams } from 'react-router-dom';
import { Settings2, Plug, ClipboardList, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { WorkspaceSection } from '@/pages/settings/WorkspaceSection';
import { IntegrationsSection } from '@/pages/settings/IntegrationsSection';
import { LeadSettings } from '@/pages/settings/LeadSettings';

// Re-exported for back-compat: several Leads pages import these from here.
export { getStagePillClass, getStageDotClass } from '@/pages/settings/stageColors';

interface Section { id: string; label: string; desc: string; icon: LucideIcon; render: () => React.ReactNode }

const SECTIONS: Section[] = [
  { id: 'workspace', label: 'Workspace', desc: 'Profile & appearance', icon: Settings2, render: () => <WorkspaceSection /> },
  { id: 'integrations', label: 'Integrations', desc: 'Xero, email, storage, AI', icon: Plug, render: () => <IntegrationsSection /> },
  { id: 'leads', label: 'Lead Settings', desc: 'Qualification stages', icon: ClipboardList, render: () => <LeadSettings /> },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const active = SECTIONS.find((s) => s.id === requested) ?? SECTIONS[0];

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('section', id);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage CRM configuration and workflow options." />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sub-nav */}
        <aside className="shrink-0 lg:w-56">
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const isActive = s.id === active.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors lg:w-full',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <s.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight">{s.label}</span>
                    <span className="hidden text-[11px] leading-tight text-muted-foreground lg:block">{s.desc}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active section */}
        <div className="min-w-0 flex-1">
          {active.render()}
        </div>
      </div>
    </div>
  );
}
