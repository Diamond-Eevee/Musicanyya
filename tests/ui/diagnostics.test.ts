import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-diagnostics.js';
import type { AudioDiagnostics, AudioEngine } from '../../src/engine/ports.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';

/** A fake whose diagnostics() is settable, for the one field FakeAudioEngine hard-codes to 0. */
class ConfigurableFakeAudioEngine extends FakeAudioEngine {
  private overrides: Partial<AudioDiagnostics> = {};
  set(overrides: Partial<AudioDiagnostics>) {
    this.overrides = overrides;
  }
  override diagnostics(): AudioDiagnostics {
    return { ...super.diagnostics(), ...this.overrides };
  }
}

function mount(engine: AudioEngine): HTMLElement {
  const el = document.createElement('mx-diagnostics') as HTMLElement & {
    setEngine: (e: AudioEngine) => void;
    toggle: () => void;
  };
  document.body.appendChild(el);
  el.setEngine(engine);
  el.toggle();
  return el;
}

describe('T057: live input queue drops shown in diagnostics (Constitution I, "counted and shown")', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows zero drops by default', () => {
    const el = mount(new FakeAudioEngine());
    expect(el.textContent).toContain('Live input queue drops');
    const dd = Array.from(el.querySelectorAll('dt')).find(
      (dt) => dt.textContent === 'Live input queue drops',
    )?.nextElementSibling;
    expect(dd?.textContent).toBe('0');
  });

  it('shows the count the engine reports', () => {
    const engine = new ConfigurableFakeAudioEngine();
    engine.set({ liveQueueDropped: 3 });
    const el = mount(engine);

    const dd = Array.from(el.querySelectorAll('dt')).find(
      (dt) => dt.textContent === 'Live input queue drops',
    )?.nextElementSibling;
    expect(dd?.textContent).toBe('3');
  });
});
