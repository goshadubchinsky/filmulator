# Optical Transport Engine

*Physics reference: `research/physics-of-film.md` §1 — Kubelka-Munk ODEs (§1.2), Frieser exponential LSF (§1.3)*

**Realness: 6/10**
**Pipeline stage:** Pass 2
**Source:** scatter block (`film.opticalRadius`, `opticalScatter`, `scatterMix`), halation block (`smoothThreshold()`, `halationSource`, `halationMap`, `film.halationRadius/Threshold/Strength`), `boxBlur2D()`

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

- **Scatter:** box-blur the raw exposure with a radius from `opticalRadius ×
  opticalScatter`, then blend a fraction (`scatterMix`, capped) back into the
  sharp signal.
- **Halation:** `smoothThreshold()` isolates only bright exposure, box-blur it
  over a larger radius, scale by `halationStrength`, and add back to exposure.

## What's real / what's approximated

- ✅ Both phenomena are genuinely modeled, in the right order (optical, before
  development), and on linear exposure (correct domain). Halation's threshold +
  large-radius spread + additive re-exposure matches the real mechanism well
  qualitatively.
- ✅ Scatter as a small PSF blended with the sharp image is the right idea for
  MTF loss.
- ✅ Halation now uses a separable IIR exponential kernel (`exponentialBlur2D`),
  implementing the Frieser LSF: E(x) = a·exp(b·x). This is the correct
  functional form for halation falloff, not a visual guess.
- ✅ Scatter now uses a three-pass box blur approximating a Gaussian
  (`gaussianBlur2D`), which better represents the MTF-limiting PSF of
  silver-halide scatter than a single flat box.
- ⚠️ The IIR exponential is separable (horizontal × vertical), not radially
  symmetric. True radial exponential decay would require a full 2-D convolution
  or a radially-symmetric IIR — halos are still subtly diamond-shaped.
- ⚠️ Thresholds, radii, and strengths are hand-tuned, not derived from measured
  MTF or halation data for FP4/HP5.

## Realness rating: 6/10

Halation now implements the Frieser exponential LSF — the correct physics, not
a visual shortcut. Scatter is improved to Gaussian. Remaining gap: separable
kernels are not radially symmetric, and parameters are tuned rather than
measured.

## Roadmap to higher realness

- Replace box blur with a separable Gaussian, and model halation with a
  long-tailed (Lorentzian/exponential) kernel for the reflection halo.
- Derive scatter radius from a target MTF curve per stock.
- Model the base-reflection geometry (intensity/spread) rather than a single
  strength scalar; consider wavelength dependence of the halo.

## Progression Log

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
