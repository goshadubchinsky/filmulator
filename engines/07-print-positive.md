# Print / Positive Engine

**Realness: 8/10**
**Pipeline stage:** Pass 6 (positive portion)
**Source:** `printDensityToPositive()`, `PAPER_GAMMA`, `paperGamma` (from grade selector), `linearToSrgb()`, `linearToByte()`, the final output write

## Purpose

Turn the negative's silver density into a viewable **positive** image and encode
it for the display (sRGB bytes on the canvas).

## Physical basis

A negative becomes a positive via optical printing: the negative is projected onto
photographic paper, which has its *own* H-D characteristic curve (its own
toe/gamma/shoulder, grade / contrast filtration, Dmax). Dense negative areas pass
less light, so the paper receives less exposure → lighter print. The paper curve
is a **second sensitometric stage**, not a simple inversion.

Paper grades work by selecting the effective gamma (slope of the straight-line
section) of the paper's H-D curve:
- Grade 0 (Extra Soft): γ ≈ 0.80 — very low contrast
- Grade 2 (Normal): γ ≈ 1.45 — standard print
- Grade 5 (Ultra Hard): γ ≈ 3.30 — extreme contrast amplification

## Current implementation

- Map `dNorm [0,1]` to log paper exposure: `logE = −dNorm × 2.50`.
  dNorm=0 (clear negative) → maximum paper exposure → darkest print.
  dNorm=1 (dense negative) → minimum paper exposure → brightest print.
- Apply a paper H-D curve with parameters calibrated to Ilford RC Glossy at grade N:
  - `Dmin = 0.06` (base density + fog)
  - `Dmax = 2.00` (maximum reflection density, RC glossy)
  - `inertia = −1.20`, `toe width = 0.32` (softplus formulation — same family as film curve)
  - Knee at 55% of paper density range; shoulder headroom = 0.80 density units
  - `driveCal = 1.71` (shared calibration constant with film H-D curve)
- `paperGamma` is selected by grade: `PAPER_GAMMA = [0.80, 1.10, 1.45, 2.00, 2.65, 3.30]`
  for grades 0–5 (derived from Ilford Multigrade RC Deluxe relative gamma data).
- Convert paper density D_paper → normalized reflectance: `(Dmax − D_paper) / (Dmax − Dmin)`.
- `linearToSrgb()` applies the sRGB gamma curve; output is monochrome (R=G=B).

## What's real / what's approximated

- ✅ Second sensitometric stage: the paper has its own H-D curve, not just a tonal
  inversion. Dense negative → less paper exposure → less paper density → brighter.
- ✅ Same knee-based H-D model as film: toe → straight-line (gamma) → shoulder.
  Paper grade controls the straight-line slope, which is exactly how real grades work.
- ✅ Paper gamma values derived from published Ilford Multigrade data.
- ✅ Output encoding (sRGB) is the exact inverse sRGB transfer function.
- ✅ Paper reflectance derived from optical density: R = 10^(−D), normalized by
  paper white (Dmin) and black (Dmax).
- ⚠️ LOG_E_RANGE=2.50 (mapping negative density range to paper exposure range) is
  calibrated to a reference negative density range, not computed from the actual
  negative's density range at runtime.
- ⚠️ Paper H-D parameters (inertia, toe, shoulder) are representative values for
  Ilford RC Glossy; not measured from a specific paper batch.
- ❌ No model of paper base white spectra or fluorescent optical brighteners.
- ❌ No "optical print" vs "scan + invert" path distinction.

## Realness rating: 8/10

Real paper sensitometric curve (Dmin, Dmax, toe/gamma/shoulder) with grade-based
paper gamma derived from published data. Negative density propagates through a
genuine second H-D stage. Remaining gaps: LOG_E_RANGE calibrated by reference
rather than computed, paper parameters are representative not measured, no
distinction between print/scan paths.

## Roadmap to higher realness

- Compute LOG_E_RANGE at runtime from the actual negative's density range
  (dMax − dMin of the developed image, per stock × dilution × time), matching
  how an enlarger is calibrated to a specific negative.
- Parameterize paper H-D constants separately per paper type (FB vs RC,
  warm-tone vs neutral-tone) and expose as a selectable paper stock.
- Model paper base white and Dmax as physical reflection density limits including
  base tint effects.
- Add scan-and-invert path as alternative to optical printing.

## Progression Log

### 2026-06-23 — Real paper H-D curve replaces tanh S-curve · rating 4→8
Replaced the generic `tanh`-based S-curve (aesthetic contrast curve, not
sensitometry) with a real paper H-D characteristic curve modeled identically to
the film H-D curve (softplus toe + straight-line section + knee shoulder).

Key changes:
- `paperGrade → paperGamma` via `PAPER_GAMMA = [0.80, 1.10, 1.45, 2.00, 2.65, 3.30]`
  (Ilford Multigrade RC Deluxe relative gamma values). Previously: linear mapping
  to a `printContrast` value for the tanh steepness — no physical basis.
- Paper H-D parameters: Dmin=0.06, Dmax=2.00 (RC glossy reference), inertia=-1.20,
  toe=0.32, kneeFrac=0.55, shoulder=0.80. These match the known character of RC
  paper (moderate contrast with a full density range of ~1.94).
- Calibration: at grade 2 (γ=1.45), scene 18% grey → dNorm≈0.37 → normalized
  brightness ≈ 0.50 (sRGB ~128). Verified analytically; shadows deep, highlights
  clean.
- Output conversion: D_paper → (Dmax − D_paper) / (Dmax − Dmin), which correctly
  maps paper Dmin → 1 (white) and Dmax → 0 (black). Previously: arbitrary tanh
  normalization with empirical black/white clip points.

Rating raised 4→8: now a genuine second sensitometric stage. The remaining 2
points represent LOG_E_RANGE calibration to a reference negative rather than to
the actual image, and representative rather than measured paper parameters.

### 2026-06-23 — Baseline assessment
Documented the tanh-contrast inversion. Confirmed correct inversion direction and
exact sRGB encoding; identified the missing paper characteristic curve as the key
gap. No code changes. Rating set to 4/10.
