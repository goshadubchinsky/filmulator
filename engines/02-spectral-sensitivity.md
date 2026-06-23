# Spectral Sensitivity Engine

*Physics reference: `research/physics-of-film.md` §4.1 — spectral domain dye formation and spectrophotometry (colour extension); §2 — latent image formation and Gurney-Mott mechanism*

**Realness: 5/10**
**Pipeline stage:** Pass 1
**Source:** `effectiveSpectralWeights()`, `FILM_PROFILES[*].weights`, `FILTERS`, `filmBalanceMultipliers()`, `kelvinToLinearWhite()`, `kelvinToSrgbWhite()`, `describeFilmBalance()`, the `exposureMultiplier`/EV terms

## Purpose

Convert scene-linear RGB into a single panchromatic exposure value `H` per pixel
— the amount of light the monochrome emulsion "sees" — folding in the film's
spectral response, the illuminant/white-balance, optical filters, and camera
exposure.

## Physical basis

A real panchromatic B&W emulsion has a spectral sensitivity curve `S(λ)` across
the visible spectrum. The exposure at a point is the integral of the scene's
spectral power distribution times `S(λ)` times any filter transmission `T(λ)`:
`H = ∫ E(λ)·T(λ)·S(λ) dλ`. Color contrast filters (yellow/red/green…) work
exactly because they reshape `T(λ)` before this integral — a red filter darkens
blue sky because it cuts the blue the emulsion would otherwise record.

## Current implementation

- Each film stock has fixed `{r,g,b}` weights approximating its sensitivity.
- `filmBalanceMultipliers()` derives per-channel gains from a Kelvin slider by
  comparing a target white (from `kelvinToSrgbWhite()`, a Tanner Helland
  blackbody approximation) to a 5500 K reference, then luminance-normalizing.
- `FILTERS` give each optical filter per-channel multipliers plus an EV cost.
- `effectiveSpectralWeights()` multiplies base weights × WB × filter, then
  normalizes the three weights to sum to 1.
- Pass 1 dots the linear RGB with these weights and applies the exposure
  multiplier (camera EV + filter EV) to produce `H`.

## What's real / what's approximated

- ✅ Structurally correct: spectral response, illuminant, and filter all combine
  multiplicatively before a weighted integration into exposure — the right shape
  of the physics. Filters reshaping tonal translation (not final color) is
  faithful to how contrast filters actually behave.
- ✅ Kelvin → white point uses a recognized blackbody approximation.
- ⚠️ The continuous `∫…dλ` is collapsed to a 3-sample dot product. With RGB
  input this is unavoidable, but it cannot reproduce metameric effects or sharp
  spectral features (e.g. a deep red filter on a narrow-band source).
- ❌ Weights are "physically inspired," not measured sensitometry. Filter
  multipliers and EV costs are hand-tuned approximations of real filter factors.
- ⚠️ Normalizing weights to sum to 1 keeps exposure stable but is a convenience,
  not a physical constraint.

## Realness rating: 5/10

The architecture mirrors the real exposure integral and the qualitative behavior
of filters and white balance is correct. It's held back by the unavoidable
3-sample spectral reduction and by constants that are tuned rather than measured.

## Roadmap to higher realness

- Replace 3 weights with sampled `S(λ)` curves and reconstruct an approximate
  scene SPD from RGB, integrating over wavelength bins.
- Use measured spectral sensitivity data for FP4/HP5 instead of guessed weights.
- Model real filter transmission curves and derive EV factors from them.
- Use measured/standard illuminant SPDs (D50/D65/Tungsten) rather than a pure
  blackbody approximation.

## Progression Log

### 2026-06-23 — Baseline assessment
Documented current weight-based spectral model. Confirmed the
multiply-then-integrate structure is physically shaped. Flagged the 3-sample
reduction and tuned (non-measured) constants as the main limits. No code
changes. Rating set to 5/10.
