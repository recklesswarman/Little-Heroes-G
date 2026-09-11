---
name: Adventurous Explorer
colors:
  surface: '#09141e'
  surface-dim: '#09141e'
  surface-bright: '#2f3a45'
  surface-container-lowest: '#050f18'
  surface-container-low: '#121d26'
  surface-container: '#16212b'
  surface-container-high: '#202b35'
  surface-container-highest: '#2b3640'
  on-surface: '#d8e4f1'
  on-surface-variant: '#bbcbbb'
  inverse-surface: '#d8e4f1'
  inverse-on-surface: '#27323c'
  outline: '#869486'
  outline-variant: '#3d4a3e'
  surface-tint: '#4ae183'
  primary: '#54e98a'
  on-primary: '#003919'
  primary-container: '#2ecc71'
  on-primary-container: '#005027'
  inverse-primary: '#006d37'
  secondary: '#ffb961'
  on-secondary: '#472a00'
  secondary-container: '#e89300'
  on-secondary-container: '#563400'
  tertiary: '#a3d3ff'
  on-tertiary: '#003351'
  tertiary-container: '#5fbaff'
  on-tertiary-container: '#004970'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bfe9c'
  primary-fixed-dim: '#4ae183'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005228'
  secondary-fixed: '#ffddb9'
  secondary-fixed-dim: '#ffb961'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#663e00'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#92ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#09141e'
  on-background: '#d8e4f1'
  surface-variant: '#2b3640'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  body-lg:
    fontFamily: Quicksand
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-md:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-xl:
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 20px
---

## Brand & Style
The design system is centered on a **Tactile Toy** aesthetic, specifically tailored for a young, adventurous audience. The brand personality is energetic, sturdy, and rewarding. It avoids the delicate or "precious" look of typical apps in favor of a "rugged digital toy" feel—think building blocks, chunky plastic controllers, and outdoor gear.

The style combines elements of **Skeuomorphism** and **Neomorphism** to create high affordance. Every interactive element should look like it can be physically pressed, slid, or toggled. The goal is to evoke a sense of physical play and tactile satisfaction upon completing tasks. 

**Key Principles:**
- **Chunky Affordance:** Large touch targets with exaggerated 3D depth.
- **Safety & Durability:** Rounded corners and soft edges to feel "child-safe."
- **Adventurous Atmosphere:** Darker, "night-sky" or "deep-forest" backgrounds that make vibrant interactive components glow and pop.

## Colors
The palette is built on high-energy, high-contrast combinations using a dark canvas to ensure the UI feels like a glowing cockpit or a magical treasure chest.

- **Background (Neutral):** A deep, midnight navy-charcoal (#0D1317) provides the foundation. Surface containers use a slightly lighter slate (#1A252F).
- **Action (Primary):** Vibrant "Jungle Green" (#2ECC71) is used for "Success" actions, habit completion, and growth-related UI.
- **Adventure (Secondary):** "Energetic Orange" (#F39C12) is used for active states, notifications, and important navigation.
- **Support (Tertiary):** "Deep Sky Blue" (#3498DB) is used for information, habit categories, and secondary buttons.
- **Reward (Accent):** "Sunny Yellow" (#F1C40F) is reserved strictly for currency, coins, and high-tier rewards to denote value.

**Note:** Pink and Purple are strictly omitted from this palette to maintain the specific adventurous, boy-focused theme requested.

## Typography
The typography strategy prioritizes legibility and friendliness. 

- **Headlines:** Use **Plus Jakarta Sans** for its bold, geometric, and modern look. It should always be used in extra-bold or bold weights to match the "chunky" visual language.
- **Body & Labels:** Use **Quicksand** for its rounded terminals and open apertures. This font feels approachable and is highly readable for children who are beginning to read.
- **Style Rules:** Avoid all-caps for long sentences. Use all-caps only for short, high-impact labels or coin tallies. Increase letter-spacing slightly for labels to improve clarity.

## Layout & Spacing
The layout follows a **fluid-grid** model with generous safe areas to prevent accidental taps (fat-finger syndrome). 

- **Touch Targets:** No interactive element should be smaller than 48px x 48px. 
- **Spacing Rhythm:** Use a 8px-based scale. For component grouping, use 12px or 24px. For major section breathing room, use 40px or 64px.
- **Breakpoints:** 
  - **Mobile:** 1-column layout for habits; 2-column for coin rewards. 
  - **Tablet:** 2-column layout for habits; 4-column for rewards.
- **Safe Zones:** High-frequency buttons (like "Complete Task") should be placed in the bottom-middle "thumb zone."

## Elevation & Depth
Elevation is not conveyed through light, airy shadows, but through **thick, physical bevels and 3D stacking.**

1.  **Chunky Bevels:** Instead of standard dropshadows, use "offset borders." A button should have a 4px-8px bottom border of a darker shade of the button's color to simulate a physical side-profile.
2.  **Inner Shadows:** Use subtle inner shadows on the top edge to create a "beveled plastic" look.
3.  **Active State:** When pressed, the component should move down (TranslateY) by 4px and the bottom "3D border" should disappear, simulating a physical button being depressed.
4.  **Surface Stacking:** Cards use a heavy, 12px offset shadow (Blur 0, Y-Offset 8px) in a darker-than-background tone to look like they are floating blocks.

## Shapes
Shapes are intentionally "inflated." 

- **Primary Radius:** Use the `rounded-lg` (1rem / 16px) as the default for most buttons and input containers.
- **Card Radius:** Use `rounded-xl` (1.5rem / 24px) for main task cards and navigation panels to give them a soft, toy-like appearance.
- **Pill Shapes:** Currency displays and navigation tabs should use full pill-shaping (circular ends) to distinguish them from actionable task cards.

## Components

### Buttons
- **Primary:** Extra-large, chunky green buttons. 8px dark-green bottom border. White bold text.
- **Secondary:** Blue buttons with 4px dark-blue bottom border.
- **Feedback:** On-press, the button "sinks" into the screen.

### Habit Cards
- **Structure:** A large container with a 3D-rendered icon on the left, habit name in the center, and a "Big Green Check" button on the right.
- **Visuals:** Use a 2px stroke in a slightly lighter shade than the card background to define the edges against the dark UI.

### Currency Displays
- **Habit Coins:** Circular gold-rimmed containers with a spinning 3D coin icon. The background of the pill should be semi-transparent "Glass" to show depth.
- **Points:** Rectangular badge with "Star" iconography.

### Navigation Tabs
- **Location:** Fixed to the bottom. Large icons (3D style) that "pop up" or bounce when selected. Use a thick, 12px padded container to ensure it feels like a physical dock.

### Progress Bars
- **Style:** "Tube" style. The background is a dark "empty pipe" and the fill is a glowing, vibrant green "liquid" or "solid block" that fills up. Use segmented blocks for easier counting by younger children.

### Selection (Checkboxes/Radios)
- Replace standard checkboxes with "Toggle Switches" that look like heavy-duty plastic rockers or "Stamp" slots that fill with a 3D icon when tapped.