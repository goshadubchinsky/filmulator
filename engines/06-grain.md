# Grain Engine

*Physics reference: `research/physics-of-film.md` §5 — Nutting's Law (§5.1), Boolean stochastic grain model / Newson et al. (§5.2)*

**Realness: 6/10**
**Pipeline stage:** Pass 6 (grain portion)
**Source:** `hashNoise()`, `grainField`, `grainBlurred`, `grainRadius`, Selwyn-Nutting amplitude block (`selwynAmp`, `clumpyNoise`, `grainBase`), applied to `dNorm` before `printDensityToPositive()`

## Purpose

Add film grain — the visible noise texture of developed film.

## Physical basis

Grain is the actual physical microstructure of the image: discrete silver-halide
crystals that develop **stochastically** to opaque metallic silver. An exposed
crystal either develops fully or not, so grain is a binary, spatially-random
process whose visible variance depends on crystal size/distribution and on local
density. The variance peaks in the midtones and vanishes at clear base (no
developed crystals) and at maximum density (all crystals developed, no variance).
Grain is *structure in the negative*, not an overlay — the image is literally
made of grains — and it propagates through printing, since dense grain areas of
the negative produce slightly different paper exposures.

The Selwyn-Nutting law describes grain statistics:
`σ(D) ∝ √(D · (1 − D/Dmax))` — RMS density fluctuation peaks at mid-density.

## Current implementation

- `hashNoise()` generates per-pixel pseudo-random values.
- `gaussianBlur2D` with `grainRadius` gives spatial correlation / clumping, with
  a physically more natural Gaussian (rotationally symmetric) morphology vs the
  old box-blur cluster shape.
- Amplitude is modulated by the **Selwyn-Nutting formula** applied in the negative
  density domain: `selwynAmp = √(dNorm · (1 − dNorm · 0.85))`. Peaks in midtones,
  vanishes at base and maximum density.
- Grain is added to **negative density** (`dNorm`) before `printDensityToPositive()`,
  so it propagates through the paper H-D curve — denser grain → slight local paper
  exposure variation → print density variation. This is the correct physical order.

## What's real / what's approximated

- ✅ Grain applied to **negative density domain** before printing — correct physical
  order; grain is structure in the negative, not a post-process overlay.
- ✅ Selwyn-Nutting amplitude formula: variance ∝ D·(1 − D/Dmax) — correct
  statistical model for silver halide grain variance vs density.
- ✅ Gaussian spatial correlation: rotationally symmetric cluster morphology,
  more physically natural than an axis-aligned box blur.
- ✅ Grain amplitude scales with grainFactor (dev time / stock dev time), reflecting
  that longer or pushed development coarsens grain.
- ❌ Per-pixel hash noise, not a stochastic crystal model. There is no crystal size
  distribution, no binary develop/not-develop statistics, no Poisson point process
  — it models the statistics of grain without modeling individual grains.
- ❌ Grain resolution is pixel-dependent. A fixed `grainRadius` in pixels does not
  correspond to a fixed physical grain size across different image resolutions
  (it should be proportional to image resolution in px/mm).
- ❌ The variance amplitude scaling (`2.4 × grainBase × selwynAmp`) is empirically
  tuned, not derived from the Selwyn granularity coefficient G for FP4/HP5.

## Realness rating: 6/10

Grain is now applied in the correct physical domain (negative density before
printing), uses the Selwyn-Nutting variance formula, and has rotationally symmetric
spatial correlation. The remaining gap is that the core is procedural noise rather
than a stochastic crystal model, and amplitude constants are empirically tuned.

## Roadmap to higher realness

- Model grain as developed crystals: a crystal-size distribution sampled
  spatially, each developing with probability tied to local exposure/density
  (Poisson / Monte-Carlo), producing variance from first principles.
- Derive the amplitude scalar from the published Selwyn granularity coefficient G
  for FP4+ (G ≈ 10, ISO 10804) and HP5+ (G ≈ 20).
- Tie grain radius to a physical scale (µm → px from image resolution ÷ px/mm
  at the target print magnification) so grain size is consistent across image sizes.

## Progression Log

### 2026-06-23 — Grain moved to density domain; Selwyn amplitude; Gaussian blur · rating 3→6
Three simultaneous improvements:

1. **Density domain**: grain is now added to `dNorm` (normalized negative density)
   before `printDensityToPositive()`. Previously grain was added to the final
   positive tone after printing — physically wrong since grain is structure in the
   negative. Now grain density variation propagates through the paper H-D curve,
   exactly as it does in a real print.

2. **Selwyn-Nutting amplitude**: amplitude now uses
   `selwynAmp = √(dNorm · (1 − dNorm · 0.85))` — peaks in midtones, zero at
   clear base and at maximum density. Previously used a shadow-weighted midtone
   mask tuned to the positive tone. The new formula is the correct statistical
   model (Selwyn-Nutting law for silver halide granularity).

3. **Gaussian correlation blur**: replaced `boxBlur2D` with `gaussianBlur2D` for
   grain spatial correlation. Gaussian blur is rotationally symmetric; box blur
   produces square-ish, axis-aligned cluster shapes that don't match real grain
   morphology. Rating raised 3→6.

### 2026-06-23 — Baseline assessment
Documented the additive density-linked noise model. Credited the (correct)
density-dependence; flagged that it's a texture overlay on the positive rather
than a stochastic crystal model carried through development. No code changes.
Rating set to 3/10.
