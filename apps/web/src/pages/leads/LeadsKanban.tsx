import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DollarSign, MapPin, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MiniStageStepper, STATUS_OPTIONS, STATUS_STYLES } from './leadShared';
import type { Lead, LeadStatus } from '@/types';

export function KanbanView({
  leads,
  onMarkWon,
  onStatusChange,
}: {
  leads: Lead[];
  onMarkWon: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  const dragLeadId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    dragLeadId.current = leadId;
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    dragLeadId.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    const column = e.currentTarget as HTMLElement;
    if (!column.contains(related)) setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    const leadId = dragLeadId.current;
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== status) onStatusChange(leadId, status);
    dragLeadId.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }, [leads, onStatusChange]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {STATUS_OPTIONS.map((status) => {
        const colLeads = leads.filter((l) => l.status === status);
        const style = STATUS_STYLES[status];
        const isOver = dragOverStatus === status;
        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              'flex flex-col min-w-[260px] w-[260px] rounded-xl border border-border/60 border-t-4 overflow-hidden shrink-0 transition-all duration-150',
              style.column,
              isOver && style.dropZone,
            )}
          >
            <div className={cn('flex items-center justify-between px-3 py-2.5', style.header)}>
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                <span className="text-xs font-semibold capitalize">{status.replace('_', ' ')}</span>
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
                {colLeads.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-22rem)]">
              {colLeads.length === 0 ? (
                <div className={cn('flex flex-col items-center justify-center py-8 text-center rounded-lg border-2 border-dashed transition-all duration-150', isOver ? 'border-primary/50 bg-primary/5' : 'border-border/40')}>
                  <span className="text-xs text-muted-foreground">{isOver ? 'Drop here' : 'No leads here'}</span>
                </div>
              ) : (
                colLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    isDragging={draggingId === lead.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMarkWon={onMarkWon}
                    onStatusChange={onStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
  onMarkWon,
  onStatusChange,
}: {
  lead: Lead;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onMarkWon: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-card rounded-lg border border-border/60 p-3 transition-all duration-150 space-y-2.5 cursor-grab active:cursor-grabbing select-none',
        isDragging ? 'opacity-40 scale-95 shadow-none' : 'hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-[11px] font-bold shrink-0">
          {lead.firstName?.[0]}{lead.lastName?.[0]}
        </div>
        <div className="min-w-0">
          <Link
            to={`/leads/${lead.id}`}
            className="text-[13px] font-semibold hover:text-primary transition-colors leading-tight block truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.firstName} {lead.lastName}
          </Link>
          <p className="text-[11px] text-muted-foreground truncate">{lead.source || 'Direct'}</p>
        </div>
      </div>

      <MiniStageStepper stageId={lead.qualificationStageId} />

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <DollarSign className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground tabular-nums">${lead.budget.toLocaleString()}</span>
        </div>
        {lead.propertyType && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.propertyType}</span>
            {lead.bedrooms ? <span>· {lead.bedrooms}bd</span> : null}
            {lead.bathrooms ? <span>· {lead.bathrooms}ba</span> : null}
          </div>
        )}
        {lead.preferredSuburbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 opacity-0" />
            <span className="truncate">
              {lead.preferredSuburbs.slice(0, 2).join(', ')}
              {lead.preferredSuburbs.length > 2 ? ` +${lead.preferredSuburbs.length - 2}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Keyboard/touch-accessible status change — fallback for drag-and-drop. */}
      <div className="pt-1">
        <label className="sr-only" htmlFor={`kb-status-${lead.id}`}>Change status</label>
        <Select
          id={`kb-status-${lead.id}`}
          value={lead.status}
          onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
          onClick={(e) => e.stopPropagation()}
          className="h-7 text-[11px] capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>
      </div>

      <div className="flex gap-1.5 pt-1 border-t border-border/50">
        <Button asChild variant="outline" size="sm" className="flex-1 h-7 text-[11px]">
          <Link to={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}>View</Link>
        </Button>
        {lead.status !== 'won' && lead.status !== 'lost' && (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onMarkWon(lead.id); }} className="flex-1 h-7 text-[11px]">
            <Trophy className="mr-1 h-3 w-3" /> Won
          </Button>
        )}
      </div>
    </div>
  );
}
