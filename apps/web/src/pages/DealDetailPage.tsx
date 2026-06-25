import { useState, useMemo, useEffect } from 'react';
import { useParams, Navigate, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { request } from '@/lib/api';
import { useDealsStore } from '@/stores/dealsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useOffMarketStore } from '@/stores/offMarketStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useCompanySettingsStore } from '@/stores/companySettingsStore';
import { COMPANY_SETTINGS_DEFAULTS, visibleJourneyTabKeys } from '@/types';
import { usePermissions } from '@/lib/permissions';
import { useCommentsStore } from '@/stores/commentsStore';
import { useAISummariesStore } from '@/stores/aiSummariesStore';
import { useAuthStore } from '@/stores/authStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useDueDiligenceStore } from '@/stores/dueDiligenceStore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ArrowLeft, Plus, Home, DollarSign, FileText, MessageSquare, CheckCircle, Send, Phone, Mail, Binary, Star, AlertCircle, Users, RefreshCw, Eye, Copy, FileSignature, Building2, Search, Check, Pencil, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DEAL_STAGE_ORDER, STAGE_LABELS, STAGE_PILL,
  PROPERTY_STATUS_ORDER, PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_PILL as PROPERTY_STATUS_BADGE,
} from '@/lib/statusStyles';
import type { DealStage, PropertyStatus, ConsentStatus, OffMarketProperty } from '@/types';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import type { EmailRecipient } from '@/components/SendEmailDialog';
import { EmailList } from '@/components/EmailList';
import { MediaUploader } from '@/components/MediaUploader';
import { useEmailMessagesStore } from '@/stores/emailMessagesStore';
import { useDetailBreadcrumb } from '@/stores/breadcrumbStore';
import { useConfigStore } from '@/stores/configStore';
import { useXeroStore } from '@/stores/xeroStore';
import { useOffersStore } from '@/stores/offersStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePurchasesStore } from '@/stores/purchasesStore';
import { downloadInvoicePdf, downloadAgreementPdf, invoicePdfPreviewPath, agreementPdfPreviewPath } from '@/lib/documents';
import { DocumentViewer } from '@/components/DocumentViewer';
import { canDownloadDoc } from '@/lib/docAccess';
import { EntityDocuments } from '@/components/documents/EntityDocuments';
import { pushInvoiceToXero, refreshInvoiceFromXero } from '@/lib/xero';
import { OffersTab } from '@/pages/deal/OffersTab';
import { TasksTab } from '@/pages/deal/TasksTab';
import { PurchaseTab } from '@/pages/deal/PurchaseTab';
import { TimelineTab } from '@/pages/deal/TimelineTab';
import { ComparablesTab } from '@/pages/deal/ComparablesTab';
import { ExternalLink } from 'lucide-react';

const STAGE_OPTIONS = DEAL_STAGE_ORDER;
const PROPERTY_STATUS_OPTIONS = PROPERTY_STATUS_ORDER;
const STAGE_PILL_STYLES = STAGE_PILL;

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── ALL hooks first, before any early return ──────────────────────────
  const deals = useDealsStore((s) => s.deals);
  const updateDeal = useDealsStore((s) => s.updateDeal);
  const addInvoiceToDeal = useDealsStore((s) => s.addInvoiceToDeal);
  const clients = useClientsStore((s) => s.clients);
  const properties = usePropertiesStore((s) => s.properties);
  const addProperty = usePropertiesStore((s) => s.addProperty);
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const offMarket = useOffMarketStore((s) => s.properties);
  const linkOffMarketToDeal = useOffMarketStore((s) => s.linkToDeal);
  const invoices = useInvoicesStore((s) => s.invoices);
  const addInvoice = useInvoicesStore((s) => s.addInvoice);
  // Configured GST rate (percent) drives new-invoice tax; defaults to 15 until settings load.
  const gstRate = useCompanySettingsStore((s) => s.settings?.gstRate ?? COMPANY_SETTINGS_DEFAULTS.gstRate);
  const emailInvoice = useInvoicesStore((s) => s.emailInvoice);
  const replaceInvoice = useInvoicesStore((s) => s.replaceInvoice);
  const hasXero = useConfigStore((s) => s.hasXero);
  const xeroConnected = useXeroStore((s) => s.connected);
  const comments = useCommentsStore((s) => s.comments);
  const addComment = useCommentsStore((s) => s.addComment);
  const summaries = useAISummariesStore((s) => s.summaries);
  const generateSummary = useAISummariesStore((s) => s.generateSummary);
  const isGenerating = useAISummariesStore((s) => s.isGenerating);
  const toggleActionItem = useAISummariesStore((s) => s.toggleActionItem);
  const currentUser = useAuthStore((s) => s.currentUser);
  const agents = useAgentsStore((s) => s.agents);
  const dealDdStatus = useDueDiligenceStore((s) => s.dealDdStatus);

  const dealForCrumb = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  useDetailBreadcrumb(dealForCrumb ? dealForCrumb.clientName : null);

  // Per-role tab visibility: only tabs the user's role is granted are shown.
  const { can } = usePermissions();
  const allowedTabs = useMemo(() => visibleJourneyTabKeys(can), [can]);

  // Active tab is mirrored in the URL (?tab=) so refresh/deep-links land correctly.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  // If the requested tab isn't permitted (e.g. a stale deep-link), fall back to
  // the first tab this role can see.
  const activeTab = allowedTabs.has(requestedTab)
    ? requestedTab
    : ([...allowedTabs][0] ?? 'overview');
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab'); else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const [showAddProperty, setShowAddProperty] = useState(false);
  const [addPropMode, setAddPropMode] = useState<'new' | 'offmarket'>('new');
  const [omSearch, setOmSearch] = useState('');
  const [linkingOmId, setLinkingOmId] = useState<string | null>(null);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [viewAgreement, setViewAgreement] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [showAISummary, setShowAISummary] = useState(false);
  const [showReenableConsent, setShowReenableConsent] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipientOverride, setEmailRecipientOverride] = useState<EmailRecipient | undefined>(undefined);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [xeroBusyId, setXeroBusyId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [aiConsentError, setAiConsentError] = useState(false);
  const [aiForm, setAiForm] = useState({ type: 'call' as 'call' | 'meeting', title: '', participants: '', transcript: '' });
  const [propForm, setPropForm] = useState({
    address: '', suburb: '', priceGuide: '', bedrooms: '3', bathrooms: '2',
    carparks: '1', landSize: '', propertyType: '', notes: '', listingUrl: '',
    sourceAgentName: '', isOffMarket: false,
  });
  // Media uploaded while filling in a new property — attached on submit.
  const [propMedia, setPropMedia] = useState<string[]>([]);
  const [invForm, setInvForm] = useState({
    type: 'engagement' as 'engagement' | 'milestone' | 'final',
    description: '', amount: '', dueDate: '',
  });

  // Derived — safe to compute before guard because id/deals are always available
  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const dealProperties = useMemo(() => properties.filter((p) => p.dealId === id), [properties, id]);
  // DD completion for this journey — subscribe to records so the chip stays live.
  const ddRecords = useDueDiligenceStore((s) => s.records);
  const ddStatus = useMemo(() => dealDdStatus(id ?? ''), [ddRecords, dealDdStatus, id]);
  const offers = useOffersStore((s) => s.offers);
  const dealOffers = useMemo(() => offers.filter((o) => o.dealId === id), [offers, id]);
  const tasks = useTasksStore((s) => s.tasks);
  const openTaskCount = useMemo(() => tasks.filter((t) => t.dealId === id && !t.completed).length, [tasks, id]);
  const purchases = usePurchasesStore((s) => s.purchases);
  const hasPurchase = useMemo(() => purchases.some((p) => p.dealId === id), [purchases, id]);
  const dealInvoices = useMemo(() => invoices.filter((inv) => inv.dealId === id), [invoices, id]);
  // Comparables live per-property inside DD; fetch the journey-level aggregate so the
  // tab label can show a live count like the other tabs. Mirrors ComparablesTab's source.
  const [comparablesCount, setComparablesCount] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    request<{ comparableSales?: unknown[] }[]>('GET', `/api/journeys/${id}/comparables`)
      .then((data) => {
        if (active) setComparablesCount(data.reduce((s, r) => s + (r.comparableSales?.length ?? 0), 0));
      })
      .catch(() => { if (active) setComparablesCount(0); });
    return () => { active = false; };
  }, [id]);
  const dealComments = useMemo(() => comments.filter((c) => c.dealId === id && !c.propertyId), [comments, id]);
  const dealSummaries = useMemo(() => summaries.filter((s) => s.dealId === id), [summaries, id]);
  const emailMessages = useEmailMessagesStore((s) => s.emails);
  const dealEmails = useMemo(() => emailMessages.filter((e) => e.dealId === id), [emailMessages, id]);

  // Agents connected to this journey = source agents on the journey's properties.
  const connectedAgents = useMemo(() => {
    const agentIds = new Set(dealProperties.map((p) => p.agentId).filter(Boolean));
    return agents.filter((a) => agentIds.has(a.id));
  }, [agents, dealProperties]);

  const emailRecipients: EmailRecipient[] = useMemo(() => {
    const list: EmailRecipient[] = [];
    if (deal?.clientEmail) {
      list.push({
        id: deal.clientId || 'deal-client',
        name: deal.clientName,
        email: deal.clientEmail,
        type: 'client',
      });
    }
    connectedAgents.forEach((a) => {
      if (a.email) {
        list.push({ id: a.id, name: `${a.firstName} ${a.lastName}`, email: a.email, type: 'agent' });
      }
    });
    return list;
  }, [deal, connectedAgents]);

  const emailVariables: Record<string, string> = useMemo(() => ({
    clientName: deal?.clientName ?? '',
    clientEmail: deal?.clientEmail ?? '',
    budget: deal ? `$${deal.budget.toLocaleString()}` : '',
    propertyType: deal?.propertyType ?? '',
    bedrooms: deal ? String(deal.bedrooms) : '',
    suburbs: deal?.preferredSuburbs.join(', ') ?? '',
    consultantName: currentUser?.name ?? 'Martelli Buyers Team',
  }), [deal, currentUser]);

  // ── Early returns AFTER all hooks ────────────────────────────────────
  if (!id) return <Navigate to="/journeys" replace />;
  if (!deal) return <Navigate to="/journeys" replace />;

  const linkedClient = deal.clientId ? clients.find((c) => c.id === deal.clientId) : null;

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propForm.address.trim()) return;
    addProperty({
      dealId: id,
      address: propForm.address.trim(),
      suburb: propForm.suburb.trim(),
      price: 0,
      priceGuide: propForm.priceGuide.trim(),
      bedrooms: Number(propForm.bedrooms) || 3,
      bathrooms: Number(propForm.bathrooms) || 2,
      carparks: Number(propForm.carparks) || 1,
      landSize: Number(propForm.landSize) || 0,
      propertyType: propForm.propertyType.trim(),
      status: 'suggested',
      notes: propForm.notes.trim(),
      clientVisibleNotes: '',
      isClientVisible: true,
      agentId: '',
      sourceAgentName: propForm.sourceAgentName.trim(),
      listingUrl: propForm.listingUrl.trim(),
      photos: propMedia,
      isOffMarket: propForm.isOffMarket,
      offMarketPropertyId: '',
    });
    setPropForm({ address: '', suburb: '', priceGuide: '', bedrooms: '3', bathrooms: '2', carparks: '1', landSize: '', propertyType: '', notes: '', listingUrl: '', sourceAgentName: '', isOffMarket: false });
    setPropMedia([]);
    setShowAddProperty(false);
  };

  // Off-market entries that are active and not already on this deal.
  const linkableOffMarket = useMemo(() => {
    const alreadyLinked = new Set(dealProperties.map((p) => p.offMarketPropertyId).filter(Boolean));
    const q = omSearch.trim().toLowerCase();
    return offMarket.filter(
      (om) =>
        om.isActive &&
        !alreadyLinked.has(om.id) &&
        (!q || om.address.toLowerCase().includes(q) || om.suburb.toLowerCase().includes(q)),
    );
  }, [offMarket, dealProperties, omSearch]);

  const handleLinkOffMarket = async (om: OffMarketProperty) => {
    if (!id) return;
    setLinkingOmId(om.id);
    try {
      await addProperty({
        dealId: id,
        address: om.address,
        suburb: om.suburb,
        price: 0,
        priceGuide: om.priceGuide,
        bedrooms: om.bedrooms,
        bathrooms: om.bathrooms,
        carparks: om.carparks,
        landSize: 0,
        propertyType: om.propertyType,
        status: 'suggested',
        notes: om.notes,
        clientVisibleNotes: '',
        isClientVisible: true,
        agentId: om.sourceAgentId,
        sourceAgentName: om.sourceAgentName,
        listingUrl: '',
        photos: [],
        isOffMarket: true,
        offMarketPropertyId: om.id,
      });
      await linkOffMarketToDeal(om.id, id);
      toast.success(`${om.address} added to this campaign.`);
      setShowAddProperty(false);
    } catch {
      toast.error('Failed to link off-market property.');
    } finally {
      setLinkingOmId(null);
    }
  };

  // Stage gate: a journey can't cross past Due Diligence until DD is complete.
  const handleStageChange = async (next: DealStage) => {
    const ddIdx = STAGE_OPTIONS.indexOf('due_diligence');
    const crossing = STAGE_OPTIONS.indexOf(deal.stage) <= ddIdx && STAGE_OPTIONS.indexOf(next) > ddIdx;
    if (crossing && !ddStatus.complete) {
      toast.error(
        ddStatus.recordCount === 0
          ? 'Create and complete a due diligence record before advancing past the Due Diligence stage.'
          : `Complete due diligence first — ${ddStatus.total - ddStatus.resolved} checklist item(s) still unresolved.`,
      );
      return;
    }
    try {
      await updateDeal(deal.id, { stage: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the stage.');
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invForm.amount || !invForm.dueDate) return;
    const amount = Number(invForm.amount);
    const gst = amount * (gstRate / 100);
    const invoice = await addInvoice({
      dealId: id,
      xeroInvoiceId: '',
      xeroStatus: '',
      xeroUrl: '',
      xeroLastSyncedAt: '',
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      type: invForm.type,
      amount,
      gst,
      total: amount + gst,
      status: 'draft',
      dueDate: invForm.dueDate,
      paidDate: '',
      description: invForm.description,
      lastReminderAt: '',
      reminderCount: 0,
    });
    addInvoiceToDeal(id, invoice.id);
    setInvForm({ type: 'engagement', description: '', amount: '', dueDate: '' });
    setShowAddInvoice(false);
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      await downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download invoice.');
    }
  };

  const handleEmailInvoice = async (invoiceId: string) => {
    setEmailingId(invoiceId);
    try {
      await emailInvoice(invoiceId);
      toast.success('Invoice emailed to the client.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to email invoice.');
    } finally {
      setEmailingId(null);
    }
  };

  const handlePushXero = async (invoiceId: string) => {
    setXeroBusyId(invoiceId);
    try {
      replaceInvoice(await pushInvoiceToXero(invoiceId));
      toast.success('Invoice sent to Xero.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send to Xero.');
    } finally {
      setXeroBusyId(null);
    }
  };

  const handleRefreshXero = async (invoiceId: string) => {
    setXeroBusyId(invoiceId);
    try {
      replaceInvoice(await refreshInvoiceFromXero(invoiceId));
      toast.success('Invoice status refreshed from Xero.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh from Xero.');
    } finally {
      setXeroBusyId(null);
    }
  };

  const handleCopySignLink = () => {
    const url = `${window.location.origin}/sign/${deal.agreementSignToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Signing link copied.'),
      () => toast.error('Could not copy link.'),
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment({
      dealId: id,
      propertyId: '',
      authorId: currentUser?.id ?? '',
      authorName: currentUser?.name ?? 'Staff',
      authorRole: 'staff',
      content: commentText.trim(),
      attachments: [],
      isClientVisible: true,
    });
    setCommentText('');
  };

  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiForm.title.trim()) return;
    if (deal.aiConsentStatus !== 'granted') {
      setAiConsentError(true);
      return;
    }
    setAiConsentError(false);
    try {
      await generateSummary(id, aiForm.type, aiForm.title, aiForm.participants.split(',').map((p) => p.trim()).filter(Boolean), aiForm.transcript);
      setAiForm({ type: 'call', title: '', participants: '', transcript: '' });
      setShowAISummary(false);
      toast.success('AI summary generated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary.');
    }
  };

  const handleUpdateConsent = (status: ConsentStatus) => {
    updateDeal(id, { aiConsentStatus: status, aiConsentDate: new Date().toISOString() });
    const messages: Record<ConsentStatus, string> = {
      granted: 'AI recording consent granted.',
      declined: 'AI recording consent declined.',
      pending: 'AI recording consent reset to pending.',
    };
    toast.success(messages[status]);
    setShowReenableConsent(false);
  };

  const consentBadgeVariant =
    deal.aiConsentStatus === 'granted' ? 'default'
    : deal.aiConsentStatus === 'declined' ? 'destructive'
    : 'outline';

  const consentLabel =
    deal.aiConsentStatus === 'granted' ? 'Granted'
    : deal.aiConsentStatus === 'declined' ? 'Declined'
    : 'Pending';

  const defaultEmailRecipient: EmailRecipient | undefined = deal.clientEmail
    ? { id: deal.clientId || 'deal-client', name: deal.clientName, email: deal.clientEmail, type: 'client' }
    : undefined;

  // Open the email dialog, optionally pre-selecting a specific recipient.
  const openEmail = (recipient?: EmailRecipient) => {
    setEmailRecipientOverride(recipient);
    setShowEmailDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="-ml-2 mt-1">
          <Link to="/journeys"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Buyer Journey</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{deal.clientName}</h1>
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STAGE_PILL_STYLES[deal.stage])}>
              {STAGE_LABELS[deal.stage]}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{deal.clientEmail}</span>
            {deal.clientPhone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{deal.clientPhone}</span>}
            <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />${deal.budget.toLocaleString()}</span>
            {linkedClient && (
              <Link
                to={`/clients/${linkedClient.id}`}
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <Users className="h-3.5 w-3.5" />
                {linkedClient.firstName} {linkedClient.lastName}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEmail(defaultEmailRecipient)}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Send Email
          </Button>
          <Select
            value={deal.stage}
            onChange={(e) => handleStageChange(e.target.value as DealStage)}
            className="w-36 text-sm"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* DD gate status — shown until the journey is past Due Diligence */}
      {STAGE_OPTIONS.indexOf(deal.stage) <= STAGE_OPTIONS.indexOf('due_diligence') && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            ddStatus.complete
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400',
          )}
        >
          {ddStatus.complete ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          <span className="font-medium">
            Due diligence:{' '}
            {ddStatus.recordCount === 0
              ? 'no record yet'
              : `${ddStatus.resolved}/${ddStatus.total} resolved${ddStatus.complete ? ' · complete' : ' · incomplete'}`}
          </span>
          <span className="opacity-70">— required to advance past the Due Diligence stage.</span>
          <Link
            to={dealProperties[0] ? `/due-diligence?propertyId=${dealProperties[0].id}` : '/due-diligence'}
            className="ml-auto font-semibold underline-offset-2 hover:underline"
          >
            {ddStatus.recordCount === 0 ? 'Create DD record' : 'Open DD record →'}
          </Link>
        </div>
      )}

      {/* Stage progress bar */}
      <div className="flex items-center gap-1">
        {STAGE_OPTIONS.map((stage, i) => {
          const currentIdx = STAGE_OPTIONS.indexOf(deal.stage);
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={stage} className="flex items-center flex-1">
              <div className={cn('h-1.5 w-full rounded-full transition-colors', isPast || isCurrent ? 'bg-primary' : 'bg-muted')} />
            </div>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto max-w-full flex-nowrap gap-1 overflow-x-auto">
          {allowedTabs.has('overview') && <TabsTrigger value="overview">Overview</TabsTrigger>}
          {allowedTabs.has('properties') && <TabsTrigger value="properties">Properties ({dealProperties.length})</TabsTrigger>}
          {allowedTabs.has('offers') && <TabsTrigger value="offers">Offers ({dealOffers.length})</TabsTrigger>}
          {allowedTabs.has('tasks') && <TabsTrigger value="tasks">Tasks ({openTaskCount})</TabsTrigger>}
          {allowedTabs.has('comparables') && <TabsTrigger value="comparables">Comparables ({comparablesCount})</TabsTrigger>}
          {allowedTabs.has('invoices') && <TabsTrigger value="invoices">Invoices ({dealInvoices.length})</TabsTrigger>}
          {allowedTabs.has('purchase') && (
            <TabsTrigger value="purchase">
              Purchase{hasPurchase && <Check className="ml-1 h-3.5 w-3.5 text-emerald-500" />}
            </TabsTrigger>
          )}
          {allowedTabs.has('comments') && <TabsTrigger value="comments">Comments ({dealComments.length})</TabsTrigger>}
          {allowedTabs.has('ai') && <TabsTrigger value="ai">AI Summaries ({dealSummaries.length})</TabsTrigger>}
          {allowedTabs.has('timeline') && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
          {allowedTabs.has('emails') && (
            <TabsTrigger value="emails">
              <Mail className="h-3.5 w-3.5 mr-1" />
              Emails{dealEmails.length > 0 ? ` (${dealEmails.length})` : ''}
            </TabsTrigger>
          )}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Client Brief</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Budget</p>
                    <p className="font-semibold">${deal.budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fee</p>
                    <p className="font-semibold">{deal.feeType === 'percentage' ? `${deal.fee}%` : `$${deal.fee.toLocaleString()}`}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Property Type</p>
                    <p className="font-semibold">{deal.propertyType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Size</p>
                    <p className="font-semibold">{deal.bedrooms} bed / {deal.bathrooms} bath</p>
                  </div>
                </div>
                {deal.preferredSuburbs.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Preferred Suburbs</p>
                    <div className="flex flex-wrap gap-1.5">
                      {deal.preferredSuburbs.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {deal.brief && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Brief</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{deal.brief}</p>
                  </div>
                )}
                {linkedClient && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Client Profile</p>
                    <Link
                      to={`/clients/${linkedClient.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-all group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {linkedClient.firstName[0]}{linkedClient.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">
                          {linkedClient.firstName} {linkedClient.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{linkedClient.email}</p>
                      </div>
                      <Users className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Agreement & Consent</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Agency Agreement</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={deal.agreementStatus === 'signed' ? 'default' : deal.agreementStatus === 'sent' ? 'secondary' : 'outline'}>
                      {deal.agreementStatus === 'signed' ? 'Signed' : deal.agreementStatus === 'sent' ? 'Sent' : 'Pending'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => setViewAgreement(true)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      {deal.agreementStatus === 'signed' ? 'Signed PDF' : 'Preview PDF'}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    The agency agreement is created and signed on the originating lead. It’s shown here for reference only.
                  </p>

                  {deal.agreementStatus === 'sent' && deal.agreementSignToken && (
                    <div className="mt-3 space-y-2">
                      {deal.agreementSentAt && (
                        <p className="text-xs text-muted-foreground">
                          Sent {new Date(deal.agreementSentAt).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Input readOnly value={`${window.location.origin}/sign/${deal.agreementSignToken}`} className="h-8 text-xs" />
                        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleCopySignLink}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {deal.agreementStatus === 'signed' && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                        Signed by <span className="font-semibold">{deal.agreementSignerName}</span>
                        {deal.agreementSignedAt && ` on ${new Date(deal.agreementSignedAt).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}`}.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Recording Consent</p>
                    {deal.aiConsentStatus === 'declined' && (
                      <button
                        type="button"
                        onClick={() => setShowReenableConsent(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-enable
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={consentBadgeVariant}>{consentLabel}</Badge>

                    {deal.aiConsentStatus === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateConsent('granted')}>Grant</Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateConsent('declined')}>Decline</Button>
                      </div>
                    )}
                    {deal.aiConsentStatus === 'granted' && (
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateConsent('declined')}>Revoke</Button>
                    )}
                    {deal.aiConsentStatus === 'declined' && (
                      <Button size="sm" variant="outline" onClick={() => setShowReenableConsent(true)}>
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Re-enable Consent
                      </Button>
                    )}
                  </div>

                  {deal.aiConsentDate && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {deal.aiConsentStatus === 'granted' ? 'Granted' : deal.aiConsentStatus === 'declined' ? 'Declined' : 'Updated'}{' '}
                      {new Date(deal.aiConsentDate).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}

                  {deal.aiConsentStatus === 'declined' && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive leading-relaxed">
                        AI recording is currently disabled for this client. Re-enable consent to use AI call and meeting summaries.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <EntityDocuments entityType="deal" entityId={deal.id} dealId={deal.id} className="mt-6" />
        </TabsContent>

        {/* PROPERTIES */}
        <TabsContent value="properties">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Tracked Properties</h2>
              <Button size="sm" onClick={() => setShowAddProperty(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Property
              </Button>
            </div>
            {dealProperties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
                  <Home className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="text-base font-semibold">No properties tracked yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">Add properties to this campaign as you find candidates for your client.</p>
                <Button size="sm" className="mt-5" onClick={() => setShowAddProperty(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first property
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dealProperties.map((prop) => (
                  <Card key={prop.id} className="hover:shadow-md transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-semibold leading-snug">{prop.address}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">{prop.suburb}</CardDescription>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            PROPERTY_STATUS_BADGE[prop.status]
                          )}
                        >
                          {PROPERTY_STATUS_LABELS[prop.status]}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{prop.priceGuide || 'Price TBC'}</span>
                        <span>{prop.bedrooms}bd / {prop.bathrooms}ba</span>
                        {prop.propertyType && <span>{prop.propertyType}</span>}
                        {prop.sourceAgentName && <span className="flex items-center gap-1"><Star className="h-3 w-3" />{prop.sourceAgentName}</span>}
                        {prop.isOffMarket && <Badge variant="secondary" className="text-xs">Off-Market</Badge>}
                      </div>
                      {prop.notes && <p className="text-xs text-muted-foreground">{prop.notes}</p>}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <span className="text-xs text-muted-foreground shrink-0">Update status:</span>
                        <Select
                          value={prop.status}
                          onChange={(e) => updateProperty(prop.id, { status: e.target.value as PropertyStatus })}
                          containerClassName="flex-1"
                          className="h-7 text-xs"
                        >
                          {PROPERTY_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline" className="flex-1">
                          <Link to={`/properties/${prop.id}`}>View Details</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/due-diligence?propertyId=${prop.id}`}>DD</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Sheet open={showAddProperty} onOpenChange={(o) => { setShowAddProperty(o); if (!o) { setAddPropMode('new'); setOmSearch(''); setPropMedia([]); } }}>
            <SheetContent size="lg">
              <SheetHeader><SheetTitle>Add Property to Journey</SheetTitle></SheetHeader>

              {/* Mode toggle: enter a new property, or reuse one from the off-market database. */}
              <div className="shrink-0 px-6 pt-4">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {([
                  { key: 'new', label: 'New property', icon: Plus },
                  { key: 'offmarket', label: 'From off-market', icon: Building2 },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setAddPropMode(m.key)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      addPropMode === m.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <m.icon className="h-3.5 w-3.5" />{m.label}
                  </button>
                ))}
              </div>
              </div>

              {addPropMode === 'offmarket' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <SheetBody className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={omSearch} onChange={(e) => setOmSearch(e.target.value)} placeholder="Search off-market by address or suburb..." className="pl-9" />
                  </div>
                  {linkableOffMarket.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-10 text-center">
                      <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {offMarket.length === 0
                          ? 'No off-market properties in your database yet.'
                          : omSearch.trim()
                            ? 'No matches — try a different search.'
                            : 'Every active off-market property is already on this campaign.'}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                      {linkableOffMarket.map((om) => (
                        <button
                          key={om.id}
                          type="button"
                          disabled={linkingOmId !== null}
                          onClick={() => handleLinkOffMarket(om)}
                          className="group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                            <Home className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{om.address}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {om.suburb || '—'} · {om.bedrooms}bd/{om.bathrooms}ba{om.priceGuide ? ` · ${om.priceGuide}` : ''}
                            </p>
                          </div>
                          {linkingOmId === om.id ? (
                            <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                              <Check className="h-3.5 w-3.5" />Add
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  </SheetBody>
                  <SheetFooter>
                    <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
                  </SheetFooter>
                </div>
              ) : (
              <form onSubmit={handleAddProperty} className="flex min-h-0 flex-1 flex-col">
                <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="propAddress">Street address *</Label>
                  <Input id="propAddress" value={propForm.address} onChange={(e) => setPropForm((f) => ({ ...f, address: e.target.value }))} placeholder="12 Example St" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="propSuburb">Suburb</Label>
                    <Input id="propSuburb" value={propForm.suburb} onChange={(e) => setPropForm((f) => ({ ...f, suburb: e.target.value }))} placeholder="Remuera" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="priceGuide">Price guide</Label>
                    <Input id="priceGuide" value={propForm.priceGuide} onChange={(e) => setPropForm((f) => ({ ...f, priceGuide: e.target.value }))} placeholder="$1.2M - $1.4M" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="propBeds">Beds</Label>
                    <Input id="propBeds" type="number" min="1" value={propForm.bedrooms} onChange={(e) => setPropForm((f) => ({ ...f, bedrooms: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="propBaths">Baths</Label>
                    <Input id="propBaths" type="number" min="1" value={propForm.bathrooms} onChange={(e) => setPropForm((f) => ({ ...f, bathrooms: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="propCars">Cars</Label>
                    <Input id="propCars" type="number" min="0" value={propForm.carparks} onChange={(e) => setPropForm((f) => ({ ...f, carparks: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="propType">Property type</Label>
                    <Input id="propType" value={propForm.propertyType} onChange={(e) => setPropForm((f) => ({ ...f, propertyType: e.target.value }))} placeholder="House" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="propAgent">Source agent</Label>
                    <Input id="propAgent" value={propForm.sourceAgentName} onChange={(e) => setPropForm((f) => ({ ...f, sourceAgentName: e.target.value }))} placeholder="Agent name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propUrl">Listing URL</Label>
                  <Input id="propUrl" value={propForm.listingUrl} onChange={(e) => setPropForm((f) => ({ ...f, listingUrl: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propNotes">Notes</Label>
                  <Textarea id="propNotes" value={propForm.notes} onChange={(e) => setPropForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Photos, videos & documents</Label>
                  <MediaUploader value={propMedia} onChange={setPropMedia} scope="property" compact />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={propForm.isOffMarket} onChange={(e) => setPropForm((f) => ({ ...f, isOffMarket: e.target.checked }))} className="rounded" />
                  Off-market property
                </label>
                </SheetBody>
                <SheetFooter>
                  <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
                  <Button type="submit" disabled={!propForm.address.trim()}>
                    <Plus className="mr-2 h-4 w-4" />Add Property
                  </Button>
                </SheetFooter>
              </form>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* OFFERS */}
        <TabsContent value="offers">
          <OffersTab dealId={id} properties={dealProperties} />
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks">
          <TasksTab dealId={id} properties={dealProperties} />
        </TabsContent>

        {/* COMPARABLES */}
        <TabsContent value="comparables">
          <ComparablesTab dealId={id} properties={dealProperties} />
        </TabsContent>

        {/* INVOICES */}
        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Invoices</h2>
              <Button size="sm" onClick={() => setShowAddInvoice(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create Invoice
              </Button>
            </div>
            {dealInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
                  <DollarSign className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="text-base font-semibold">No invoices yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">Create an engagement invoice to download or email to the client.</p>
                <Button size="sm" className="mt-5" onClick={() => setShowAddInvoice(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Create Invoice
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {dealInvoices.map((inv) => (
                  <Card key={inv.id} className="hover:shadow-sm transition-all">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{inv.invoiceNumber}</span>
                            <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                              {inv.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{inv.type}</Badge>
                            {inv.xeroInvoiceId && (
                              <Badge variant="outline" className="text-xs">In Xero</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{inv.description || 'Buyer agency services'} · Due {inv.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums">${inv.total.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">incl. GST</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setViewInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEmailInvoice(inv.id)}
                              disabled={emailingId === inv.id}
                            >
                              <Mail className="mr-1.5 h-3.5 w-3.5" />
                              {emailingId === inv.id ? 'Emailing…' : 'Email to client'}
                            </Button>
                            {!hasXero ? (
                              <span
                                className="text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-2 py-1"
                                title="Set XERO_CLIENT_ID/SECRET on the server to enable Xero."
                              >
                                Xero — Not configured
                              </span>
                            ) : !xeroConnected ? (
                              <Button asChild size="sm" variant="outline" title="Connect Xero in Settings">
                                <Link to="/settings">Connect Xero</Link>
                              </Button>
                            ) : inv.xeroInvoiceId ? (
                              <>
                                <Badge variant="secondary" className="text-[11px] capitalize">
                                  Xero · {(inv.xeroStatus || 'synced').toLowerCase()}
                                </Badge>
                                {inv.xeroUrl && (
                                  <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                                    <a href={inv.xeroUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRefreshXero(inv.id)}
                                  disabled={xeroBusyId === inv.id}
                                >
                                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                  {xeroBusyId === inv.id ? '…' : 'Refresh'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePushXero(inv.id)}
                                disabled={xeroBusyId === inv.id}
                              >
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                {xeroBusyId === inv.id ? 'Sending…' : 'Send to Xero'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Sheet open={showAddInvoice} onOpenChange={setShowAddInvoice}>
            <SheetContent size="sm">
              <SheetHeader><SheetTitle>Create Invoice</SheetTitle></SheetHeader>
              <form onSubmit={handleAddInvoice} className="flex min-h-0 flex-1 flex-col">
                <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invType">Invoice type</Label>
                  <Select id="invType" value={invForm.type} onChange={(e) => setInvForm((f) => ({ ...f, type: e.target.value as 'engagement' | 'milestone' | 'final' }))}>
                    <option value="engagement">Engagement</option>
                    <option value="milestone">Milestone</option>
                    <option value="final">Final</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invDesc">Description</Label>
                  <Input id="invDesc" value={invForm.description} onChange={(e) => setInvForm((f) => ({ ...f, description: e.target.value }))} placeholder="Buyer agency engagement fee" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invAmount">Amount (excl. GST) *</Label>
                  <Input id="invAmount" type="number" value={invForm.amount} onChange={(e) => setInvForm((f) => ({ ...f, amount: e.target.value }))} placeholder="10000" />
                  {Number(invForm.amount) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      + {gstRate}% GST = ${(Number(invForm.amount) * (1 + gstRate / 100)).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invDue">Due date *</Label>
                  <Input id="invDue" type="date" value={invForm.dueDate} onChange={(e) => setInvForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
                </SheetBody>
                <SheetFooter>
                  <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
                  <Button type="submit" disabled={!invForm.amount || !invForm.dueDate}>
                    <Plus className="mr-2 h-4 w-4" />Create
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* PURCHASE */}
        <TabsContent value="purchase">
          <PurchaseTab dealId={id} properties={dealProperties} stage={deal.stage} />
        </TabsContent>

        {/* COMMENTS */}
        <TabsContent value="comments">
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Journey Comments</h2>
            <form onSubmit={handleAddComment} className="space-y-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment or note..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!commentText.trim()}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Post Comment
                </Button>
              </div>
            </form>
            {dealComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No comments yet. Add the first note above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dealComments.map((c) => (
                  <Card key={c.id} className="border-border/60">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {c.authorName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{c.authorName}</p>
                            <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('en-NZ')}</p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AI SUMMARIES */}
        <TabsContent value="ai">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">AI Call & Meeting Summaries</h2>
              <Button
                size="sm"
                onClick={() => { setAiConsentError(false); setShowAISummary(true); }}
                disabled={deal.aiConsentStatus !== 'granted'}
              >
                <Binary className="mr-1.5 h-3.5 w-3.5" />
                Generate Summary
              </Button>
            </div>
            {deal.aiConsentStatus !== 'granted' && (
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        AI summaries require client consent. Go to the Overview tab to manage consent settings.
                      </p>
                    </div>
                    {deal.aiConsentStatus === 'declined' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        onClick={() => setShowReenableConsent(true)}
                      >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Re-enable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {dealSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
                  <Binary className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="text-base font-semibold">No summaries yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">Generate AI summaries from call and meeting transcripts to capture key points and action items.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dealSummaries.map((summary) => (
                  <Card key={summary.id} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{summary.title}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">{summary.type} · {summary.date} · {summary.participants.join(', ')}</CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-xs capitalize">{summary.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Summary</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{summary.summary}</p>
                      </div>
                      {summary.actionItems.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Action Items</p>
                          <div className="space-y-2">
                            {summary.actionItems.map((item) => (
                              <div key={item.id} className="flex items-start gap-2">
                                <button type="button" onClick={() => toggleActionItem(summary.id, item.id)} className="mt-0.5 shrink-0">
                                  <CheckCircle className={cn('h-4 w-4', item.completed ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm', item.completed && 'line-through text-muted-foreground')}>{item.description}</p>
                                  <p className="text-xs text-muted-foreground">{item.assignedTo} · due {item.dueDate}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Sheet open={showAISummary} onOpenChange={setShowAISummary}>
            <SheetContent size="lg">
              <SheetHeader><SheetTitle>Generate AI Summary</SheetTitle></SheetHeader>
              <form onSubmit={handleGenerateSummary} className="flex min-h-0 flex-1 flex-col">
                <SheetBody className="space-y-4">
                {aiConsentError && (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-sm text-destructive">Client consent is required to use AI summaries. Please grant consent in the Overview tab first.</p>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="aiType">Type</Label>
                    <Select id="aiType" value={aiForm.type} onChange={(e) => setAiForm((f) => ({ ...f, type: e.target.value as 'call' | 'meeting' }))}>
                      <option value="call">Call</option>
                      <option value="meeting">Meeting</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="aiTitle">Title *</Label>
                    <Input id="aiTitle" value={aiForm.title} onChange={(e) => setAiForm((f) => ({ ...f, title: e.target.value }))} placeholder="Weekly check-in" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aiParticipants">Participants (comma-separated)</Label>
                  <Input id="aiParticipants" value={aiForm.participants} onChange={(e) => setAiForm((f) => ({ ...f, participants: e.target.value }))} placeholder="Jane Smith, John Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aiTranscript">Transcript / Notes</Label>
                  <Textarea id="aiTranscript" value={aiForm.transcript} onChange={(e) => setAiForm((f) => ({ ...f, transcript: e.target.value }))} rows={5} placeholder="Paste transcript or key discussion points here..." />
                </div>
                </SheetBody>
                <SheetFooter>
                  <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
                  <Button type="submit" disabled={!aiForm.title.trim() || isGenerating}>
                    <Binary className="mr-2 h-4 w-4" />
                    {isGenerating ? 'Generating...' : 'Generate Summary'}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          <TimelineTab dealId={id} />
        </TabsContent>

        {/* EMAILS TAB */}
        <TabsContent value="emails">
          <div className="space-y-6">
            {/* Synced Outlook emails linked to this Buyer Journey. */}
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">Linked emails</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Outlook mail tagged to this deal. Tag more from the{' '}
                  <Link to="/inbox" className="underline underline-offset-2">Inbox</Link>.
                </p>
              </div>
              <EmailList emails={dealEmails} emptyText="No emails linked to this deal yet. Link them from the Inbox." />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Send Email</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Send a templated email to the client or agents involved in this campaign.
                </p>
              </div>
              <Button size="sm" onClick={() => openEmail(defaultEmailRecipient)}>
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Compose Email
              </Button>
            </div>

            {/* Quick-send recipient cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client card */}
              <Card className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {deal.clientName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{deal.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{deal.clientEmail}</p>
                      <Badge variant="secondary" className="text-[10px] mt-1">Client</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEmail(defaultEmailRecipient)}
                      className="shrink-0"
                    >
                      <Mail className="h-3.5 w-3.5 mr-1" />
                      Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Agent cards — only agents connected to this journey's properties */}
              {connectedAgents.map((agent) => (
                <Card key={agent.id} className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground font-bold text-sm">
                        {agent.firstName[0]}{agent.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{agent.firstName} {agent.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.email || agent.agency}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">Agent</Badge>
                          {agent.isPreferred && <Badge variant="secondary" className="text-[10px]">Preferred</Badge>}
                        </div>
                      </div>
                      {agent.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEmail({ id: agent.id, name: `${agent.firstName} ${agent.lastName}`, email: agent.email, type: 'agent' })}
                          className="shrink-0"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          Email
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {connectedAgents.length === 0 && (
                <Card className="border-dashed border-border/60 col-span-full">
                  <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No agents connected to this journey yet.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add a property with a source agent to email them from here.</p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link to="/properties">Go to Properties</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Template hint */}
            <Card className="border-border/60 bg-muted/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">25+ ready-to-send templates</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Templates are pre-filled with this campaign's client name, budget, suburbs, and property type.
                      Edit the body before sending to personalise further.
                    </p>
                    <Button asChild size="sm" variant="ghost" className="mt-2 -ml-2 h-7 text-xs">
                      <Link to="/emails">Manage templates</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Re-enable Consent Confirmation Dialog */}
      <Dialog open={showReenableConsent} onOpenChange={setShowReenableConsent}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-enable AI Recording Consent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will re-enable AI call and meeting summaries for this client. Please confirm that the client has provided their verbal or written consent to AI recording.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Important:</span> Only re-enable consent if the client has explicitly agreed to AI-assisted recording and summarisation of their calls and meetings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={() => handleUpdateConsent('granted')}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-enable Consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Send Email Dialog */}
      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        defaultRecipient={emailRecipientOverride ?? defaultEmailRecipient}
        recipients={emailRecipients}
        variables={emailVariables}
        contextLabel={deal.clientName}
      />

      {viewAgreement && (
        <DocumentViewer
          open={viewAgreement}
          onClose={() => setViewAgreement(false)}
          title="Agency agreement"
          mimeType="application/pdf"
          previewPath={agreementPdfPreviewPath(id)}
          canDownload={canDownloadDoc(deal.assignedTo, currentUser)}
          onDownload={() => downloadAgreementPdf(id)}
        />
      )}

      {viewInvoice && (
        <DocumentViewer
          open={!!viewInvoice}
          onClose={() => setViewInvoice(null)}
          title={`Invoice ${viewInvoice.invoiceNumber || ''}`.trim()}
          mimeType="application/pdf"
          previewPath={invoicePdfPreviewPath(viewInvoice.id)}
          canDownload={canDownloadDoc(deal.assignedTo, currentUser)}
          onDownload={() => handleDownloadInvoice(viewInvoice.id, viewInvoice.invoiceNumber)}
        />
      )}
    </div>
  );
}