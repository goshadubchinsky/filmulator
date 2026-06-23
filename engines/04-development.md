# Development Engine

*Physics reference: `research/physics-of-film.md` §3 — reaction-diffusion PDEs (§3.2), Metol-Hydroquinone kinetics (§3.1), Mackie lines / Eberhard (§3.3)*

**Realness: 8/10**
**Pipeline stage:** Passes 3–4
**Source:** iterative `devField` loop (`DEV_STEPS=6`), `diffusedDeveloper`, `hdDensity()`, the push/pull terms

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

- Development runs in `DEV_STEPS = 6` time steps. Each step:
  - Per-pixel consumption: `devField[i] -= devField[i] × (demand/N) × exhaustion`,
    where `demand = 1 − e^(−1.45·H)` and minimum developer is clamped to 0.02.
  - Lateral diffusion: `boxBlur2D(devField, …, stepDiffRadius)` then 50/50 mix
    of local and diffused, redistributing fresh developer from low-demand regions.
- After the loop, `hdDensity(H, devField[i], film, pushPull)` maps exposure +
  final developer concentration to density via softplus toe, gamma straight-line,
  exponential shoulder.

## What's real / what's approximated

- ✅ The H-D curve is the real model with toe/gamma/shoulder, physically sensible
  functional form.
- ✅ Development is now **iterative**: developer is consumed step-by-step while
  diffusing laterally, mirroring the actual reaction-diffusion chemistry of
  time-stepped bath development. This is the Filmulator approach.
- ✅ Mackie lines and Eberhard adjacency overshoot **emerge from the chemistry**:
  at a sharp boundary, the heavily exposed side exhausts its developer, and fresh
  developer from the light side crosses over, producing the density overshoot
  fringes naturally. The synthetic E5 pass has been retired.
- ✅ Push/pull modifies the curve in the right directions.
- ⚠️ `boxBlur2D` stands in for true 2-D diffusion (should be Gaussian-like).
- ⚠️ Constants (`1.45`, `DEV_STEPS=6`, step diffusion mix 0.5, push/pull
  coefficients) are tuned, not derived from developer chemistry or sensitometry.

## Realness rating: 8/10

Iterative reaction-diffusion is now implemented: developer is consumed and
diffused across multiple time steps, and adjacency effects emerge from the
chemistry. The principal remaining gap is the box-blur diffusion kernel (not a
true Gaussian PDE propagator) and tuned constants.

## Roadmap to higher realness

- Replace `boxBlur2D` diffusion with a Gaussian kernel (physical PDE).
- Calibrate the curve against measured H-D data for FP4/HP5.
- Derive exhaustion rates from developer chemistry (agitation, dilution, time,
  temperature); link `DEV_STEPS` to real development time.

## Progression Log

### 2026-06-23 — Replaced single-pass with iterative reaction-diffusion · rating 7→8
Implemented `DEV_STEPS = 6` time-stepped loop: each step consumes developer
proportional to silver demand (`demand/N × exhaustion`) and then diffuses the
field laterally via `boxBlur2D` with a per-step radius
(`diffusionRadius / √DEV_STEPS`), blending 50/50 local + diffused. Adjacency
overshoot (Mackie lines, Eberhard fringes) now emerge naturally from the
chemistry at sharp boundaries — no synthetic high-pass needed.
Retired E5 (synthetic high-pass edge engine): removed Pass 5 block, deleted
`blurredDensity` buffer, `eberhardAmount` variable, and Eberhard HTML slider.
Removed `adjacencyDev` overshoot hack (it was an approximation of what the
iterative loop now does correctly). Rating raised 7→8.

### 2026-06-23 — Baseline assessment
Documented the curve + exhaustion + diffusion model. Confirmed this is the most
real engine and that adjacency effects partly originate here (overlap with Pass
5 noted). Flagged single-pass-vs-iterative and box-blur diffusion as the main
gaps. No code changes. Rating set to 7/10.
