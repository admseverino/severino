# HIDROSYNC — Visual & UI Reference

**Use this document whenever you create or modify a new feature, page, or interface.** It is the single source of truth for colors, radius, typography, and component patterns so all UIs stay consistent and on-brand.

---

## How to use (for AI)

When building a new page or component:
1. **Reference this file** (e.g. `@docs/VISUAL_GUIDE.md`) so your output follows the same aesthetics.
2. Prefer the **exact class names and values** listed below over inventing new ones.
3. **HIDROSYNC brand colors** (`hidrostone`, `hidrogray`, `quicksilver`, `hidrogreen`) are defined in `app/globals.css` and `tailwind.config.ts`; use them by name.

---

## 1. Color palette

### Semantic (Tailwind / CSS variables)

Use these for backgrounds, text, borders, and states. They are in `hsl(var(--…))` in the main app.

| Purpose        | Background class     | Text class              | Use for                          |
|----------------|----------------------|-------------------------|----------------------------------|
| Page / default | `bg-background`      | `text-foreground`       | Page background, body            |
| Cards / surfaces | `bg-card`          | `text-card-foreground`  | Cards, panels                    |
| Muted / subtle | `bg-muted`           | `text-muted-foreground` | Secondary text, placeholders     |
| Primary action | `bg-primary`         | `text-primary-foreground` | Primary buttons, key CTAs    |
| Secondary UI   | `bg-secondary`       | `text-secondary-foreground` | Secondary buttons, tabs    |
| Borders / inputs | —                  | —                        | `border-border`, `border-input`  |
| Destructive    | `bg-destructive`     | `text-destructive-foreground` | Delete, danger actions   |

### HIDROSYNC brand (main app)

Defined in `app/globals.css` and exposed in Tailwind. **Use these for brand presence**, not for generic grays.

| Name         | Tailwind class   | Hex        | Use for                                |
|--------------|------------------|------------|----------------------------------------|
| Hidro Stone | `hidrostone`    | `#424242`  | Dark accents, badges, strong text      |
| Hidro Gray  | `hidrogray`     | `#A8ABAC`  | Secondary brand elements               |
| Quicksilver  | `quicksilver`    | `#EFEFEF`  | Light backgrounds, dividers            |
| Hidro Greenish | `hidrogreen`      | `#27ac97`  | CTAs, highlights, links (accent)       |

**Examples:** `bg-hidrostone text-white`, `text-hidrogreen`, `bg-quicksilver`, `border-hidrogreen`.

### Neutral grays (when not using semantic/brand)

- Light: `bg-gray-50`, `bg-gray-100`, `bg-gray-200` (e.g. secondary buttons, disabled).
- Dark text: `text-black` for primary buttons and strong contrast.
- Hover: `hover:bg-gray-100`, `hover:bg-gray-200` for white/gray buttons.

---

## 2. Border radius

**Standard radius is 4px** across the main app for buttons, cards, inputs, and thumbnails.

| Use case              | Class           | Value   |
|-----------------------|-----------------|---------|
| Default (buttons, cards, inputs, thumbnails) | `rounded-[4px]` | 4px     |
| Softer (optional)     | `rounded-md`    | theme   |
| Larger containers     | `rounded-lg`    | theme   |
| Pills / tags          | `rounded-full`  | full    |

**Rule:** Prefer `rounded-[4px]` for new UI elements unless the design explicitly uses pills (`rounded-full`) or a different radius. Do not introduce new arbitrary radii without updating this guide.

---

## 3. Typography

- **Font:** Chivo (Google Font), loaded in `app/layout.tsx` with `variable: "--font-chivo"` and applied to `<body className={chivo.className}>`. Body text uses Chivo by default.
- **Weights:** Chivo is loaded with weights 300, 400, 500, 600, 700. Use `font-medium`, `font-semibold`, `font-bold`, `font-extrabold` for hierarchy.
- **Buttons / CTAs:** Often `text-sm md:text-lg font-bold` or `font-extrabold` and `uppercase` for primary actions.
- **Labels / secondary:** `text-sm`, `text-muted-foreground` or `text-xs` for captions.
- **Explicit Chivo:** Use `font-['Chivo']` when you need to force Chivo (e.g. inside a component that might override the body font).

---

## 4. Buttons

### Primary (main CTA)

- Classes: `bg-white text-black hover:bg-gray-100`, plus `font-bold` or `font-extrabold`, `uppercase`, `rounded-[4px]`.
- Optional: `outline` for outline style, `px-4 py-2` or `px-4 py-4 md:px-8 md:py-6` for larger CTAs.

Example:

```tsx
<button className="bg-white text-black hover:bg-gray-100 px-4 py-4 md:px-8 md:py-6 text-sm md:text-lg font-bold uppercase outline rounded-[4px]">
  Action
</button>
```

### Secondary (back / cancel)

- Classes: `bg-gray-100 text-black hover:bg-gray-200`, same typography and `rounded-[4px]`.

### Brand accent

- Use `bg-hidrostone text-white` or `bg-hidrogreen text-white` with `rounded-[4px]` when the button should feel clearly “HIDROSYNC” (e.g. badges, key CTAs).

---

## 5. Cards & containers

- **Card:** `border rounded-md` or `rounded-[4px]`, `bg-white` or `bg-card`, `p-4` (or consistent padding).
- **Thumbnails / media:** `rounded-[4px] overflow-hidden` for images.
- **List items:** `p-4 border rounded-md bg-white` for rows or blocks.

---

## 6. Spacing & layout

- Use Tailwind spacing scale: `p-2`, `p-4`, `gap-2`, `gap-4`, etc.
- Container: theme `container` is centered with padding; `2xl` at 1400px.
- Keep vertical rhythm consistent (e.g. `space-y-4`, `space-y-6` between sections).

---

## 7. Shadows & effects

- Prefer subtle or no shadow by default; use `shadow`, `shadow-sm` if needed.
- **Liquid glass:** The main app defines `.liquid-glass` in `app/globals.css` (blur, translucent background, 18px radius). Use only when the design explicitly calls for that effect.

---

## 8. Global constraints

- **Light mode only:** The main app forces light mode (`color-scheme: light only`, white background). Do not rely on dark mode for new features in the main app unless the product direction changes.
- **Accessibility:** Keep contrast sufficient; primary actions use `text-black` on white or `text-white` on `hidrostone`/`hidrogreen`.

---

## Quick checklist for new UI

- [ ] Background: `bg-background` or `bg-white` / `bg-card`
- [ ] Text: `text-foreground` or `text-black` with `text-muted-foreground` for secondary
- [ ] Radius: `rounded-[4px]` for buttons, cards, inputs, thumbnails
- [ ] Buttons: primary = white + black text + `rounded-[4px]`; secondary = gray-100/200
- [ ] Brand: use `hidrostone`, `hidrogray`, `quicksilver`, `hidrogreen` where appropriate
- [ ] Font: Chivo (body default from layout); bold/uppercase for main CTAs

