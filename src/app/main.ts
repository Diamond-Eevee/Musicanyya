import '../ui/styles/tokens.css';
import '../ui/styles/layout.css';
import '../ui/styles/score.css';
import '../ui/elements/mx-app.js';
import '../ui/elements/mx-notice-tray.js';
import { probeEnvironment } from '../engine/environment/probe.js';
import { Session } from './session.js';

async function bootstrap() {
  const env = await probeEnvironment();
  // Future: create audio/MIDI adapters based on env capabilities (US2/US3).
  console.log('App bootstrapped in environment:', env);

  const session = new Session();
  await session.start();
}

bootstrap().catch(console.error);
