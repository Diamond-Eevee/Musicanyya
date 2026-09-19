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
  | 'middleBarlineRepeat';

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
