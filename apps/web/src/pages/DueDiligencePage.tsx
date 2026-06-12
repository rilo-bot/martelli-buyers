import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDueDiligenceStore } from '@/stores/dueDiligenceStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  Plus, Search, AlertCircle, CheckCircle, Clock, ExternalLink,
  FileText, ArrowLeft, Trash2, Link as LinkIcon, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { downloadDdReport } from '@/lib/documents';
import type { ChecklistItemStatus } from '@/types';

const STATUS_ICONS: Record<ChecklistItemStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  completed: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  na: <span className="text-xs text-muted-foreground font-semibold">N/A</span>,
};

export default function DueDiligencePage() {
  const [searchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get('propertyId') ?? '';

  const records = useDueDiligenceStore((s) => s.records);
  const addRecord = useDueDiligenceStore((s) => s.addRecord);
  const updateRecord = useDueDiligenceStore((s) => s.updateRecord);
  const addEvidence = useDueDiligenceStore((s) => s.addEvidence);
  const removeEvidence = useDueDiligenceStore((s) => s.removeEvidence);
  const addComparable = useDueDiligenceStore((s) => s.addComparable);
  const removeComparable = useDueDiligenceStore((s) => s.removeComparable);
  const updateChecklistItem = useDueDiligenceStore((s) => s.updateChecklistItem);
  const generateDefaultChecklist = useDueDiligenceStore((s) => s.generateDefaultChecklist);
  const properties = usePropertiesStore((s) => s.properties);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showCreateDD, setShowCreateDD] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [createForm, setCreateForm] = useState({ propertyId: defaultPropertyId, dealId: '', address: '' });
  const [evidenceForm, setEvidenceForm] = useState({ label: '', url: '', type: 'link' as 'link' | 'screenshot' | 'document' });
  const [compForm, setCompForm] = useState({
    address: '', suburb: '', salePrice: '', saleDate: '',
    bedrooms: '3', bathrooms: '2', landSize: '', notes: '', sourceUrl: '',
  });

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => !q || r.address.toLowerCase().includes(q));
  }, [records, search]);

  const selectedRecord = useMemo(
    () => (selectedRecordId ? records.find((r) => r.id === selectedRecordId) : null),
    [records, selectedRecordId]
  );

  const handleCreateDD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.address.trim()) return;
    const checklist = generateDefaultChecklist();
    const newRecord = await addRecord({
      propertyId: createForm.propertyId,
      dealId: createForm.dealId,
      address: createForm.address.trim(),
      floodMapUrl: '',
      floodMapNotes: '',
      naturalHazardsUrl: '',
      naturalHazardsNotes: '',
      councilRecordsUrl: '',
      evidenceLinks: [],
      comparableSales: [],
      checklistItems: checklist,
      reportGenerated: false,
      reportUrl: '',
      internalNotes: '',
    });
    setCreateForm({ propertyId: '', dealId: '', address: '' });
    setShowCreateDD(false);
    setSelectedRecordId(newRecord.id);
  };

  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !evidenceForm.label.trim() || !evidenceForm.url.trim()) return;
    addEvidence(selectedRecordId, {
      id: crypto.randomUUID(),
      label: evidenceForm.label.trim(),
      url: evidenceForm.url.trim(),
      type: evidenceForm.type,
      addedAt: new Date().toISOString(),
    });
    setEvidenceForm({ label: '', url: '', type: 'link' });
    setShowAddEvidence(false);
  };

  const handleAddComp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !compForm.address.trim()) return;
    addComparable(selectedRecordId, {
      id: crypto.randomUUID(),
      address: compForm.address.trim(),
      suburb: compForm.suburb.trim(),
      salePrice: Number(compForm.salePrice) || 0,
      saleDate: compForm.saleDate,
      bedrooms: Number(compForm.bedrooms) || 3,
      bathrooms: Number(compForm.bathrooms) || 2,
      landSize: Number(compForm.landSize) || 0,
      notes: compForm.notes.trim(),
      sourceUrl: compForm.sourceUrl.trim(),
    });
    setCompForm({ address: '', suburb: '', salePrice: '', saleDate: '', bedrooms: '3', bathrooms: '2', landSize: '', notes: '', sourceUrl: '' });
    setShowAddComp(false);
  };

  const handleGenerateReport = async () => {
    if (!selectedRecord) return;
    setGeneratingReport(true);
    try {
      await downloadDdReport(selectedRecord.id, selectedRecord.address);
      if (!selectedRecord.reportGenerated) {
        updateRecord(selectedRecord.id, { reportGenerated: true });
      }
      toast.success('Due diligence report downloaded as PDF.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const completedItems = useMemo(
    () => selectedRecord?.checklistItems.filter((i) => i.status === 'completed').length ?? 0,
    [selectedRecord]
  );
  const totalItems = useMemo(() => selectedRecord?.checklistItems.length ?? 0, [selectedRecord]);

  // ---- Detail view ----
  if (selectedRecord) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" className="rounded-xl border border-border" onClick={() => setSelectedRecordId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Due Diligence</p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{selectedRecord.address}</h1>
          </div>
          <Button
            variant={selectedRecord.reportGenerated ? 'secondary' : 'default'}
            size="sm"
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className={cn('h-9 shadow-sm', !selectedRecord.reportGenerated && 'shadow-primary/20')}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {generatingReport ? 'Generating...' : selectedRecord.reportGenerated ? 'Download PDF Report' : 'Generate PDF Report'}
          </Button>
        </div>

        {selectedRecord.reportGenerated && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">DD report ready. Use “Download PDF Report” to fetch the latest copy.</span>
            </div>
          </div>
        )}

        <Tabs defaultValue="checklist">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="checklist">
              Audit Checklist ({completedItems}/{totalItems})
            </TabsTrigger>
            <TabsTrigger value="hazards">Hazard Maps</TabsTrigger>
            <TabsTrigger value="evidence">Evidence ({selectedRecord.evidenceLinks.length})</TabsTrigger>
            <TabsTrigger value="comparables">Comparables ({selectedRecord.comparableSales.length}/5)</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* CHECKLIST */}
          <TabsContent value="checklist" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Internal Audit Checklist</h2>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${totalItems ? (completedItems / totalItems) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{completedItems}/{totalItems}</span>
                </div>
              </div>
              <div className="space-y-2">
                {selectedRecord.checklistItems.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      'transition-all border',
                      item.status === 'completed'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                        : 'border-border/70'
                    )}
                  >
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateChecklistItem(
                              selectedRecord.id,
                              item.id,
                              item.status === 'completed' ? 'pending' : 'completed',
                              undefined,
                              currentUser?.name
                            )
                          }
                          className="mt-0.5 shrink-0"
                        >
                          {STATUS_ICONS[item.status]}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium', item.status === 'completed' && 'line-through text-muted-foreground')}>
                            {item.label}
                          </p>
                          {item.completedBy && item.status === 'completed' && (
                            <p className="text-xs text-muted-foreground mt-0.5">Completed by {item.completedBy}</p>
                          )}
                        </div>
                        <Select
                          value={item.status}
                          onChange={(e) =>
                            updateChecklistItem(
                              selectedRecord.id,
                              item.id,
                              e.target.value as ChecklistItemStatus,
                              undefined,
                              currentUser?.name
                            )
                          }
                          className="h-7 text-xs w-28"
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="na">N/A</option>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* HAZARD MAPS */}
          <TabsContent value="hazards" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-primary">Auckland Council Flood Map</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="floodUrl">Flood map URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="floodUrl"
                        value={selectedRecord.floodMapUrl}
                        onChange={(e) => updateRecord(selectedRecord.id, { floodMapUrl: e.target.value })}
                        placeholder="https://gis.aucklandcouncil.govt.nz/..."
                      />
                      {selectedRecord.floodMapUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={selectedRecord.floodMapUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  {!selectedRecord.floodMapUrl && (
                    <Button size="sm" variant="outline" asChild className="w-full">
                      <a href="https://gis.aucklandcouncil.govt.nz/portal/apps/webappviewer/index.html?id=c6f2e2f218ba43c09bd79fe16b0cd8e6" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open Auckland Council Flood Map
                      </a>
                    </Button>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="floodNotes">Notes</Label>
                    <Textarea
                      id="floodNotes"
                      value={selectedRecord.floodMapNotes}
                      onChange={(e) => updateRecord(selectedRecord.id, { floodMapNotes: e.target.value })}
                      rows={3}
                      placeholder="Flood zone classification, risk level..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-orange-600 dark:text-orange-400">Natural Hazards (NHRP)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="hazardUrl">NHRP URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="hazardUrl"
                        value={selectedRecord.naturalHazardsUrl}
                        onChange={(e) => updateRecord(selectedRecord.id, { naturalHazardsUrl: e.target.value })}
                        placeholder="https://www.naturalhazards.govt.nz/..."
                      />
                      {selectedRecord.naturalHazardsUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={selectedRecord.naturalHazardsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  {!selectedRecord.naturalHazardsUrl && (
                    <Button size="sm" variant="outline" asChild className="w-full">
                      <a href="https://www.naturalhazards.govt.nz/hazard-information/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open Natural Hazards Portal
                      </a>
                    </Button>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="hazardNotes">Notes</Label>
                    <Textarea
                      id="hazardNotes"
                      value={selectedRecord.naturalHazardsNotes}
                      onChange={(e) => updateRecord(selectedRecord.id, { naturalHazardsNotes: e.target.value })}
                      rows={3}
                      placeholder="Liquefaction risk, coastal hazard classification..."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* EVIDENCE */}
          <TabsContent value="evidence" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Evidence Storage</h2>
                <Button size="sm" onClick={() => setShowAddEvidence(true)} className="h-8 shadow-sm shadow-primary/20">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add Evidence
                </Button>
              </div>
              {selectedRecord.evidenceLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
                    <LinkIcon className="h-8 w-8 text-primary/40" />
                  </div>
                  <p className="text-sm font-semibold">No evidence stored yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add links, screenshots, and documents.</p>
                  <Button size="sm" className="mt-4 shadow-sm shadow-primary/20" onClick={() => setShowAddEvidence(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add Evidence
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRecord.evidenceLinks.map((ev) => (
                    <Card key={ev.id} className="border-border/70 hover:shadow-sm transition-all">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <LinkIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{ev.label}</p>
                              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{ev.url}</a>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{ev.type}</Badge>
                            <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive" onClick={() => removeEvidence(selectedRecord.id, ev.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Dialog open={showAddEvidence} onOpenChange={setShowAddEvidence}>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Evidence</DialogTitle></DialogHeader>
                <form onSubmit={handleAddEvidence} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="evLabel">Label *</Label>
                    <Input id="evLabel" value={evidenceForm.label} onChange={(e) => setEvidenceForm((f) => ({ ...f, label: e.target.value }))} placeholder="Flood map screenshot - January 2025" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="evUrl">URL *</Label>
                    <Input id="evUrl" value={evidenceForm.url} onChange={(e) => setEvidenceForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="evType">Type</Label>
                    <Select id="evType" value={evidenceForm.type} onChange={(e) => setEvidenceForm((f) => ({ ...f, type: e.target.value as 'link' | 'screenshot' | 'document' }))}>
                      <option value="link">Link</option>
                      <option value="screenshot">Screenshot</option>
                      <option value="document">Document</option>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={!evidenceForm.label.trim() || !evidenceForm.url.trim()} className="shadow-sm shadow-primary/20">
                      <Plus className="mr-2 h-4 w-4" />Add
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* COMPARABLES */}
          <TabsContent value="comparables" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Comparable Sales</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Minimum 5 comparable sales required for thorough analysis.</p>
                </div>
                <Button size="sm" onClick={() => setShowAddComp(true)} className="h-8 shadow-sm shadow-primary/20">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add Comparable
                </Button>
              </div>
              {selectedRecord.comparableSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
                    <AlertCircle className="h-8 w-8 text-primary/40" />
                  </div>
                  <p className="text-sm font-semibold">No comparable sales yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add at least 5 for thorough market analysis.</p>
                  <Button size="sm" className="mt-4 shadow-sm shadow-primary/20" onClick={() => setShowAddComp(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add Comparable
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="text-left px-4 py-3">Address</th>
                        <th className="text-left px-4 py-3">Sale Price</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Beds/Baths</th>
                        <th className="text-left px-4 py-3">Land</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecord.comparableSales.map((comp) => (
                        <tr key={comp.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{comp.address}</p>
                            <p className="text-xs text-muted-foreground">{comp.suburb}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold tabular-nums text-primary">${comp.salePrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{comp.saleDate}</td>
                          <td className="px-4 py-3 text-muted-foreground">{comp.bedrooms}bd/{comp.bathrooms}ba</td>
                          <td className="px-4 py-3 text-muted-foreground">{comp.landSize ? `${comp.landSize}m²` : '—'}</td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive" onClick={() => removeComparable(selectedRecord.id, comp.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedRecord.comparableSales.length < 5 && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {5 - selectedRecord.comparableSales.length} more comparable(s) needed for full analysis
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Dialog open={showAddComp} onOpenChange={setShowAddComp}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Comparable Sale</DialogTitle></DialogHeader>
                <form onSubmit={handleAddComp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="compAddr">Address *</Label>
                      <Input id="compAddr" value={compForm.address} onChange={(e) => setCompForm((f) => ({ ...f, address: e.target.value }))} placeholder="12 Example St" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compSuburb">Suburb</Label>
                      <Input id="compSuburb" value={compForm.suburb} onChange={(e) => setCompForm((f) => ({ ...f, suburb: e.target.value }))} placeholder="Remuera" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="compPrice">Sale price ($)</Label>
                      <Input id="compPrice" type="number" value={compForm.salePrice} onChange={(e) => setCompForm((f) => ({ ...f, salePrice: e.target.value }))} placeholder="1350000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compDate">Sale date</Label>
                      <Input id="compDate" type="date" value={compForm.saleDate} onChange={(e) => setCompForm((f) => ({ ...f, saleDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="compBeds">Beds</Label>
                      <Input id="compBeds" type="number" min="1" value={compForm.bedrooms} onChange={(e) => setCompForm((f) => ({ ...f, bedrooms: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compBaths">Baths</Label>
                      <Input id="compBaths" type="number" min="1" value={compForm.bathrooms} onChange={(e) => setCompForm((f) => ({ ...f, bathrooms: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compLand">Land (m²)</Label>
                      <Input id="compLand" type="number" value={compForm.landSize} onChange={(e) => setCompForm((f) => ({ ...f, landSize: e.target.value }))} placeholder="650" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="compSrc">Source URL</Label>
                    <Input id="compSrc" value={compForm.sourceUrl} onChange={(e) => setCompForm((f) => ({ ...f, sourceUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="compNotes">Notes</Label>
                    <Textarea id="compNotes" value={compForm.notes} onChange={(e) => setCompForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={!compForm.address.trim()} className="shadow-sm shadow-primary/20">
                      <Plus className="mr-2 h-4 w-4" />Add Comparable
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* NOTES */}
          <TabsContent value="notes" className="mt-4">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Internal Notes</CardTitle>
                <CardDescription className="text-sm">Private notes visible to internal staff only.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={selectedRecord.internalNotes}
                  onChange={(e) => updateRecord(selectedRecord.id, { internalNotes: e.target.value })}
                  rows={10}
                  placeholder="Internal due diligence notes, concerns, recommendations..."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Analysis</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Due Diligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Hazard maps, comparable sales, evidence storage, and internal audit checklists.</p>
        </div>
        <Button onClick={() => setShowCreateDD(true)} className="h-10 shadow-md shadow-primary/25">
          <Plus className="mr-2 h-4 w-4" />
          New DD Record
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/8 border-2 border-dashed border-primary/30 mb-6">
            <ShieldCheck className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold">No DD records yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            Create a due diligence record for a property to start your hazard analysis, comparable sales research, and audit checklist.
          </p>
          <Button className="mt-6 shadow-md shadow-primary/20" onClick={() => setShowCreateDD(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first DD record
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRecords.map((record) => {
            const completed = record.checklistItems.filter((i) => i.status === 'completed').length;
            const total = record.checklistItems.length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <Card
                key={record.id}
                className="group cursor-pointer border-border/70 hover:border-primary/40 hover:shadow-md hover:shadow-primary/8 hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => setSelectedRecordId(record.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 shrink-0">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {record.reportGenerated && <Badge variant="default" className="text-[10px] px-2 py-0.5">Report Ready</Badge>}
                      <Badge
                        variant={pct === 100 ? 'default' : 'secondary'}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {pct}% done
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="mt-3 text-[15px] font-semibold group-hover:text-primary transition-colors">{record.address}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Checklist: {completed}/{total}</span>
                      <span>{record.comparableSales.length}/5 comps</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {record.floodMapUrl && <span className="text-primary">✓ Flood map</span>}
                      {record.naturalHazardsUrl && <span className="text-orange-600 dark:text-orange-400">✓ Hazards</span>}
                      {record.evidenceLinks.length > 0 && <span>{record.evidenceLinks.length} evidence</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create DD Dialog */}
      <Dialog open={showCreateDD} onOpenChange={setShowCreateDD}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Due Diligence Record</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateDD} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ddAddress">Property address *</Label>
              <Input id="ddAddress" value={createForm.address} onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))} placeholder="12 Example St, Remuera" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ddProperty">Link to deal property (optional)</Label>
              <Select
                id="ddProperty"
                value={createForm.propertyId}
                onChange={(e) => {
                  const prop = properties.find((p) => p.id === e.target.value);
                  setCreateForm((f) => ({
                    ...f,
                    propertyId: e.target.value,
                    address: prop ? prop.address : f.address,
                    dealId: prop ? prop.dealId : f.dealId,
                  }));
                }}
              >
                <option value="">No linked property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!createForm.address.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />Create Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}