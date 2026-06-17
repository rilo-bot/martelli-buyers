import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, HardDrive, Sparkles, type LucideIcon } from 'lucide-react';
import { XeroIntegrationCard } from '@/pages/settings/XeroIntegrationCard';
import { OutlookIntegrationCard } from '@/pages/settings/OutlookIntegrationCard';

/** Server-managed integrations (configured via env vars, not from the UI). */
function ServerIntegration({ icon: Icon, name, desc }: { icon: LucideIcon; name: string; desc: string }) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{name}</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">{desc}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">Server-managed</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Configured on the server via environment variables. Contact your administrator to update credentials.
        </p>
      </CardContent>
    </Card>
  );
}

export function IntegrationsSection() {
  return (
    <div className="space-y-5">
      <XeroIntegrationCard />
      <OutlookIntegrationCard />
      <ServerIntegration icon={Mail} name="Email · SendGrid" desc="Transactional email and requirement blasts to agents are sent via the SendGrid API." />
      <ServerIntegration icon={HardDrive} name="Storage · AWS S3" desc="Property photos and media upload directly to your S3 bucket via presigned URLs." />
      <ServerIntegration icon={Sparkles} name="AI · OpenRouter" desc="Call and meeting summaries are generated through OpenRouter (Gemini)." />
    </div>
  );
}
