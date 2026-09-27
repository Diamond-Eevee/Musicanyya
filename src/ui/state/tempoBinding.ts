import type { RunPhase } from '../../core/play/types.js';
import type { TempoDisplaySegment } from '../../core/tempo/tempo-display.js';
import { TEMPO_PERCENT_DEFAULT } from '../../engine/config.js';
import type { AppMode } from './practiceState.js';

// data-model.md section 5, contracts/tempo-field.md (feature 012, US3): which segment and percent the tempo
// field shows, and when it locks, in each mode. Pure selector - the segment itself (transport's own, or Play's
// range-start / live-cursor one) is resolved by the caller (session.ts), which alone knows the tempo map, the
// reference tick and the run's position (Constitution V: no DOM, no store reads here).

export interface TempoBindingTransport {
  segment: TempoDisplaySegment | null;
  percent: number;
}

export interface TempoBindingPlaySetup {
  segment: TempoDisplaySegment | null;
  tempoPercent: number;
}

export interface TempoBindingRun {
  phase: RunPhase;
}

export interface TempoBindingResult {
  segment: TempoDisplaySegment | null;
  percent: number;
  locked: boolean;
}

/** Listen and Practice show the transport's own segment and factor, never locked. Play shows the Play setup's
 *  segment and factor instead (FR-017, FR-018), locked only while a run is counting in or running. */
export function tempoFieldBinding(
  mode: AppMode,
  transport: TempoBindingTransport,
  playSetup: TempoBindingPlaySetup | null,
  run: TempoBindingRun | null,
): TempoBindingResult {
  if (mode !== 'play') {
    return { segment: transport.segment, percent: transport.percent, locked: false };
  }
  return {
    segment: playSetup?.segment ?? null,
    percent: playSetup?.tempoPercent ?? TEMPO_PERCENT_DEFAULT,
    locked: run?.phase === 'countIn' || run?.phase === 'running',
  };
}
