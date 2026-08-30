---
name: Monolith Ledger
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#434656'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#4e4e4e'
  on-tertiary: '#ffffff'
  tertiary-container: '#666666'
  on-tertiary-container: '#e6e4e4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e4e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

The design system is built on a foundation of **Rigid Minimalism** and **Modern Flat Design**. It targets professionals who value precision, clarity, and structural integrity in their financial data. The emotional response is one of controlled authority and absolute transparency.

Key stylistic pillars:
- **Zero-Radius Geometry:** Every element features sharp, 90-degree corners to evoke a sense of architectural stability and digital precision.
- **Flat Hierarchy:** Depth is communicated through color blocking and stroke weight rather than shadows or gradients. 
- **High-Contrast Utility:** Pure blacks, stark whites, and saturated functional accents ensure that data is the primary focus, removing all decorative "fluff."
- **Institutional Clarity:** The aesthetic borrows from brutalist efficiency but maintains a polished, corporate execution suitable for fintech.

## Colors

The palette is strictly functional, using high-contrast neutrals to frame financial data.

- **Primary Action:** A vibrant "Digital Blue" (#0052FF) is reserved exclusively for interactive elements and primary call-to-actions.
- **Monochrome Foundation:** Pure Black (#000000) is used for borders, primary headings, and heavy UI anchors. Light Grey (#F5F5F5) provides subtle "zoning" for background sections.
- **Financial Status:**
    - **Income (Success):** A high-visibility green for positive cash flow.
    - **Expense (Error):** A sharp, urgent red for outflows and alerts.
- **UI Borders:** All containers and inputs utilize a consistent 1px or 2px solid black stroke to define boundaries without the use of shadows.

## Typography

This design system employs a "Type-as-UI" approach. **Inter** provides a neutral, highly readable canvas for interface elements, while **JetBrains Mono** is introduced for numerical data and transaction strings to emphasize the "ledger" nature of the product.

- **Scale:** Use tight line-heights for headlines to create dense, impactful blocks of text.
- **Weight:** Use `Extra Bold` (800) for large currency displays to ensure they dominate the visual hierarchy.
- **Labels:** Use uppercase with increased letter spacing for small metadata labels to ensure legibility despite the small size.
- **Numerics:** All currency values should use tabular lining figures (monospaced) to ensure columns of numbers align perfectly in lists.

## Layout & Spacing

The layout is governed by a strict **4px baseline grid**. All margins and paddings must be multiples of 4.

- **Grid System:** A 12-column grid for desktop and a 4-column grid for mobile. 
- **Geometric Zoning:** Content is organized into clear, rectangular blocks. Use 1px black borders to separate categories of information instead of whitespace alone.
- **Generous Gutters:** While the corners are sharp, the internal spacing (padding) within cards and containers should be generous (24px+) to prevent the high-contrast borders from feeling claustrophobic.
- **Alignment:** All elements must be hard-aligned to the grid. No centered text in data tables; use left-aligned for descriptors and right-aligned for financial values.

## Elevation & Depth

This design system intentionally rejects physical depth. 
- **No Shadows:** Do not use box-shadows or drop-shadows under any circumstances.
- **Tonal Layering:** To indicate that an element is "above" another (like a modal), use a solid black background overlay at 40% opacity and give the modal a 2px solid black border with a pure white background.
- **Active States:** Instead of "pressing" down, buttons should invert color (e.g., White text on Black background becomes Black text on White background) or shift 2px down and right if a "hard-shadow" brutalist effect is desired for specific tactile feedback.
- **Focus States:** Use a 2px offset solid blue border to indicate keyboard focus or active input fields.

## Shapes

The shape language is strictly **rectangular**. 

- **Corner Radius:** All `border-radius` values are set to `0px`. This applies to buttons, input fields, cards, modals, and even checkboxes.
- **Icons:** Use thick-stroke (2px), geometric icons that avoid rounded terminals. Icons should be framed within square containers.
- **Dividers:** Use 1px or 2px solid lines. Avoid hairline (0.5px) borders to maintain the "professional/sturdy" aesthetic.

## Components

### Buttons
- **Primary:** Solid blue background, white text, 0px radius, bold weight.
- **Secondary:** White background, 2px black border, black text.
- **Critical:** Solid red background, white text.

### Input Fields
- **Default:** White background, 1px black border, 16px horizontal padding.
- **Focus:** 2px blue border. Label should be positioned strictly above the input in `label-caps` style.

### Cards & Containers
- Containers must have a 1px black border. 
- Headers within cards should be separated by a horizontal 1px line.
- For "Income" or "Expense" specific cards, a 4px solid color stripe may be added to the left edge.

### Data Tables / Lists
- Rows should have a 1px bottom border. 
- Hover state: Background changes to `#F5F5F5`. 
- No zebra-striping; use borders for separation.

### Chips/Tags
- Rectangular blocks with solid background colors. Use `label-caps` typography. No rounded ends.

### Transaction Items
- Use a three-column layout: Icon (square), Description/Category (left-aligned), and Amount (right-aligned, using `data-mono`).