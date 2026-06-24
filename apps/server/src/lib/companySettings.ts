import { CompanySettings } from '../models';
import type { CompanySettings as CompanySettingsDTO } from '@rilo/shared';
import { normalizeAssetUrl } from './s3';

/**
 * Return the settings as a plain object for the client/builders, mapping the
 * hosted email logo onto its current public (proxy) URL so logos saved before
 * the image proxy still resolve.
 */
export function settingsToClient(doc: { toJSON: () => unknown }): CompanySettingsDTO {
  const json = doc.toJSON() as CompanySettingsDTO & { emailLogoUrl?: string };
  if (typeof json.emailLogoUrl === 'string') json.emailLogoUrl = normalizeAssetUrl(json.emailLogoUrl);
  return json;
}

/**
 * The org-wide company settings document. Single-tenant, so there is at most
 * one. Created lazily with schema defaults on first access, so callers never
 * have to handle a missing document.
 */
export async function getCompanySettings() {
  const existing = await CompanySettings.findOne();
  if (existing) return existing;
  return CompanySettings.create({});
}

/**
 * The company settings as a plain DTO for the PDF builders. Returns the saved
 * document's values (which fall back to defaults field-by-field). Never throws —
 * on any error it resolves to `undefined` so PDF generation degrades to the
 * builders' own hardcoded fallbacks rather than failing the download.
 */
export async function getCompanySettingsDto(): Promise<CompanySettingsDTO | undefined> {
  try {
    const doc = await getCompanySettings();
    return settingsToClient(doc);
  } catch {
    return undefined;
  }
}
