import type { Browser } from 'puppeteer';

/**
 * Headless-Chromium HTML→PDF rendering. Used by the agreement builder so the
 * generated PDF matches the WYSIWYG editor pixel-for-pixel (backgrounds, fonts,
 * colours, images) — something the pure-pdfkit builders can't do.
 *
 * The browser is launched once and reused across requests (this is a
 * single-instance server). Only TRUSTED-after-sanitisation HTML is ever rendered
 * here, via `page.setContent` — we never navigate to a user-supplied URL.
 */

// Recycle the browser periodically so a long-lived process can't accumulate
// Chromium memory indefinitely.
const RECYCLE_AFTER_RENDERS = 200;
// Cap concurrent renders to avoid OOM under burst; PDF generation is infrequent.
const MAX_CONCURRENT = 3;

let browserP: Promise<Browser> | null = null;
let rendersSinceLaunch = 0;
let active = 0;
const queue: Array<() => void> = [];

async function launch(): Promise<Browser> {
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function getBrowser(): Promise<Browser> {
  if (browserP) {
    const b = await browserP;
    // Relaunch if Chromium crashed/disconnected since the last render.
    if (b.connected) return b;
    browserP = null;
  }
  browserP = launch();
  rendersSinceLaunch = 0;
  return browserP;
}

/** Acquire a render slot (simple FIFO semaphore). */
function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release(): void {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

export interface RenderOpts {
  /** Chromium header template HTML (repeats on every page). Needs explicit font-size. */
  headerTemplate?: string;
  /** Chromium footer template HTML (repeats on every page). Supports .pageNumber/.totalPages. */
  footerTemplate?: string;
  /** Page margins; defaults reserve room for the header/footer templates. */
  margin?: { top: string; bottom: string; left: string; right: string };
}

/**
 * Render a complete HTML document to an A4 PDF buffer. `html` must already be
 * sanitised and wrapped in its print shell. Fonts referenced via <link> are
 * awaited (networkidle0 + document.fonts.ready) so the PDF isn't rendered with
 * fallback glyphs.
 */
export async function renderHtmlToPdf(html: string, opts: RenderOpts = {}): Promise<Buffer> {
  await acquire();
  try {
    const browser = await getBrowser();
    rendersSinceLaunch++;
    const page = await browser.newPage();
    try {
      // 'load' fires after images/stylesheets finish; fonts are awaited below.
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      // Ensure web fonts have loaded before snapshotting to PDF (runs in-page).
      await page
        .evaluate(() => {
          const d = (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document;
          return d?.fonts?.ready ?? null;
        })
        .catch(() => undefined);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: Boolean(opts.headerTemplate || opts.footerTemplate),
        headerTemplate: opts.headerTemplate ?? '<span></span>',
        footerTemplate: opts.footerTemplate ?? '<span></span>',
        margin: opts.margin ?? { top: '120px', bottom: '70px', left: '0', right: '0' },
        timeout: 30_000,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    release();
    // Recycle outside the slot so the next render relaunches lazily.
    if (rendersSinceLaunch >= RECYCLE_AFTER_RENDERS && active === 0) {
      void closeBrowser();
    }
  }
}

/** Close the shared browser (graceful shutdown / recycle). Safe to call when none is open. */
export async function closeBrowser(): Promise<void> {
  if (!browserP) return;
  const p = browserP;
  browserP = null;
  rendersSinceLaunch = 0;
  try {
    const b = await p;
    await b.close();
  } catch {
    /* already gone */
  }
}
