export type EngravingMode = 'library' | 'opened';

export interface ElementInsert {
  offset: number;
  text: string;
  order: number;
}

export interface EngravingFinding {
  kind: 'missingBeam' | 'missingAccidental' | 'missingCourtesy';
  part: number;
  measureLabel: string;
  staff: number;
  voice: string;
  pitch?: string;
}

export interface EngravingPlan {
  inserts: ElementInsert[];
  beamGroupsAdded: number;
  accidentalsAdded: { required: number; courtesy: number };
  findings: EngravingFinding[];
  invalidBeams: Array<{ part: number; measureLabel: string; voice: string }>;
  contradictions: Array<{ part: number; measureLabel: string; staff: number; pitch: string }>;
}
