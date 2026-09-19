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
  { category: 'Notes', element: '<grace>', status: 'Supported', notes: 'Acciaccatura and appoggiatura' },
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
