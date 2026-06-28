# Input / Latent Image Engine

*Physics reference: `research/physics-of-film.md` §1.1 — Radiative Transfer and the requirement for scene-linear input; §2 — Gurney-Mott latent image formation (photon statistics, Ag₄ threshold, Poisson model)*

**Realness: 5/10**
**Pipeline stage:** before Pass 1
**Source:** `upload` change handler, `buildLinearSourceBuffers()`, `srgbToLinear()`, `reciprocityEfficiency()`, `gurneyMottDevelopability()`, the `maxDimension` downscale

## Purpose

Turn an uploaded image file into scene-linear light buffers (`linearR/G/B`,
`Float32Array`), then convert photon flux into a **latent image** — a per-pixel
developability probability. This is what development (E4) acts on: not raw light,
but the probability that a grain at each location is developable.

## Physical basis

Real film is exposed by scene radiance — a continuous spectral light field,
linear in intensity. Photons strike silver halide (AgX) grains suspended in
gelatin. Within each grain, the Gurney-Mott process (§2) converts photon
absorption into stable silver clusters:

1. Photon absorption excites an electron into the conduction band (e⁻ + h⁺)
2. The electron is trapped at a sensitivity speck (Ag₂S impurity)
3. An interstitial silver ion (Agᵢ⁺) arrives → forms Ag⁰
4. A single Ag⁰ is unstable (~1 s lifetime, 0.69 eV dissociation)
5. A second photon before decay creates Ag₂ (stable, 1.74 eV)
6. The process repeats until ≥4 atoms (Ag₄): **thermodynamically developable**

The model we use is the **Poisson upper-tail approximation**: photon arrivals
are treated as a Poisson process with mean λ ∝ scene radiance, and a grain
becomes developable if it receives ≥4 photons. This gives:

$$\text{P(developable | λ)} = 1 - e^{-\lambda} \sum_{i=0}^{3} \frac{\lambda^i}{i!}$$

This is a natural sigmoid: at low λ, developability is suppressed (the Poisson
probability of ≥4 arrivals is low); at moderate λ (~4), probability climbs
through the Ag₄ threshold region; at high λ (≫4), probability saturates at 1.

**Important:** this is a **statistical simplification** of Gurney-Mott. It
models the counting-statistics consequence of needing 4 discrete events, plus
the FP4+ published long-exposure reciprocity correction. It does not model
per-event trap occupation, sensitivity-speck geometry, or a Hamilton-Bayer state
machine. That's one useful piece of the real physics, not the whole thing.

## Current implementation

- Decodes the uploaded image via the browser, draws it to a canvas, reads back
  8-bit sRGB pixels.
- Downscales so the longest edge is ≤ 2622 px (performance guard).
- `srgbToLinear()` applies the exact inverse sRGB transfer function per channel
  to recover linear values in `[0,1]`.
- E2 spectral sensitivity is now wired: per-channel panchromatic weights
  (default FP4+: r=0.35, g=0.37, b=0.28, rounded from digitized Ilford FP4+
  spectral data), optical filter multipliers, and
  illuminant white balance (5500K reference) mix linear RGB into a single
  panchromatic exposure H before the Poisson step.
- A shutter-speed control supplies exposure duration. `reciprocityEfficiency()`
  uses the Ilford FP4+ formula `Ta = Tm^1.26` to derive a low-intensity
  efficiency term for exposures longer than 1/2 s. High-intensity recombination
  is intentionally disabled (Ilford states no reciprocity correction is needed
  for 1/2 to 1/10000 s).
- `ensembleDevelopability(λ_ref)` computes the weighted average over 6 grain
  classes (log-normal radius, σ≈0.6): `Σ w_i × P(Poisson(λ_ref × r_i²) ≥ 4)`.
  Large grains lift the toe; small grains extend the shoulder.
- A precomputed LUT (8192 entries, λ∈[0,100]) avoids expensive per-pixel `Math.exp`
  calls — critical for iOS Safari home-screen (no JIT).
- Output is stored in a persistent `latentDevelopability` Float32Array (E4 input).
  Canvas display gamma-encodes from this buffer — separate compute from display.

## Current E1 status

E1 is complete for the current browser-friendly FP4+ latent-image scope:

`sRGB upload → linear RGB → FP4+ panchromatic exposure → ISO-calibrated λ →
per-grain FP4+ reciprocity → Poisson Ag₄ developability → latentDevelopability`.

The UI version for this frozen scope is `v1.0.0-e1-fp4-latent`.

The remaining items below are intentionally deferred because they require source
data or infrastructure that is not present in the current app.

## What's real / what's approximated

- ✅ The sRGB → linear transfer function is the correct, exact piecewise curve.
- ✅ The Poisson CDF with Ag₄ threshold models the counting-statistics origin
  of the characteristic curve's toe and shoulder — the sigmoid shape emerges
  from "need ≥4 discrete events from a Poisson process," not from an aesthetic
  function. At low λ, P(N≥4) ≈ λ⁴/24 (quartic toe); at high λ, P → 1 (soft
  saturation).
- ⚠️ This is NOT a full Gurney-Mott simulation. It does not model time-dependent
  trap occupation or sensitivity-speck geometry. It now includes a simplified
  intensity/time efficiency term, but not a Hamilton-Bayer event-state model.
- ✅ Low-intensity reciprocity failure uses the Ilford FP4+ measured formula
  `Ta = Tm^1.26`: for exposures longer than 1/2 s, efficiency drops as
  `η = (T/0.5)^(-0.26)`. At 10s η=0.46, at 100s η=0.25.
- ⚠️ High-intensity reciprocity is intentionally disabled — Ilford states no
  correction is needed for 1/2 to 1/10000 s. The structure is in place for
  future data.
- ⚠️ The sensitivity scale is derived from ISO film speed:
  `sensitivity = (4 / 0.18) × (ISO / 125)`. This anchors FP4+ box speed
  (ISO 125) at the Ag₄ threshold for 18% gray. It is a single-scalar proxy;
  real sensitivity depends on grain size distribution, crystal morphology, and
  sensitization chemistry.
- ✅ Grain size distribution: 6-class log-normal ensemble (σ≈0.6) — each class
  has relative sensitivity ∝ r²; the weighted average softens the toe (large
  grains lift it) and extends the shoulder (small grains keep climbing).
- ⚠️ The grain classes use fixed weights approximating a log-normal; real
  emulsions have continuous distributions tuned per film stock.
- ❌ The input is an already-processed 8-bit JPEG/PNG: it has been demosaiced,
  white-balanced, tone-mapped, and clipped. Treating it as scene radiance bakes
  in another imaging system's choices.
- ❌ Dynamic range is capped at the [0,1] sRGB container. Real scene radiance is
  unbounded; clipped JPEG highlights saturate the latent image prematurely.

## Realness rating: 5/10

The Poisson counting-statistics model and grain size distribution are real physics,
replacing the old linear-gain-plus-hard-clip with a physically motivated sigmoid.
The FP4+ spectral weights are now derived from digitized Ilford spectral data, and
E1.1 adds a first-order reciprocity-efficiency term for low-intensity Ag0
decay (Ilford FP4+ measured). High-intensity recombination is intentionally
disabled (Ilford states no reciprocity correction is needed for 1/2 to
1/10000 s). The rating is still capped by fundamental limitations: the input
is a processed JPEG (not scene radiance), the grain classes are synthetic
rather than fitted from FP4+ RMS/grain-size data, and the high-intensity
reciprocity regime is not constrained by measurement. The Poisson CDF plus
low-intensity reciprocity correction is a scientific approximation, not a
Hamilton-Bayer simulation.

Held back by: JPEG-as-radiance premise, synthetic grain classes, missing
trap-occupation state dynamics, lack of absolute radiometric calibration, and no
radiative transfer (Kubelka-Munk / Frieser LSF belong to E3, not E1).

## Deferred E1 work

- **RAW / scene-linear input:** deferred because the browser currently receives
  rendered sRGB images. JPEG/PNG data has already been demosaiced,
  white-balanced, tone-mapped, and clipped, so it cannot supply true scene
  radiance or clipped highlight headroom. A RAW/HDR path is an input
  infrastructure project, not a latent-image formula tweak.
- **Absolute lux-second calibration:** deferred because the public FP4+
  characteristic curve is relative D-logE data, not an absolute radiometric
  exposure scale. The current λ scale is intentionally ISO-relative.
- **Measured FP4+ grain-size distribution:** deferred because the public RMS
  granularity value constrains density-noise variance under a measurement
  aperture; it does not determine grain radii, weights, clumping, or
  autocorrelation. Track available data and limits in
  `docs/digitization-backlog.md`.
- **Hamilton-Bayer event simulation:** deferred because it requires per-grain
  event-state dynamics (electron trapping, ion arrival, Ag0 decay, recombination)
  and a much heavier compute model. The current analytical Poisson +
  reciprocity model is the intended browser-friendly approximation.
- **Spectral Wratten filter integration:** deferred to E2/filter work. E1
  already consumes panchromatic exposure `H`; replacing RGB filter proxies with
  digitized Wratten transmission curves belongs in the spectral mixing step.
- **Downstream development/density mapping:** deferred to E4. E1 outputs
  developability only; it must not apply an H-D density curve or development
  contrast.

## Progression Log

### 2026-06-28 — E1.1 reciprocity efficiency · rating 4→5

**What changed:** Added shutter speed and reciprocity efficiency. Low-intensity
term uses the Ilford FP4+ measured formula `Ta = Tm^1.26`: efficiency drops as
`η = (T/0.5)^(-0.26)` for exposures longer than 1/2 s. High-intensity
recombination intentionally disabled (Ilford: no correction needed for 1/2 to
1/10000 s). Applied per grain class.

**Why it matters:** Equal total exposure no longer always produces equal latent
developability. A 30s metered exposure at the same total λ as 1/125s yields
~34% efficiency — reciprocity failure directly from Ilford's published data.

### 2026-06-27 — Grain size distribution (log-normal ensemble) + LUT · rating unchanged at 4

**What changed:** Replaced the single representative grain with a 6-class
log-normal grain radius distribution (σ≈0.6). Each class i has relative
sensitivity ∝ r_i²; the ensemble developability is the weighted average:

`P = Σ w_i × P(Poisson(λ_ref × r_i²) ≥ 4)`

Large grains (r > 1) lift the toe by firing at lower λ. Small grains (r < 1)
extend the shoulder by continuing to climb after large grains saturate.

**Performance:** Added a precomputed LUT (8192 entries, λ=[0,100]) to avoid
~41M Math.exp calls on worst-case frames — critical for iOS Safari home-screen
where there is no JIT.

**Calibration:** FP4+ box speed (ISO 125) anchors the median grain at 18% gray → λ=4. Other ISOs scale proportionally.
The ensemble P at this point is ~44% (small grains drag the average below the
single-grain 57%).

### 2026-06-27 — Poisson Ag₄ counting-statistics model replaces linear-gain exposure · rating unchanged at 4

**What changed:** Replaced the `clamp(luma × 2^EV, 0, 1)` exposure model with
a Poisson cumulative distribution function: `P = 1 - e^(-λ) · Σ(i=0..3) λ^i/i!`.
This models the statistical consequence of the Gurney-Mott requirement that a
grain needs ≥4 silver atoms to become developable.

**New pipeline:** `sRGB → linear → BT.709 luma → λ = sensitivity × luma × 2^EV →
gurneyMottDevelopability(λ, n=4) → developability [0,1]`

**What this captures:** The Poisson counting-statistics origin of the
characteristic curve's sigmoid shape. Shadow toe: at low λ, P(N≥4) ≈ λ⁴/24
(quartic, not linear — the probability of 4 rare events is very small).
Highlight shoulder: at high λ, P → 1 (all grains saturated). The shape is
emergent from "need 4 discrete events," not from an aesthetic curve fit.

**What this does NOT capture:** Time-dependent trap occupation, thermal decay
of Ag⁰, electron-hole recombination, sensitivity speck geometry, exposure
duration (and therefore true Schwarzschild reciprocity failure). These require
tracking per-grain state over time, not just total photon count.

**Limitations:** sensitivity is now derived from ISO film speed rather than
hardcoded. BT.709 luminance collapse is temporary (E2 spectral weights will
replace it). Gamma-encoding of the output is for E1-only display (E4 will
consume linear developability from the persistent `latentDevelopability` buffer).

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
