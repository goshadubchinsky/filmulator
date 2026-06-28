# Digitization Backlog

This file tracks source curves/tables that should be digitized before claiming
measured behavior in the simulator. Do not replace these with fitted constants
unless the source data is unavailable and the approximation is clearly labeled.

## E1 Deferral Notes

These items are intentionally deferred from the current E1 implementation:

| Item | Why deferred | Required before implementation |
|---|---|---|
| RAW / scene-linear input | Browser JPEG/PNG input is already rendered, clipped, white-balanced, and tone-mapped. E1 cannot recover true scene radiance from it. | RAW/HDR decode path or explicit scene-linear input format |
| Absolute lux-second λ calibration | Public FP4+ characteristic curves use relative exposure; they do not anchor λ to absolute photon flux. | Absolute sensitometric exposure data or measured calibration target |
| FP4+ grain-size distribution | RMS granularity constrains density-noise variance, not grain radius bins or weights. | High-resolution scan/microscope data, MTF/autocorrelation data, or a measured distribution |
| Hamilton-Bayer latent image | Requires per-grain event-state simulation and heavier compute than the current browser model. | Designed state model, validated constants, likely GPU/WASM path |
| H-D density mapping | Development and density belong to E4; E1 output is developability. | E4 implementation consuming `latentDevelopability` |

## Filters: Kodak Wratten 2 Density Curves

**Goal:** Replace approximate RGB filter multipliers with spectral transmission
curves integrated against the digitized FP4+ spectral sensitivity.

**Sources to digitize:**

| Filter | Source | Target data |
|---|---|---|
| Wratten #8 Yellow / K2 | Kodak Wratten 2 `Basic-Color-Filters-w2-8.pdf` | diffuse density vs wavelength |
| Wratten #15 Deep Yellow | Kodak Wratten 2 curve PDF | diffuse density vs wavelength |
| Wratten #21 Orange | Kodak Wratten 2 `Special-Dye-Color-Filters-W2-21.pdf` | diffuse density vs wavelength |
| Wratten #25 Red | Kodak Wratten 2 `Basic-Color-Filters-W2-25.pdf` | diffuse density vs wavelength |
| Wratten #58 Green | Kodak Wratten 2 `Basic-Color-Filters-W2-58.pdf` | diffuse density vs wavelength |
| Wratten #47 Blue | Kodak Wratten 2 `Basic-Color-Filters-W2-47.pdf` | diffuse density vs wavelength |

**Conversion:**

```txt
transmission(lambda) = 10 ^ -density(lambda)
```

**Implementation target:**

```txt
H = integral(sceneSPD(lambda) * FP4Sensitivity(lambda) * filterTransmission(lambda) dλ)
```

Until a spectral scene reconstruction exists, reduce each filter to RGB proxy
weights by integrating the filter transmission through the same approximate RGB
lobes used for FP4+ reduction.

**Current v1 implementation:** `index.html` uses named Wratten filters and
published B&W filter factors for EV correction. RGB transmission multipliers are
still approximate proxies.

## FP4+ Grain / Granularity Data

**Goal:** Constrain or validate the synthetic 6-class grain-radius distribution.

**Known quantitative value:**

| Data | Value | Source | Limitation |
|---|---:|---|---|
| RMS granularity | 10 | ILFORD FP4 Plus negative motion picture film fact sheet, D-96 5.5 min at 75F | Cine/process-specific; not a grain-size distribution |

**Interpretation guardrails:**

- RMS granularity can constrain density-noise variance after matching aperture
  and density conditions.
- RMS granularity alone cannot determine grain diameter, grain-size
  distribution, clumping, autocorrelation length, or density-dependent texture.
- Do not tighten `GRAIN_CLASSES` solely from the word "exceptionally fine grain."

**Implementation target:**

Use RMS granularity as a validation target for E6 grain/noise after development,
not as a direct replacement for the E1 latent-image grain-size distribution.

## FP4+ Characteristic Curve

**Goal:** Use the datasheet D-logE curve for development/density calibration,
not for E1 photon statistics.

**Source:** ILFORD FP4+ technical sheet, characteristic curve for roll film
developed in ILFORD ILFOTEC HC 1+31 for 8 min at 20C.

**Implementation target:** E4 H-D curve calibration: toe, straight-line gamma,
shoulder, Dmin/Dmax under the stated developer/process conditions.

**Do not use for:** anchoring E1 lambda to absolute lux-second exposure. The
datasheet curve is relative exposure, not an absolute radiometric scale.
