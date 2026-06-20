import { useSearchParams } from 'react-router-dom';
import { Settings2, Plug, ClipboardList, Building2, ShieldCheck, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { WorkspaceSection } from '@/pages/settings/WorkspaceSection';
import { IntegrationsSection } from '@/pages/settings/IntegrationsSection';
import { LeadSettings } from '@/pages/settings/LeadSettings';
import { CompanySettingsSection } from '@/pages/settings/CompanySettingsSection';
import { DueDiligenceSettings } from '@/pages/settings/DueDiligenceSettings';

// Re-exported for back-compat: several Leads pages import these from here.
export { getStagePillClass, getStageDotClass } from '@/pages/settings/stageColors';

interface Section { id: string; label: string; desc: string; icon: LucideIcon; perm?: string; render: () => React.ReactNode }

const SECTIONS: Section[] = [
  { id: 'workspace', label: 'Workspace', desc: 'Profile & appearance', icon: Settings2, render: () => <WorkspaceSection /> },
  { id: 'company', label: 'Company & Invoices', desc: 'Branding & invoice template', icon: Building2, perm: 'settings:manage', render: () => <CompanySettingsSection /> },
  { id: 'integrations', label: 'Integrations', desc: 'Xero, email, storage, AI', icon: Plug, perm: 'settings:manage', render: () => <IntegrationsSection /> },
  { id: 'leads', label: 'Lead Settings', desc: 'Qualification stages', icon: ClipboardList, perm: 'settings:manage', render: () => <LeadSettings /> },
  { id: 'due-diligence', label: 'Due Diligence', desc: 'Audit checklist items', icon: ShieldCheck, perm: 'settings:manage', render: () => <DueDiligenceSettings /> },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const { can } = usePermissions();
  // Workspace (profile/appearance) is universal; admin-only sections require settings:manage.
  const sections = SECTIONS.filter((s) => !s.perm || can(s.perm));
  const requested = params.get('section');
  const active = sections.find((s) => s.id === requested) ?? sections[0];

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
            {sections.map((s) => {
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
