import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, DollarSign, ArrowRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QualStageBadge, STATUS_STYLES } from './leadShared';
import type { Lead } from '@/types';

export function CardView({ leads, onMarkWon }: { leads: Lead[]; onMarkWon: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {leads.map((lead) => {
        const style = STATUS_STYLES[lead.status];
        return (
          <Card key={lead.id} className="group card-interactive border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {lead.firstName?.[0]}{lead.lastName?.[0]}
                  </div>
                  <div>
                    <CardTitle className="text-[15px] font-semibold group-hover:text-primary transition-colors">
                      {lead.firstName} {lead.lastName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{lead.source || 'Direct enquiry'}</p>
                  </div>
                </div>
                <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 capitalize', style.pill)}>
                  {lead.status.replace('_', ' ')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.qualificationStageId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">Stage:</span>
                  <QualStageBadge stageId={lead.qualificationStageId} />
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground tabular-nums">${lead.budget.toLocaleString()}</span>
                  <span>budget</span>
                </div>
              </div>
              {lead.preferredSuburbs.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {lead.preferredSuburbs.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs px-2 py-0.5">{s}</Badge>
                  ))}
                  {lead.preferredSuburbs.length > 3 && (
                    <Badge variant="secondary" className="text-xs px-2 py-0.5">+{lead.preferredSuburbs.length - 3}</Badge>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-border/60">
                <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                  <Link to={`/leads/${lead.id}`}>View <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                </Button>
                {lead.status !== 'won' && lead.status !== 'lost' && (
                  <Button size="sm" onClick={() => onMarkWon(lead.id)} className="flex-1 h-8 text-xs">
                    <Trophy className="mr-1.5 h-3 w-3" /> Mark Won
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
