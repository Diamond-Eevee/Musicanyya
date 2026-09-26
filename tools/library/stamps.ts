// A generated sidecar is stamped with the day it was generated (`provenance.created`, and `reviewedOn` when the definition
// names none). Regenerating on another day must not rewrite every committed sidecar: a stamp that equals today's date is
// replaced by the one the sidecar already has. Dev-only.
import * as fs from 'node:fs';

interface Stamped {
  reviewedOn?: string;
  provenance?: { created?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** `meta` with today's stamps replaced by those of the sidecar on disk at `sidecarPath`, when it has any. */
export function keepStamps<T extends object>(meta: T, sidecarPath: string, generatedOn: string): T {
  if (!fs.existsSync(sidecarPath)) return meta;
  let existing: Stamped;
  try {
    existing = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')) as Stamped;
  } catch {
    return meta;
  }
  const next = { ...meta } as Stamped;
  if (next.reviewedOn === generatedOn && typeof existing.reviewedOn === 'string') next.reviewedOn = existing.reviewedOn;
  if (next.provenance?.created === generatedOn && typeof existing.provenance?.created === 'string')
    next.provenance = { ...next.provenance, created: existing.provenance.created };
  return next as T;
}
