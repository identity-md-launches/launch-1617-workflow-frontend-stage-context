# IMD PEPE RISK design

## Overview

The site is a playable tactical Pepe war room with a separate set of contract operations. Its visual idea is a cartographic hex board under cyan/magenta continent strips, with angular green military miniatures, restrained scanlines, faint crimson ownership pulses, and subdued searchlight/fog/reflection layers. The game is the first screen’s product; setup and Start operation precede the map, and wallet access stays in the header. Practice is explicitly free and has no token rewards.

The assignment forbids root writes despite requesting a root DESIGN.md. This file is the scoped implementation document; the protected repository root was left unchanged.

Sources: `web/src/style.css`, `web/src/components/Game.tsx`, `web/src/components/Pepe.tsx`, `web/src/game/map.ts`, and `web/src/App.tsx`. The scene is original SVG/React art, not a flattened screenshot of gameplay. The 1200×630 WebP cover is generated from the same miniature and map geometry by `web/scripts/cover.tsx`.

## Colors

The deliberate dark-only treatment follows the neon-noir brief; there is no nonfunctional theme toggle. Hex values are canonical.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b1013` | Page background |
| `--surface` | `#131d22` | Command panel, action form and empty states |
| `--line` | `#34454a` | Structural separators |
| `--text` | `#e9ecdf` | Main text |
| `--muted` | `#a7b5b6` | Supporting descriptions |
| `--accent` | `#adf18b` | Primary actions and current phase |
| `--accent-ink` | `#15231c` | Text on the primary button |
| `--cyan` | `#8bdde4` | Links, network/setup guidance |
| `--warning` | `#edd099` | Missing setup / eligibility explanations |
| `--error` | `#ff9bad` | Persistent action errors |

The focus perimeter is `2px solid #c2ffa0`, offset 4px. SVG map focus instead uses a 4-unit white outline on the selected hex. Forced-colors mode restores system Highlight/CanvasText colors.

Faction colors live in `game/map.ts`: jade `#94e77c`, crimson `#ff8799`, cyan `#79d9ec`, amber `#e7c47e`, violet `#cba3ec`, bone `#dfddd1`. Ownership also has a faction number and text label; color is never the only cue. The selected territory has a brighter border; its name and units appear in the command panel. Opponent targets have a crimson outline.

The final taste probe passes its measured 4.5:1 text / 3:1 large-text checks. It excludes SVG artwork and does not prove every translucent map treatment; see validation for the exact coverage. No unmeasured contrast ratios are asserted here.

## Typography

System `Arial, Helvetica, sans-serif` supports the interface; `monospace` is used only for addresses, JSON and technical data. There are no remote font loads. `.game-heading h1` and `.brand > span` have a 1px horizontal knockout at their midline using a CSS mask, providing stencil bridges while preserving real text and accessible names. Body text, font sizes and weights are unchanged. CSS weights are 400, 600 and 800, with the headline at 800. System fonts choose their available closest weight; no custom font-loading claim is made.

Six named size tokens in `style.css` are 12, 14, 16, 20, 28 and 48px. Body copy uses 16px with 1.55 line height; form inputs remain 16px on mobile. Small captions and map legends use 12px; supporting copy uses 14px. The desktop game headline is 48px, 1.06 line height and −1.7px tracking; at 540px and below it is 28px and −0.7px. Other headings use 20px; larger transaction/result headings use 28px.

Headings balance lines; prose is capped at 75ch. Changing numbers use tabular figures. Addresses and amounts wrap rather than truncate, and full precision remains available in transaction reviews. No tracked uppercase kickers or decorative prose monospace are used.

## Layout

The site has a maximum width of 1536px. Desktop gutters are 42px, medium gutters 24px, and phone gutters 16px. Spacing groups use mostly 8, 12, 16, 20, 24 and 32px; large separations use 40px.

The desktop battle area is a flexible map plus a 280px command rail. At 1100px the rail becomes 250px. At 820px the rail moves below the map into a two-column command grid. At 540px inputs span the grid, command buttons remain in a paired row, and the map uses a 250px scene height. The page itself never relies on horizontal scrolling. The game map uses a controlled SVG viewBox, not a clipped document-wide canvas.

On phones the preview is a noninteractive world illustration and Start operation is above it. Starting a match zooms to the active faction’s continent. The world-view selector and full-size territory/target menus remain available. Overview hexes are intentionally small geographic marks; essential actions have equivalent form controls.

Contract pages use `.content-panel`; paired inputs use `.form-grid`. At 540px forms, numeric metrics, wallet prompts and transaction actions stack. Long values use `overflow-wrap:anywhere`, `min-width:0` and natural-height rows. Header navigation wraps labels without producing a horizontal scroller. The direct wallet address is shown untruncated in the relevant page.

Rendered evidence covers 320, 390 and 1440px, a phone gameplay state and an opaque iframe. Native 200% browser zoom and physical-device tests were not performed.

## Elevation & Depth

Flat surfaces and thin borders carry structure. Only the decorative commander gets a drop shadow. Dialogs use a dark translucent backdrop and 3px blur, with a native top-layer dialog that supplies focus containment. Reduced motion removes backdrop blur. The board’s grid, curved cartographic lines, ocean labels, fine scanlines and low-opacity connection routes sit beneath a static fog/reflection gradient. During play a subdued searchlight sweeps over 22 seconds and owned hexes pulse crimson between 0.025 and 0.11 opacity over 4.8 seconds. Each new battle triggers a single 150ms cyan/crimson flash. Decorative layers ignore pointer events. Pause, help, finished games and host/background pause stop animations; reduced-motion preferences remove all animation. The text field report and dice remain the primary combat feedback.

## Shapes

Controls have 3px corners and 1px borders. Dialogs have 6px corners. Hex territory geometry and the shield/frog brand mark are the scene’s distinctive shapes. Decorative scanlines have `pointer-events:none`. Borders, not stacked shadows or nested cards, distinguish the board, rail and current selections.

## Components

- **`Game`** (`components/Game.tsx`): practice lifecycle, deterministic engine connection, map/menu input, responsive viewBox, keyboard shortcuts, opt-in audio, turn/phase feedback, pause/help/results dialogs. Host pause and document visibility stop play. SVG territories use roving tabindex and arrow keys; native menus give a second route to the same actions. Territory Enter/Space select without bubbling to the order hotkey. Finished boards retain Play again in the utility row after dismissing results or returning from Rewards.
- **`Pepe`** (`components/Pepe.tsx`): original low-poly miniature built from polygons/paths. `rank`, `id` and `className` select gear, unique SVG gradient IDs and layout. Gear is decorative; army totals remain textual. `PepeMiniature` in the same file takes `rank(value.units)` for every map tile, with a recruit cap, scout visor, tank helmet/side plating, commando bandana or general cap/star. It renders one to five bright rank pips below the army total. The army and faction numbers retain their original positions; no hover or selection is needed to see gear or pips.
- **`Dialog`** (`components/Dialog.tsx`): native `showModal()` overlay with a title, explicit close action and Escape handling. The browser manages focus containment and return. Duplicate behind-dialog resume actions were removed during WebKit validation.
- **`Action`** (`components/Action.tsx`): simulation → review → wallet → receipt → refresh. Props supply an intent, prerequisites and an optional primary style. Every action has its own status/error; a shared lock prevents concurrent writes. It binds the reviewed wallet and expires stale swap intents. Rejection restores usability; unknown confirmation does not retry automatically. Unmounting during simulation or review releases only that action’s lock and ignores late results. Once signing starts, the lock persists across navigation until receipt resolution or an explicit global status check.
- **`TransactionStatus`**: cross-tab status and an explorer link for submitted transactions, including explicit receipt recheck. It remains visible if an individual form unmounts.
- **`WalletGate`, `AddressLink`** (`components/Contracts.tsx`): missing-wallet/wrong-chain/setup states, full addresses, copy and explorer navigation. `Rewards`, `Arsenal`, `MatchList`, `Commitment`, and `ContractConsole` reuse these operations and fields.
- **`Trade`**: constrained amount/slippage form, quote age, exact approvals as separate steps and minimum received. It uses the common action review and receipt handling. Quotes are bound to both token addresses, amount, slippage, account and chain. Input changes immediately invalidate the quote and pending request; stale responses cannot repopulate the form. Invalid slippage retains the form and shows an associated inline recovery message.
- **`.primary`, `.segmented`, `.stats-grid`, `.wallet-gate`, `.empty-state`**: shared CSS patterns. Primary green fill marks the next consequential action; tabs indicate selection with an underline; disabled controls are visibly dimmed and accompanied by a reason where needed.

Interactive color/opacity transitions are short and property-specific. Buttons scale to 0.96 on press; reduced-motion preferences remove the scale and transitions. There is no `transition:all`. Ambient animation runs only during a game and only with `prefers-reduced-motion: no-preference`. Static gear, pips, ownership numbers and dice remain available with motion disabled.

## Do’s and don’ts

Use `.content-panel` for another contract page, one `<h1>`, shared fields/WalletGate, and `Action` for a write. Load state through the existing runtime and `useReads`. Show what is being spent and why an action is unavailable. Keep errors adjacent and preserve a path back to the game.

Reuse the six type sizes and role tokens. Keep deployment addresses and ABI paths out of components. Keep mobile inputs at 16px and expose full address/amount values. Maintain explicit practice/reward separation. Do not add a fake live leaderboard, token price, hosted submission ID, or claim entitlement. Do not encode ownership only in color or replace the playable map with a static image.
