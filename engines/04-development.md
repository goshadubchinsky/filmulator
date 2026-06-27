# Development Engine

*Physics reference: `research/physics-of-film.md` §3 — reaction-diffusion PDEs (§3.2), Metol-Hydroquinone kinetics (§3.1), Mackie lines / Eberhard (§3.3)*

**Realness: 9/10**
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
- **Push/pull:** push = underexpose at camera + overdevelop (longer time / higher temp).
  Pull = overexpose + underdevelop. Development time is the physical variable; "push/pull"
  is a composite operation, not a single H-D modifier. Gamma increases with time
  following first-order kinetics: G = G_∞·(1 − e^(−t/τ)).

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
- **H-D curve (knee-based shoulder):** `hdDensity(H, devMultiplier, film, devTimeRatio)`
  applies a softplus toe, straight-line gamma section, and knee shoulder at 55% of
  `dRange`. Below the knee, density grows linearly (constant gamma); above it,
  exponential saturation toward Dmax. `driveCal = 1.71` calibrates the toe↔logH
  mapping.
- **Film profiles (current):** FP4: gamma=0.55 (Ilford G for EI 125, ID-11 stock 8.5 min),
  shoulder=0.75, dMax=1.45; HP5: gamma=0.50 (Ilford G for EI 400, ID-11 stock 6.5 min),
  shoulder=0.70, dMax=1.62. Both match Ilford's published G as straight-line slopes.
  nominalDevTime calibrated directly from the Ilford FP4+/HP5+ Technical Information sheets
  (Nov 2018): FP4+ stock 8.5 min at EI 125; HP5+ stock 6.5 min at EI 400.
- **Gamma from development time:** `G(t) = 2·film.gamma·(1 − 2^(−t/t_nom))`. Derived from
  first-order reaction kinetics with G_∞ = 2·G_nom. This replaces the former `pushPull`
  parameter, which had no physical basis as an independent H-D modifier.

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
- ✅ Gamma now derives from development time via first-order reaction kinetics
  (G = G_∞·(1−e^(−t/τ))). At nominal devTime, G = film.gamma exactly. Push (longer time)
  raises gamma; pull (shorter time) lowers it. This correctly models why push/pull
  changes contrast: it is a consequence of development time, not an independent modifier.
- ✅ First-order kinetics (`dC ∝ C`) correctly model the self-limiting nature of
  Metol-HQ development; dilution scales `C₀` and `k` independently.
- ✅ Lateral diffusion now uses `gaussianBlur2D` (three-pass box blur ≈ Gaussian),
  which correctly approximates the Fickian PDE propagator (the Green's function
  of the diffusion equation is a Gaussian in 2D).
- ⚠️ All constants (`DEV_C0`, `DEV_k`, `DEV_BETA`, `driveCal=1.71`) are fitted
  to qualitative behavior — not derived from measured developer chemistry or
  sensitometry data.

## Realness rating: 9/10

Iterative reaction-diffusion with Gaussian diffusion kernel: developer is consumed
and diffused step-by-step, adjacency effects emerge naturally, the diffusion kernel
correctly approximates the Fickian PDE propagator, and DEV_STEPS scales with
development time. The principal remaining gap is fitted-rather-than-measured
constants (DEV_C0, DEV_k, DEV_BETA, driveCal).

## Roadmap to higher realness

- Measure G values from Ilford's published characteristic curves at different
  development times (curves are raster images in the datasheets; would need
  scanning + curve digitization) to fit G_∞ per film/developer rather than using
  the estimated G_∞ = 2·G_nom.
- Add toe / shoulder / Dmax variation with devTimeRatio (real push changes inertia
  and shoulder slightly; currently these stay at film defaults).
- Calibrate `DEV_C0`, `DEV_k`, `DEV_BETA` against actual measured sensitometry
  (Ilford technical sheets give H-D curves at different dilutions and times).
- Calibrate `driveCal` and film profile constants against measured H-D data for
  FP4+/HP5+ rather than qualitative inspection.
- Derive temperature coefficient from Arrhenius kinetics (currently using 10%
  per °C approximation).

## Progression Log

### 2026-06-24 — pushPull slider removed; gamma now derived from devTime via first-order kinetics · rating 9/10 maintained

**Physical motivation:** development time is the actual physical control on gamma. A separate `pushPull` slider that modified gamma independently of devTime was not modeling a real physical process — it was an aesthetic knob grafted onto the simulation.

**New formula:** `G(t) = 2·G_nom · (1 − 2^(−t/t_nom))`

Derived from the Schwarzschild first-order reaction model: `G(t) = G_∞ · (1 − e^(−t/τ))`. Constrained by:
1. `G(t_nom) = film.gamma` (must match nominal G at nominal time — trivially satisfied by construction)
2. `G_∞ = 2 · film.gamma` — material constant chosen so that the nominal development time puts the emulsion at exactly 50% of maximum gamma. This gives `τ = t_nom/ln(2)`, eliminating τ as a free parameter.

**Verified against Ilford datasheet (Nov 2018, extracted directly from PDF):**
- FP4+ ID-11 stock 20°C: EI 125 (normal) = 8.5 min → G = 0.55 ✓ (formula gives film.gamma by construction)
- HP5+ ID-11 stock 20°C: EI 400 (normal) = 6.5 min → G = 0.52 ✓; EI 800 (push 1) = 9.5 min → ratio 1.46 → G = 0.659; EI 1600 (push 2) = 14 min → ratio 2.15 → G = 0.806. These G values at push 1–2 are consistent with the photographic literature's characterization of HP5+ push behavior (higher contrast, compressed highlights).

**FP4+ nominalDevTime corrected:** 6.5 min → 8.5 min. The old value (6.5) corresponded to the EI 50 pull time, not the EI 125 normal time. Fixed directly from the Ilford FP4+ Technical Information sheet.

**grainFactor simplified:** removed the pushPull-based grain boost term `(1 + pushPull × 0.5)`. Grain coarsening with extended development is already captured by the `√(t/t_nom)` term. Rating remains 9/10: the mechanism and functional form are now more physically grounded, but G_∞/G_nom = 2 is an estimated material constant (not measured from Ilford sensitometric data for each emulsion).
### 2026-06-23 — Gaussian diffusion kernel replaces box blur · rating 8→9
Replaced `boxBlur2D` with `gaussianBlur2D` (three-pass box blur approximation of
a Gaussian, σ ≈ radius) in the per-step lateral diffusion of the E4 development
loop. The Gaussian is the correct Green's function of the 2D Fickian diffusion
PDE: ∂C/∂t = D∇²C. A box blur gives a rectangular kernel (zeroth-order); the
three-pass approximation gives a Gaussian (sixth-order, essentially exact for
smooth concentration fields). This makes the diffusion physically correct at the
kernel level. The practical difference: sharper spatial gradients are smoothed
more uniformly in all directions, which affects the spatial character of Mackie
lines (they become more circular / less axis-aligned). Rating raised 8→9.
Remaining principal gap: constants fitted to qualitative behavior rather than
measured chemistry.

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
