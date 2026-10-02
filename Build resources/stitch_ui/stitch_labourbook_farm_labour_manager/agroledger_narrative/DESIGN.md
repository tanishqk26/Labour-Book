---
name: AgroLedger Narrative
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#414844'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#012d1d'
  on-primary: '#ffffff'
  primary-container: '#1b4332'
  on-primary-container: '#86af99'
  inverse-primary: '#a5d0b9'
  secondary: '#53606a'
  on-secondary: '#ffffff'
  secondary-container: '#d7e4f0'
  on-secondary-container: '#596670'
  tertiary: '#510900'
  on-tertiary: '#ffffff'
  tertiary-container: '#781300'
  on-tertiary-container: '#ff8266'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd4'
  primary-fixed-dim: '#a5d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3d'
  secondary-fixed: '#d7e4f0'
  secondary-fixed-dim: '#bbc8d3'
  on-secondary-fixed: '#111d25'
  on-secondary-fixed-variant: '#3c4851'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a4'
  on-tertiary-fixed: '#3e0500'
  on-tertiary-fixed-variant: '#8c1700'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-currency:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 280px
  drawer-width: 400px
---

## Brand & Style

The design system is built on the metaphor of a **Modern Digital Notebook**. It moves away from sterile corporate HR software toward a tool that feels like a trusted physical ledger—sturdy, reliable, and grounded in the reality of agricultural management. 

The aesthetic blends **Minimalism** with **Tactile/Skeuomorphic** hints. It uses heavy whitespace and a limited, nature-inspired palette to reduce cognitive load for farmers managing complex data after a long day in the field. The emotional response should be one of "quiet productivity"—an interface that feels as essential and hardworking as the tools in a barn.

**Key Principles:**
- **Utility First:** Prioritize data entry and financial clarity above all else.
- **Agricultural Sophistication:** Use deep greens and earthy tones to feel native to the industry without appearing "low-tech."
- **Evening-Optimized:** Use warm background tones to reduce eye strain during late-night accounting.

## Colors

This design system utilizes a high-contrast, organic palette. 

- **Primary (#1B4332):** A deep forest green used for primary actions, navigation states, and success indicators. It represents growth and stability.
- **Background (#FDFCF8):** A warm off-white (cream) base that prevents the clinical feel of pure white and reduces blue-light harshness.
- **Tertiary (#D94324):** A warm, burnt orange-red reserved exclusively for outstanding balances, urgent warnings, or "Money Out" indicators.
- **Neutral (#2D2D2D):** A charcoal gray for maximum legibility in text.
- **Borders (#E5E2D9):** A soft, beige-tinted gray to define structure without creating visual noise.

## Typography

The typography system uses **Inter** for its exceptional legibility and neutral, modern character. 

**Currency Formatting:**
A custom `display-currency` role is defined for financial totals. The Rupee symbol (₹) should always be rendered with the same weight as the digits, but can be scaled down by 10% in size to keep focus on the numerical value.

**Hierarchy Rules:**
- Use `headline-lg` for page titles (e.g., Worker Name).
- Use `label-caps` for table headers and metadata labels.
- For mobile, scale down large headlines to avoid awkward text wrapping, ensuring no line of text is smaller than 14px for accessibility.

## Layout & Spacing

The layout follows a **sidebar-based fixed grid** for desktop and a **fluid single-column** for mobile.

- **Desktop:** A permanent 280px sidebar on the left provides navigation. The main content area uses a 12-column grid with 24px margins.
- **Side Drawers:** "Add Entry" or "Edit Worker" actions must open in a right-aligned side drawer (400px width) rather than a centered modal to maintain the "notebook" feel.
- **Vertical Rhythm:** A strict 8px spacing scale is used. Group related items with 8px or 16px; separate sections with 32px or 48px.
- **Mobile:** Transition to a bottom-tab navigation for primary actions, with full-screen overlays for data entry.

## Elevation & Depth

To maintain the "practical notebook" aesthetic, this design system avoids heavy shadows and floating effects.

- **Tonal Layers:** Depth is created primarily through color. The main background is `#FDFCF8`, while interactive cards and the sidebar use a pure white `#FFFFFF` surface to "pop" forward.
- **Low-Contrast Outlines:** Instead of shadows, use 1px borders in `#E5E2D9`.
- **Active States:** When a card or list item is pressed, it should not lift (no shadow increase); instead, use a subtle inner-stroke or a slight background color shift to `#F4F2EB`.
- **Soft Shadows:** Only used for the Side Drawer and high-level Dropdowns to separate them from the content below (e.g., `0px 4px 20px rgba(0, 0, 0, 0.05)`).

## Shapes

The shape language is "Soft-Modern." 

- **Components:** Standard buttons, input fields, and small cards use a **10px corner radius** (defined by `roundedness: 2`).
- **Containers:** Large dashboard sections or the main content container use **16px (rounded-xl)** to create a friendly, approachable framing.
- **Interactive Elements:** Checkboxes use a 4px radius, maintaining a distinct square-ish profile to differentiate them from circular radio buttons.

## Components

**Buttons:**
- **Primary:** Solid `#1B4332` with white text. High contrast, 10px radius.
- **Secondary:** Transparent with a `#1B4332` border and text.
- **Ghost:** No border, text-only for less frequent actions like "Cancel."

**Cards:**
- White background, 1px `#E5E2D9` border. 
- No shadow.
- Used for "Worker Summary," "Today's Attendance," and "Total Payable."

**Tables (Labour Lists):**
- No vertical lines. 
- Horizontal separators only in `#E5E2D9`.
- Row height of 64px to accommodate thick-fingered tapping and large text.
- The "Payment" column should use the `Tertiary` color if the balance is positive.

**Input Fields:**
- Large touch targets (min-height 48px).
- Labels are always visible (no disappearing placeholders).
- Focus state uses a 2px `#1B4332` border.

**Attendance Chips:**
- "Present": Soft green background with `#1B4332` text.
- "Absent": Soft gray background with `#2D2D2D` text.
- "Half-day": Soft yellow/earth-tone background.

**Specialized Component: The Money Bar**
A sticky footer or header element that displays the "Total Due Today" in the `display-currency` style, ensuring the financial impact of entries is always visible.