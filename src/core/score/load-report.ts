export type Severity = 'info' | 'warning';

export type LoadNoticeCode =
  | 'unsupportedElement'
  | 'timingRounded'
  | 'divisionsInvalid'
  | 'cursorClamped'
  | 'measureLengthMismatch'
  | 'measureRepeatOnlyRests'
  | 'brokenTie'
  | 'jumpTargetMissing'
  | 'jumpInferredFromText'
  | 'endingNoMatch'
  | 'repeatTooDeep'
  | 'unrollGuardHit'
  | 'tempoTextIgnored'
  | 'instrumentFallback'
  | 'unpitchedWithoutSound'
  | 'defaultTempo'
  | 'middleBarlineRepeat'
  // US3 (006-beamed-note-engraving): engraving completion notices
  | 'engravingCompleted'
  | 'beamDataInvalid'
  | 'accidentalContradicts';

export interface LoadReportEntry {
  code: LoadNoticeCode;
  severity: Severity;
  measureLabels: string[];
  element?: string;
  detail?: string;
}

export interface LoadReport {
  entries: LoadReportEntry[];
  skippedElementCount: number;
}
