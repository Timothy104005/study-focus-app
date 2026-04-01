# DESIGN_SPEC (Design Focus V2)

## Source of truth
- **Visual parent:** reference page 1 from attached design pack.
- **Brand motif:** reference page 3 logo geometry (sparse intersecting vertical/horizontal line motif).
- **Secondary references:** PNG pages showing focus start/stop drag behavior, left rail navigation behavior, plan flow, and note tab treatment.

## Core visual language
1. **Palette**
   - Background: warm white (`#F4F4F2` / nearby neutrals).
   - Primary navy surfaces: desaturated navy (`#567393` family).
   - Structural line: sage grey (`#9CB0AD`).
   - Accent red: action emphasis (`#B84040`).
   - Note paper: warm beige (`#CFC8BA`).
   - Text: near-black for key numerics and labels.
2. **Geometry**
   - Use sparse line intersections as brand DNA on headers/shells.
   - Prefer rectangular blocks with low-radius corners over glossy cards.
   - Keep generous whitespace and large typographic hierarchy.
3. **Typography**
   - Prioritize Traditional Chinese user copy by default.
   - Timer numerals are oversized and high contrast.
   - Short, directive labels (`start`, `stop`) stay intentionally prominent.

## Token mapping (implementation intent)
- `--color-vanilla`: neutral canvas.
- `--color-navy` + derived navy scale: shell/nav/components.
- `--color-sage`: linework + separators + motif strokes.
- `--color-bloodstone`: interaction accent (start/stop/progress).
- `--color-chalk`: muted panel background.

## Shared shell behavior
- Left drawer remains existing logic, visual refresh only.
- Navigation labels in Traditional Chinese for MVP demo consistency.
- Bottom mobile nav remains fixed; active state uses light tile over navy base.

## Page-by-page extension
- **Login**: apply motif header + flatter panel and accent CTA.
- **Groups / Group Detail**: convert cards to flatter navy/neutral system without changing data flow.
- **Leaderboard**: emphasize rank contrast and zebra readability within muted surfaces.
- **Exams / Plans**: keep current CRUD behavior, restyle countdown cards + controls.
- **Profile**: align stats, hero, and recent sessions to same token system.
- **Focus**: preserve existing drag-to-stop/start interactions and note tab, align visuals to parent references.

## Non-goals
- No backend contract or business logic redesign.
- No auth architecture rewrite (UI-only refinements allowed).
- No i18n removal; all changes remain compatible with future language packs.
