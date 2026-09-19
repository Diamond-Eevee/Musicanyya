# ADR-0004: Electron packaging with electron-builder

- **Status**: Accepted
- **Date**: 2026-09-19
- **Deciders**: project owner ("go with the one that has the best opinions and keeps up to date")
- **Amends**: ADR-0001 (desktop shell row), constitution v1.1.0

## Context

The Electron app must be packaged for Windows first, and for macOS and Linux as well, bundling the web build and the
Native audio plugin binary for each OS (ADR-0003). The two maintained options are Electron Forge (the official
Electron tool) and electron-builder.

## Decision

Use **electron-builder** (MIT; 26.x, released 2026-06; about 4.2 million weekly npm downloads vs. about 1.1 million
for `@electron-forge/cli`).

- Covers every target we need from one config: Windows NSIS installer (plus MSI/portable), macOS dmg/zip with code
  signing and notarization, Linux AppImage, deb and rpm (snap/flatpak possible).
- `extraResources` per platform ships the right `musicanyya-audio` binary with each build.
- Auto-update through `electron-updater` when we need it.
- The renderer is the normal Vite web build; the main and preload scripts are also built with Vite (exact setup in
  the Electron feature's plan).

## Alternatives considered

| Option | Verdict |
|---|---|
| Electron Forge (official, 7.11, released 2026-05) | Recommended by the Electron docs and well maintained, but its default Windows maker is Squirrel.Windows (users often dislike its install behaviour), Linux formats are fewer, and its Vite integration has been marked experimental. Good second choice |
| Hand-made packaging scripts | Rejected: signing, notarization and installers are exactly what these tools are for |

## Consequences

- One dev dependency (`electron-builder`); `electron` itself is pinned to a supported major version and updated
  regularly for security fixes.
- Code-signing certificates (Windows, Apple Developer ID) are needed for public releases; unsigned builds are fine
  for development.
