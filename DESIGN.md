# Zola — Design System

> The visual identity for Zola, a discovery app for long-form essays. This document captures the design philosophy, the palette, the typography, and the rationale behind each decision so future work stays coherent.

---

## 1. Brand

**Name**: **Zola** — after Émile Zola, the 19th-century French novelist and essayist. The name carries journalistic conviction (his open letter *J'Accuse…!* in defense of Dreyfus is one of the most-cited acts of public writing in modern history) and literary heft (the Rougon-Macquart cycle of 20 novels). For a product whose purpose is *finding writing worth your evening*, "Zola" sets the right reference point: serious, French-coded, literary, accountable.

**Tagline**: *Essays worth your evening.*

Alternates we considered:
- *Read deeper.* — too generic
- *Slow reading for fast lives.* — too declarative
- *A library of long form.* — too descriptive

The chosen tagline does three things at once: signals long-form, anchors a use-case (the evening reader, not the commute scroller), and uses "worth" — a quiet claim of curatorial judgment.

---

## 2. Design philosophy

Three principles, in priority order.

### 2.1 Literary, not vintage
Zola is a 2026 product. The visual language should feel like a contemporary independent magazine site (think *The Dial*, *Increment archives*, *The New York Review of Books'* digital surfaces) — not a pastiche of an old book. We use serifs because reading is the verb, but we use *contemporary* serifs designed for screens, on warm-white (not parchment) backgrounds, with confident modern color choices.

### 2.2 Content leads, brand recedes
Articles and their excerpts are the primary visual content on every page. The chrome (nav, buttons, filters) is colored but not loud. The brand wordmark is the one place where we let visual personality fully express itself — everywhere else, content earns the attention.

### 2.3 One clear voice, not a theme buffet
We ship a single coherent identity (warm white + deep teal + sea green + ink) plus a faithful dark mirror. We deliberately do *not* ship "themes" or color-picker customization. Strong product design means making a confident choice; the user's job is to read.

---

## 3. Palette

The brand palette is two cool jewel-tones (teal + green) sitting on warm-white paper, with an ink-blue text color that harmonizes with the accents instead of fighting them. Two-color accent palettes are easier to keep coherent than three; the third color is the text itself.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#FAFAF8` warm white | `#0E1A22` deep ink | Page background |
| `--foreground` | `#14242E` deep ink-blue | `#E8DECB` warm cream | Body text, headlines |
| `--muted` | `#F1EEE6` paper edge | `#1A2A33` slightly raised | Card borders, dividers, hover surfaces |
| `--muted-foreground` | `#5C6B73` cool gray | `#93A2AC` cool gray | Secondary text, bylines |
| `--border` | `#ECE7DA` soft cream edge | `#1F2F3A` ink edge | Borders, separators |
| `--primary` | `#22577A` deep ocean teal | `#22577A` (unchanged) | Wordmark, primary buttons, links, focused states |
| `--primary-foreground` | `#FAFAF8` warm white | `#FAFAF8` warm white | Text on primary buttons |
| `--accent` | `#40916C` sea green | `#6BC4A0` lighter sea green | Source line, badges, success affordances |
| `--accent-soft` | `#E0EBE5` faint green wash | `#1A2F3A` deep teal-tinged | Tag backgrounds, hover backgrounds |

### Why these colors
- **Teal `#22577A`** is authoritative without being corporate. It reads as ink rather than as marketing. Pairs well with cream paper.
- **Sea green `#40916C`** is the friendly accent — gives the brand a hint of optimism so the whole palette doesn't feel solemn. Used sparingly: source attribution lines, topic tags, the "active" indicator in the nav.
- **Warm white `#FAFAF8`** is almost imperceptibly warm — enough to feel like paper, not enough to feel like parchment. Avoids the Kindle look.
- **Deep ink `#14242E`** has a slight cool/teal undertone that harmonizes with `#22577A`. Pure black next to teals reads as cold and amateur.

### Accessibility
- Body text on background: `#14242E` on `#FAFAF8` → ~14.5:1 contrast ratio. Comfortably exceeds WCAG AAA (7:1).
- Primary button text: `#FAFAF8` on `#22577A` → ~7.5:1. Exceeds AAA.
- Accent text (source line, tags): `#40916C` on `#FAFAF8` → ~4.6:1. Meets AA for large text; reserved for ≥11px usage where AA-large applies.

---

## 4. Typography

Three families, each with a clearly distinct job.

### 4.1 Spectral — body & headlines
**Use for**: article titles, article body, drop caps, list titles, list descriptions, source detail pages.

Spectral is a contemporary transitional serif designed by Production Type and released through Google Fonts. Unlike most readable serifs, it was drawn explicitly for digital long-form reading — its terminals, proportions, and italic shapes were tuned for screens rather than print. Compared to alternatives:
- Less playful than **Fraunces** (which we considered first; Fraunces was great but warmer/cozier than the brand wants)
- More designed-for-screen than **EB Garamond** or **Cormorant Garamond**
- More personality than **Source Serif 4** or **Tinos**
- Less "book app" than **Literata**

We use weights 400 (body), 500 (titles, drop caps), and the 400-italic (bylines, decorative emphasis).

### 4.2 Inter — UI sans
**Use for**: nav links, button labels, badges, filter chips, form inputs, secondary navigation, captions.

Inter is the contemporary workhorse sans. It's neutral, screen-tuned, and deliberately uninteresting — which is what UI text should be. It steps out of the way of Spectral.

### 4.3 Bagel Fat One — the wordmark
**Use for**: the "Zola" wordmark only — in the nav, on a future landing page hero, and as the favicon source.

Bagel Fat One is a fat, rounded, single-weight display face. It's intentionally maximalist — it carries the brand personality at a single anchor point so the rest of the site can stay calm. The visual contrast between Bagel Fat One (the wordmark) and Spectral (everything else literary) is the brand's signature gesture: a playful welcome at the front door, serious work inside.

We deliberately do *not* use Bagel anywhere except as the wordmark. It's too loud to repeat. Try resisting the temptation to use it for section headers or marketing copy — that's how brands lose their distinct mark.

### 4.4 Font delivery
All three fonts are loaded via `next/font/google` (self-hosted, no CLS, no external request). They are exposed as CSS variables consumed by Tailwind's `font-*` utilities:

```ts
// apps/web/app/layout.tsx (sketch)
import { Spectral, Inter, Bagel_Fat_One } from "next/font/google";

const spectral = Spectral({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-spectral", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bagelFatOne = Bagel_Fat_One({ subsets: ["latin"], weight: "400", variable: "--font-bagel", display: "swap" });
```

```js
// tailwind.config.js
fontFamily: {
  sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
  serif: ["var(--font-spectral)", "ui-serif", "Georgia"],
  display: ["var(--font-bagel)", "ui-sans-serif"],
}
```

Then in components:
- Article titles: `<h1 className="font-serif">`
- Wordmark: `<Link className="font-display">`
- UI: default (Inter) — set body to `font-sans`

---

## 5. Wordmark sizes

Bagel Fat One is a display face. It needs different treatment per context:

| Context | Size | Tracking | Notes |
|---|---|---|---|
| Nav bar (default) | 24–28px | 0 | Letters are already chunky; no need to compress |
| Mobile nav | 22px | 0 | |
| Hero / marketing landing | 96–160px | -0.025em | Tighten for visual cohesion |
| Favicon | 32×32 SVG | n/a | Just the "Z" cut from the same font |

Color: always `--primary` (`#22577A` teal) on light, and `#FAFAF8` warm cream on the dark theme background. Never overlay on a complex image — the wordmark needs to sit on a flat surface.

---

## 6. Voice & verbal style

Out of scope for this design doc; will get its own treatment when we write the marketing home page (Phase 13). For now: copywriting should match the design — confident, restrained, literary, not cute. No emoji. No exclamation points except for genuine surprise. The tagline (*Essays worth your evening.*) is the canonical voice example.

---

## 7. What we're not doing (and why)

**No theme picker / custom themes.** A coherent brand beats configurability. If a user wants a different look, our answer is "we picked one — read with it." (We do keep the light/dark toggle because that's an accessibility / preference baseline, not a brand choice.)

**No icon set swap to "designer" icons.** lucide-react is already in place. Replacing it with custom or premium iconography is high-effort, low-marginal-return. Lucide is clean, free, well-maintained.

**No paper-noise SVG texture.** We initially considered a faint paper noise behind the page. Decided against it: the warm-white already does the "paper" work without the visual debt of an extra asset.

**No drop cap on every paragraph.** Drop cap appears once per article, on the first paragraph of `/article/[id]`. Anything more would be ornamental.

**No custom illustrations** for empty states yet. The `<EmptyState>` component already provides hooks for icons, and lucide icons are sufficient for now. Custom illustrations are a Phase 14 polish item.

**No serif body on cards in browse.** Card descriptions stay in Inter — they're at a size where Spectral starts to feel cramped. Spectral is reserved for headlines (≥18px) and long-form body (article detail page, the deck card title), where it's at its best.

---

## 8. Design decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-22 | Renamed app from "Longform" to "Zola" | After Émile Zola; literary, French-coded, gives the brand a center of gravity that "Longform" (descriptive, generic) lacked. |
| 2026-05-22 | Direction = modern bookish (V1) over paper/ink, French editorial, dark academia | Pulls the brand into 2026 design language without losing the literary anchor. The other directions either felt pastiche (paper/ink) or fought the literary thread (French editorial). |
| 2026-05-22 | Palette: teal `#22577A` + green `#40916C` over oxblood/terracotta | User-led. The teal/green pairing is more contemporary and more French (think the *Café de Flore* moss-greens and the deep ocean of *Verne*) than the warm reds of the initial palette. |
| 2026-05-22 | Body type = Spectral over Fraunces/Newsreader/Cormorant | Spectral was designed specifically for digital long-form. Less playful than Fraunces, less utility than Source Serif. Right gravity for a literary site. |
| 2026-05-22 | UI sans = Inter | Workhorse. Recedes. Already a project standard. |
| 2026-05-22 | Wordmark = Bagel Fat One | Strongest answer to "chunky, slight asymmetry, modernist-playful" without going to a paid font. The contrast against Spectral's elegance is the brand's signature move. |
| 2026-05-22 | No theme picker; one brand identity + light/dark | Coherence > configurability. Theming was a Phase 14 candidate; we're deciding now to not pursue it. |
| 2026-05-22 | Wordmark only — Bagel Fat One never used for headers/marketing copy | A display face is a single anchor, not a system. Discipline keeps the brand mark distinct. |

---

## 9. Implementation reference

For the engineering shape of this design system in code, see:
- `apps/web/app/layout.tsx` — font variable wiring
- `apps/web/app/globals.css` — CSS custom properties for the palette (light + dark)
- `apps/web/tailwind.config.js` — font-family tokens
- `apps/web/components/nav-bar.tsx` — the wordmark using `font-display`
- `apps/web/app/article/[id]/page.tsx` — Spectral typography + drop cap

If you're tweaking the palette, edit `globals.css` once — every component reads from CSS variables. If you're tweaking type, the next/font config in `layout.tsx` is the single source.

---

*Last updated: 2026-05-22.*
