# Development Engine

**Realness: 7/10**
**Pipeline stage:** Passes 3–4
**Source:** developer-exhaustion block (`silverDemand`, `localDeveloper`), diffusion (`diffusedDeveloper`, `film`/`diffusionRadius`), `adjacencyDev`, `hdDensity()`, the push/pull terms

## Purpose

Convert exposure `H` into developed silver **density** `D` — the core of film
behavior — including the characteristic curve, developer exhaustion, and the
lateral chemical diffusion of developer.

## Physical basis

- **H-D characteristic curve:** density rises with log exposure along a curve
  with a toe (shadows), a straight-line section (gamma/contrast), and a shoulder
  (highlight compression toward Dmax). This is the canonical, measured model of
  film response.
- **Developer exhaustion:** developer is consumed locally in proportion to how
  much silver is being developed. Heavily exposed areas exhaust their developer,
  limiting further density — a self-limiting reaction.
- **Lateral diffusion:** fresh developer diffuses sideways from less-exposed
  regions into exhausted ones. This reservoir/diffusion coupling is exactly the
  mechanism the original Filmulator (Carlson) simulates, and it is the *true*
  origin of adjacency/edge effects.
- **Push/pull:** longer/shorter or hotter/cooler development raises/lowers
  contrast and Dmax and shifts the curve.

## Current implementation

- `silverDemand = 1 − e^(−1.45·H)`; `localDeveloper = e^(−exhaustion·demand)`
  (more demand → more exhausted developer).
- `boxBlur2D` of the developer field models lateral diffusion (`diffusionRadius`).
- `adjacencyDev` mixes local and diffused developer with a small overshoot,
  feeding the curve a spatially-varying developer concentration.
- `hdDensity()` builds density: softplus toe, gamma straight-line, exponential
  shoulder toward Dmax, with `inertia/toe/shoulder/dMax` shifted by push/pull.

## What's real / what's approximated

- ✅ The H-D curve is the real model, with toe/gamma/shoulder all present and a
  physically sensible functional form (softplus toe, exponential saturation).
- ✅ Exhaustion-then-diffusion of developer is the correct chemical mechanism,
  and density is driven by a spatially-varying developer concentration — this is
  the genuine reaction-diffusion idea, not a fake.
- ✅ Push/pull modifies the curve in the right directions.
- ⚠️ It is a **single forward pass**, whereas real development (and the original
  Filmulator) is an **iterative time-stepped reaction-diffusion** that converges.
  The single pass approximates the steady state.
- ⚠️ `boxBlur2D` again stands in for true diffusion (should be Gaussian-like).
- ⚠️ Constants (`1.45`, `1.78`, overshoot `0.65`, push/pull coefficients) are
  tuned, not derived from chemistry or sensitometry.
- 🔗 `adjacencyDev` already produces edge enhancement here; the separate
  Adjacency engine (Pass 5) partly **double-counts** this real effect with a
  synthetic one — see `05-adjacency-edge-effects.md`.

## Realness rating: 7/10

The most physically grounded engine: real characteristic curve plus a real
reaction-diffusion mechanism for development. Held back from higher by the
single-pass (vs. iterative) approximation, the box-blur diffusion kernel, and
tuned constants.

## Roadmap to higher realness

- Make development iterative: time-step developer diffusion + consumption to
  convergence, letting adjacency effects emerge naturally (then retire the
  synthetic Pass 5).
- Use a Gaussian/physical diffusion kernel.
- Calibrate the curve against measured H-D data for each stock; derive exhaustion
  from developer chemistry (agitation, dilution, time, temperature).

## Progression Log

### 2026-06-23 — Baseline assessment
Documented the curve + exhaustion + diffusion model. Confirmed this is the most
real engine and that adjacency effects partly originate here (overlap with Pass
5 noted). Flagged single-pass-vs-iterative and box-blur diffusion as the main
gaps. No code changes. Rating set to 7/10.
