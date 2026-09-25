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
  {
    category: 'Notes',
    element: '<slur>',
    status: 'Ignored',
    notes: 'Engraved by Verovio; not used by playback or grading',
  },
  {
    category: 'Notes',
    element: '<tuplet>',
    status: 'Supported',
    notes: 'The bracket and number are engraved by Verovio; the timing comes from `<time-modification>`',
  },
  {
    category: 'Directions',
    element: '<octave-shift>',
    status: 'Supported',
    notes:
      '8va/8vb lines engraved by Verovio and used when completing accidentals; also read into the Score (staff, span, octaves) so Practice prints a pressed key where that note would be (feature 008); `<pitch>` is the sounding pitch, so playback and grading are unaffected',
  },
  {
    category: 'Attributes',
    element: '<clef>',
    status: 'Supported',
    notes:
      'Engraved by Verovio; also read into the Score (sign, line, octave change, per staff and position) so Practice shows a pressed key on the staff at the right place (feature 008). Percussion, TAB and other non-pitched clefs are reported and no key is drawn on that staff',
  },
  {
    category: 'Attributes',
    element: '<key>',
    status: 'Supported',
    notes:
      'Engraved by Verovio and used when completing accidentals; also read (fifths, mode, per staff or all staves) so Practice spells a pressed key against the key signature (feature 008). A non-traditional key (no fifths element) shows a sign on every pressed key',
  },
  {
    category: 'Directions',
    element: '<pedal>',
    status: 'Ignored',
    notes: 'Engraved by Verovio; the sustain is not played (library items say so in their limitations)',
  },
  {
    category: 'Credits',
    element: '<rights>',
    status: 'Ignored',
    notes: 'Kept in the file for attribution; not shown',
  },
  {
    category: 'Credits',
    element: '<source>',
    status: 'Ignored',
    notes: 'Kept in the file for attribution; not shown',
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
