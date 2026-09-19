import '../ui/styles/tokens.css';
import '../ui/styles/layout.css';
import '../ui/styles/score.css';
import '../ui/elements/mx-app.js';
import '../ui/elements/mx-notice-tray.js';
import '../ui/elements/mx-score-view.js';
import { probeEnvironment } from '../engine/environment/probe.js';

async function bootstrap() {
  const env = await probeEnvironment();
  // Future: create adapters (AudioEngine, MidiInput, Stores) based on env capabilities.
  console.log('App bootstrapped in environment:', env);
}

bootstrap().catch(console.error);
