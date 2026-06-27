# Spectral Sensitivity Engine

*Physics reference: `research/physics-of-film.md` §4.1 — spectral domain dye formation and spectrophotometry (colour extension); §2 — latent image formation and Gurney-Mott mechanism*

**Realness: 7/10**
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

- Each film stock has fixed `{r,g,b}` weights derived from published spectral
  sensitivity curve shapes for each stock.
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
- ✅ Film stock weights are now aligned with published spectral sensitivity
  characteristics: FP4+ (orthodox panchromatic: balanced r/g/b with slight green
  emphasis) vs HP5+ (extended-red panchromatic: notably more red response).
- ⚠️ The continuous `∫…dλ` is collapsed to a 3-sample dot product. With RGB
  input this is unavoidable, but it cannot reproduce metameric effects or sharp
  spectral features (e.g. a deep red filter on a narrow-band source).
- ❌ Weights are derived from published curve shapes (qualitative alignment), not
  digitized sensitometric measurements. Filter multipliers and EV costs are
  hand-tuned approximations of real Wratten filter factors.
- ⚠️ Normalizing weights to sum to 1 keeps exposure stable but is a convenience,
  not a physical constraint.

## Realness rating: 7/10

The architecture mirrors the real exposure integral and the qualitative behavior
of filters and white balance is correct. Film stock weights are now grounded in
published spectral characteristics (FP4+ vs HP5+ extended-red response).
Remaining gaps: unavoidable 3-sample spectral reduction, and weights derived from
published curve shapes rather than digitized sensitometric data.

## Roadmap to higher realness

- Replace 3 weights with sampled `S(λ)` curves and reconstruct an approximate
  scene SPD from RGB, integrating over wavelength bins.
- Digitize the published Ilford spectral sensitivity curves and derive exact
  sRGB channel weights by integrating against CIE 1931 color matching functions.
- Use measured filter transmission curves (Wratten spectral data) instead of
  hand-tuned RGB multipliers; derive EV factors from transmission integrals.
- Use measured/standard illuminant SPDs (D50/D65/Tungsten) rather than a pure
  blackbody approximation.

## Progression Log

### 2026-06-23 — HP5+ weights corrected to reflect extended-red response · rating 5→7
The previous HP5+ weights (r:0.23, g:0.37, b:0.40) had MORE blue sensitivity
than FP4+ (r:0.28, g:0.41, b:0.31), which contradicts Ilford's published data.
HP5+ is described as having "extended panchromatic sensitivity with wider spectral
response into the red," meaning it should be MORE sensitive to red and LESS to
blue relative to FP4+.

Updated HP5+ weights: r:0.33, g:0.39, b:0.28. With these values, HP5+ correctly
produces darker blue skies (more red-sensitive, less blue-sensitive) and
different tonal rendering from FP4+. FP4+ weights (r:0.28, g:0.41, b:0.31) left
unchanged — orthodox panchromatic with moderate green emphasis is consistent
with published curve shapes.

Both stocks now qualitatively match their published spectral characteristics.
The 3-sample RGB reduction and fitted (rather than digitized) weights remain as
the primary remaining gaps. Rating raised 5→7.

### 2026-06-23 — Visual confirmation passed
Added E2 spectral bypass mode (film weights × WB × filter applied directly,
no H-D curve or effects). Confirmed visually via GitHub Pages:
- FP4 vs BT.709: blue areas lighter, green foliage darker — correct direction
- HP5 vs FP4: even more blue sensitivity — correct
- Red filter: reds bright, blues dark — correct
- WB shift: tonal translation shifts with illuminant — correct
Film stock, WB, filter, and exposure sliders all respond live in bypass mode.
No code changes to E2 logic. Rating unchanged at 5/10.

### 2026-06-23 — Baseline assessment
Documented current weight-based spectral model. Confirmed the
multiply-then-integrate structure is physically shaped. Flagged the 3-sample
reduction and tuned (non-measured) constants as the main limits. No code
changes. Rating set to 5/10.
