# E1 Reciprocity Design

## Goal

Add exposure duration to E1 so latent-image developability depends on both total photon count and photon arrival rate.

## Model

Keep the current E1/E2 path:

```txt
linear RGB -> FP4 spectral exposure H -> lambda_total
```

Replace direct use of `lambda_total` with an effective value:

```txt
intensity = lambda_total / shutterSeconds
efficiency = lowIntensityEfficiency(intensity) * highIntensityEfficiency(intensity)
lambda_effective = lambda_total * efficiency
developability = grainEnsemblePoisson(lambda_effective)
```

Low-intensity loss uses the Ilford FP4+ measured formula `Ta = Tm^1.26`. High-intensity recombination is intentionally disabled (Ilford states no correction is needed for 1/2 to 1/10000 s).

## UI

Keep `Exposure Bias` as total-exposure control because the uploaded image already carries scene brightness. Add `Shutter Speed` as the time axis:

```txt
Film Speed
Exposure Bias
Shutter Speed
Spectral Sensitivity
```

Default shutter speed is `1/125 s`, where reciprocity correction should be effectively neutral.

## Constraints

- Browser-only, no dependencies.
- Current Poisson grain ensemble remains the short-exposure baseline.
- Right-side linear reference remains EV-only and does not include filter EV or reciprocity.
- The correction function must be pure enough to test from Node by extracting it from `index.html`.

## Verification

- Add a Node test that reads `index.html`, extracts the reciprocity function, and checks:
  - normal exposure remains near neutral;
  - long dim exposure loses efficiency;
  - short-shutter exposure remains neutral (Ilford: no correction for 1/2–1/10000s);
  - combined efficiency stays bounded in `[0,1]`.
