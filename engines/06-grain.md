# Grain Engine

**Realness: 3/10**
**Pipeline stage:** Pass 6 (grain portion)
**Source:** `hashNoise()`, `grainField`, `grainBlurred`, `grainRadius`, density-linked amplitude block (`midDensity`, `positiveShadowWeight`, `highlightSuppress`, `film.grain`/`grainAmount`)

## Purpose

Add film grain — the visible noise texture of developed film.

## Physical basis

Grain is the actual physical microstructure of the image: discrete silver-halide
crystals that develop **stochastically** to opaque metallic silver. An exposed
crystal either develops fully or not, so grain is a binary, spatially-random
process whose visible variance depends on crystal size/distribution and on local
density. It is most visible in the midtones and is *structure*, not an overlay —
the image is literally made of grains.

## Current implementation

- `hashNoise()` generates per-pixel pseudo-random values.
- A small box blur (`grainRadius`) gives spatial correlation / clumping.
- Amplitude is modulated by local density (`midDensity` peaks in midtones),
  weighted toward shadows (`positiveShadowWeight`) and suppressed in highlights
  (`highlightSuppress`), then added to the positive tone.

## What's real / what's approximated

- ✅ Density-linkage is physically motivated: grain variance genuinely depends on
  local density, peaks in the midtones, and the modulation here captures that
  qualitatively.
- ✅ Spatial correlation (clumping) acknowledges that grain isn't pure per-pixel
  white noise.
- ❌ The core is **additive procedural noise**, not a model of discrete crystals
  developing. There is no crystal size distribution, no binary develop/not-develop
  statistics, no Poisson/Monte-Carlo behavior — it imitates the texture rather
  than generating it from grain physics.
- ❌ Applied to the **positive** tone after printing, so it is a post-effect
  overlay rather than structure carried through development and printing.
- ❌ Box-blur correlation is axis-aligned and not a real grain morphology;
  resolution-dependent (a fixed pixel radius isn't a fixed physical grain size).

## Realness rating: 3/10

The density-dependence is right, but grain is fundamentally a structural,
stochastic phenomenon and this is an additive texture approximation. It looks
plausible without modeling the cause.

## Roadmap to higher realness

- Model grain as developed crystals: a crystal-size distribution sampled
  spatially, each developing with probability tied to local exposure/density
  (Poisson / Monte-Carlo), producing variance from first principles.
- Carry grain as part of the density/development stage so it propagates through
  printing, instead of overlaying it on the final positive.
- Tie grain size to a physical scale (µm → px from image resolution) so it stays
  consistent across image sizes.

## Progression Log

### 2026-06-23 — Baseline assessment
Documented the additive density-linked noise model. Credited the (correct)
density-dependence; flagged that it's a texture overlay on the positive rather
than a stochastic crystal model carried through development. No code changes.
Rating set to 3/10.
