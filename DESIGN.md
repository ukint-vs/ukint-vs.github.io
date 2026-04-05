# Design System — devlog~

## Product Context
- **What this is:** Personal devlog and engineering portfolio for Vadim Smirnov
- **Who it's for:** Web3/Rust/Substrate developers, collaborators, people researching Gear Protocol or Vara Network
- **Space/industry:** Engineering blog, technical portfolio, Web3 infrastructure
- **Project type:** Editorial blog with portfolio elements

## Aesthetic Direction
- **Direction:** Warm Industrial Editorial — a research notebook on a workbench. Ink on warm paper. Personal and technical at the same time.
- **Decoration level:** Minimal — typography and whitespace do the work. The ASCII `devlog~` hero and cat mascot are the only decorative elements. Don't add more.
- **Mood:** Serious and personal at the same time. The visitor should feel like they found something, not like they were marketed to.
- **Key constraint:** The `devlog~` identity (ASCII art, tilde, Plex Mono italic) is the soul of the site. Don't touch it.

## Typography

All three fonts are load from `public/fonts/` as self-hosted woff2 files.

- **Display/wordmark:** IBM Plex Mono 300 Italic — the `devlog~` heading and the `currently:` stamp. Mono carries the technical identity.
- **Body:** Source Serif 4, 18px/1.75 leading — post titles, bio, article prose. The soul of the site. Use italic (not bold) for emphasis.
- **UI/Labels:** Instrument Sans — nav, metadata, tags, dates, badges. Small, tight tracking. It's scaffolding, not content.
- **Code/Accents:** IBM Plex Mono 400/500 — code blocks, project names, arrow links, numerical data.
- **Blacklist:** No Inter, Roboto, or system-ui as primary. No serif on dashboards or data-dense UI.

### Type Scale (CSS custom properties)
```
--serif:  "Source Serif 4", Georgia, serif
--sans:   "Instrument Sans", system-ui, sans-serif
--mono:   "IBM Plex Mono", "Menlo", monospace
```

## Color

### Light Mode — Warm Parchment
```css
--bg:             #f6f4f0   /* warm off-white */
--bg-warm:        #eee9e2   /* surface, hover states */
--bg-code:        #2c2926   /* code block background */
--text:           #1a1a1a   /* primary text */
--text-secondary: #5a5550   /* descriptions, secondary */
--text-tertiary:  #8a847d   /* metadata, muted labels */
--border:         #d8d2ca   /* standard dividers */
--border-light:   #e8e3dc   /* subtle dividers */
--accent:         #c44b28   /* terracotta — links, project names, accent stripe */
--accent-dim:     rgba(196, 75, 40, 0.08)
--ink:            #2c2926   /* strong headings */
```

### Dark Mode — Neutral Dark, Terminal Glow
```css
--bg:             #292a2e   /* neutral dark, no blue cast, no warm cast */
--bg-warm:        #30333a   /* surface */
--bg-code:        #1e2127
--text:           #e0ddd8
--text-secondary: #a8a29e
--text-tertiary:  #8a847d
--border:         #3e4249
--border-light:   #353940
--accent:         #39fca8   /* mint green — punchy, terminal glow on dark */
--accent-dim:     rgba(57, 252, 168, 0.08)
--ink:            #f0ece4
```

**Why the modes feel different:** Light mode is warm parchment (editorial by day). Dark mode is neutral dark with a mint accent (terminal by night). This is intentional — not two separate brands, but the same person in two different environments. Don't try to make them match.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable (daily-app mode)
- **Project items:** `padding: 1.25rem 0 1.25rem 0.75rem`, `margin-left: -0.75rem` — the left offset creates space for the inset hover stripe without layout shift
- **Bio paragraphs:** `1rem` top margin between consecutive `.intro-bio` elements
- **Section gap:** `3rem` between major sections

## Layout
- **Approach:** Single column, left-aligned
- **Max content width:** `720px` (`--max-width`)
- **Container:** `max-width: var(--max-width); margin: 0 auto; padding: 0 1.5rem`
- **Cat mascot:** Absolutely positioned, `right: 0; bottom: 0; width: 450px; transform: translateX(30%)` — decorative, desktop only

## Projects Section Structure
Two tiers — don't collapse them into a flat list:

1. **Hero entries** (Vara Network, Gear Protocol): full project name + lang badge + italic role line + description + `→ link`
2. **AI Agent Tooling group**: category chip (`font-size: 0.75rem; uppercase; letter-spacing: 0.1em; color: var(--text-secondary)`) with left-border sub-list

**Hover:** `box-shadow: inset 3px 0 0 var(--accent)` on hero items, `inset 2px` on sub-items. Arrow links slide `translateX(4px)` on row hover.

## Motion
- **Approach:** Intentional — only what aids comprehension or gives tactile feedback
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` on all transitions (quick out, soft settle)
- **Duration:** `0.2–0.25s` for color/shadow, `0.4s` for load animations
- **Load animation:** `@keyframes fadeUp` (opacity 0→1, translateY 8px→0) staggered with 50ms increments on project and writing items
- **Reduced motion:** All animations disabled via `@media (prefers-reduced-motion: reduce)`
- **Rule:** Don't add more motion. What's there is the ceiling.

## "currently:" Stamp
A single italic Plex Mono line below the nav (`font-size: 0.72rem; color: var(--text-tertiary); font-style: italic`). The project name in `--accent`. Update manually when focus shifts.

```html
<div class="currently">currently: <span>vara-wallet</span></div>
```

**Why it's here:** Makes the site feel like active practice, not archive. No other portfolio site in this space does this at nav level.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-06 | Font stack: Source Serif 4 + Instrument Sans + IBM Plex Mono | Warm editorial + clean UI + technical identity. All three roles distinct. |
| 2026-04-06 | Terracotta accent (#c44b28) in light mode | Warm, unique, not borrowed from any design system. Earthy rather than digital. |
| 2026-04-06 | Mint accent (#39fca8) in dark mode | Kept user's preference. Punchy terminal glow on neutral dark. Intentional contrast with light mode. |
| 2026-04-06 | Dark mode bg: #292a2e (neutral, no cast) | #2b2e33 had blue cast (cold). #21201c caused eye strain (too warm/dark). Neutral is comfortable. |
| 2026-04-06 | Projects: 2-tier hierarchy | Vara Network + Gear Protocol are career-defining infrastructure. AI tools are current work. Flat list loses that distinction. |
| 2026-04-06 | "currently:" stamp | One line, always visible. Signals active practice. Free to update. |
| 2026-04-06 | No changes to layout structure | Single-column editorial with cat mascot works. First-time visitors need the founding story before the projects list. |
