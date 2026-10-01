// The licences a library item or reference source may carry (feature 019 FR-025, research R-19, data-model 6.3a):
// public domain, CC0, and the attribution licences CC BY / CC BY-SA as SPDX ids. Names and deed links are derived
// from the id here, never typed by hand in a sidecar.

const ATTRIBUTION_VERSIONS = ['2.0', '2.5', '3.0', '4.0'] as const;

export const ATTRIBUTION_LICENCES = [
  ...ATTRIBUTION_VERSIONS.map((v) => `CC-BY-${v}` as const),
  ...ATTRIBUTION_VERSIONS.map((v) => `CC-BY-SA-${v}` as const),
] as const;

export const LIBRARY_LICENCES = ['public-domain', 'CC0-1.0', ...ATTRIBUTION_LICENCES] as const;

export type AttributionLicence = (typeof ATTRIBUTION_LICENCES)[number];
export type LibraryLicence = (typeof LIBRARY_LICENCES)[number];

export function isLibraryLicence(value: unknown): value is LibraryLicence {
  return typeof value === 'string' && (LIBRARY_LICENCES as readonly string[]).includes(value);
}

/** CC BY and CC BY-SA: the item must credit its author and say whether it was changed (FR-025). */
export function isAttributionLicence(value: unknown): value is AttributionLicence {
  return typeof value === 'string' && (ATTRIBUTION_LICENCES as readonly string[]).includes(value);
}

/** "Public domain", "CC0 1.0", "CC BY 4.0", "CC BY-SA 3.0". */
export function licenceName(licence: LibraryLicence): string {
  if (licence === 'public-domain') return 'Public domain';
  if (licence === 'CC0-1.0') return 'CC0 1.0';
  const sa = licence.startsWith('CC-BY-SA-');
  return `CC ${sa ? 'BY-SA' : 'BY'} ${licence.slice(sa ? 'CC-BY-SA-'.length : 'CC-BY-'.length)}`;
}

/** The Creative Commons deed of the licence; public domain has none. */
export function licenceUrl(licence: LibraryLicence): string | undefined {
  if (licence === 'public-domain') return undefined;
  if (licence === 'CC0-1.0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  const sa = licence.startsWith('CC-BY-SA-');
  const version = licence.slice(sa ? 'CC-BY-SA-'.length : 'CC-BY-'.length);
  return `https://creativecommons.org/licenses/${sa ? 'by-sa' : 'by'}/${version}/`;
}
