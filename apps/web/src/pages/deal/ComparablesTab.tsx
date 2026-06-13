import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ExternalLink } from 'lucide-react';
import { useDueDiligenceStore } from '@/stores/dueDiligenceStore';
import type { Property } from '@/types';

const money = (n: number) => (n ? `$${n.toLocaleString()}` : '—');

/**
 * Read-only aggregation of comparable sales recorded across all of this journey's
 * due-diligence records (comparables live per-property inside DD; this surfaces
 * them at the journey level). Editing still happens on the Due Diligence page.
 */
export function ComparablesTab({ dealId, properties }: { dealId: string; properties: Property[] }) {
  const records = useDueDiligenceStore((s) => s.records);

  const groups = useMemo(() => {
    return records
      .filter((r) => r.dealId === dealId && (r.comparableSales?.length ?? 0) > 0)
      .map((r) => {
        const prop = properties.find((p) => p.id === r.propertyId);
        return {
          id: r.id,
          title: prop?.address || r.address || prop?.suburb || 'Property',
          comps: r.comparableSales,
        };
      });
  }, [records, properties, dealId]);

  const total = groups.reduce((s, g) => s + g.comps.length, 0);

  if (total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-dashed border-primary/30 mb-3">
            <BarChart3 className="h-6 w-6 text-primary/40" />
          </div>
          <p className="text-sm font-medium">No comparable sales yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Comparable sales added in a property’s Due Diligence record appear here, aggregated for the journey.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.id} className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {g.title}
              <span className="text-muted-foreground font-normal">({g.comps.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">Address</th>
                    <th className="px-3 py-2 text-left font-semibold">Sale price</th>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Bd/Ba</th>
                    <th className="px-3 py-2 text-left font-semibold">Land</th>
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {g.comps.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">
                        <span className="font-medium">{c.address || '—'}</span>
                        {c.suburb && <span className="text-muted-foreground">, {c.suburb}</span>}
                        {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-semibold">{money(c.salePrice)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.saleDate || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.bedrooms || 0}/{c.bathrooms || 0}</td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.landSize ? `${c.landSize}m²` : '—'}</td>
                      <td className="px-3 py-2">
                        {c.sourceUrl ? (
                          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                            <ExternalLink className="h-3 w-3" />Link
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
