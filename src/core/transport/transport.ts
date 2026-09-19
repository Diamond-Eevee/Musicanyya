import {
  TEMPO_PERCENT_DEFAULT,
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  TEMPO_PERCENT_STEP,
  VOLUME_DEFAULT,
} from '../defaults.js';

export type TransportPhase = 'stopped' | 'loading' | 'playing' | 'paused';
export type TempoPercent = number;
export type Volume = number;

export interface TransportSnapshot {
  phase: TransportPhase;
  startTick: number;
  positionTick: number;
  tempoPercent: TempoPercent;
  volume: Volume;
  follow: boolean;
}

export type TransportAction =
  | { type: 'play'; soundReady: boolean }
  | { type: 'soundReady' }
  | { type: 'soundFailed' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'ended' }
  | { type: 'seekMeasure'; tick: number }
  | { type: 'newScore' }
  | { type: 'tempoPercent'; value: TempoPercent }
  | { type: 'volume'; value: Volume }
  | { type: 'follow'; value: boolean }
  | { type: 'manualScroll' }
  | { type: 'positionTick'; value: number };

export function initialTransport(): TransportSnapshot {
  return {
    phase: 'stopped',
    startTick: 0,
    positionTick: 0,
    tempoPercent: TEMPO_PERCENT_DEFAULT,
    volume: VOLUME_DEFAULT,
    follow: true,
  };
}

export function clampTempoPercent(value: TempoPercent): TempoPercent {
  const stepped = Math.round(value / TEMPO_PERCENT_STEP) * TEMPO_PERCENT_STEP;
  return Math.min(TEMPO_PERCENT_MAX, Math.max(TEMPO_PERCENT_MIN, stepped));
}
export function clampVolume(value: Volume): Volume {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Pure transport state reducer (data-model §5). No I/O, no timers - the audio engine and UI drive it. */
export function transportReducer(state: TransportSnapshot, action: TransportAction): TransportSnapshot {
  switch (action.type) {
    case 'play': {
      if (state.phase === 'stopped') {
        return { ...state, phase: action.soundReady ? 'playing' : 'loading', follow: true };
      }
      if (state.phase === 'paused') {
        return { ...state, phase: 'playing' };
      }
      return state;
    }
    case 'soundReady': {
      if (state.phase === 'loading') return { ...state, phase: 'playing' };
      return state;
    }
    case 'soundFailed': {
      if (state.phase === 'loading') return { ...state, phase: 'stopped', positionTick: state.startTick };
      return state;
    }
    case 'pause': {
      if (state.phase === 'playing') return { ...state, phase: 'paused' };
      return state;
    }
    case 'stop': {
      if (state.phase === 'playing' || state.phase === 'paused') {
        return { ...state, phase: 'stopped', positionTick: state.startTick };
      }
      return state;
    }
    case 'ended': {
      if (state.phase === 'playing') {
        return { ...state, phase: 'stopped', positionTick: state.startTick };
      }
      return state;
    }
    case 'seekMeasure': {
      return { ...state, startTick: action.tick, positionTick: action.tick };
    }
    case 'newScore': {
      return { ...initialTransport(), tempoPercent: state.tempoPercent, volume: state.volume, follow: state.follow };
    }
    case 'tempoPercent': {
      return { ...state, tempoPercent: clampTempoPercent(action.value) };
    }
    case 'volume': {
      return { ...state, volume: clampVolume(action.value) };
    }
    case 'follow': {
      return { ...state, follow: action.value };
    }
    case 'manualScroll': {
      if (state.phase === 'playing') return { ...state, follow: false };
      return state;
    }
    case 'positionTick': {
      return { ...state, positionTick: action.value };
    }
    default:
      return state;
  }
}
