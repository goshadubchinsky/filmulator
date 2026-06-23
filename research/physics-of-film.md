# The Physics and Computational Simulation of Photographic Film Processes

*Source: Gemini research compilation, 2026-06. Stored here as the canonical physics reference for engine development. Each section maps to one or more engines — see cross-references.*

---

## Introduction

Historically, digital film emulation has relied on phenomenological approximations — most notably 3D LUTs mapping linear or logarithmic digital values to H&D curves of specific film stocks. While these replicate macroscopic colorimetry under standardised conditions, they are ignorant of the underlying physics: they cannot respond dynamically to varied lighting, cannot reproduce adjacency effects such as Mackie lines, and treat grain as a 2D noise texture rather than a density-dependent morphological structure.

This document exhaustively details the science across the fundamental phases: optical transport, solid-state latent image formation, reaction-diffusion chemical kinetics, subtractive colour coupling, and stochastic granularity. For each topic it distinguishes:

- **Absolute physical reality** — the exact mechanism
- **Open-source scientific approach** — tractable approximation used by serious simulators
- **Vague graphical approximation** — the shortcut to avoid

---

## 1. Optical Transport and Photon Scattering in Turbid Media

*→ Engines: E1 (input), E3 (optical transport)*

A modern film stock is a complex 3-D heterogeneous turbid medium: multiple emulsion layers, gelatin binders, spectral colour filters, and a polymer base. The propagation of light through this medium dictates spatial distribution of exposure — the foundation of sharpness and halation.

### 1.1 Radiative Transfer and Monte Carlo Scattering

As light enters the gelatin matrix it encounters suspended silver halide (AgX) crystals. The refractive index of silver halides ($n \approx 2.2$) is significantly higher than gelatin ($n \approx 1.5$), so the emulsion acts as a highly scattering medium. Exact photon transport is formally described by the **Radiative Transfer Equation (RTE)**.

At the highest level of rigour this is solved via **Monte Carlo Radiation Transfer (MCRT)**. Millions of virtual photons are launched into a simulated 3-D volume; at each step a photon's path length is determined stochastically from the mean free path of the medium, and its scattering angle is derived from the phase function of the silver halide crystals (computed via Mie theory for specific crystal morphologies: tabular T-grains, cubic, octahedral). MCRT tracks wavelength-dependent momentum and phase shifts, predicting both single-point intensity and two-point spatial coherence. *Computationally intractable for real-time use.*

### 1.2 The Kubelka-Munk Two-Stream Approximation

The Kubelka-Munk theory (1931) reduces the 3-D scattering problem to a 1-D differential model. Light propagates as two diffuse fluxes: a forward flux $J(x)$ and a backward flux $H(x)$, where $x$ is depth into the emulsion. Governed by absorption coefficient $K$ and scattering coefficient $S$:

$$\frac{dJ}{dx} = -(K + S)J + SH$$

$$\frac{dH}{dx} = -(K + S)H + SJ$$

Solving these gives reflectance $R_\infty$ and transmittance without tracking individual photons. For an infinitely thick layer the **Kubelka-Munk function** relates the ratio of absorption to scattering to the ultimate reflectance:

$$F(R_\infty) = \frac{K}{S} = \frac{(1 - R_\infty)^2}{2R_\infty}$$

Discretised across the vertical profile of the simulated film, this computes how much light reaches the bottom red-sensitive layer versus the top blue-sensitive layer — accurately simulating wavelength-dependent exposure drop-off.

### 1.3 Halation and the Frieser Line Spread Function

Light that penetrates through all emulsion layers may strike the film base (or camera pressure plate) and reflect back at oblique angles, exposing silver halide grains laterally — the characteristic aura around high-contrast highlights.

Frieser demonstrated empirically that the **Line Spread Function (LSF)** of the scattered light follows an **exponential decay**, not a Gaussian:

$$E(x) = a \exp(bx)$$

where $E(x)$ is exposure at absolute spatial distance $x$ from the incident point, and $b < 0$ characterises the emulsion's scattering properties. The **Modulation Transfer Function (MTF)** — which dictates spatial frequency response and resolving power — is the Fourier transform of this exponential LSF.

| Paradigm | Methodology | Verdict |
|---|---|---|
| Absolute reality | Phase-encoded MCRT tracking individual photon momentum, Mie/Rayleigh scattering, Fresnel reflection | Computationally intractable for real-time |
| Scientific approach | Kubelka-Munk ODEs for depth-dependent attenuation + spatial convolution with Frieser exponential LSF for halation | Highly accurate; used by spektrafilm and filmr |
| Vague approximation | Ignoring internal scattering; Gaussian blur on thresholded highlights | Wrong spatial falloff; ignores wavelength-dependent diffraction causing the red-orange fringing of real halation |

---

## 2. Solid-State Physics of Latent Image Formation

*→ Engine: E1 (exposure model), future engine candidate*

The photochemical conversion of absorbed photons into a stable metallic silver cluster within individual silver halide crystals.

### 2.1 The Gurney-Mott and Mitchell Mechanisms

A silver halide crystal (AgBr, AgCl, AgI) is not a perfect lattice; Frenkel defects allow interstitial silver ions ($\text{Ag}_i^+$) to move freely within the crystal structure.

When a photon with energy greater than the bandgap is absorbed, it excites an electron from the valence band into the conduction band:

$$\gamma \rightarrow e^- + h^+$$

The electron migrates through the conduction band until captured by a **sensitivity speck** — typically microscopic silver sulphide ($\text{Ag}_2\text{S}$) or gold-silver amalgam clusters introduced during emulsion manufacture. The trapped electron attracts an interstitial silver ion:

$$e^- + \text{Ag}_i^+ \rightarrow \text{Ag}^0$$

A single $\text{Ag}^0$ atom is thermodynamically unstable (lifetime ~1 s at room temperature; dissociation energy ~0.69 eV). A second photon absorption before dissociation creates a diatomic centre:

$$\text{Ag}^0 + e^- + \text{Ag}_i^+ \rightarrow \text{Ag}_2$$

$\text{Ag}_2$ is far more stable (dissociation energy ~1.74 eV). This sequence must repeat until a cluster of typically **four or more silver atoms** ($\text{Ag}_4$) is formed. At this critical size the cluster crosses a thermodynamic boundary and becomes a fully stable, **developable latent image** capable of catalysing macroscopic chemical reduction of the entire grain during development.

### 2.2 Recombination and the Schwarzschild Effect (Reciprocity Failure)

Not every absorbed photon contributes. The primary loss mechanism is **recombination**: an excited electron recombines with a positive hole before reaching a sensitivity speck, dissipating energy as heat. The loss rate:

$$\frac{dn}{dt} = -\left(\sigma_r v_e V_g^{-1}\right) n_e n_h$$

where $\sigma_r$ is the capture cross-section of the recombination centre, $v_e$ is thermal velocity of the electron, $V_g$ is grain volume, and $n_e$, $n_h$ are transient concentrations of electrons and holes.

This explains **reciprocity failure (Schwarzschild effect)**:
- At very low intensity: photons arrive so infrequently that $\text{Ag}^0$ thermally decays before a subsequent photon stabilises it into $\text{Ag}_2$.
- At very high intensity: high density of simultaneous $e^-$ and $h^+$ drastically increases recombination probability before ionic neutralisation can occur.

### 2.3 The Hamilton-Bayer Monte Carlo Computational Model

Standard analytical equations are insufficient because processes occur at the level of discrete quanta. The Hamilton-Bayer model (Eastman Kodak, 1965) is a **Monte Carlo event-driven state machine** simulating the sequence of discrete events within a single grain. It tracks state of actors ($e^-$, $h^+$, interstitial ions) and calculates transition probabilities for mutually exclusive events:

1. Photon absorption → $e^-$ + $h^+$ pair
2. Trapping of $e^-$ at a shallow sensitivity speck
3. Thermal escape of $e^-$ from trap
4. Arrival of $\text{Ag}_i^+$ to form $\text{Ag}^0$
5. Thermal decay of $\text{Ag}^0$
6. Permanent trapping of $h^+$, or $e^-$/$h^+$ recombination

A proper engine instantiates a **statistical distribution of virtual grains** matching the RMS granularity and crystal size distribution of the target film stock. For each grain, local photon flux is calculated from the optical transport model, then a GPU-accelerated Hamilton-Bayer simulation determines which grains cross the $\text{Ag}_4$ threshold.

| Paradigm | Methodology | Verdict |
|---|---|---|
| Absolute reality | Quantum mechanical $e^-$/$h^+$ generation, interstitial ion migration, atomistic cluster growth with thermal dissociation | Dictates absolute sensitivity and failure rates |
| Scientific approach | GPU-accelerated Hamilton-Bayer Monte Carlo evaluating binary developability of millions of grains; or empirical Schwarzschild equation for reciprocity failure | Cutting edge of physical simulation |
| Vague approximation | Applying an S-curve to image luminance via 1D or 3D LUT | Treats film response as a continuous deterministic function; ignores reciprocity failure entirely |

---

## 3. Chemical Development Kinetics and Reaction-Diffusion

*→ Engine: E4 (development), E5 (adjacency effects)*

### 3.1 Thermodynamics of Metol-Hydroquinone Reduction

Standard photographic developer is an aqueous alkaline solution of organic reducing agents, typically **Metol** (monomethyl-p-aminophenol sulfate) and **Hydroquinone** (1,4-benzenediol).

The $\text{Ag}_4$ latent image speck acts as a catalytic electrode, lowering the activation energy barrier for reduction. The reducing agent donates electrons to this speck, which in turn reduces surrounding silver ions, extruding them into filamentary metallic silver.

The two agents exhibit **superadditivity**: Metol initiates reduction rapidly (establishing shadow detail, low contrast); Hydroquinone builds high density in highlights (high activation energy, slower). In a superadditive mixture, Metol reduces silver and Hydroquinone regenerates oxidised Metol — the combined reaction rate far exceeds the sum of individual rates. Reaction rate increases by a factor of 1.5–4 for every 10°C rise in temperature.

### 3.2 Reaction-Diffusion PDEs

Development cannot be treated as a global, uniform tone-mapping operation. It is a localised, mass-transport-limited chemical reaction. As the developer reduces silver halide, the local concentration of reducing agent is depleted, and inhibitory byproducts — bromide ions ($\text{Br}^-$) and oxidised developer molecules — are released into the gelatin matrix.

This is governed by **Fick's laws of diffusion** and reaction kinetics, modelled via non-linear PDEs. For developer concentration $C(x, y, t)$:

$$\frac{\partial C}{\partial t} = D_c \nabla^2 C - k(E) f(C)$$

where:
- $D_c$ = diffusion coefficient of developer in swollen gelatin
- $\nabla^2$ = spatial Laplacian operator
- $k(E) f(C)$ = consumption rate, a direct function of local exposure $E$ (density of developable grains) and current developer concentration

A second coupled PDE governs accumulation and diffusion of inhibitory bromide ions, which actively retard $k(E)$.

### 3.3 Adjacency Effects: Eberhard Effect and Mackie Lines

The visual consequences of the coupled PDEs:

When a region of high exposure is adjacent to a region of low exposure, the developer in the high-exposure region is rapidly exhausted. Fresh developer from the adjacent low-exposure region diffuses across the boundary; simultaneously, inhibitory $\text{Br}^-$ from the high-exposure region diffuses outward into the low-exposure region.

This creates:
- **Mackie line**: pronounced density spike *just inside* the bright side (influx of fresh developer)
- **Eberhard effect**: depressed density fringe *just inside* the dark side (influx of inhibitors)

This physical edge enhancement defines film's characteristic **acutance**, operating on spatial dependencies far more complex than digital unsharp masking.

| Paradigm | Methodology | Verdict |
|---|---|---|
| Absolute reality | Localised catalytic reduction of AgX by Metol-Hydroquinone superadditivity, limited by molecular mass transport and inhibitor byproduct diffusion | Fundamental origin of non-linear contrast, grain morphology, and spatial edge effects |
| Scientific approach | Coupled non-linear reaction-diffusion PDEs over time $\Delta t$ across the emulsion grid. Filmulator explicitly simulates this with first-order DEs for silver growth + developer consumption, then iterative spatial blurring between active layer and inactive reservoir. ComfyUI-Darkroom uses a spatial "adjacency acutance" convolution kernel | Accurately generates Mackie lines, Eberhard effect, and natural highlight roll-off |
| Vague approximation | Digital unsharp mask or high-pass filter for sharpness; S-curve for contrast | Pure linear pixel math; ignores the exposure-dependent, non-linear chemical exhaustion of actual fluid dynamics |

---

## 4. Subtractive Colour, DIR Couplers, and Spectral Simulation

*→ Future engine: colour simulation (B&W currently out of scope, but relevant for colour stock expansion)*

### 4.1 Dye Formation and Spectrophotometry

In colour development (CD-4), oxidised developer reacts with **couplers** pre-embedded in oil droplets within the gelatin to form subtractive dyes: Cyan, Magenta, Yellow (CMY).

A rigorous simulation cannot operate in sRGB or Rec.709. Physical dyes have significant spectral overlap and crosstalk — a Cyan dye inevitably absorbs portions of green and blue, not just red. State-of-the-art engines like **agx-emulsion** and **spektrafilm** operate entirely in the spectral domain:

1. Convert input RGB to a full spectral power distribution via spectral upsampling
2. Multiply by the published spectrophotometric log-sensitivity curves of each film layer
3. After computing dye concentration via reaction-diffusion models, construct optical density by multiplying spatial concentrations by spectral absorption curves of the CMY dyes

### 4.2 Developer Inhibitor Release (DIR) Couplers

DIR couplers, when reacting with oxidised developer to form a dye, simultaneously release a **chemical inhibitor molecule** (typically a mercaptotetrazole derivative). This inhibitor diffuses spherically through the gelatin, shutting down further development in its vicinity and also migrating vertically into adjacent colour layers.

This inter-layer inhibition is the physical mechanism behind high colour purity and complex colour crosstalk. Example: a strong red exposure develops cyan dye and simultaneously releases inhibitors into the green-sensitive layer, retarding magenta dye formation in that spatial area — artificially purifying red rendering.

| Paradigm | Methodology | Verdict |
|---|---|---|
| Absolute reality | CD-4 oxidation linking with couplers to form imperfect CMY dyes; DIR couplers releasing inhibitors that diffuse across layer boundaries | Definitive cause of colour film's unique spectral response, non-linear saturation, and complex crosstalk |
| Scientific approach | Operating in the spectral domain; DIR couplers emulated via spatial cross-channel inhibition matrices with blur kernels parameterised by measured inter-layer effects | Unparalleled colour accuracy and exposure-dependent saturation shifts |
| Vague approximation | 3D LUT or simple colour matrix applied uniformly | A LUT cannot simulate DIR couplers — inter-layer inhibition is a spatial effect depending on exposure of neighbouring pixels; a LUT only performs 1:1 pixel mapping |

---

## 5. Granularity, Microstructure, and Stochastic Rendering

*→ Engine: E6 (grain)*

True film grain is not a superficial noise overlay. It is the physical absence of light caused by occlusion of photons by overlapping opaque silver filaments or dye clouds distributed stochastically in 3-D space.

### 5.1 Nutting's Law and the Poisson Point Process

The relationship between the microscopic particulate structure and macroscopic optical density is governed by **Nutting's Law**:

$$D = \log_{10}(e) \cdot \frac{Na}{A}$$

where $D$ is optical density, $N$ is total number of developed grains, $a$ is mean projected area of a single grain, and $A$ is total area of the measuring aperture.

Because grains are distributed randomly throughout the emulsion volume, their spatial arrangement follows a **spatial Poisson point process**. Crystal radii typically follow a **log-normal distribution**. Faster films (e.g. ISO 800) utilise larger crystals with wider size variance to maximise photon capture probability, resulting in lower SNR and coarser visible granularity.

### 5.2 The Boolean Stochastic Film Grain Model

The benchmark for computationally tractable physical grain rendering is the **"Stochastic Film Grain Model for Resolution-Independent Rendering"** (Newson, Delon, Galerne).

Rather than overlaying a scanned texture, this defines a continuous **Boolean model of random sets**. The image plane is treated as a continuous spatial domain where dye clouds (modelled as overlapping disks or spheres) are placed according to a Poisson process. Grain density is mathematically tied directly to underlying exposure: most visible in midtones, vanishing at $D_\text{min}$ (no developed grains) and at $D_\text{max}$ (entirely saturated grain density).

The rendering equation accounts for integration of light across the optical device (scanner optics or human eye), convolving the Boolean grain field with the point spread function of the sensor:

$$I = G_\sigma * I_0$$

where $I_0$ is the infinite-resolution Boolean grain field, $G_\sigma$ is the Gaussian PSF of the scanner, and $*$ denotes spatial convolution.

Implemented in **filmgrain-simplified** (C + HLSL) and **chickendream** (VapourSynth/AviSynth+).

| Paradigm | Methodology | Verdict |
|---|---|---|
| Absolute reality | 3-D overlapping of opaque silver filaments or semi-transparent CMY dye clouds, log-normal size distribution, Poisson spatial distribution | Dictates physical texture, micro-contrast, and resolution limits |
| Scientific approach | Newson et al. Boolean stochastic model; resolution-independent, density-aware Poisson noise parameterised by log-normal radius for the film's specific ISO | Accurately reproduces physical clumping; grain intensity breathes naturally with exposure density |
| Vague approximation | Pre-scanned 1080p grain loop on Overlay/Soft Light blend mode, or Simplex/Perlin noise | Fails Poisson distribution and density-dependent scaling; appears uniform and detached from image data |

---

## 6. Synthesis: Architecting a Physically Accurate Pipeline

The computational pipeline must replicate the chronological and physical sequence of analog photography:

1. **Optical Input & Spectral Conversion** — Reject sRGB. Ingest scene-linear spectral data. Apply Kubelka-Munk ODEs + Frieser exponential LSF to generate depth-dependent spatial photon map.

2. **Latent Image Evaluation** — Instantiate discrete statistical grain distribution (log-normal). Evaluate developability via GPU-accelerated Hamilton-Bayer probability matrix (stochastic electron-trapping, not empirical reciprocity equations).

3. **Reaction-Diffusion Solving** — Run PDE solver (finite difference methods) to simulate physical diffusion of Metol/Hydroquinone and localised chemical exhaustion. Mackie lines and Eberhard effect emerge organically from user-defined development time and temperature.

4. **Spectral Dye Coupling & Inhibition** *(colour stocks only)* — Compute CMY dye formation; apply spatial cross-channel convolution matrices for DIR couplers. Construct final density from spectral absorption curves.

5. **Boolean Stochastic Rendering** — Evaluate overlapping Boolean geometry of dye clouds according to Poisson process, convolved with PSF of virtual scanning optic.

---

## Key Reference Implementations

| Project | What it models rigorously |
|---|---|
| **Filmulator** | Reaction-diffusion developer exhaustion + lateral diffusion (the Filmulator algorithm) |
| **spektrafilm** | Spectral domain processing, Kubelka-Munk scatter, DIR coupler approximation |
| **agx-emulsion** | Full spectral pipeline, measured sensitometric data |
| **filmgrain-simplified** / **chickendream** | Boolean stochastic grain model (Newson et al.) |
| **ComfyUI-Darkroom** | Adjacency acutance convolution approximating Eberhard/Mackie |
| **filmr** | Schwarzschild reciprocity failure; Frieser LSF for halation |
