# Frontend validation and handoff

Worker validation, 2026-10-13, including the targeted review revision. These are local observations, not an independent audit or a publication attestation.

## Delivery status

The scoped frontend, static export, cover, deployment manifest and evidence are written in the workspace. Git staging was attempted again in this revision but failed because `.git` is mounted read-only: `Unable to create .git/index.lock: Read-only file system`. No commit was created by this session; the network worker must collect and commit the allowed files. The game and direct-wallet UI were built and exercised locally. **The original Pepe2Pepe on-chain host reward integration remains incompatible with the already-deployed contracts.** A frontend cannot add the missing `Game.state(address)` / `Game.act(bytes)` interface or contract-verified local gameplay. No replacement Game address, creator value, hosted submission ID, or token entitlement was fabricated.

`dist/pepe-game.json` describes the free `play.html` entry under `pepe-browser-game/1` and explicitly discloses the incompatibility. It is not an on-chain registration manifest. The SDK transport is included and tested; the actual host claim control is disabled. Existing IMD entitlements can be claimed directly through the standalone PrizeVault UI. The publisher must resolve template/deployment compatibility before claiming an on-chain listing is complete.

Root `DESIGN.md` is prohibited by the task’s overriding write budget. The final design documentation is at `docs/DESIGN.md`. No root configuration or deployed source was changed. Publishing, IPFS/CID checks, site naming, and game-specific hosted-play links are subsequent publisher work. The site links to the real games catalogue until a registered play URL exists.

## Requirements and implementation

| Area | Result and evidence |
|---|---|
| React/Vite/TypeScript source, lockfile and static export | `web/`, `web/package-lock.json`, `dist/index.html`; production builds from retained inputs without `.imd/reads` |
| Static hosting and relative base | Vite `base: './'`, two exported entrypoints, hash navigation; browser tests serve `/gateway/site/` |
| Playable 42-territory, six-continent scene | SVG board, actual ownership/army state, standard adjacency, continent bonuses; `game.test.ts` |
| Deploy / attack / fortify; defender wins ties | Deterministic Keccak dice and engine transition guards; seeded complete-game tests |
| Solo swarm or 2–6 players | Local AI or same-device pass-and-play; no network multiplayer service claimed |
| Keyboard, touch, pause, results | Chromium touch and keyboard flows, WebKit start/deploy/pause/resume, native modal handling, screenshots |
| Ranks / neon-noir scene / cover | Original faceted Pepe artwork, rank-specific map miniatures/pips, numbered factions, cyan/magenta strips, fog/reflections, restrained battle and ownership motion; 1200×630 local cover |
| Wallet/network/action states | Missing wallet, wrong chain, exact add-chain fallback, simulation/review, rejection, receipt and reread tested with mocks |
| Contract actions and live state | Rewards, refunds, latest 20 matches + ID lookup, lifecycle/settlement methods, exact approvals, cosmetics, owner console; five-second visible connected-page refresh |
| Launch setup | Unset prerequisites shown; dependent core actions and non-owner settings disabled; owner fields remain actual user inputs |
| Swap | Exact handoff poolKey, configured quoter/router/Permit2, extended Robinhood tuple, slippage, separate approvals, simulation and receipt; zero native input for IMD |
| Runtime deployment binding | App fetches `imd-deployment.json` and its referenced ABIs; no separate component address map; ABI tampering blocks writes |
| Export inventory | Five canonical ABI hashes and every exported file’s SHA-256 mechanically checked; no self-hash or extra manifest keys |
| Host bridge | Real bundled SDK; authenticated parent/channel init, pause/resume, display-only score callback, account request; claim transport tested against a mock host; actual host claims unavailable for this deployment |
| Metadata / mobile | Title, favicon, description, og:title, relative og:image; first-screen product/start/wallet at 390; no page overflow at 320/390/1440 |
| Design guide | Six-domain review below; final taste probe passes all 16 categories |
| Protected paths and size | Candidate file set checked; only `web/**`, `dist/**`, `docs/**` and explicitly allowed `web/.gitignore` are included |

## Commands and results

The final integrity recheck compares the retained inputs with both pinned handoff files, byte-compares all five ABIs with `git show <sourceCommit>:docs/abi/<Contract>.json`, recomputes canonical Keccak and every asset SHA-256, verifies allowed paths/no gitlinks/no dependency artifacts and matches the browser-tested bundle hash. See `integrity.json` for the final export and candidate bundle byte counts. `.imd-responses.json` is the explicitly requested revision-response exception to the ordinary path budget.

- `npm --prefix web run typecheck`: passed.
- `npm --prefix web test`: 13/13 passed. Includes map connectivity, exact continent partitions, tie resolution, deterministic dice, legal/illegal deployment, army conservation/capture, single fortification, result ties, 50 complete seeded AI games, exact extended v4 swap decoding, unknown-chain fallback and wallet rejection.
- `npm --prefix web run build`: passed after final source and cover corrections. The manifest generator runs after Vite.
- `npm --prefix web run check:export`: passed, with all five implementation ABI bindings and exact handoff/network/poolKey equality.
- `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/imd-risk-revision-browsers node web/scripts/browser-test.mjs`: 31/31 scenarios passed (16 existing checks plus 15 regression/coverage checks). See `browser-results.json` for the tested bundle hash, scenario names and timings.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/imd-risk-revision-browsers IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: passed all 16 categories against the final export; retained as `taste.json`.
- `node web/scripts/live-read.mjs` (initial delivery, retained without a new live-chain run in this revision): read-only RPC snapshot at block **87700777**, chain **4663**, from the handoff’s public endpoint. All five addresses had code, and token metadata/immutable links matched. The owner-dependent vault link, swap venue, signer and seats recipient were unset. Details are in `live-read.json`. No transactions were sent.

The initial delivery reported that its browser MCP answered `Transport closed`; that attempt was not counted as rendered validation. This revision used the local Playwright harness directly. Local Playwright provided the actual browser checks and screenshots instead. Chromium and WebKit binaries were installed under `/tmp`. WebKit’s missing Ubuntu shared libraries were downloaded and extracted under `/tmp`; its local launcher’s library search path was extended. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` bypassed only Playwright’s system-library-location precheck; a real WebKit process launched and exercised the app successfully. No browser binaries, OS packages or caches are in the submission.

The test server and browsers are created and closed by one foreground script. The iframe uses `sandbox="allow-scripts allow-pointer-lock"`, with no same-origin storage. Host timeouts are tested by advancing the browser clock, not waiting three minutes. Mock balances, claims, approvals and transaction hashes appear only in the test harness/evidence; production reads the configured network.

## Better Interface review

| Domain | Coverage | Evidence and limits |
|---|---|---|
| Accessibility | Checked | Native labels/buttons/dialogs, keyboard map navigation and alternative menus, focus trap/Escape, live result/error text, reduced motion and axe scan. `accessibility.json`: zero reported violations; incomplete automated checks for SVG ARIA/contrast remain. No physical screen-reader session or native-device audit. |
| Layout | Checked | Screenshots and DOM overflow measurement at 320, 390 and 1440; first-screen primary action, long address and deliberately huge mock balance, form/dialog reflow; no horizontal overflow. Native 200% browser zoom and RTL mirror not performed; no RTL localization claimed. |
| Writing | Checked | Practice/reward distinction, unofficial label, descriptive actions, setup reasons, recovery errors, truthful empty state and no invented market data. Hosted claim and registration limits are visible. |
| Typography | Checked | Three requested weights, two UI font families, six declared scale steps; natural tracking, full addresses/amounts, 16px form inputs; probe passes. System font availability is platform-dependent. |
| Colors | Checked, bounded | Final probe reports all measured text at its 4.5:1 or 3:1 large-text threshold. Faction numbers/text supplement colors. SVG/translucent art contrast is not fully measured, and color-vision/device testing was not performed. |
| UI | Checked | Loading, empty, disconnected, wrong-chain, rejection, confirmed, unavailable-feature and retry states; disabled prerequisites, explicit approvals, reduced motion, metadata and share card. Active-game searchlight/ownership animations and one-shot combat flash; browser checks confirm pause and reduced-motion suppression. Animation-panel slow-motion review was not performed. |

The site’s one visual idea is a tactical Pepe board with an adjacent command rail. The dark-only theme, geometric hex geography and worn faceted miniatures are deliberate responses to the brief. System sans-serif typography retains readable controls; brand/headline CSS masks add 1px stencil bridges without a font dependency. The map has low-opacity CSS fog/reflections, searchlight movement and crimson ownership pulses. These are decorative 2D effects, with static army/faction/rank cues preserved.

## Findings corrected in the initial delivery

| Severity / source | Observed cause | Change and recheck |
|---|---|---|
| High · `web/src/components/Game.tsx:456` | The initial probe counted 36 preview hexes below 24px at 390. | Removed interactive semantics from the illustrative preview; mobile play begins at continent zoom; essential full-size territory/target controls remain. Final targets check passes. Whole-world mobile hexes use the equivalent-controls exception. |
| High · `web/src/host.ts:1` | A single host init sent on iframe load could arrive before React’s effect registered the bridge. | Register the SDK at module evaluation and preserve host state for React subscribers. Opaque iframe test passes the one-message handshake. |
| Medium · `web/src/components/Game.tsx:457` | Programmatic arrow-key focus could target an SVG group with no tabindex. | Active tiles use 0, other playable tiles −1; preview tiles have no tab stop. Keyboard test passes. |
| Medium · `web/src/components/Game.tsx:581` | WebKit exposed a second Resume button behind the local pause dialog. | The board overlay is now only for host pause; local pause uses one native dialog action. WebKit flow passes. |
| Medium · `web/src/components/Pepe.tsx:11` | The cover’s nested SVG miniature inherited an oversized viewport and rendered outside its intended area. | Added explicit intrinsic SVG dimensions; regenerated and visually inspected the final WebP cover. |
| Medium · `web/src/components/Action.tsx:31` and `TransactionStatus.tsx` | A form-local pending status could disappear on navigation; a changed wallet or stale quote needed rechecking at confirmation. | Added a global submitted-transaction banner/lock, reviewed-wallet binding and quote expiration check. Ordinary rejection/confirmation paths were browser-tested; the 120-second direct-wallet receipt-timeout path was source-reviewed, not waited out live. |
| Low · `web/src/components/Game.tsx` | Intro copy repeated short slogans. | Kept the game headline and one plain product sentence. Final copy-budget/slogan checks pass. |

No known reproducible in-scope first-screen overflow, broken primary control, missing local asset or design-probe failure remains. The unavailable host on-chain interface is a deployed-contract limitation, not a cosmetic issue hidden by a passing probe.

## Review revision: reproduced findings and fixes

All eight supplied findings reproduced against the accepted export before production source edits. `revision-before.json` records the old bundle hash, failing assertions and observations (including the empty root, stale quote and locked controls). All eight are answered `fixed` in the required `.imd-responses.json`. The source changes are limited to Game, Pepe, Trade, Action and their styles; the existing engine, contracts, ABI inputs, layout and deployment configuration remain intact.

| Finding / final source | Reproduction and correction | Recheck |
|---|---|---|
| High `e16c7c5c` · `web/src/components/Game.tsx:547`, `Pepe.tsx:2` | Tank and Scout paths were identical. Each tile now renders its rank gear and 1–5 bright pips, keeping army/faction numbers. | Six-player Alberta Tank vs Quebec Scout; real deployment/fortification reaches Commando, General and Recruit. Continent/world screenshots. |
| Medium `35aa1325` · `Trade.tsx:41`, `Trade.tsx:181` | A period caused NaN→BigInt and an empty root. Validate slippage before minimum calculation; invalidate quotes synchronously; associate a recoverable inline error. | Chromium/WebKit invalid input and re-quote flow, then usable War room. |
| Medium `9bd3544e` · `Game.tsx:258` | Dismissing results removed the only restart. Finished boards now retain Play again whenever results are closed. | Close, Escape and Rewards navigation all restart to round 1 in Chromium/WebKit. |
| Medium `32c75155` · `Game.tsx:471` | Enter on Alberta deployed one troop. Territory Enter/Space now stop propagation. | Selection leaves armies/reserve unchanged; explicit order button still deploys in both browsers. |
| Medium `a4164131` · `Action.tsx:31` | Delayed claim simulation locked subsequent tabs. Unmount releases only the local simulation/review lock and ignores late completion; signing/receipt ownership persists. | Delayed simulation navigation, newer review lock, review unmount and submitted transaction navigation. Zero sends in cancellation cases. |
| Medium `77025d9f` · `Trade.tsx:59` | A Buy result became a Sell quote. Bind request/results to token addresses, amount, slippage, account and chain, and require current identity at review. | Old direction/amount responses discarded; fresh Sell quote restores RISK approval. |
| Medium `5daf6645` · `style.css:367`, `Game.tsx:581` | Static map lacked motion/lighting and battle flash. Add faint ownership pulse, searchlight, fog/reflections and a 150ms flash for each battle. | Ambient and combat animation names observed; flash ends; pause and reduced motion stop animations. A searchlight pause specificity issue found in the first recheck was corrected. |
| Medium `75270981` · `style.css:114` | Brand/headline had no stencil treatment. Apply a 1px CSS mask to display lettering while retaining text/font metrics. | Computed masks, unchanged 48px/28px headline and inspected desktop/mobile screenshots. |

Six-domain revision coverage: **Accessibility checked** (selection-only keyboard behavior, replay recovery, slippage error association, native dialog focus and reduced motion); **Layout checked** (320/390/1440 reflow, visible first-screen actions, markers retaining numbers); **Writing checked** (recoverable validation, unchanged truthful practice/reward labels); **Typography checked** (display masks preserve text, existing sizes/weights); **Colors checked with limits** (taste measures text; map gradients/art remain outside complete contrast certification); **UI checked** (delayed responses, cancelled and submitted action lifetimes, restart and motion states). Physical screen readers/devices, native browser 200% zoom, RTL and slow-motion animation-panel inspection remain unperformed.

Final regression evidence: `revision-observations.json`, `revision-ranks-1440.png`, `revision-ranks-world.png`, `revision-rank-promotions.png`, `revision-first-screen-390.png` and `revision-motion-reduced.png`. Baseline reproduction and all wallet/quote regression tests use mocks; no live signing was requested. The pre-existing host-contract compatibility limitation below is unchanged.

Completion: **Complete for the stated revision scope**; all reported defects are repaired and browser-rechecked. The design document stays at `docs/DESIGN.md` because root DESIGN.md remains outside the overriding write allowance.

## Evidence

- `mobile-390.png`: first screen, with product, start and wallet visible.
- `desktop-1440.png`: desktop war room and commander.
- `gameplay-mobile.png`: live local command phase after deployment/combat/turn advancement.
- `results.png`: practice result and restart flow.
- `wallet-claim.png`: mocked successful claim, refreshed entitlement and explorer status; not a real payout.
- `iframe.png`: host account response and explicitly disabled unsupported host claim.
- `browser-results.json`, `accessibility.json`, `taste.json`, `live-read.json`, `integrity.json`: machine-readable records, each with its stated scope.

The revised 390px first screen, desktop rank zoom and multi-rank promotion scene were visually inspected. The browser runner also refreshes gameplay/results/wallet/iframe evidence and checks those flows programmatically. Screenshots are evidence of the tested view, not a substitute for every game state.

## Untested and unavailable behavior

No funded match creation, approval, purchase, swap, settlement, refund or prize transaction was broadcast. A real host listing/claim cannot be tested because the handoff has no compatible Game. The browser claim transport fixture proves SDK request/response behavior only, not payout compatibility. Real wallet hardware/mobile apps, fee estimates under congestion, full owner administration with funds, signature exchange between separate people, every contract revert, RPC-provider outages in the real network, and full accessibility compliance are not certified.

No public site URL, CID or named-entrypoint validation is claimed. The control plane’s later hash/RPC checks do not replace these browser tests. Contracts retain the behavior documented in the existing root README, including optimistic settlement trust, seat-signature bonus eligibility and the difference between the original curve/tax idea and what was actually deployed.
