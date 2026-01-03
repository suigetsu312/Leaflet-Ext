# Leaflet Ext Prototype

> A lightweight, object-oriented extension layer on top of Leaflet,  
> focusing on **layer abstraction**, **replay (time-based playback)**, and **composable map UI controls**.

This repository is a **prototype** that explores how to build a reusable map library
on top of Leaflet without rewriting the map engine itself.

---

## Motivation

Leaflet is powerful but mostly **imperative** and **state-driven**:
- layers and markers are often manipulated directly
- replaying historical data (logs) requires ad-hoc logic
- UI controls are usually tightly coupled to the app or framework

This project experiments with:
- wrapping Leaflet into **object-oriented layers**
- a **replay system** driven by time and incremental events
- a **framework-agnostic UI panel system** (not tied to React/Vue)
- keeping **domain logic (e.g. vessels)** out of the core library

---

## What This Prototype Demonstrates

- Multiple vessels moving on the map via replay (10 minutes @ 10Hz)
- Replay controls (play / pause / speed / seek / reset)
- Custom vessel markers (pentagon shape with heading rotation)
- UI panels rendered as Leaflet Controls
- No per-frame rendering — updates are event-driven
- UI updates are **patched**, not fully re-rendered (important for performance)

![demo]("assets/demo.png")

---

## Project Structure

```text
.
├── apps/
│   └── demo-react/        # Demo application (React + Vite)
│
├── packages/
│   └── leaflet-ext/       # Core extension library (framework-agnostic)
│
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── README.md
