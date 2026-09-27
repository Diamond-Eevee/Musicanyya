/** data-model.md §2/§3, FR-012/FR-013, R-8/R-16 - plain-words formatting of a `ProgressResult`/`ProgressRecord`
 *  for the browser's rows, detail pane and rail. Pure text (Principle V): no DOM. */
import type { StrictnessLevelName } from '../../core/grade/types.js';
import { percentShown } from '../../core/progress/compare.js';
import type { Trend } from '../../core/progress/status.js';
import type { ProgressResult, ResultScope } from '../../core/progress/types.js';
import { en } from '../i18n/en.js';

/** "92% correct · 85% on time" (FR-009/FR-013): never a new, unexplained number - always the two Grade figures. */
export function resultFigures(result: ProgressResult): string {
  const correct = percentShown(result.notesCorrect) ?? 0;
  const onTime = percentShown(result.notesOnTime) ?? 0;
  return en.browser.resultFigures.replace('{correct}', String(correct)).replace('{onTime}', String(onTime));
}

/** Tempo is shown only when it was not the written tempo (R-13 "tempo when not 100%"); percent is the fallback
 *  used everywhere in the browser, since a true BPM needs the Score loaded (`attemptTempo`), which most rows are
 *  not. `''` at 100%. */
export function resultTempoSuffix(result: ProgressResult): string {
  if (result.tempoPercent === 100) return '';
  return en.browser.resultTempo.replace('{percent}', String(result.tempoPercent));
}

export function strictnessText(strictness: StrictnessLevelName): string {
  return strictness === 'beginner'
    ? en.play.setup.strictnessBeginner
    : strictness === 'standard'
      ? en.play.setup.strictnessStandard
      : en.play.setup.strictnessStrict;
}

/** data-model.md §2: a written bar range and/or a hand selection, or the whole Score. */
export function scopeText(scope: ResultScope): string {
  if (scope.kind === 'whole') return en.browser.scopeWhole;
  const parts: string[] = [];
  if (scope.hands === 'right') parts.push(en.browser.scopeHandsRight);
  else if (scope.hands === 'left') parts.push(en.browser.scopeHandsLeft);
  else if (scope.hands === 'custom') parts.push(en.browser.scopeHandsCustom);
  if (scope.fromMeasure !== null && scope.toMeasure !== null) {
    parts.push(
      en.browser.scopeRange.replace('{from}', String(scope.fromMeasure)).replace('{to}', String(scope.toMeasure)),
    );
  }
  return parts.length > 0 ? parts.join(', ') : en.browser.scopeWhole;
}

/** FR-013: "Stopped early" for a run known to have stopped, "Stopped early: not recorded" for a legacy run whose
 *  completeness is unknown (R-6); `''` for a complete run - nothing to say. */
export function completenessText(result: ProgressResult): string {
  if (result.complete === true) return '';
  if (result.complete === false) return en.browser.stoppedEarly;
  return en.browser.stoppedEarlyUnknown;
}

/** FR-012, R-8: the same points-delta rule as `trendDeltaPoints` (core/progress/status.ts), but over an
 *  `ItemProgressView.history` array (newest first) rather than a full `ProgressRecord` - what the browser's rows
 *  and detail pane actually have to hand. `null` with fewer than two results. */
export function historyTrendDeltaPoints(history: readonly ProgressResult[]): number | null {
  const [last, previous] = history;
  if (last === undefined || previous === undefined) return null;
  return (percentShown(last.notesCorrect) ?? 0) - (percentShown(previous.notesCorrect) ?? 0);
}

/** FR-012: "up 15 points" / "down 3 points" / "same", or `null` with fewer than two results (screen-reader text,
 *  paired with the up/down triangle or equals sign, R-16). */
export function trendText(trend: Trend, deltaPoints: number | null): string | null {
  if (trend === null) return null;
  if (trend === 'same') return en.browser.trend.same;
  const points = String(Math.abs(deltaPoints ?? 0));
  return en.browser.trend[trend].replace('{points}', points);
}

const RELATIVE_UNITS: readonly { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "3 days ago" / "just now" (`Intl.RelativeTimeFormat`, R-13). `now` is injectable for deterministic tests. */
export function relativeDate(iso: string, now: Date = new Date()): string {
  const deltaMs = Date.parse(iso) - now.getTime();
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms) return relativeFormat.format(Math.round(deltaMs / ms), unit);
  }
  return relativeFormat.format(Math.round(deltaMs / 60_000), 'minute');
}
