export interface SupportEntry {
  category: string;
  element: string;
  status: 'Supported' | 'Partial' | 'Ignored' | 'Unsupported';
  notes: string;
}

export const SUPPORT_MATRIX: SupportEntry[] = [
  { category: 'Structure', element: '<part>', status: 'Supported', notes: '' },
  { category: 'Structure', element: '<measure>', status: 'Supported', notes: '' },
  { category: 'Notes', element: '<note>', status: 'Supported', notes: '' },
  { category: 'Notes', element: '<pitch>', status: 'Supported', notes: '' },
  { category: 'Notes', element: '<rest>', status: 'Supported', notes: '' },
  { category: 'Notes', element: '<tie>', status: 'Supported', notes: '' },
  {
    category: 'Notes',
    element: '<beam>',
    status: 'Supported',
    notes: 'Shown as encoded; completed automatically when a voice has none (not for sung lines with lyrics)',
  },
  {
    category: 'Notes',
    element: '<accidental>',
    status: 'Supported',
    notes: 'Shown as encoded; required and courtesy signs completed when missing',
  },
  { category: 'Notes', element: '<grace>', status: 'Supported', notes: 'Acciaccatura and appoggiatura' },
  {
    category: 'Notes',
    element: '<fingering>',
    status: 'Supported',
    notes: 'Engraved by Verovio; also read by Practice mode for its help overlay (feature 002)',
  },
  {
    category: 'Time & Repeats',
    element: '<repeat>',
    status: 'Supported',
    notes: 'Backward and forward repeats. Note: middle-barline repeats not supported',
  },
  { category: 'Time & Repeats', element: '<ending>', status: 'Supported', notes: 'Voltas (1., 2. endings)' },
  {
    category: 'Time & Repeats',
    element: '<direction>',
    status: 'Supported',
    notes: 'Jumps (D.C., D.S., To Coda, Fine). Note: mid-measure jumps not supported',
  },
  {
    category: 'Time & Repeats',
    element: '<sound tempo>',
    status: 'Supported',
    notes: 'Note: continuous changes (rit./accel.) not supported',
  },
  { category: 'Time & Repeats', element: '<fermata>', status: 'Unsupported', notes: 'Ignored for playback' },
  { category: 'Dynamics', element: '<dynamics>', status: 'Supported', notes: 'Marks and wedges' },
  {
    category: 'Instruments',
    element: '<midi-instrument>',
    status: 'Supported',
    notes: 'MIDI programs and unpitched percussion',
  },
  {
    category: 'Notes',
    element: '<trill-mark>',
    status: 'Supported',
    notes: 'Play mode: the realisation is played-along, never graded (feature 003)',
  },
  {
    category: 'Notes',
    element: '<mordent>',
    status: 'Supported',
    notes: 'Play mode: the realisation is played-along, never graded (feature 003)',
  },
  {
    category: 'Notes',
    element: '<turn>',
    status: 'Supported',
    notes: 'Play mode: the realisation is played-along, never graded (feature 003)',
  },
  {
    category: 'Notes',
    element: '<tremolo>',
    status: 'Supported',
    notes: 'Play mode: the realisation is played-along, never graded (feature 003)',
  },
  {
    category: 'Notes',
    element: '<arpeggiate>',
    status: 'Supported',
    notes: 'Play mode: the wider arpeggio spread applies instead of the chord spread (feature 003)',
  },
  { category: 'Notes', element: '<glissando>', status: 'Unsupported', notes: 'Reported; ignored for playback' },
  { category: 'Notes', element: '<slide>', status: 'Unsupported', notes: 'Reported; ignored for playback' },
  {
    category: 'Notes',
    element: '<wavy-line>',
    status: 'Ignored',
    notes: 'The trill extension line: engraved by Verovio, ignored by the time model. Common in real scores',
  },
  {
    category: 'Notes',
    element: '<accidental-mark>',
    status: 'Ignored',
    notes: 'The accidental printed over an ornament: engraved by Verovio, ignored by the time model',
  },
  {
    category: 'Harmony',
    element: '<harmony>',
    status: 'Ignored',
    notes: 'Chord symbols above the staff: engraved by Verovio, not played and not graded',
  },
  {
    category: 'Harmony',
    element: '<figured-bass>',
    status: 'Ignored',
    notes: 'Figured-bass numerals: engraved by Verovio, not played and not graded',
  },
  {
    category: 'Credits',
    element: '<creator type="arranger">',
    status: 'Supported',
    notes: 'Not drawn by the engraver; shown in the UI title block instead',
  },
  {
    category: 'Credits',
    element: '<movement-title>',
    status: 'Supported',
    notes: 'Not drawn by the engraver; shown in the UI title block instead',
  },
  {
    category: 'Credits',
    element: '<credit>',
    status: 'Ignored',
    notes: 'Not drawn by the engraver; UI title block used instead',
  },
];

export function generateSupportMatrixMarkdown(): string {
  let md = '| Category | Element | Status | Notes |\n';
  md += '|---|---|---|---|\n';
  for (const entry of SUPPORT_MATRIX) {
    const element = `\`${entry.element}\``;
    const notesStr = entry.notes ? ` ${entry.notes} ` : ' ';
    md += `| ${entry.category} | ${element} | ${entry.status} |${notesStr}|\n`;
  }
  return md;
}
