# Input / Scene-Linear Engine

*Physics reference: `research/physics-of-film.md` §1.1 — Radiative Transfer and the requirement for scene-linear spectral input; §2 — Gurney-Mott latent image formation (requires accurate photon flux)*

**Realness: 4/10**
**Pipeline stage:** before Pass 1
**Source:** `upload` change handler, `buildLinearSourceBuffers()`, `srgbToLinear()`, the `maxDimension` downscale

## Purpose

Turn an uploaded image file into the scene-linear light buffers (`linearR/G/B`,
`Float32Array`) that the rest of the pipeline integrates as if it were the
radiance falling on the film plane.

## Physical basis

Real film is exposed by scene radiance — a continuous spectral light field,
linear in intensity, with effectively unbounded dynamic range. The "input" to
a real exposure is the actual photons arriving through the lens.

## Current implementation

- Decodes the uploaded image via the browser, draws it to a canvas, reads back
  8-bit sRGB pixels.
- Downscales so the longest edge is ≤ 1100 px (performance guard).
- `srgbToLinear()` applies the exact inverse sRGB transfer function per channel
  to recover linear values in `[0,1]`.

## What's real / what's approximated

- ✅ The sRGB → linear transfer function is the correct, exact piecewise curve.
  Working in linear light is the right foundation for everything downstream.
- ❌ The input is an already-processed 8-bit JPEG/PNG: it has been demosaiced,
  white-balanced, tone-mapped, gamut-mapped, sharpened, and clipped by a camera
  or editor. Treating that as scene radiance bakes in another imaging system's
  choices before film ever sees the light.
- ❌ Dynamic range is capped at the [0,1] sRGB container. Real film responds far
  into the highlights; clipped JPEG highlights cannot drive halation or shoulder
  compression realistically.
- ❌ No spectral information survives — only three integrated channels (this
  limitation is inherited by the Spectral engine).

## Realness rating: 4/10

The math it performs is exact, but the premise — a finished sRGB image standing
in for scene radiance — is the single biggest physical compromise in the whole
project. It earns more than a low score only because linearization is done
correctly and honestly.

## Roadmap to higher realness

- Accept RAW / scene-linear input (e.g. via a decoder) to start from true sensor
  radiance instead of a rendered image.
- Carry a higher dynamic range internally (already `Float32`, but the input is
  the bottleneck) so highlights can exceed 1.0 and drive halation/shoulder.
- Optional inverse-tone-curve estimation to partially undo a JPEG's rendering.

## Progression Log

### 2026-06-23 — Visual confirmation passed
Added E1 identity bypass mode (`sRGB → linear → BT.709 luma → sRGB`, no film
processing). Uploaded a photo via GitHub Pages live build and confirmed output
is a correct desaturated (luminance-weighted B&W) version of the source.
Round-trip linearisation is working. Rating unchanged at 4/10 — the math is
correct; the 4/10 ceiling is the processed-JPEG-as-radiance premise, not a bug.

### 2026-06-23 — Baseline assessment
Documented the engine as-is. Linearization confirmed correct. Identified the
processed-JPEG-as-radiance premise and the [0,1] dynamic-range cap as the main
barriers to realness. No code changes. Rating set to 4/10.
