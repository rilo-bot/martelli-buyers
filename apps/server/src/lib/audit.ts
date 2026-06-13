import { AuditEvent } from '../models';

/**
 * Append-only audit/timeline recorder. Best-effort: a failure to log must never
 * break the mutation that triggered it, so all errors are swallowed.
 */
export interface AuditActor {
  id: string;
  name: string;
}

export interface AuditInput {
  entityType: string;
  entityId: string;
  dealId: string;
  action: string;
  field?: string;
  fromValue?: string | number;
  toValue?: string | number;
  actor?: AuditActor;
}

export async function recordEvent(input: AuditInput): Promise<void> {
  try {
    await AuditEvent.create({
      entityType: input.entityType,
      entityId: input.entityId,
      dealId: input.dealId,
      action: input.action,
      field: input.field ?? '',
      fromValue: input.fromValue == null ? '' : String(input.fromValue),
      toValue: input.toValue == null ? '' : String(input.toValue),
      actorId: input.actor?.id ?? '',
      actorName: input.actor?.name ?? '',
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[audit] failed to record event:', (err as Error).message);
  }
}
