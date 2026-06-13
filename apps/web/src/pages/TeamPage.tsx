import { useState } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { UsersPanel } from '@/pages/team/UsersPanel';
import { RolesPanel } from '@/pages/team/RolesPanel';

type Tab = 'users' | 'roles';

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck },
];

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="space-y-6">
      <PageHeader title="Team" subtitle="Manage who has access and what each role can do." />

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'users' ? <UsersPanel /> : <RolesPanel />}
    </div>
  );
}
