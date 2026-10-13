# IMD PEPE RISK frontend

A neon-noir territorial conquest game with 42 territories, six continents, deploy/attack/fortify turns, local AI, same-device pass-and-play, keyboard and touch controls, pause, and results. RISK is an **unofficial community coin**, not IMD.

The standalone site also reads the attested Robinhood Chain deployment and exposes prize/refund claims, match lifecycle and settlement controls, cosmetics, owner settings, and the exact RISK/IMD Uniswap v4 pool. No contract source, root configuration, deployment, or ownership was changed.

## Important integration boundary

The supplied deployment has `MatchFactory`, `PrizeVault`, `Buyback`, `Cosmetics`, and `LaunchToken`. It does **not** have the `Game.state(address)` / `Game.act(bytes)` interface required by the current [Pepe2Pepe on-chain template](https://github.com/adaki2004/pepe2pepe-game-template/blob/main/ONCHAIN.md). Practice moves are not contract-verified and practice results cannot create reward entitlements.

- `index.html` is the standalone site and direct-wallet contract UI.
- `play.html` is the game entry for an opaque iframe. It has no injected-wallet actions.
- `pepe-game.json` explicitly describes the free practice entry as `pepe-browser-game/1`. It is **not** an on-chain listing attestation or a claim of on-chain template compatibility.
- The locally bundled bridge handles authenticated init/channel messages, pause/resume, display-only scores, host account requests, errors and timeouts. Unsupported host claims stay disabled.
- Direct `PrizeVault.claim()` pays existing IMD entitlements; it is independent of local results.
- No hosted submission ID was supplied. The site links to the real Pepe2Pepe games catalogue. A game-specific hosted-play URL belongs to the publisher after registration; none was invented.

Publication, pinning, naming, registration, and replacement contract deployment are outside this worker assignment. See [validation](../docs/frontend/VALIDATION.md) for the exact boundary and evidence.

## Install, run and rebuild

Node 22.12+ and npm 10+:

```sh
cd web
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Open the Vite preview URL. Use a static HTTP server rather than opening HTML with `file://`, because deployment/ABI loading uses fetch. Both entrypoints and their assets work under gateway subpaths. There are no server routes or required remote fonts/images/scripts.

Dependency installation uses the public npm registry. With dependencies installed, typecheck, unit tests, and production build need no network. Browser tests use mocked RPC/wallet traffic. Browser engine installation may need network and system libraries. No npm mirrors, dependency archives, caches, or `node_modules` are committed.

`npm run build` produces repository-root `dist/`, then regenerates `dist/imd-deployment.json` **after** all files are final. `npm run check:export` checks the exact contract set, identifiers, chain, network, pool key, canonical Keccak ABI hashes and the SHA-256 inventory of every other exported file. Never edit an exported asset without rebuilding that inventory.

Artwork is original vector code in `src/components/Pepe.tsx` and `scripts/cover.tsx`. `npm run art:cover` regenerates the 1200×630 WebP cover; follow with `npm run build`. No hosted image service is needed.

## Configuration and integrity

Runtime addresses, chain ID, RPC URLs and ABI paths come exclusively from `./imd-deployment.json`. `src/config.ts` loads that file and then the referenced ABI JSON, validates every canonical Keccak hash, and builds the public client. Wallet writes require the configured chain and successful on-chain code checks. The manifest uses the handoff’s entire pool key unchanged, including its initialization hook.

`deployment.handoff.json` and `network.handoff.json` are retained build inputs copied from the pinned handoff. ABI files in `public/abi/` were copied with `git show` from commit `ea68f7e1a9b6271449984eefa6cc791ccb6a8748`, `docs/abi/<Contract>.json`. Build inputs are not a second runtime address map. Protocol ABIs for ERC-20, Uniswap and Permit2 contain interfaces only; their addresses come from the manifest.

No keys, credentials, private endpoints, or WalletConnect project ID are needed. Browser wallets use their injected EIP-1193 provider. Unknown chains trigger the exact supplied `wallet_addEthereumChain` parameters after a 4902/unknown-chain switch failure. Signing remains with the visitor. This implementation supports the browser's injected provider, not a WalletConnect QR connector.

## Game rules and controls

- 2–6 factions: one human against local swarm AI, or friends sharing one device. No network multiplayer, server, persistent leaderboard, or score signer.
- The shuffled initial map gives every territory three Pepes. Every turn grants `max(3, floor(territories/3))` plus held-continent bonuses (5, 2, 5, 3, 7, 2).
- Deploy all reinforcements to owned territories; attack adjacent enemies with up to three dice against up to two; defenders win ties. Leave one Pepe behind. A capture moves the attacking dice count (bounded by survivors) into the new territory.
- Fortify once between adjacent friendly territories, then end the turn. Win by domination, or by the most territories after 12 rounds or ten active human-play minutes. Territory ties share first place. Pause, hidden tabs, other site tabs, help and AI presentation stop the local timer.
- Recruit / Scout / Tank / Commando / General display 1 / 3 / 5 / 10 / 25+ armies. These are visual ranks, not combat buffs. No paid army or off-chain attack tax is invented.
- Select map tiles or the full-size territory/target menus. Mobile starts zoomed to the active faction’s continent. `1–6` zoom; `Space` locates the last combat; `P` or `Escape` pauses. `D` focuses deployment or ends fortification; `A` checks whether deployment is complete; `F` advances attack to fortification. Form controls retain normal keyboard behavior.
- Shift-drag across same-rank friendly territories selects a squad; deploy distributes one reinforcement to each selected territory while reserve lasts. Touch/keyboard menus provide every essential game action.
- A Web Crypto seed drives deterministic Keccak dice using the deployed `RiskRules` formula. Local randomness is for practice only and proves no funded entitlement. Results reset on reload. Sound is opt-in and synthesized after a gesture.

## Contract operations

The UI shows live state before actions, simulates writes, presents an explicit review, requests the wallet signature, waits for the receipt, and refreshes reads. Confirmation status survives tab navigation. An uncertain receipt retains a transaction lock and provides an explicit recheck. No automatic write retry occurs. Do not reload an uncertain transaction before checking its explorer status.

Rewards shows claimable IMD, refunds, rolling reward slots, burned/circulating RISK and bonus funds. The contract enforces at most three rewarded placements per rolling 24 hours, 60/25/15 splits (75/25 for two players). A local practice win is not an awarded placement.

Matches shows the latest twenty on-chain lobbies and supports lookup by any ID. Its expanded tools generate a commitment and downloadable reveal backup, expose create/join/reveal/recovery/propose/dispute/finalize/settle methods and sign agreed EIP-712 outcomes. A commitment binds the expected match ID and connected wallet. Nothing stores the reveal secret persistently. Keep its backup until reveal; changing wallets clears it. The client does not synchronize funded matches or fabricate participant signatures. Monitor proposal deadlines yourself; five-second polling occurs only while the connected page is visible, and it is not a background notification service.

The advanced contract console exposes the implementation’s methods with explicit types and raw-unit inputs. Arrays use JSON. The IMD amount helper and exact-allowance helper assist paid actions. Owner methods are owner-gated, permanent vault linking checks the handoff address, and venue changes check for code. Core actions that require unset launch settings are disabled with their setup reason. Contract-only `awardMatch` is visible for ABI completeness but cannot be called by a visitor; simulation enforces that restriction.

Arsenal reads the requested item ID, availability, supply, price and owned count. It offers the exact IMD approval before purchase. Unconfigured items remain unavailable. Cosmetic revenue routes 30% to Buyback, 35% to the vault, 35% to seats/stakers; burning occurs when a buyback is executed. The UI does not claim that the old brief's curve or 1% off-chain attack tax exists.

Trade quotes through the configured v4 quoter, with a 30-second quote lifetime, adjustable 0.01–5% slippage, exact ERC-20→Permit2 approval, separate Permit2→router approval, then simulated router execution. It encodes the Robinhood extended swap tuple, attested hook and `0x060c0f` actions. IMD input sends zero ETH value. Gas is paid separately in native ETH. USD context is unavailable because no price feed was supplied.

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run check:export
npx playwright install chromium webkit
npm run test:browser
```

The browser runner starts and closes its own foreground HTTP server, serves the **production export** under `/gateway/site/`, mocks wallet/RPC responses, writes evidence under `docs/frontend/`, and tests an iframe with `sandbox="allow-scripts allow-pointer-lock"`. It sends no real transactions. To install browser system dependencies on a normal development machine, use Playwright's supported install-deps procedure. This worker used isolated browser binaries and extracted OS libraries under `/tmp`; none are shipped.

The pinned taste probe is an assignment input, so it is not copied into this repository. During the assignment it ran from the repository root with `--out test/scratch/taste`; the final JSON evidence is retained in `docs/frontend/taste.json`. The design implementation and six-domain review are in [docs/DESIGN.md](../docs/DESIGN.md) and [VALIDATION.md](../docs/frontend/VALIDATION.md).
