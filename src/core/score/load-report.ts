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
  // 008 (pressed-keys-on-score): a clef the red-disc placement cannot use (percussion, TAB, ...)
  | 'unsupportedClef'
  // US3 (006-beamed-note-engraving): engraving completion notices
  | 'engravingCompleted'
  | 'beamDataInvalid'
  | 'accidentalContradicts'
  | 'engravingSkipped'
  // 019 (metronome-orchestra-volume): Orchestra parts and staves hidden in other ways
  | 'hiddenStaffIgnored'
  | 'orchestraChannelsShared'
  | 'orchestraInstrumentMissing';

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
