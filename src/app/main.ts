import '../ui/styles/tokens.css';
import '../ui/styles/layout.css';
import '../ui/styles/score.css';
import '../ui/elements/mx-app.js';
import '../ui/elements/mx-notice-tray.js';
import { probeEnvironment } from '../engine/environment/probe.js';
import type { MxEnvironmentPanel } from '../ui/elements/mx-environment-panel.js';

import { createEnvironmentState } from '../ui/state/environmentState.js';
import { Session } from './session.js';

async function bootstrap() {
  const env = await probeEnvironment();
  const envState = createEnvironmentState(env);

  // Future: create audio/MIDI adapters based on env capabilities (US2/US3).
  console.log('App bootstrapped in environment:', env);

  const appElement = document.querySelector('mx-app');
  if (appElement) {
    const envPanel = appElement.querySelector('mx-environment-panel') as MxEnvironmentPanel;
    if (envPanel) {
      envPanel.setEnvironment(envState);
    }
  }

  const session = new Session();
  await session.start();
}

bootstrap().catch(console.error);
