// Feature 019 FR-025 / research R-19: the licences the library accepts, their names and deed links.
import { describe, expect, it } from 'vitest';
import { isAttributionLicence, LIBRARY_LICENCES, licenceName, licenceUrl } from '../../../src/core/library/licences.js';

describe('library licences (019 FR-025, data-model 6.3a)', () => {
  it('lists exactly public domain, CC0 and CC BY / CC BY-SA 2.0, 2.5, 3.0, 4.0 as SPDX ids', () => {
    expect([...LIBRARY_LICENCES]).toEqual([
      'public-domain',
      'CC0-1.0',
      'CC-BY-2.0',
      'CC-BY-2.5',
      'CC-BY-3.0',
      'CC-BY-4.0',
      'CC-BY-SA-2.0',
      'CC-BY-SA-2.5',
      'CC-BY-SA-3.0',
      'CC-BY-SA-4.0',
    ]);
  });

  it('calls only CC BY and CC BY-SA attribution licences', () => {
    expect(isAttributionLicence('CC-BY-4.0')).toBe(true);
    expect(isAttributionLicence('CC-BY-SA-2.5')).toBe(true);
    expect(isAttributionLicence('CC0-1.0')).toBe(false);
    expect(isAttributionLicence('public-domain')).toBe(false);
    expect(isAttributionLicence('CC-BY-NC-4.0')).toBe(false);
  });

  it('names each licence for people', () => {
    expect(licenceName('public-domain')).toBe('Public domain');
    expect(licenceName('CC0-1.0')).toBe('CC0 1.0');
    expect(licenceName('CC-BY-4.0')).toBe('CC BY 4.0');
    expect(licenceName('CC-BY-SA-3.0')).toBe('CC BY-SA 3.0');
  });

  it('derives the licence deed link from the id; public domain has none', () => {
    expect(licenceUrl('CC-BY-SA-3.0')).toBe('https://creativecommons.org/licenses/by-sa/3.0/');
    expect(licenceUrl('CC-BY-2.5')).toBe('https://creativecommons.org/licenses/by/2.5/');
    expect(licenceUrl('CC0-1.0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenceUrl('public-domain')).toBeUndefined();
  });
});
