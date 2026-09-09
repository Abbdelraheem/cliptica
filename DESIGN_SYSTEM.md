# NOLOGY Design System

> Comprehensive specification for Cliptica / NOLOGY UI components, tokens, typography, motion, and accessibility standards.

---

## 1. Brand Identity & Visual Philosophy

- **Vibe**: High-performance AI studio, dark-mode first, industrial luxury.
- **Palette Tone**: Deep near-black obsidian backgrounds paired with an intense Forge Orange accent (`#FF5A1F`), metallic champagne highlights, and frosted glass layers.
- **Visual Depth**: Multi-layered backdrop glow (`.amb`), subtle animated film grain (`.grain`), and micro-interactions powered by custom cubic-bezier curves.

---

## 2. Core Color Tokens

Defined in `src/app/globals.css` via CSS custom properties and mapped to Tailwind inline theme:

### Surfaces & Backgrounds
| Token | Value | Purpose |
|---|---|---|
| `--onyx` | `#050505` | Primary application canvas background |
| `--onyx-2` | `#0a0a0a` | Elevated surface background (cards, sidebars) |
| `--surface` | `rgba(255, 255, 255, 0.04)` | Semi-transparent card overlay |
| `--surface-2` | `rgba(255, 255, 255, 0.02)` | Subtle table row striping or secondary surfaces |

### Ink & Typography
| Token | Value | WCAG Contrast on `#050505` | Usage |
|---|---|---|---|
| `--pearl` | `#ffffff` | **21:1** (AAA) | Headings, primary text, prominent metrics |
| `--mist` | `rgba(255, 255, 255, 0.75)` | **12.4:1** (AAA) | Body copy, descriptions, secondary text |
| `--mist-2` | `rgba(255, 255, 255, 0.58)` | **5.3:1** (AA Compliant) | Captions, timestamps, metadata, disabled hints |

### Forge Orange Accents
| Token | Value | Usage |
|---|---|---|
| `--gold` | `#ff5a1f` | Brand primary action color (CTAs, active tabs, scores) |
| `--gold-2` | `#e8430a` | Gradient endpoint, hover/active pressed states |
| `--champagne` | `#ff7a3d` | Focus rings, link hovers, eyebrow text, subtle highlights |
| `--emerald` | `#7c2d12` | Darkened amber/orange shadow anchor |
| `--emerald-soft` | `rgba(255, 90, 31, 0.25)` | Glow shadows, active chip fills, selection highlight |

### Hairlines & Borders
| Token | Value | Usage |
|---|---|---|
| `--hair` | `rgba(255, 255, 255, 0.08)` | Default card borders, dividers, table separators |
| `--hair-soft` | `rgba(255, 255, 255, 0.05)` | Nested dividers, secondary panel borders |

---

## 3. Typography Scale & Rules

### Font Families
- **Display Font**: `Manrope`, `Inter`, system-ui, sans-serif (`--font-display`).
- **Body Font**: `Inter`, system-ui, sans-serif (`--font-body`).

### Type Scale
| Class / Token | Font Size | Line Height | Tracking | Weight | Usage |
|---|---|---|---|---|---|
| `.display-xl` | `clamp(2.8rem, 7vw, 5.5rem)` | 1.02 | `-0.03em` | 800 (ExtraBold) | Hero headlines |
| `.display-lg` | `clamp(2rem, 4.6vw, 3.4rem)` | 1.08 | `-0.025em` | 800 (ExtraBold) | Section headlines |
| `.display-md` | `clamp(1.5rem, 2.8vw, 2.1rem)` | 1.15 | `-0.02em` | 700 (Bold) | Card titles, modal headers |
| `.eyebrow` | `0.72rem` (11.5px) | 1.00 | `0.22em` | 600 (SemiBold) | Uppercase category tags |
| `body-base` | `1rem` (16px) | 1.50 | `normal` | 400 (Regular) | Default paragraph text |
| `body-sm` | `0.875rem` (14px) | 1.40 | `normal` | 400–500 | Form controls, table cells |
| `caption` | `0.75rem` (12px) | 1.30 | `0.02em` | 400–500 | Tooltips, metadata labels |

---

## 4. Spacing, Layout & Breakpoints

- **Spacing Scale**: Standard 4px base (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`, `96px`).
- **Container Max-Width**: `max-w-7xl` (1280px) for general app shell; `max-w-5xl` for settings and billing views.
- **Breakpoints**:
  - `sm`: `640px` (Mobile landscape / small tablets)
  - `md`: `768px` (Tablets / collapsed desktop sidebar)
  - `lg`: `1024px` (Desktop sidebar expanded)
  - `xl`: `1280px` (Widescreen monitor canvas)

---

## 5. Corner Radii & Elevation

### Corner Radii
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `10px` | Inputs, dropdown items, compact buttons, badges |
| `--radius` | `18px` | Cards, preview video containers, standard modals |
| `--radius-lg` | `28px` | Featured showcase containers, large pricing panels |
| `pill` | `9999px` | Badges, primary CTA buttons (`.btn-lux`) |

### Elevation & Glassmorphism
- **Glassmorphism**: `.glass-card` uses `backdrop-filter: blur(20px)`, `border: 1px solid var(--hair)`, and `background: linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))`.
- **Shadows**:
  - Regular hover: `box-shadow: 0 14px 44px rgba(0, 0, 0, 0.45), 0 0 32px rgba(255, 90, 31, 0.08)`.
  - Primary button active: `box-shadow: 0 10px 34px rgba(255, 90, 31, 0.45)`.
  - Accent icon gem: `box-shadow: 0 0 20px rgba(255, 90, 31, 0.15)`.

---

## 6. Component Standards

### Buttons
- **Primary / Gold** (`.btn-primary`, `.btn-gold`): Solid gradient `linear-gradient(120deg, var(--gold), var(--gold-2))` with white text and orange ambient shadow.
- **Outline** (`.btn-outline`): Semi-transparent surface `rgba(255,255,255,0.04)` with `1px solid var(--hair)`. On hover: border tints to `--champagne`.
- **Ghost** (`.btn-ghost`): Transparent background, muted text (`--mist`). On hover: shifts to `--champagne`.
- **Destructive**: Red hue `rgba(239, 68, 68, 0.15)` border and `text-red-400`.

### Form Controls
- Inputs use `bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30`.
- On focus: `focus:outline-none focus:border-[#FF5A1F] focus:ring-1 focus:ring-[#FF5A1F]`.
- Validation errors include `role="alert"` and an inline red notice with an alert triangle icon.

### Empty States & Skeletons
- Empty states must always feature:
  1. A thematic icon enclosed in an `icon-gem` circular or rounded square badge.
  2. A clear headline explaining that no records were found.
  3. A descriptive 1–2 sentence explanation.
  4. An immediate call to action (e.g., "Create Project", "Browse Campaigns").
- Loading skeletons use pulse animations `animate-pulse` with `bg-white/[0.04]` and matching border radii.

---

## 7. Motion & Transitions

- **Timing Function**: Custom luxurious easing curve `--ease-lux: cubic-bezier(0.2, 0.7, 0.2, 1)`.
- **Hover Micro-interactions**:
  - Cards: `transform: translateY(-4px); transition: 0.35s var(--ease-lux)`.
  - Buttons: `transform: translateY(-2px) scale(1.01); transition: 0.3s var(--ease-lux)`.
- **Continuous Animations**:
  - Border flow (`.price-ring.feat::after`): 6s linear infinite rotation of multi-stop gradient.
  - Film grain (`.grain::after`): 9s 6-step jitter animation to simulate analog cinematography.

---

## 8. Accessibility & Compliance (WCAG 2.1 AA)

1. **Color Contrast**:
   - All body text and UI labels maintain at least **4.5:1** contrast ratio against `#050505` and card surfaces.
   - Secondary muted text (`--mist-2`) was calibrated to `rgba(255, 255, 255, 0.58)` giving **5.3:1** contrast, exceeding the 4.5:1 minimum.
2. **Keyboard Navigation & Focus Indicators**:
   - All interactive elements (`button`, `a`, `input`, `select`, `textarea`) have explicit `:focus-visible` styling:
     ```css
     :focus-visible {
       outline: 2px solid var(--champagne);
       outline-offset: 3px;
     }
     ```
3. **Screen Readers**:
   - Form inputs are paired with `<label>` or explicit `aria-label`.
   - Error banners have `role="alert"`.
   - Modals trap focus and specify `aria-modal="true"`.
