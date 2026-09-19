import { describe, it, expect, vi, afterEach } from "vitest";
import { probeEnvironment } from "../../src/engine/environment/probe.js";

describe("EnvironmentProbe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects capabilities successfully when globals are present", () => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      musicanyyaShell: undefined // Not in electron
    });
    vi.stubGlobal("AudioWorklet", class {});
    vi.stubGlobal("navigator", {
      requestMIDIAccess: vi.fn(),
      userAgentData: {
        brands: [{ brand: "Chromium", version: "114" }]
      }
    });
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("DecompressionStream", class {});

    const env = probeEnvironment();
    expect(env.shell.kind).toBe("browser");
    expect(env.secureContext).toBe(true);
    expect(env.builtInSound.available).toBe(true);
    expect(env.midiInput.available).toBe(true);
    expect(env.recentScores.available).toBe(true);
    expect(env.compressedFiles.available).toBe(true);
  });

  it("detects absent capabilities", () => {
    vi.stubGlobal("window", {
      isSecureContext: false,
      musicanyyaShell: undefined
    });
    vi.stubGlobal("navigator", {}); // no requestMIDIAccess
    // missing AudioWorklet, indexedDB, DecompressionStream

    const env = probeEnvironment();
    expect(env.secureContext).toBe(false);
    expect(env.builtInSound.available).toBe(false);
    if (!env.builtInSound.available) {
      expect(env.builtInSound.reason).toBe("notSupported");
    }
    
    expect(env.midiInput.available).toBe(false);
    if (!env.midiInput.available) {
      expect(env.midiInput.reason).toBe("notSupported"); // or insecureContext
    }
    
    expect(env.recentScores.available).toBe(false);
    expect(env.compressedFiles.available).toBe(false);
  });

  it("detects electron shell", () => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      musicanyyaShell: {
        appVersion: "1.0.0",
        electronVersion: "30.0.0",
        chromeVersion: "124.0.0",
        platform: "win32",
        bridgeVersion: "1.0.0"
      }
    });

    const env = probeEnvironment();
    expect(env.shell.kind).toBe("electron");
    if (env.shell.kind === "electron") {
      expect(env.shell.appVersion).toBe("1.0.0");
    }
  });
});
