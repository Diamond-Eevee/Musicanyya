import type { Environment } from '../../engine/ports.js';
import { createStore, type Store } from './store.js';

export interface EnvironmentStateData extends Environment {
  isUnknownBridgeMajor: boolean;
}

export type EnvironmentState = Store<EnvironmentStateData>;

export function createEnvironmentState(env: Environment): EnvironmentState {
  let isUnknownBridgeMajor = false;
  if (env.shell.kind === 'electron') {
    const major = env.shell.bridgeVersion.split('.')[0];
    if (major !== '1') {
      isUnknownBridgeMajor = true;
    }
  }

  return createStore({
    ...env,
    isUnknownBridgeMajor,
  });
}
