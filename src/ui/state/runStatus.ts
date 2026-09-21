import type { PlayRun } from '../../core/play/types.js';
import type { TransportSnapshot } from '../../core/transport/transport.js';
import type { AppMode, PracticeState } from './practiceState.js';

export type RunStatusPhase = 'idle' | 'countIn' | 'running' | 'paused' | 'finished';
export type DeviceState = 'ok' | 'noMidi' | 'midiLost' | 'audioLost';

/** What the slim bar shows while a run is active (FR-008): derived, never stored (`data-model.md` section 3). */
export interface RunStatus {
  mode: AppMode;
  phase: RunStatusPhase;
  /** The 1-based measure the cursor is on, or null when idle or unknown. */
  measureLabel: string | null;
  deviceState: DeviceState;
  /** A run that can be ended right now (count-in, running or paused). */
  canStop: boolean;
}

export interface RunStatusInputs {
  transport: TransportSnapshot;
  practice: PracticeState;
  run: PlayRun | null;
  /** At least one MIDI keyboard is connected. */
  midiConnected: boolean;
  /** The codes of the notices on screen; device loss is announced as one (`en.notices`). */
  noticeCodes: readonly string[];
  measureIndex: number | null;
}

const AUDIO_LOST = ['playAudioLost', 'audioDeviceChanged'];
const MIDI_LOST = ['midiDeviceLost', 'practiceDeviceLost', 'playMidiLost'];
const MIDI_BACK = ['practiceDeviceBack', 'playMidiBack'];

function phaseOf(inputs: RunStatusInputs): RunStatusPhase {
  const { mode, session } = inputs.practice;
  if (mode === 'play') {
    switch (inputs.run?.phase) {
      case 'countIn':
        return 'countIn';
      case 'running':
        return 'running';
      case 'finished':
      case 'stopped':
      case 'aborted':
        return 'finished';
      default:
        return 'idle';
    }
  }
  if (mode === 'practice') {
    if (!session) return 'idle';
    if (session.phase === 'finished') return 'finished';
    return inputs.transport.phase === 'paused' ? 'paused' : 'running';
  }
  if (inputs.transport.phase === 'playing') return 'running';
  return inputs.transport.phase === 'paused' ? 'paused' : 'idle';
}

function deviceStateOf(inputs: RunStatusInputs): DeviceState {
  const codes = inputs.noticeCodes;
  if (codes.some((code) => AUDIO_LOST.includes(code))) return 'audioLost';
  if (codes.some((code) => MIDI_LOST.includes(code)) && !codes.some((code) => MIDI_BACK.includes(code))) {
    return 'midiLost';
  }
  if (inputs.practice.mode !== 'listen' && !inputs.midiConnected) return 'noMidi';
  return 'ok';
}

export function deriveRunStatus(inputs: RunStatusInputs): RunStatus {
  const phase = phaseOf(inputs);
  return {
    mode: inputs.practice.mode,
    phase,
    measureLabel: phase !== 'idle' && inputs.measureIndex !== null ? String(inputs.measureIndex + 1) : null,
    deviceState: deviceStateOf(inputs),
    canStop: phase === 'countIn' || phase === 'running' || phase === 'paused',
  };
}
