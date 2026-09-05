---
name: frontend-design
description: Anti-Slop Frontend (design-taste-frontend v2). Prevent generic AI UIs, enforce clean typography, asymmetric layout, spring animations, and production-ready code.
---

# Antigravity Skill: Anti-Slop Frontend (design-taste-frontend v2)

Target: Landing pages, portfolios, product marketing, & redesigns.
Purpose: Prevent generic AI-generated UIs (Inter font, purple gradients, centered 3-card features, flat layout).

---

## 0. BRIEF INFERENCE (Read the Room First)
Before writing any code or layout structure:
1. **Analyze Signals**:
   - Page Kind: Landing, portfolio, editorial, B2B SaaS, or redesign.
   - Vibe/Tone: Minimalist, Linear-style, Apple-y, Brutalist, Editorial, Premium Consumer, or Dark Tech.
   - Audience: Technical B2B buyers vs. design-conscious consumers.
2. **Output "Design Read"**:
   Before outputting any frontend code, output a 1-line statement:
   `Design Read: Building a [Page Kind] for [Audience] with a [Vibe] aesthetic using [Stack/Style].`
3. **Anti-Default Discipline (STRICT BAN)**:
   - 🚫 NEVER default to Inter/Roboto fonts.
   - 🚫 NEVER default to 3 equal-width centered card grids for features.
   - 🚫 NEVER use generic centered Hero text over a dark mesh/purple gradient.
   - 🚫 NEVER use em-dashes (—) or corporate fluff text.
   - 🚫 NEVER output `// TODO: implement rest` placeholder comments.

---

## 1. TYPOGRAPHY & BRANDING
- **Font Selection**: Choose intentional pairing based on the vibe:
  - Technical / Modern: *Geist*, *Satoshi*, *Cabinet Grotesk*.
  - Clean / Geometric: *Outfit*, *Plus Jakarta Sans*.
  - Creative / Editorial: *Newsreader*, *Playfair Display* paired with clean Sans-Serif body.
- **Hierarchy & Tracking**:
  - Tighten letter spacing (`tracking-tight` or `tracking-tighter`) for display titles.
  - Apply negative tracking to large headers, positive tracking to subheaders/labels.
  - Limit paragraph width to ~65 characters (`max-w-prose`) using `text-wrap: pretty` or `text-wrap: balance`.

---

## 2. LAYOUT & ASYMMETRY
- **Container Constraint**: Use `max-w-[1400px] mx-auto px-6` with generous, asymmetrical spacing.
- **Viewport Stability**: ALWAYS use `min-h-[100dvh]` for full-height Hero sections. NEVER use `h-screen` (prevents iOS Safari viewport jumping).
- **Asymmetric Layouts**:
  - Replace centered Hero with left/right aligned asymmetric Hero.
  - Replace 3 equal feature cards with 2-column Zig-Zag, asymmetric grids, or horizontal scroll components.
  - Vary border radii across components (sharper inside, softer outside).

---

## 3. MOTION & INTERACTION (GSAP / FRAMER MOTION)
- **Spring Physics**: No linear easing. Use spring transitions (`type: "spring", stiffness: 100, damping: 20`).
- **Performance**:
  - NEVER use React `useState` for continuous mouse-follow or scroll animations.
  - Use Framer Motion's `useMotionValue` and `useTransform` outside the React render cycle.
- **Scroll Reveals & Micro-interactions**:
  - Apply subtle staggered entrance animations for section elements.
  - Add magnetic hover states to primary call-to-actions.

---

## 4. CODE EXECUTION & QUALITY CHECK
- **Full Deliverable**: Always output complete, self-contained, production-ready code (HTML/Tailwind/React/Svelte/Vue).
- **Pre-Flight Inspection**: Verify that spacing rhythm, responsive breakpoints (`sm`, `md`, `lg`, `xl`), contrast, and layout balance feel cohesive before finalizing.
