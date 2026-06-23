# Print / Positive Engine

**Realness: 4/10**
**Pipeline stage:** Pass 6 (positive portion)
**Source:** `printDensityToPositive()`, `dNorm` normalization, `printContrast`, `linearToSrgb()`, `linearToByte()`, the final output write

## Purpose

Turn the negative's silver density into a viewable **positive** image and encode
it for the display (sRGB bytes on the canvas).

## Physical basis

A negative becomes a positive in one of two real ways:

1. **Optical printing:** the negative is projected onto photographic paper, which
   has its *own* H-D characteristic curve (its own toe/gamma/shoulder, grade /
   contrast filtration, Dmax). Dense negative areas pass less light, so the paper
   receives less exposure → lighter print. The paper curve is a second
   sensitometric stage, not a simple inversion.
2. **Scanning + inversion:** the negative is digitized and tone-mapped; the
   scanner/software applies a transfer curve and inversion.

Either way, higher negative density → brighter positive tone, monotonically.

## Current implementation

- Normalize density to `[0,1]` (`dNorm`) using the stock's `dMin/dMax`.
- `printDensityToPositive()`: clip black/white points, apply a `tanh`-based
  S-curve whose steepness is `printContrast`, then a `smoothstep` toe/shoulder.
- `linearToByte()` / `linearToSrgb()` encode to 8-bit sRGB; output is monochrome
  (R=G=B) with the original alpha preserved.

## What's real / what's approximated

- ✅ The inversion direction is correct (higher density → brighter positive,
  monotonic) and the sRGB output encoding is exact.
- ✅ A contrast S-curve with black/white points is a reasonable stand-in for the
  combination of paper grade + scanner tone curve.
- ❌ There is **no paper characteristic curve**: real printing is a second H-D
  stage with its own toe/shoulder/Dmax, paper grades, and dodging/burning
  latitude. A `tanh` is an aesthetic curve, not a sensitometric one.
- ❌ No model of paper base white, max black (reflection density limits), or the
  spectral/contrast-grade interaction of multigrade paper.
- ⚠️ Black/white clip points and the contrast mapping are tuned constants.

## Realness rating: 4/10

Correct direction and correct output encoding, but the heart of printing — a
second characteristic curve belonging to the paper — is replaced by a generic
contrast curve. It produces a believable positive without modeling the print
medium.

## Roadmap to higher realness

- Model an actual paper H-D curve (toe/gamma/shoulder/Dmax) and project negative
  density through it; support paper grades / multigrade contrast.
- Model paper base white and maximum reflection density as real endpoints.
- Optionally split "optical print" vs. "scan + invert" as distinct, selectable
  positive paths, each with its own physics.

## Progression Log

### 2026-06-23 — Baseline assessment
Documented the tanh-contrast inversion. Confirmed correct inversion direction and
exact sRGB encoding; identified the missing paper characteristic curve as the key
gap. No code changes. Rating set to 4/10.
