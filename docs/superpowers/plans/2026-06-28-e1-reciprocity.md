# E1 Reciprocity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shutter-speed driven reciprocity failure to E1 latent-image formation.

**Architecture:** Add a pure `reciprocityEfficiency(lambdaTotal, shutterSeconds)` helper in `index.html`, route each pixel through `lambdaEffective = lambdaTotal * efficiency`, and add a shutter speed slider. Add a dependency-free Node test that extracts and exercises the pure helper.

**Tech Stack:** HTML, browser JavaScript, Node built-in `assert`, PowerShell.

## Global Constraints

- Browser-only, no runtime dependencies.
- Default `1/125 s` should be effectively neutral.
- Low-intensity long exposures reduce latent-image efficiency (Ilford FP4+ measured `Ta = Tm^1.26`). High-intensity recombination intentionally disabled (Ilford: no correction for 1/2–1/10000s).
- Right-side linear reference remains a pure EV reference.

---

### Task 1: Reciprocity Math Test

**Files:**
- Create: `tests/e1-reciprocity.test.js`

**Interfaces:**
- Consumes: `index.html`
- Produces: executable Node test for `reciprocityEfficiency(lambdaTotal, shutterSeconds)`

- [ ] **Step 1: Write failing test**

Create `tests/e1-reciprocity.test.js` with assertions for neutral normal exposure, long-exposure loss (FP4+ measured), short-shutter neutrality (Ilford: no correction), and bounds.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/e1-reciprocity.test.js`

Expected: FAIL because `reciprocityEfficiency` does not exist yet.

### Task 2: UI And Processing

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `reciprocityEfficiency(lambdaTotal, shutterSeconds)`
- Produces: shutter speed control, label update, and corrected latent-image lambda

- [ ] **Step 1: Add shutter-speed control and constants**
- [ ] **Step 2: Add pure reciprocity helper**
- [ ] **Step 3: Use `lambdaEffective` in the pixel loop**
- [ ] **Step 4: Update status text and explanatory note**
- [ ] **Step 5: Run `node tests/e1-reciprocity.test.js`**

Expected: PASS.

### Task 3: Documentation

**Files:**
- Modify: `engines/01-input-latent-image.md`
- Modify: `engines/README.md`

**Interfaces:**
- Consumes: implemented E1.1 behavior
- Produces: docs that no longer say E1 has no exposure-duration parameter

- [ ] **Step 1: Update current implementation and realness notes**
- [ ] **Step 2: Add progression-log entry**
- [ ] **Step 3: Re-run test**

Expected: PASS.
