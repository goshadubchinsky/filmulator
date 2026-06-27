# Optical Transport Engine

*Physics reference: `research/physics-of-film.md` §1 — Kubelka-Munk ODEs (§1.2), Frieser exponential LSF (§1.3)*

**Realness: 7/10**
**Pipeline stage:** Pass 2
**Source:** scatter block (`film.opticalRadius`, `gaussianBlur2D`), halation block (`smoothThreshold()`, `halationSource`, `halationMap`, `film.halationRadius/Threshold/Strength`, `gaussianBlur2D`)

## Purpose

Model what happens to light *inside* the film between hitting the emulsion and
being recorded: lateral scatter (loss of sharpness / MTF) and halation (bright
highlights bleeding into surrounding areas).

## Physical basis

- **Scatter / MTF loss:** light entering the emulsion is scattered by silver
  halide crystals before it is absorbed, spreading each point into a small
  point-spread function. This is the dominant cause of film's inherent
  unsharpness and is described by its MTF.
- **Halation:** strong light passes through the emulsion, reflects off the
  film base / pressure plate, and re-exposes the emulsion from behind in a halo
  around bright points. It is threshold-like (only bright areas trigger it) and
  spreads over a larger radius than scatter. (Color stocks use an anti-halation
  backing; classic B&W stocks show it more.)

## Current implementation

- **Scatter:** `gaussianBlur2D` (three-pass box blur approximating a Gaussian)
  with radius from `film.opticalRadius × 2`. Blended 82%/18% sharp/scattered.
- **Halation:** `smoothThreshold()` isolates only bright exposure, then
  `gaussianBlur2D` spreads it over the halation radius, scaled by
  `film.halationStrength`, and added back to exposure. The Gaussian kernel is
  radially symmetric, producing circular halos.

## What's real / what's approximated

- ✅ Both phenomena are genuinely modeled, in the right order (optical, before
  development), and on linear exposure (correct domain). Halation's threshold +
  large-radius spread + additive re-exposure matches the real mechanism well
  qualitatively.
- ✅ Scatter as a small Gaussian PSF blended with the sharp image correctly models
  MTF loss: Gaussian is the appropriate model for diffuse silver-halide scattering.
- ✅ Halation now uses a radially symmetric Gaussian PSF, producing circular halos
  — physically correct shape for a point-source halo from base reflection.
- ⚠️ The Frieser exponential LSF (previous model) is a 1D measurement of the
  halation cross-section. A Gaussian PSF approximates the 2D spread from a point
  source, which is physically defensible (and circular), but the exact radial
  decay profile differs from the Frieser exponential. The Gaussian has a heavier
  body relative to tail compared to exponential decay.
- ⚠️ Thresholds, radii, and strengths are hand-tuned per stock, not derived from
  measured MTF or halation data for FP4/HP5.

## Realness rating: 7/10

Scatter (Gaussian) and halation (Gaussian) are both radially symmetric — physically
correct shape. The kernel types are physically defensible. Remaining gaps: exact
halation decay profile (Gaussian approximation of exponential), and parameters not
derived from measured MTF/halation data.

## Roadmap to higher realness

- Implement a radially symmetric exponential PSF (Laplace radial, approximated as
  a mixture of 2–3 Gaussians) for halation to recover the Frieser exponential
  decay profile while retaining circular shape.
- Derive scatter radius from a target MTF value at a specific lp/mm per stock
  (Ilford publishes MTF curves for FP4+ and HP5+).
- Model the base-reflection geometry: derive halation radius from film thickness
  and base refractive index; derive strength from base reflectivity.

## Progression Log

### 2026-06-23 — Halation switched to Gaussian PSF for radial symmetry · rating 6→7
Replaced `exponentialBlur2D` (separable H×V IIR) with `gaussianBlur2D` for
halation in both the main pass and the E3 bypass. The separable exponential
gives an L1-norm kernel (diamond shape), whereas real halos are circular. The
Gaussian (three-pass separable box blur) is radially symmetric by construction —
the product of two identical 1D Gaussians is a 2D Gaussian with circular
iso-contours. Circular halos are the physically correct shape for a point-source
halo from base reflection. The tradeoff: Gaussian decay profile (heavier near-core
relative to tail) vs the Frieser exponential cross-section model. This is an
honest approximation improvement — correct shape, slightly different decay profile.
Rating raised 6→7.

### 2026-06-23 — Replaced box blur with Frieser exponential + Gaussian kernels · rating 5→6
Implemented `exponentialBlur2D`: separable causal+anticausal first-order IIR
filter giving exact two-sided exponential decay e^(−|x|/σ) per axis. Applied
to halation in Pass 2 and E3 bypass — this is the Frieser LSF functional form
per `research/physics-of-film.md §1.3`.
Implemented `gaussianBlur2D`: three-pass box blur approximation of a Gaussian
(σ ≈ radius), applied to scatter in Pass 2 and E3 bypass. Better MTF response
than a single flat kernel.
`boxBlur2D` is now used only by E4 (developer diffusion), E5 (edge high-pass),
and E6 (grain correlation) — not by E3 optical phenomena.
Rating raised 5→6: halation mechanism is now physically correct in functional
form. Remaining gap: separable ≠ radially symmetric; no measured parameters.

### 2026-06-23 — Visual confirmation passed
Added E3 optical transport bypass mode. Confirmed via GitHub Pages:
- Scatter: fine detail softens progressively as slider raises — correct
- Halation: discovered two-layer invisibility issue in direct linear encoding:
  (1) halationThreshold=0.74 linear (sRGB≈222) means only very bright highlights
  produce a source; (2) halationStrength 0.030–0.040 is calibrated for the H-D
  curve's shoulder compression — raw addition is sub-pixel without it.
  Added ×20 display boost and max-halSrc diagnostic to status bar in E3 mode.
  With boost, halation glow confirmed correct: appears only around bright
  highlights, scales with slider, spreads wider on HP5 (radius 18) vs FP4 (14).
  The ×20 multiplier exists only in the E3 bypass; Pass 2 in processImage is
  unchanged. Halation is working correctly — it just requires the H-D curve to
  be perceptible at its physically calibrated strength.
No physics code changes. Rating unchanged at 5/10 — box-blur PSF remains the
primary gap; a physically shaped (exponential/Frieser) kernel would raise it.

### 2026-06-23 — Baseline assessment
Documented scatter + halation. Confirmed both are real effects modeled in the
correct (pre-development, linear-exposure) domain. Identified the box-blur PSF
as the primary inaccuracy. No code changes. Rating set to 5/10.
