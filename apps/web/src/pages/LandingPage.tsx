import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  Home,
  Mail,
  ShieldCheck,
  BarChart2,
  Lock,
  MessageSquare,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

const capabilities = [
  {
    icon: Users,
    title: 'Lead Qualification',
    description: 'Rapid lead capture, requirement scoring, and agreement signing in one seamless flow.',
  },
  {
    icon: Home,
    title: 'Off-Market Database',
    description: 'Centralised off-market property records, reusable across multiple client engagements.',
  },
  {
    icon: Mail,
    title: 'Agent Network & Outreach',
    description: 'Segmented agent database with branded email campaigns to targeted groups.',
  },
  {
    icon: ShieldCheck,
    title: 'Due Diligence Toolkit',
    description: 'Hazard maps, comparable sales, evidence storage and one-click PDF audit reports.',
  },
  {
    icon: Lock,
    title: 'Secure Client Portal',
    description: 'Clients view deals, properties and collaborate via comments and attachments.',
  },
  {
    icon: BarChart2,
    title: 'Xero Integration',
    description: 'Trigger invoices at engagement start and key milestones without leaving the platform.',
  },
  {
    icon: MessageSquare,
    title: 'AI Meeting Summaries',
    description: 'Opt-in AI-generated summaries capture key discussion points with client consent.',
  },
  {
    icon: Building2,
    title: 'End-to-End Pipeline',
    description: 'Full buyer journey from first enquiry through offer, settlement and final invoice.',
  },
];

const highlights = [
  'Fast lead qualification and buyer agreement signing',
  'Centralised off-market property database',
  'Geographic agent segmentation and preferred tagging',
  'Branded outbound email campaigns to agent groups',
  'Due diligence toolkit with internal audit checklist',
  'Client portal with secure collaboration',
  'Xero-integrated invoicing at every milestone',
  'Opt-in AI call and meeting summaries',
];

export default function LandingPage() {
  return (
    <div className="bg-background min-h-screen overflow-x-hidden font-sans">

      {/* ── Header ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-wordmark leading-none">
              <span className="block text-[16px] text-foreground"><span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span></span>
              <span className="brand-eyebrow mt-0.5 block text-[8px] text-muted-foreground">Buyers Agents</span>
            </div>
          </div>
          <Link to="/login">
            <Button size="sm" className="text-sm font-semibold px-5 shadow shadow-primary/20 gap-2">
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[88vh] flex items-center">
        {/* background photo */}
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/19517620/pexels-photo-19517620.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Aerial view of residential neighbourhood"
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          {/* deep gradient left side for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(84_18%_10%/0.96)] via-[hsl(84_16%_12%/0.82)] to-[hsl(84_16%_14%/0.18)]" />
          {/* bottom fade */}
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative max-w-screen-xl mx-auto px-6 py-24 md:py-36 w-full">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary mb-6">
              Internal Operations Platform
            </p>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-primary-foreground leading-[1.08] tracking-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              The complete system for<br />
              <span style={{ color: 'hsl(80 30% 64%)' }}>Martelli &amp; Co Buyers Agents.</span>
            </h1>

            {/* Sub */}
            <p className="text-base md:text-lg text-primary-foreground/70 leading-relaxed mb-10 max-w-lg">
              One platform covering every stage of the buyer journey — from lead qualification and agent outreach through to due diligence, settlement, and Xero invoicing.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-4 items-center">
              <Link to="/login">
                <Button size="lg" className="text-base font-semibold px-8 shadow-lg shadow-primary/30 gap-2">
                  Sign In to CRM <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#capabilities" className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors underline underline-offset-4">
                View capabilities
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's inside ──────────────────────── */}
      <section id="capabilities" className="py-20 max-w-screen-xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_auto] gap-12 items-start">
          {/* Left: intro text + highlights */}
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-primary mb-4">Platform Overview</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-5">
              Every tool your team needs, in one place.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Martelli Buyers CRM is purpose-built for boutique buyer agencies. It replaces the patchwork of spreadsheets, inboxes, and disconnected tools with a single, structured system that keeps deals moving and clients informed.
            </p>
            <ul className="space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: sign-in prompt card */}
          <div className="lg:sticky lg:top-24 w-full lg:w-80">
            <div className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="brand-wordmark leading-none">
                  <span className="block text-[16px] text-foreground"><span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span></span>
                  <span className="brand-eyebrow mt-0.5 block text-[8px] text-muted-foreground">Buyers Agents</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Access your deals, clients, properties and pipeline. Sign in with your team credentials to get started.
              </p>
              <Link to="/login" className="block">
                <Button className="w-full font-semibold gap-2" size="default">
                  Sign In <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-[11px] text-muted-foreground text-center mt-5 leading-snug">
                Access is invite-only — for authorised Martelli team members.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities Grid ──────────────────── */}
      <section className="bg-muted/40 border-y border-border py-20">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-primary mb-3">Core Modules</p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-12 max-w-lg">
            Built around how boutique buyer agencies actually work.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <cap.icon className="h-[18px] w-[18px] text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{cap.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow steps ─────────────────────── */}
      <section className="py-20 max-w-screen-xl mx-auto px-6">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-primary mb-3">Buyer Journey</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-12 max-w-lg">
          From first enquiry to settlement — fully tracked.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Qualify the Lead', desc: 'Capture requirements, assess fit, and get the buyer agreement signed in minutes.' },
            { step: '02', title: 'Match Properties', desc: 'Search the off-market database and engage your agent network with branded outreach.' },
            { step: '03', title: 'Run Due Diligence', desc: 'Compile evidence, hazard maps, and comps. Generate PDF audit reports with one click.' },
            { step: '04', title: 'Close & Invoice', desc: 'Finalise the deal and trigger Xero invoices at every milestone without leaving the platform.' },
          ].map((s, i, arr) => (
            <div key={s.step} className="relative">
              {i < arr.length - 1 && (
                <div
                  className="hidden lg:block absolute top-6 h-px border-t-2 border-dashed border-border z-0"
                  style={{ left: 'calc(50% + 1.75rem)', width: 'calc(100% - 1.75rem)' }}
                />
              )}
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow shadow-primary/25">
                  <span className="text-primary-foreground font-bold text-sm">{s.step}</span>
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom sign-in banner ──────────────── */}
      <section className="bg-muted/40 border-t border-border py-16">
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-2">
              Ready to start your session?
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your authorised team credentials to access the full platform.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link to="/login">
              <Button size="default" className="font-semibold px-6 gap-2 shadow shadow-primary/20">
                Sign In <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-wordmark leading-none">
              <span className="block text-[13px] text-foreground"><span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span></span>
              <span className="brand-eyebrow mt-0.5 block text-[7px] text-muted-foreground">Buyers Agents</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Martelli Buyer Agency. Authorised personnel only.
          </p>
        </div>
      </footer>

    </div>
  );
}