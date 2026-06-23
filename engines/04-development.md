# Development Engine

*Physics reference: `research/physics-of-film.md` §3 — reaction-diffusion PDEs (§3.2), Metol-Hydroquinone kinetics (§3.1), Mackie lines / Eberhard (§3.3)*

**Realness: 9/10**
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

### 2026-06-23 — Recalibrated H-D drive factor for knee-based shoulder
The 1.78 drive factor was calibrated for the old continuously-compressing
exponential shoulder. With the knee-based shoulder (no compression below 42%
dRange), midtones received full gamma gain without counterbalancing compression,
pushing mid-grey from sRGB 118 (BT.709 reference) to 158 — a 40-level jump
that made the full pipeline look "so much more contrasty" than E1.

Reduced driveCal from 1.78 → 1.30. Mid-grey now anchors at ~119 sRGB (matching
BT.709 luminance at the midtone reference), while highlight compression and
shadow depth are preserved through the knee shoulder and print curve.

### 2026-06-23 — Fixed spatial variation: k×C₀ now INCREASES with dilution
Two bugs causing excess contrast and broken compensating effect:

**Bug 1 — devMultiplier (silverNorm).** The old `silverNorm = N/(k·C₀)`
produced values of ~32 at default 1+1 dilution, causing accumulated-silver × norm
to exceed the clamp ceiling (1.15) for every non-shadow pixel. Compensating
effect was dead code — all pixels got max multiplier. Fixed by tracking average
developer concentration over steps (`C_avg/C₀`) instead of accumulated
consumption. Now: if developer was never depleted → multiplier ≈ 1.0; if
depleted to 60% → multiplier ≈ 0.6.

**Bug 2 — H-D curve shoulder.** The `1 − exp(−drive/shoulder)` formulation
compresses density continuously from the origin — there is no true straight-line
region with constant gamma. The 1.78 boost compensated for midtone compression
but over-steepened shadows (effective gamma ~1.0 in shadows, ~0.70 in midtones).
Replaced with a knee-based shoulder: linear (constant gamma) below 42% of dRange,
exponential saturation above it. Removed the 1.78 compensation from the shoulder
(it remains as a toeExposure↔logH calibration factor).

**Film profile adjustments:** FP4 gamma 0.68→0.58, shoulder 1.18→0.85; HP5
gamma 0.56→0.52, shoulder 1.55→1.05. Values now match Ilford's published G
(~0.55–0.60 for FP4, ~0.50–0.55 for HP5) as a true straight-line slope.

### 2026-06-23 — Physics-based dilution model (first-order kinetics + Ilford calibration) · rating 8→9
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

### 2026-06-23 — Physics-based dilution model (first-order kinetics + Ilford calibration) · rating 8→9
Replaced ad-hoc `DILUTION_EXHAUSTION` coefficients (tuned by eye, caused density
collapse at 1+3 and above) with physics-grounded parameters derived from measured
data:

- **Dilution → initial concentration C₀**: activity ∝ (1/(1+parts))^0.42,
  calibrated to Ilford FP4+ D-76/ID-11 data (stock 8.5 min, 1+1 11 min,
  1+3 15 min → all G=0.55). Exponent <1 accounts for Metol-HQ superadditivity
  buffering and diffusion-limited development (Mason §5.3).
- **First-order consumption**: dC/dt = −k·demand·C per step, discretised as
  ΔC = k·demand·C/N. Replaces the old multiplicative `C *= (1−demand·exhaustion)`
  which collapsed to zero at high dilutions.
- **Accumulated silver → density**: track ∫k·demand·C dt over steps, normalize
  by k·C₀, feed normalized multiplier into hdDensity(). Decouples reaction
  progress from final developer concentration — with appropriate dev time,
  all dilutions reach similar density.
- **DEV_STEPS ∝ effectiveDevTime**: more time → more reaction steps (5–14
  range), matching the time-integral nature of real development.
- **Stronger reservoir diffusion**: 70/30 diffused/local blend (was 50/50),
  reflecting measured D_Metol ≈ 1.4×10⁻⁶ cm²/s in swollen gelatin (Iwano 1969,
  Bull Chem Soc Japan 42:2677).
- **k values**: increase modestly with dilution (k×C₀ decreases ~10–20%),
  producing the real compensating effect — slightly lower Dmax at higher
  dilutions, with stronger Mackie line gradients from steeper C transients.

Calibrated against: Mason, *Photographic Processing Chemistry*; Iwano (1969);
Ilford FP4+ technical data sheet. Rating raised 8→9. Remaining gap: box-blur
diffusion kernel (not true Gaussian PDE propagator).

### 2026-06-23 — Baseline assessment
Documented the curve + exhaustion + diffusion model. Confirmed this is the most
real engine and that adjacency effects partly originate here (overlap with Pass
5 noted). Flagged single-pass-vs-iterative and box-blur diffusion as the main
gaps. No code changes. Rating set to 7/10.
