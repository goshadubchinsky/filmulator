# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

The app is structured as three sections within `index.html`:

1. **HTML** — Controls UI: file input, canvas element, range sliders and dropdowns for all film parameters.
2. **CSS** — Dark-theme design using CSS custom properties (`--bg`, `--panel`, `--accent`, etc.).
3. **JavaScript** — All application logic (~550 lines inline `<script>`).

### Data model

Two top-level constant tables drive the simulation:

- **`FILM_PROFILES`** (`fp4`, `hp5`) — per-stock physical parameters: panchromatic spectral weights, H-D curve shape (`gamma`, `inertia`, `toe`, `shoulder`, `dMin`, `dMax`), optical scatter radius, halation radius/threshold/strength, Eberhard coefficient, and grain parameters.
- **`FILTERS`** — six optical filter presets, each carrying per-channel multipliers and an EV correction.

### Image processing pipeline

Images are capped to 1100 px on the longest edge on load. `buildLinearSourceBuffers()` converts sRGB pixels into three `Float32Array` buffers (`linearR/G/B`) in scene-linear light. All subsequent passes operate on `Float32Array` buffers of size `width × height`.

`processImage()` runs six sequential passes:

| Pass | What it does |
|------|-------------|
| 1 | Scene-linear RGB → panchromatic film exposure via `effectiveSpectralWeights()` (folds white balance + optical filter into channel mixing weights, then normalizes) |
| 2 | Optical transport: emulsion scatter (box blur + partial mix) and monochrome halation (box blur of highlight-only source, added back to exposure) |
| 3 | Local developer exhaustion (per-pixel) + lateral chemical diffusion (box blur of developer field) |
| 4 | H-D characteristic curve via `hdDensity()` — softplus toe, exponential shoulder saturation, push/pull-modified parameters |
| 5 | Eberhard/Mackie edge effect — adaptive high-pass in density domain using box blur |
| 6 | Grain (spatially correlated hash noise → box blur → density-weighted amplitude), then `printDensityToPositive()` for final positive tones → sRGB output bytes |

### Key functions

- **`hdDensity(exposure, developer, film, pushPull)`** — implements the Hurter-Driffield density curve. Push shifts toe and compresses the shoulder; pull does the reverse.
- **`boxBlur2D(src, dst, w, h, radius)`** — separable (horizontal then vertical) sliding-window box blur on `Float32Array` with clamped edges. Used for scatter, halation, diffusion, edge detection, and grain.
- **`effectiveSpectralWeights(base, wb, filter)`** — multiplies base film weights by white-balance multipliers and filter multipliers, then normalizes so the total channel weight sums to 1.
- **`filmBalanceMultipliers(filmKelvin)`** — converts a color temperature (Kelvin) to per-channel multipliers relative to the 5500 K reference white via `kelvinToSrgbWhite()` (Tanner Helland approximation).
- **`printDensityToPositive(dNorm, contrast)`** — maps normalized negative density to positive print tones using a `tanh`-based S-curve contrast operator followed by a `smoothstep` display toe/shoulder.
- **`hashNoise(i)`** — integer hash function for grain; produces a deterministic value in `[-0.5, 0.5]`.
- **`scheduleProcess()`** — debounces reprocessing by 45 ms on every control change. Uses a version counter to discard stale renders.

### Rendering

Output is always monochrome: R, G, and B output channels are all set to the same byte value. The alpha channel is copied from the original image unchanged. `ctx.putImageData()` writes the result directly to the canvas.

## Extending Film Stocks or Filters

Add a new entry to `FILM_PROFILES` or `FILTERS` and add a matching `<option>` element in the HTML `<select>` — no other wiring is needed.
