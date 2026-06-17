import { CompanySettings } from '../models';
import type { CompanySettings as CompanySettingsDTO } from '@rilo/shared';

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
    return doc.toJSON() as unknown as CompanySettingsDTO;
  } catch {
    return undefined;
  }
}
