# Optical Transport Engine

**Realness: 5/10**
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
- ❌ The PSF is a **box blur**, which is not a physical point-spread function.
  Real scatter/halation are closer to Gaussian or Lorentzian (long-tailed)
  profiles; a box kernel produces square-ish artifacts and the wrong falloff.
- ❌ `boxBlur2D` is axis-separable with hard-clamped edges — not radially
  symmetric — so halos are subtly square and behave oddly at borders.
- ⚠️ Thresholds, radii, and strengths are hand-tuned, not derived from measured
  MTF or halation data.

## Realness rating: 5/10

Right phenomena, right domain, right ordering — but the kernel shape is the weak
link. Swapping the box PSF for a physically-shaped one would be the single
biggest realness gain here.

## Roadmap to higher realness

- Replace box blur with a separable Gaussian, and model halation with a
  long-tailed (Lorentzian/exponential) kernel for the reflection halo.
- Derive scatter radius from a target MTF curve per stock.
- Model the base-reflection geometry (intensity/spread) rather than a single
  strength scalar; consider wavelength dependence of the halo.

## Progression Log

### 2026-06-23 — Baseline assessment
Documented scatter + halation. Confirmed both are real effects modeled in the
correct (pre-development, linear-exposure) domain. Identified the box-blur PSF
as the primary inaccuracy. No code changes. Rating set to 5/10.
