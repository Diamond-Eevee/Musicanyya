import { AUDIO_OUTPUT_FALLBACK_MAX_MS } from '../config.js';
import { probeEnvironment } from '../environment/probe.js';
import type { Environment, OutputCapability, OutputChoice, SettingsStore } from '../ports.js';

/**
 * Which sound output the desktop app offers and where the sound goes (feature 021 US5, contracts/audio-setup.md section 3,
 * data-model.md section 5, research R-6). Everything the platform provides arrives through small interfaces, so the rules
 * run in Node against fakes:
 *
 * - **Capability**: only the desktop app, only when the audio context has `setSinkId` and the output devices come with their
 *   names (Chromium shows names once the page may see them: the desktop app allows that, a browser does not without asking for
 *   the microphone). Otherwise the system default is all there is, with the reason.
 * - **Rule**: use the saved device when it is present, else the system default - applied at start-up and on every
 *   `devicechange`. A saved device that is gone gives one lost-output notice per loss; its return switches back silently.
 * - **Timing** (RT review of US5): moving the context to another device changes the output latency and can glitch, so the
 *   moves the musician did not ask for (the start-up apply, the return of a device) wait until nothing is running
 *   (`canSwitch`); a lost device cannot wait and falls back at once. Nothing here waits on the platform without a bound.
 */

/** The output path named for the Shell (FR-026): a pure function of the Shell, the UI maps it to words. */
export type OutputPath = 'windowsShared' | 'macos' | 'linux' | 'browser';

export function outputPath(shell: Environment['shell']): OutputPath {
  if (shell.kind !== 'electron') return 'browser';
  switch (shell.platform) {
    case 'win32':
      return 'windowsShared';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'browser';
  }
}

/** The part of an `AudioContext` this module uses. */
export interface SinkContext {
  setSinkId?: (deviceId: string) => Promise<void>;
}

/** The part of `navigator.mediaDevices` this module uses. */
export interface DeviceSource {
  enumerateDevices(): Promise<ReadonlyArray<{ kind: string; deviceId: string; label: string }>>;
  addEventListener(type: 'devicechange', listener: () => void): void;
  removeEventListener(type: 'devicechange', listener: () => void): void;
}

export interface OutputDevicesDeps {
  /** The Shell is the desktop app (the only place a device can be chosen). */
  desktop: boolean;
  devices: DeviceSource | undefined;
  store: Pick<SettingsStore, 'loadAudioOutput' | 'saveAudioOutput'>;
  /** The chosen output is gone and the sound is on the system default: called once per loss. */
  onFallback: (lostDeviceId: string) => void;
  /** False while a run or a calibration is going: a move to another device then waits (default: always allowed). */
  canSwitch?: () => boolean;
}

/** The browser's own aliases for "the system default" and "the communications default": not devices of their own. */
const ALIAS_IDS: readonly string[] = ['default', 'communications'];

const BROWSER: OutputCapability = { kind: 'systemDefaultOnly', reason: 'browser' };
const NOT_SUPPORTED: OutputCapability = { kind: 'systemDefaultOnly', reason: 'notSupported' };
const SYSTEM_DEFAULT: OutputChoice = { id: '', label: 'System default', available: true };

type DeviceInfo = { kind: string; deviceId: string; label: string };

/** True in the desktop app (the frozen preload bridge says so), false in a browser and in Node. */
export function isDesktopShell(): boolean {
  return probeEnvironment().shell.kind === 'electron';
}

/** A call into the platform that does not answer in time is a failure: the sound stays where it is, and nothing queues
 *  behind it (FR-025 promises the fallback within AUDIO_OUTPUT_FALLBACK_MAX_MS). */
function withinBound<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The platform did not answer in time')),
      AUDIO_OUTPUT_FALLBACK_MAX_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class OutputDevices {
  private context: SinkContext | null = null;
  private capabilityNow: OutputCapability;
  private choices: OutputChoice[] = [];
  private activeId = '';
  private lostNotified = false;
  private listening = false;
  /** The musician's last choice made in this session, kept here too: blocked storage must not undo it. */
  private chosen: { id: string | null } | null = null;
  /** A move to another device is waiting for a run or a calibration to end. */
  private deferred = false;
  private work: Promise<unknown> = Promise.resolve();
  private readonly onDeviceChange = () => {
    void this.refresh();
  };

  constructor(private readonly deps: OutputDevicesDeps) {
    this.capabilityNow = deps.desktop ? NOT_SUPPORTED : BROWSER;
  }

  capability(): OutputCapability {
    return this.capabilityNow;
  }

  /** The system default first, then every output by name; empty when only the system default is possible. */
  list(): readonly OutputChoice[] {
    return this.capabilityNow.kind === 'choosable' ? this.choices : [];
  }

  /** The output in use; '' = the system default. */
  active(): string {
    return this.activeId;
  }

  /** Hands over the audio context: lists the devices, moves the sound to the saved one if it is there, and from now on
   *  follows `devicechange`. Never rejects. */
  async attach(context: SinkContext): Promise<void> {
    this.context = context;
    if (this.deps.desktop && this.deps.devices && !this.listening) {
      this.listening = true;
      this.deps.devices.addEventListener('devicechange', this.onDeviceChange);
    }
    await this.refresh();
  }

  /** Lets go of the context: work still in flight ends quietly, and no device change is followed any more. */
  dispose(): void {
    if (this.listening) this.deps.devices?.removeEventListener('devicechange', this.onDeviceChange);
    this.listening = false;
    this.context = null;
    this.deferred = false;
  }

  /** Reads the devices again and applies the rule. Calls queue up, so a burst of device changes is handled in order. */
  refresh(): Promise<void> {
    return this.enqueue(() => this.doRefresh()).catch(() => undefined);
  }

  /** Applies a move that was waiting for the run or calibration to end, if one is waiting. Never rejects. */
  async resume(): Promise<void> {
    if (this.deferred && this.canSwitch()) await this.refresh();
  }

  /** Moves the sound to a device (null = the system default) and remembers the choice. Rejects, and the sound stays where
   *  it was, when the device cannot be used. */
  setOutput(deviceId: string | null): Promise<void> {
    return this.enqueue(() => this.doSetOutput(deviceId));
  }

  /** Runs one job after the ones before it, so a device change and a choice never overlap. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.work.then(job, job);
    this.work = run.catch(() => undefined);
    return run;
  }

  private canSwitch(): boolean {
    return this.deps.canSwitch?.() ?? true;
  }

  private saved(): string | null {
    return this.chosen ? this.chosen.id : this.deps.store.loadAudioOutput();
  }

  private async doSetOutput(deviceId: string | null): Promise<void> {
    const context = this.context;
    if (this.capabilityNow.kind !== 'choosable' || !context?.setSinkId) {
      throw new Error('The sound output cannot be chosen here');
    }
    const target = deviceId ?? '';
    if (target !== '' && !this.choices.some((choice) => choice.id === target)) {
      throw new Error('That sound output is not available');
    }
    await withinBound(context.setSinkId(target));
    if (this.context !== context) return; // let go of meanwhile
    this.activeId = target;
    this.lostNotified = false;
    this.deferred = false;
    this.chosen = { id: deviceId };
    this.deps.store.saveAudioOutput(deviceId);
  }

  private async doRefresh(): Promise<void> {
    const { desktop, devices } = this.deps;
    if (!desktop) return; // a browser keeps the system default and never looks
    const context = this.context;
    if (!context) return;
    let found: ReadonlyArray<DeviceInfo>;
    try {
      found = devices ? await withinBound(devices.enumerateDevices()) : [];
    } catch {
      // A list that did not come this time changes nothing about what was learnt before
      if (this.capabilityNow.kind !== 'choosable') this.noChoice();
      return;
    }
    if (this.context !== context) return; // let go of meanwhile
    const outputs = found.filter((device) => device.kind === 'audiooutput');
    const labelled = outputs.some((device) => device.label !== '');
    if (!devices || typeof context.setSinkId !== 'function' || !labelled) {
      this.noChoice();
      return;
    }
    this.capabilityNow = { kind: 'choosable' };
    this.choices = [
      SYSTEM_DEFAULT,
      ...outputs
        .filter((device) => !ALIAS_IDS.includes(device.deviceId))
        .map((device) => ({ id: device.deviceId, label: device.label, available: true })),
    ];
    await this.applySaved(context);
  }

  private noChoice(): void {
    this.capabilityNow = NOT_SUPPORTED;
    this.choices = [];
  }

  /** The rule: the saved device when it is present, else the system default. */
  private async applySaved(context: SinkContext): Promise<void> {
    const saved = this.saved();
    if (saved === null) return; // the system default was chosen on purpose: nothing pulls the sound away from it
    if (!this.choices.some((choice) => choice.id === saved)) {
      await this.fallBack(context, saved); // the device is gone: no waiting
      return;
    }
    if (this.activeId === saved) {
      this.lostNotified = false;
      this.deferred = false;
      return;
    }
    if (!this.canSwitch()) {
      this.deferred = true; // not under a run or a calibration: `resume()` moves it when they are over
      return;
    }
    this.deferred = false;
    try {
      await withinBound(context.setSinkId?.(saved) ?? Promise.reject(new Error('no setSinkId')));
      if (this.context !== context) return;
      this.activeId = saved;
      this.lostNotified = false; // it is back (or it is the first start): no notice for that
    } catch {
      if (this.context !== context) return;
      await this.fallBack(context, saved);
    }
  }

  /** The saved device is not usable: the sound is on the system default, and the musician is told once per loss. */
  private async fallBack(context: SinkContext, lostId: string): Promise<void> {
    this.deferred = false;
    if (this.activeId !== '') {
      try {
        await withinBound(context.setSinkId?.('') ?? Promise.reject(new Error('no setSinkId')));
        if (this.context !== context) return;
        this.activeId = '';
      } catch {
        if (this.context !== context) return;
        // The context keeps whatever it had; the notice below still tells the musician the chosen output is not in use
      }
    }
    if (!this.lostNotified) {
      this.lostNotified = true;
      this.deps.onFallback(lostId);
    }
  }
}
