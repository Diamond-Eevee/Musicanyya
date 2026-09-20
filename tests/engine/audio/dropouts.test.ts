import { describe, expect, it } from 'vitest';
import { DropoutDetector } from '../../../src/engine/audio/dropouts.js';

describe('DropoutDetector', () => {
  it('detects dropouts using clock-drift heuristic', () => {
    const detector = new DropoutDetector();

    detector.startPlayback({ contextTime: 0, performanceTime: 1000 });

    // Normal progress
    detector.check({ contextTime: 1, performanceTime: 2000 });
    expect(detector.getDropoutsSincePlay()).toBe(0);

    // Clock drift: context time falls behind performance time by 500ms (threshold is usually around 50-100ms)
    detector.check({ contextTime: 1.5, performanceTime: 3000 });
    expect(detector.getDropoutsSincePlay()).toBeGreaterThanOrEqual(1);
    const dropouts1 = detector.getDropoutsSincePlay();
    expect(detector.getTotalDropouts()).toBe(dropouts1);

    // Normal progress again
    detector.check({ contextTime: 2.5, performanceTime: 4000 });
    expect(detector.getDropoutsSincePlay()).toBe(dropouts1);

    detector.stopPlayback();

    // Start again resets since-play
    detector.startPlayback({ contextTime: 2.5, performanceTime: 5000 });
    expect(detector.getDropoutsSincePlay()).toBe(0);
    expect(detector.getTotalDropouts()).toBe(dropouts1);
  });

  it('does not false positive on normal clock drift (e.g. 5ms)', () => {
    const detector = new DropoutDetector();
    detector.startPlayback({ contextTime: 0, performanceTime: 1000 });

    // 5ms difference should not trigger
    detector.check({ contextTime: 1.0, performanceTime: 2005 });
    expect(detector.getDropoutsSincePlay()).toBe(0);
  });
});
