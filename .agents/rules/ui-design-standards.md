---
description: Universal UI Design Standards & Anti-ChatGPToso Aesthetic for RoomUp! V2
always_on: true
---

# Universal UI Design Standards & Anti-"ChatGPToso" Aesthetic

## 1. Zero "ChatGPToso" / AI-Template Slop
- **NO Rainbow Candy Colors**: Never render random multi-colored badges (neon purple, bright cyan, neon pink, lime green, yellow) next to each other.
- **NO Rainbow Gradients**: Never use saturated rainbow gradients on cards, titles, borders, or backgrounds.
- **NO Flashy Glow Effects**: Avoid heavy, multi-colored `box-shadow` or neon glow that makes the dashboard look like an over-decorated AI prototype.
- **Clean Neutral Dark Theme**:
  - Base Background: `#0e0e11`
  - Sidebar & Nav Rails: `#121317`
  - Card Surfaces: `#18191f` (1px solid rgba(255, 255, 255, 0.06))
  - Input Backgrounds: `#101115` (1px solid rgba(255, 255, 255, 0.08))
  - Text Primary: `#f8fafc`
  - Text Muted/Secondary: `#94a3b8`
  - Accent Color: Discord Blurple (`#5865F2`) used purposefully for primary actions and active toggles.

## 2. Strict Squircle Geometry (Supercerchi)
- **Supercircles (`.supercircle` / `border-radius: 28%`)**:
  - All module icons, avatar containers, status badges, and server icons MUST use squircle / supercircle geometry.
  - No sharp 90-degree boxes and no harsh plain circles when squircle styling is designated.
- **Cards & Modals**: Uniform `border-radius: 12px` or `14px`.
- **Buttons & Form Inputs**: Uniform `border-radius: 8px` or `10px`.

## 3. Pixel-Perfect Structural Alignment Across ALL Tabs
Every tab pane across the entire dashboard must follow the exact same visual hierarchy:
1. **Sub-Header**:
   - `<div class="sub-header">`
   - Left side: `<div class="module-icon supercircle"><i class="fas fa-..."></i></div>` + Title `<h3>` + Description `<p>`.
   - Right side: Action buttons / Save trigger.
2. **Card Grid**:
   - Layout in `.grid-2`, `.grid-3`, or single column with identical gap (`1.25rem`).
   - Every card has `.dashboard-card` with `.card-header` (`.card-title` + `.card-desc`) and `.card-body`.
3. **Form Elements**:
   - `.form-group` with `.form-label`, `.form-control` (inputs, selects, textareas), and `.form-hint`.
4. **Tables**:
   - Standard `.data-table` with uppercase headers, subtle borders, and monospace identifiers.
5. **Badges & Tags**:
   - Subdued monochromatic `.badge-tag` with neutral dark background and subtle border.

## 4. Standard Metriche KPI & Griglie Mobile
1. **Centratura Geometrica Rigorosa per Metriche (`.metric-box`, `.stat-card`)**:
   - Tutte le box statistiche devono avere centratura assoluta sia verticale che orizzontale:
     `display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;`
   - Il wrapper dei testi interni (`.metric-info`, `.metric-box > div:not(.metric-icon)`) deve avere larghezza 100% con `display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; margin: 0 auto;`.
   - Il valore numerico (`.metric-val`, `.stat-card-value`) DEVE avere:
     `text-align: center !important; font-variant-numeric: tabular-nums; width: 100%;`
     L'uso di `tabular-nums` impedisce che cifre asimmetriche (come `1`, `0`, `#`) appaiano disallineate o scivolino a sinistra.
   - L'etichetta (`.metric-label`, `.stat-card-title`) DEVE avere:
     `text-align: center !important; width: 100%; text-transform: uppercase; letter-spacing: 0.6px;`

2. **Griglia Mobile KPI a 2x2 Colonne (`.grid-4`)**:
   - Su schermi smartphone e tablet (`max-width: 768px` e `max-width: 480px`), le metriche KPI non devono mai collassare in un'unica colonna verticale gigante.
   - Devono sempre adottare una griglia 2x2 compatta ed elegante:
     `grid-template-columns: repeat(2, 1fr) !important; gap: 0.75rem !important;`
   - Il padding delle card su mobile deve essere ridotto a `0.9rem 0.65rem` con icone compatte a `38x38px` squircle.

