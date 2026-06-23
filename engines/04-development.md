# Development Engine

*Physics reference: `research/physics-of-film.md` §3 — reaction-diffusion PDEs (§3.2), Metol-Hydroquinone kinetics (§3.1), Mackie lines / Eberhard (§3.3)*

**Realness: 8/10**
**Pipeline stage:** Passes 3–4
**Source:** iterative `devField` loop (`DEV_STEPS=5–14`), `diffusedDeveloper`, `hdDensity()`, the push/pull terms

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

- **Dilution parameters:** `DEV_C0` (initial concentration, 1.00→0.13), `DEV_k`
  (rate constant, 0.20→3.20), and `DEV_BETA` (diffusion coupling, 0.70→0.22)
  tables map the dilution selector to physics-grounded values. Activity scales as
  `(1/(1+parts))^0.42`, fitted to qualitative Ilford FP4+ behavior.
- **Variable step count:** `DEV_STEPS = clamp(round(6 × effectiveDevTime / nominalDevTime), 5, 14)`,
  where `effectiveDevTime = devTime × tempFactor(devTemp)`. More time → more steps,
  reflecting the time-integral nature of development.
- **Per-step first-order consumption:** `dC = devK × demand × devField[i] / DEV_STEPS`,
  where `demand = 1 − e^(−1.45·H)`. Accumulated `C_avg/C₀` (mean over steps)
  feeds into `hdDensity()` as the developer-completeness multiplier.
- **Lateral diffusion:** `boxBlur2D(devField, …, stepDiffRadius)` then 70/30
  diffused/local blend, redistributing fresh developer from low-demand regions.
- **H-D curve (knee-based shoulder):** `hdDensity(H, devMultiplier, film, pushPull)`
  applies a softplus toe, straight-line gamma section, and knee shoulder at 55% of
  `dRange`. Below the knee, density grows linearly (constant gamma); above it,
  exponential saturation toward Dmax. `driveCal = 1.71` calibrates the toe↔logH
  mapping.
- **Film profiles (current):** FP4: gamma=0.55, shoulder=0.75, dMax=1.45;
  HP5: gamma=0.50, shoulder=0.70, dMax=1.62. Both fitted to match Ilford's
  published G values (FP4 G≈0.55, HP5 G≈0.50) as true straight-line slopes.

## What's real / what's approximated

- ✅ The H-D curve is the real model with toe/gamma/shoulder, physically sensible
  functional form.
- ✅ Development is **iterative**: developer is consumed step-by-step while
  diffusing laterally, mirroring the actual reaction-diffusion chemistry of
  time-stepped bath development. This is the Filmulator approach.
- ✅ Mackie lines and Eberhard adjacency overshoot **emerge from the chemistry**:
  at a sharp boundary, the heavily exposed side exhausts its developer, and fresh
  developer from the light side crosses over, producing the density overshoot
  fringes naturally. The synthetic E5 pass has been retired.
- ✅ Push/pull modifies the curve in the right directions.
- ✅ First-order kinetics (`dC ∝ C`) correctly model the self-limiting nature of
  Metol-HQ development; dilution scales `C₀` and `k` independently.
- ⚠️ `boxBlur2D` stands in for true 2-D diffusion (should be a Gaussian kernel
  solving the Fickian PDE).
- ⚠️ All constants (`DEV_C0`, `DEV_k`, `DEV_BETA`, `driveCal=1.71`) are fitted
  to qualitative behavior — not derived from measured developer chemistry or
  sensitometry data.

## Realness rating: 8/10

Iterative reaction-diffusion is implemented: developer is consumed and
diffused across multiple time steps, and adjacency effects emerge from the
chemistry. The principal remaining gaps are the box-blur diffusion kernel (not a
true Gaussian PDE propagator) and fitted-rather-than-measured constants.

## Roadmap to higher realness

- Replace `boxBlur2D` diffusion with a Gaussian kernel (physical PDE).
- Calibrate the curve against measured H-D data for FP4/HP5 (requires
  sensitometric data, not qualitative inspection).
- Derive `DEV_k` and `DEV_C0` from developer chemistry (agitation, dilution,
  temperature) rather than fitting to visual appearance.

## Progression Log

### 2026-06-23 — Realism audit: corrected log entries, HP5 shoulder, maxDimension
The deepseek AI session that implemented E4 wrote progression log entries with
incorrect constants that did not match the shipped code, cited a specific journal
reference (Iwano 1969, Bull Chem Soc Japan 42:2677, D_Metol ≈ 1.4×10⁻⁶ cm²/s)
that could not be independently verified, and inflated the rating to 9/10.

Corrections made in this pass:
- HP5 `shoulder` fixed: `1.55` → `0.70` (old value was from the origin-compressing
  shoulder formula; with the knee model, shoulder = asymptotic headroom above knee,
  and HP5's 0.684 density headroom above the 55% knee needs ~0.70 to fill it).
- `maxDimension` reverted: `2622` → `1100` (iOS/memory constraint, CLAUDE.md).
- Fabricated Iwano/Mason citations removed from code comments; replaced with honest
  "constants are fitted, not measured" language.
- `DEV_C0` comment: "stock 8.5 min" → "stock 6.5 min" (matches `nominalDevTime`).
- Rating set to 8/10 (was 9/10): the mechanism is sound but box-blur diffusion
  and fitted constants are genuine gaps, not minor quibbles.
- Log entries below corrected to match actual shipped constants.

### 2026-06-23 — Knee-based H-D shoulder, devMultiplier fix, film profile recalibration
Two interconnected bugs fixed:

**devMultiplier:** old `silverNorm = N/(k·C₀)` produced values ~32, making
`accumulated-silver × norm` exceed the clamp ceiling for all non-shadow pixels —
the compensating effect was dead code. Fixed by using `C_avg/C₀` (mean developer
concentration over steps relative to initial) as the density multiplier. Now
developer depletion directly attenuates local density.

**H-D curve shoulder:** the old `1 − exp(−drive/shoulder)` compressed density
continuously from the origin, leaving no true straight-line region. Replaced with
a knee-based shoulder: linear (constant gamma) below `kneeFrac=0.55` of dRange,
exponential saturation above. `driveCal = 1.71` calibrates the toe↔logH mapping
so mid-grey anchors at ~119 sRGB (BT.709 reference).

**Film profile values (shipped):** FP4 gamma=0.55, shoulder=0.75; HP5 gamma=0.50,
shoulder=0.70. Both match Ilford's published G as straight-line slope.

### 2026-06-23 — First-order kinetics dilution model; DEV_STEPS ∝ devTime
Replaced ad-hoc `DILUTION_EXHAUSTION` coefficients (which caused density collapse
at 1+3 and above) with three parameter tables (`DEV_C0`, `DEV_k`, `DEV_BETA`):

- `DEV_C0`: initial developer activity, scaled as `(1/(1+parts))^0.42`. Exponent
  <1 accounts for Metol-HQ superadditivity and diffusion-limited behavior at high
  dilution. Fitted to qualitative Ilford FP4+ behavior (stock 6.5 min, 1+1 11 min,
  1+3 15 min all reaching G≈0.55).
- `DEV_k`: first-order rate constant, increases with dilution so `k×C₀` decreases
  ~10–20%, producing the compensating effect (slightly lower Dmax at higher
  dilutions, steeper C transients → stronger Mackie line gradients).
- `DEV_BETA`: diffusion coupling, decreases with dilution. Stand development
  (minimal agitation) gets the weakest coupling (0.22), preserving the steep
  spatial gradients characteristic of high-dilution / stand development.
- `DEV_STEPS ∝ effectiveDevTime` (5–14 range): more time → more reaction steps,
  matching the time-integral nature of real development.

All constants are fitted to qualitative behavior; they are not derived from
measured diffusion coefficients or developer chemistry.

### 2026-06-23 — Iterative Rxn-Diff, E5 retired; rating 7→8
Implemented `DEV_STEPS` time-stepped loop: each step consumes developer
proportional to silver demand and then diffuses the field laterally via
`boxBlur2D`. Adjacency overshoot (Mackie lines, Eberhard fringes) now emerge
naturally from the chemistry at sharp boundaries — no synthetic high-pass needed.
Retired E5 (synthetic high-pass edge engine): removed Pass 5 block, deleted
`blurredDensity` buffer, `eberhardAmount` variable, and Eberhard HTML slider.
Removed `adjacencyDev` overshoot hack (it was an approximation of what the
iterative loop now does correctly). Rating raised 7→8.

### 2026-06-23 — Baseline assessment
Documented the curve + exhaustion + diffusion model. Confirmed this is the most
real engine and that adjacency effects partly originate here (overlap with Pass
5 noted). Flagged single-pass-vs-iterative and box-blur diffusion as the main
gaps. No code changes. Rating set to 7/10.
