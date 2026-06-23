# Engines

The simulation in `index.html` is one linear pipeline, but it is conceptually
made of distinct **engines** — each modeling one physical or chemical stage of
real film photography. This directory holds one document per engine.

Each engine doc carries a **realness rating (1–10)**: how faithfully it models
the actual physics/chemistry, *not* how good it looks. A high score means the
mechanism matches reality (even if the constants are tuned); a low score means
the result is achieved by a visual shortcut that imitates the look without
modeling the cause.

> Reminder of the project's core philosophy: we model what film *does*, not
> what film *looks like*. Approximating a calculation is fine; faking the
> phenomenon is not. These ratings exist to track that honestly.

> **Physics reference:** `research/physics-of-film.md` contains the full
> mathematical derivations (Kubelka-Munk ODEs, Frieser LSF, Gurney-Mott,
> reaction-diffusion PDEs, Nutting's Law, Boolean grain model) with the
> paradigm tables distinguishing real physics from acceptable approximations
> from vague graphical shortcuts. Read the relevant section before working
> on an engine.

## The engines

| # | Engine | Realness | One-line assessment |
|---|--------|:--------:|---------------------|
| 1 | [Input / Scene-Linear](01-input-scene-linear.md) | 4/10 | sRGB linearization is exact, but a processed 8-bit JPEG is treated as scene radiance |
| 2 | [Spectral Sensitivity](02-spectral-sensitivity.md) | 5/10 | 3-sample RGB stand-in for a continuous spectral integral; weights are tuned, not measured |
| 3 | [Optical Transport](03-optical-transport.md) | 5/10 | halation is a real phenomenon modeled qualitatively; the box-blur PSF is not physical |
| 4 | [Development](04-development.md) | 7/10 | genuine H-D curve plus developer exhaustion and lateral diffusion; single-pass vs. iterative |
| 5 | [Adjacency / Edge Effects](05-adjacency-edge-effects.md) | 3/10 | a real effect, but synthesized as a high-pass sharpen instead of emerging from diffusion |
| 6 | [Grain](06-grain.md) | 3/10 | procedural noise texture, not a stochastic silver-halide crystal model |
| 7 | [Print / Positive](07-print-positive.md) | 4/10 | plausible density inversion, but the paper's own characteristic curve is unmodeled |

Ratings are a snapshot. Update the table whenever an engine's score changes,
and record *why* in that engine's progression log.

## Pipeline order

```
Input ─▶ Spectral ─▶ Optical Transport ─▶ Development ─▶ Adjacency ─▶ Grain ─▶ Print/Positive ─▶ canvas
 (1)        (2)            (3)                (4)            (5)        (6)          (7)
```

This maps to the passes inside `processImage()`: Spectral = Pass 1, Optical
Transport = Pass 2, Development = Passes 3–4, Adjacency = Pass 5, Grain +
Print/Positive = Pass 6.

## Progression logs

Every engine doc ends with a **Progression Log**. Whenever you (the AI) do work
that touches an engine, append a dated entry to that engine's log describing:

- what changed and why,
- whether the change moved the engine toward real physics or was a pragmatic
  approximation,
- any change to the realness rating (and update the table above to match).

The log is the running memory of how each engine has evolved toward physical
accuracy. Keep newest entries at the top.
