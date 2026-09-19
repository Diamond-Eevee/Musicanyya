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
