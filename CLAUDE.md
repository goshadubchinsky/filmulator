# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Research

`research/physics-of-film.md` — comprehensive physics reference (optical transport, latent image formation, reaction-diffusion kinetics, stochastic grain). Read it before touching any engine. Includes the formulas and references the open-source simulators that model each phenomenon correctly.

## Core Design Philosophy

This project simulates film photography. The goal is not to make images *look like* film through visual tricks or aesthetic approximations — it is to model what film actually does, physically and chemically, step by step. Individual calculations may be simplified or approximated for browser performance, but every approximation must be grounded in the real phenomenon it represents, and the output must look genuinely real, not stylized.

When adding or changing anything: ask what the physical process actually is, model that, then simplify only if necessary. Do not add parameters or effects that are purely aesthetic knobs with no physical basis.

## Project Overview

**JS Filmulator POC** — a browser-based black-and-white film simulation tool. The entire application lives in a single `index.html` file with no build system, no package manager, and no external dependencies.

Current version: `v0.4.0-bw-hd-filmstocks`

## Development Workflow

There is no build step. Open `index.html` directly in a browser to run the app. All changes are made in `index.html`.

To serve locally (avoids `file://` quirks with some browsers):
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no tests, no linter, and no CI configuration.

### Platform & Deployment Constraints

The app is deployed via **GitHub Pages** and used on **iOS as a home-screen web app**
("Add to Home Screen" → standalone PWA mode). Every feature and dependency must be
compatible with iOS Safari in this configuration. Key implications:

- **No large WASM** — iOS Safari caps WebAssembly module size aggressively; typical
  raw-codec WASM bundles (e.g. LibRaw) may not load.
- **No server backend** — everything runs client-side; no server-side conversion or
  API calls.
- **Single-file** — the entire app lives in `index.html` (no separate JS bundles
  fetched at runtime, no CDN imports that could fail offline).
- **iOS Safari quirks** — limited `<input type="file">` capabilities, no
  `OffscreenCanvas`, memory pressure on large canvases, and the iOS JIT ban in
  home-screen web apps (WKWebView runs without JIT, so hot loops are much slower).
- **Touch-first UI** — all controls must be usable with touch (adequate hit
  targets, no hover-dependent interactions).

## Architecture

The app is structured as three sections within `index.html`:

1. **HTML** — Controls UI: file input, canvas element, range sliders and dropdowns for all film parameters.
2. **CSS** — Dark-theme design using CSS custom properties (`--bg`, `--panel`, `--accent`, etc.).
3. **JavaScript** — All application logic (~550 lines inline `<script>`).

### Data model

Two top-level constant tables drive the simulation:

- **`FILM_PROFILES`** (`fp4`, `hp5`) — per-stock physical parameters: panchromatic spectral weights, H-D curve shape (`gamma`, `inertia`, `toe`, `shoulder`, `dMin`, `dMax`), optical scatter radius, halation radius/threshold/strength, and grain parameters.
- **`FILTERS`** — six optical filter presets, each carrying per-channel multipliers and an EV correction.

### Engines

The pipeline is conceptually divided into seven **engines**, each modeling one
physical/chemical stage of film. Every engine is documented in `engines/` with a
**realness rating (1–10)** — how faithfully it models the actual physics, not how
good it looks — and a **progression log**.

| # | Engine | Realness | Passes |
|---|--------|:--------:|--------|
| 1 | Input / Scene-Linear | 4/10 | pre-Pass 1 |
| 2 | Spectral Sensitivity | 7/10 | Pass 1 |
| 3 | Optical Transport | 7/10 | Pass 2 |
| 4 | Development | 9/10 | Passes 3–4 (iterative Rxn-Diff, Gaussian diffusion) |
| 5 | Adjacency / Edge Effects | **RETIRED** | emerges from E4 |
| 6 | Grain | 6/10 | Pass 6 (density domain, Selwyn-Nutting) |
| 7 | Print / Positive | 8/10 | Pass 6 (paper H-D curve) |

**Required workflow:** whenever you change code belonging to an engine, append a
dated entry to that engine's progression log in `engines/`, and update its
realness rating (and the tables in `engines/README.md` and here) if the change
moved it. The logs are the running memory of how each engine evolves toward real
physics. Read the relevant engine doc before working on its code. See
`engines/README.md` for the full map.

### Image processing pipeline

Images are capped to 1100 px on the longest edge on load. `buildLinearSourceBuffers()` converts sRGB pixels into three `Float32Array` buffers (`linearR/G/B`) in scene-linear light. All subsequent passes operate on `Float32Array` buffers of size `width × height`.

`processImage()` runs six sequential passes:

| Pass | What it does |
|------|-------------|
| 1 | Scene-linear RGB → panchromatic film exposure via `effectiveSpectralWeights()` (folds white balance + optical filter into channel mixing weights, then normalizes) |
| 2 | Optical transport: emulsion scatter (`gaussianBlur2D`) and monochrome halation (`exponentialBlur2D` of highlight-only source, added back to exposure) |
| 3–4 | Iterative reaction-diffusion development (6 steps): per-step developer consumption + lateral `boxBlur2D` diffusion; adjacency effects (Mackie lines) emerge from chemistry; then `hdDensity()` maps final developer concentration to density |
| 5 | *(retired — E5 synthetic high-pass deleted; edge effects emerge from Pass 3–4)* |
| 6 | Grain (spatially correlated hash noise → box blur → density-weighted amplitude), then `printDensityToPositive()` for final positive tones → sRGB output bytes |

### Key functions

- **`hdDensity(exposure, developer, film, pushPull)`** — implements the Hurter-Driffield density curve. Push shifts toe and compresses the shoulder; pull does the reverse.
- **`boxBlur2D(src, dst, w, h, radius)`** — separable (horizontal then vertical) sliding-window box blur on `Float32Array` with clamped edges. Used for E4 iterative diffusion and E6 grain.
- **`gaussianBlur2D(src, dst, w, h, radius)`** — three-pass box-blur approximation of a Gaussian (σ ≈ radius); used for E3 scatter.
- **`exponentialBlur2D(src, dst, w, h, sigma)`** — separable causal+anticausal first-order IIR implementing Frieser exponential LSF e^(−|x|/σ); used for E3 halation.
- **`effectiveSpectralWeights(base, wb, filter)`** — multiplies base film weights by white-balance multipliers and filter multipliers, then normalizes so the total channel weight sums to 1.
- **`filmBalanceMultipliers(filmKelvin)`** — converts a color temperature (Kelvin) to per-channel multipliers relative to the 5500 K reference white via `kelvinToSrgbWhite()` (Tanner Helland approximation).
- **`printDensityToPositive(dNorm, contrast)`** — maps normalized negative density to positive print tones using a `tanh`-based S-curve contrast operator followed by a `smoothstep` display toe/shoulder.
- **`hashNoise(i)`** — integer hash function for grain; produces a deterministic value in `[-0.5, 0.5]`.
- **`scheduleProcess()`** — debounces reprocessing by 45 ms on every control change. Uses a version counter to discard stale renders.

### Rendering

Output is always monochrome: R, G, and B output channels are all set to the same byte value. The alpha channel is copied from the original image unchanged. `ctx.putImageData()` writes the result directly to the canvas.

## Extending Film Stocks or Filters

Add a new entry to `FILM_PROFILES` or `FILTERS` and add a matching `<option>` element in the HTML `<select>` — no other wiring is needed.
