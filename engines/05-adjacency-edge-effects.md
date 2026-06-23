# Adjacency / Edge Effects Engine

**Realness: 3/10**
**Pipeline stage:** Pass 5
**Source:** `blurredDensity`, `edgeRadius`, `edgeGain` (`film.eberhard`, `eberhardAmount`), the high-pass add, `smoothstep()` edge mask

## Purpose

Produce Eberhard / Mackie-line edge effects: the bright/dark fringes that appear
along high-contrast boundaries on developed film.

## Physical basis

Edge effects are **not a separate process** — they are an emergent consequence
of developer diffusion (the Development engine). At a sharp light/dark boundary,
exhausted developer on the dense side and fresh developer diffusing from the
light side create overshoot: extra density just inside the dark edge (Mackie
line) and reduced density just inside the light edge (Eberhard effect). They
fall out of the reaction-diffusion chemistry for free.

## Current implementation

- Box-blur the density map, take the high-pass `density − blurredDensity`.
- Gate it with a `smoothstep` magnitude mask (only act on real edges).
- Add it back scaled by `edgeGain` (`film.eberhard × eberhardAmount`, nudged by
  push), clamped to `[dMin, dMax]`.

This is, mechanically, an unsharp-mask / high-pass sharpen in the density domain.

## What's real / what's approximated

- ✅ The *target* phenomenon is real and important, it operates in the correct
  (density) domain, and the edge-gated high-pass does qualitatively reproduce
  over/undershoot at boundaries.
- ❌ The **mechanism is fake**: real edge effects emerge from developer
  diffusion, but here they are synthesized by a generic sharpening filter. It
  imitates the look without modeling the cause — exactly the kind of shortcut
  this project's philosophy aims to avoid.
- 🔗 It **double-counts** with the Development engine, which already generates
  adjacency overshoot via `adjacencyDev`. Two mechanisms (one real, one
  synthetic) drive the same effect, making both hard to calibrate.
- ❌ Box-blur high-pass produces square-ish, axis-aligned fringes rather than the
  smooth radial profile of real Mackie lines.

## Realness rating: 3/10

A real and recognizable effect achieved by an unphysical mechanism that
duplicates work the Development engine should own. Low score by design: this is
the clearest "looks-like" rather than "is" engine.

## Roadmap to higher realness

- **Retire this engine** once the Development engine is iterative: let edge
  effects emerge from real developer diffusion + exhaustion, and delete the
  synthetic high-pass (removing the double-count).
- If kept as a stopgap, at least derive its radius/gain from the same diffusion
  parameters as development so the two are consistent, and use a physical kernel.

## Progression Log

### 2026-06-23 — Baseline assessment
Documented the high-pass implementation. Identified it as a synthetic stand-in
for an effect that should emerge from developer diffusion, and noted the
double-count with the Development engine's `adjacencyDev`. Marked for eventual
removal in favor of iterative development. No code changes. Rating set to 3/10.
