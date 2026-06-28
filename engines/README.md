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
| 1 | [Input / Latent Image](01-input-latent-image.md) | 5/10 | sRGB linearization is exact; Poisson Ag₄ + grain ensemble + FP4 spectral mixing + first-order reciprocity; JPEG input and approximate constants cap the rating |
| 2 | [Spectral Sensitivity](02-spectral-sensitivity.md) | 7/10 | 3-sample RGB integral; weights now aligned with published FP4+/HP5+ spectral characteristics |
| 3 | [Optical Transport](03-optical-transport.md) | 7/10 | scatter (Gaussian) and halation (Gaussian) both radially symmetric; parameters fitted, not from measured MTF |
| 4 | [Development](04-development.md) | 9/10 | iterative rxn-diff (5–14 steps, ∝ time); Gaussian Fickian diffusion; first-order kinetics; adjacency emerges |
| 5 | [Adjacency / Edge Effects](05-adjacency-edge-effects.md) | **RETIRED** | synthetic high-pass deleted; effect now emerges from E4 iterative development |
| 6 | [Grain](06-grain.md) | 6/10 | Selwyn-Nutting amplitude in density domain; Gaussian correlation; procedural (not stochastic crystal) model |
| 7 | [Print / Positive](07-print-positive.md) | 8/10 | real paper H-D curve (Dmin/Dmax/toe/shoulder); grade-based paper gamma from Ilford data; density→reflectance via optical density |

Ratings are a snapshot. Update the table whenever an engine's score changes,
and record *why* in that engine's progression log.

## Pipeline order

```
Input/Latent Image ─▶ Spectral ─▶ Optical Transport ─▶ Development ─▶ Adjacency ─▶ Grain ─▶ Print/Positive ─▶ canvas
      (1)               (2)            (3)                (4)            (5)        (6)          (7)
```

This maps to the passes inside `processImage()`: Spectral = Pass 1, Optical
Transport = Pass 2, Development = Passes 3–4, Adjacency = Pass 5, Grain +
Print/Positive = Pass 6.

> **Current state (2026-06-27):** The main `index.html` is an E1-only latent-image
> viewer (engine-by-engine rebuild in progress). The full 7-engine pipeline lives
> in `index-full-archive.html`. The pipeline docs here describe the full system;
> not all engines are wired in the current entry point.

## Progression logs

Every engine doc ends with a **Progression Log**. Whenever you (the AI) do work
that touches an engine, append a dated entry to that engine's log describing:

- what changed and why,
- whether the change moved the engine toward real physics or was a pragmatic
  approximation,
- any change to the realness rating (and update the table above to match).

The log is the running memory of how each engine has evolved toward physical
accuracy. Keep newest entries at the top.
