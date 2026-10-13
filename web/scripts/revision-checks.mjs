import assert from "node:assert/strict";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

// Regression scenarios run against the exported app and the existing mock RPC.
export async function runRevisionChecks({
  browser,
  webkit,
  setup,
  check,
  noOverflow,
  evidence,
  rpcControl,
  reset,
}) {
  const observations = [];
  async function scenario(
    name,
    run,
    { wallet = false, width = 390, engine = browser } = {},
  ) {
    if (
      process.env.IMD_REVISION_FILTER &&
      !name.includes(process.env.IMD_REVISION_FILTER)
    )
      return;
    await check(`revision: ${name}`, async () => {
      reset();
      rpcControl.delays = {};
      rpcControl.fail = "";
      rpcControl.calls = [];
      const page = await engine.newPage({
        viewport: { width, height: width > 400 ? 900 : 844 },
        hasTouch: width < 400,
      });
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        const original = crypto.getRandomValues.bind(crypto);
        crypto.getRandomValues = (a) =>
          a instanceof Uint8Array && a.length === 32
            ? a.fill(0x19)
            : original(a);
      });
      const observation = { name, errors };
      observations.push(observation);
      try {
        await setup(page, { wallet });
        if (wallet) {
          await page.getByRole("button", { name: "Connect wallet" }).click();
          await page
            .getByRole("button", { name: "Switch to Robinhood Chain" })
            .click();
          await page
            .getByRole("button", { name: "Switch to Robinhood Chain" })
            .waitFor({ state: "hidden" });
        }
        await run(page, observation);
        assert.deepEqual(errors, [], "No uncaught page errors");
        await noOverflow(page);
      } catch (error) {
        observation.failureState = await page
          .locator(".command-panel")
          .allTextContents();
        throw error;
      } finally {
        await page.close();
        rpcControl.delays = {};
        rpcControl.fail = "";
      }
    });
  }
  const navigate = (p, name) =>
    p.getByRole("link", { name, exact: true }).click();
  async function start(p) {
    await p.getByLabel("Opponents").selectOption("local");
    await p.getByRole("button", { name: "Start operation" }).click();
  }
  async function end(p) {
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    await p
      .getByRole("button", { name: "End practice and see results" })
      .click();
    await p.locator("dialog[open]").waitFor();
  }
  async function quote(p) {
    await navigate(p, "Trade RISK");
    await p.getByLabel("You pay · IMD").fill("1");
    await p.getByRole("button", { name: "Get quote", exact: true }).click();
    await p.getByText("10 RISK", { exact: true }).waitFor();
  }
  async function enterCheck(p, o) {
    await start(p);
    const tile = p.locator('.territory[tabindex="0"]');
    const before = await tile.getAttribute("aria-label");
    const reserve = (await p.locator(".command-panel").innerText()).match(
      /\d+ reinforcements ready/,
    )[0];
    await tile.focus();
    await p.keyboard.press("Enter");
    o.before = before;
    o.after = await tile.getAttribute("aria-label");
    assert.equal(o.after, before, "Enter must select without deploying");
    await p.keyboard.press("Space");
    assert.equal(
      await tile.getAttribute("aria-label"),
      before,
      "Space must select without deploying",
    );
    assert((await p.locator(".command-panel").innerText()).includes(reserve));
    await p.locator("#commit-order").focus();
    await p.keyboard.press("Enter");
    assert.notEqual(
      await tile.getAttribute("aria-label"),
      before,
      "Explicit order button still deploys",
    );
  }
  async function replayCheck(p, o) {
    await start(p);
    o.recoveries = [];
    for (const dismissal of ["close", "escape", "rewards"]) {
      await end(p);
      if (dismissal === "close")
        await p.getByRole("button", { name: "Close dialog" }).click();
      if (dismissal === "escape") await p.keyboard.press("Escape");
      if (dismissal === "rewards") {
        await p.getByRole("button", { name: "View wallet rewards" }).click();
        await navigate(p, "War room");
      }
      const restart = p.getByRole("button", {
        name: /^(Start operation|Play again)/,
      });
      o.recoveries.push({ dismissal, visible: await restart.isVisible() });
      assert(
        await restart.isVisible(),
        `${dismissal}: restart remains reachable`,
      );
      await restart.click();
      assert.match(
        await p.locator(".operation-bar").innerText(),
        /Round 1\/12/,
      );
      assert(await p.locator("#commit-order").isEnabled());
    }
  }
  async function slippageCheck(p, o) {
    await quote(p);
    await p.getByLabel("Slippage tolerance").fill(".");
    // Baseline may unmount; capture the empty-root symptom before asserting.
    o.rootLength = await p
      .locator("#root")
      .innerHTML()
      .then((s) => s.length);
    assert(o.rootLength > 0, "Slippage edit must keep the app mounted");
    assert(await p.getByLabel("Slippage tolerance").isVisible());
    assert(
      await p
        .getByRole("button", { name: "Get quote", exact: true })
        .isDisabled(),
    );
    assert.equal(await p.locator(".quote").count(), 0);
    for (const value of [
      "",
      "0",
      "5.01",
      "1.234",
      "1e2",
      "Infinity",
      "NaN",
      "-1",
    ]) {
      await p.getByLabel("Slippage tolerance").fill(value);
      assert(
        await p
          .getByRole("button", { name: "Get quote", exact: true })
          .isDisabled(),
      );
      assert.equal(await p.locator(".quote").count(), 0);
    }
    await p.getByLabel("Slippage tolerance").fill("0.5");
    await p.getByRole("button", { name: "Get quote", exact: true }).click();
    await p.getByText("Minimum received: 9.95 RISK", { exact: true }).waitFor();
    await navigate(p, "War room");
    assert(
      await p.getByRole("button", { name: "Start operation" }).isEnabled(),
    );
  }

  await scenario(
    "e16c7c5c rank gear and pips on the six-faction map",
    async (p, o) => {
      await start(p);
      await p.getByLabel("Pepe count").fill("2");
      await p.locator("#commit-order").click();
      await p.getByLabel("Map view").selectOption("0");
      const tank = p
        .locator(".territory")
        .filter({ has: p.locator("title", { hasText: /Alberta.*Tank/ }) });
      const scout = p
        .locator(".territory")
        .filter({ has: p.locator("title", { hasText: /Quebec.*Scout/ }) });
      const paths = (el) =>
        el
          .locator("path")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d")));
      o.tankPaths = await paths(tank);
      o.scoutPaths = await paths(scout);
      await p.screenshot({
        path: resolve(evidence, "revision-ranks-1440.png"),
      });
      assert.notDeepEqual(
        o.tankPaths,
        o.scoutPaths,
        "Tank and Scout must have different job gear",
      );
      assert.equal(await tank.locator(".rank-pip").count(), 3);
      assert.equal(await scout.locator(".rank-pip").count(), 2);
      assert.match(await tank.getAttribute("aria-label"), /5 Pepes/);
      assert.equal(
        await tank.locator(":scope > text").last().textContent(),
        "1",
      );
      await p.getByLabel("Map view").selectOption("-1");
      await p.screenshot({
        path: resolve(evidence, "revision-ranks-world.png"),
      });
      assert.equal(await p.locator(".territory .pepe-miniature").count(), 42);
    },
    { width: 1440 },
  );
  await scenario(
    "32c75155 Enter and Space select without committing an order",
    enterCheck,
    { width: 1440 },
  );
  await scenario(
    "9bd3544e replay after close, Escape and rewards navigation",
    replayCheck,
  );
  await scenario(
    "35aa1325 invalid slippage preserves and recovers the app",
    slippageCheck,
    { wallet: true },
  );

  await scenario(
    "a4164131 unmount cancels simulation without stranding the wallet lock",
    async (p, o) => {
      await navigate(p, "Matches & rewards");
      rpcControl.delays.claim = 1800;
      await p
        .getByRole("button", { name: "Claim IMD prize", exact: true })
        .click();
      await p.getByRole("button", { name: "Checking action…" }).waitFor();
      await p.waitForTimeout(150);
      await navigate(p, "Trade RISK");
      await p.waitForTimeout(2100);
      o.buyDisabled = await p
        .getByRole("button", { name: "Buy RISK", exact: true })
        .isDisabled();
      o.dialogs = await p.locator("dialog[open]").count();
      o.sent = await p.evaluate(
        () =>
          window.walletCalls.filter((x) => x.method === "eth_sendTransaction")
            .length,
      );
      assert.equal(o.buyDisabled, false);
      assert.equal(o.dialogs, 0);
      assert.equal(o.sent, 0);
      await navigate(p, "Matches & rewards");
      await p
        .getByRole("button", { name: "Claim IMD prize", exact: true })
        .click();
      await p.getByRole("dialog", { name: "Review transaction" }).waitFor();
      await p.getByRole("button", { name: "Cancel", exact: true }).click();
      assert(
        await p
          .getByRole("button", { name: "Claim IMD prize", exact: true })
          .isEnabled(),
      );
    },
    { wallet: true },
  );

  await scenario(
    "77025d9f quotes cannot cross direction or amount changes",
    async (p, o) => {
      await navigate(p, "Trade RISK");
      await p.getByLabel("You pay · IMD").fill("1");
      rpcControl.delays.quoteExactInputSingle = 1800;
      await p.getByRole("button", { name: "Get quote", exact: true }).click();
      await p.getByRole("button", { name: "Getting quote…" }).waitFor();
      await p.getByRole("button", { name: "Sell RISK", exact: true }).click();
      await p.waitForTimeout(2100);
      o.staleQuote = await p.locator(".quote").allTextContents();
      o.quoteCalls = rpcControl.calls.filter(
        (x) => x.fn === "quoteExactInputSingle",
      ).length;
      assert.equal(
        await p.locator(".quote").count(),
        0,
        "Buy response cannot become a Sell quote",
      );
      await p.getByRole("button", { name: "Get quote", exact: true }).click();
      await p.getByLabel("You pay · RISK").fill("2");
      await p.waitForTimeout(2100);
      assert.equal(
        await p.locator(".quote").count(),
        0,
        "Changed amount invalidates in-flight quote",
      );
      await p.getByRole("button", { name: "Get quote", exact: true }).click();
      await p.getByText("10 IMD", { exact: true }).waitFor();
      assert.equal(
        rpcControl.calls.filter((x) => x.fn === "quoteExactInputSingle").length,
        3,
      );
      assert.match(await p.locator(".trade-form").innerText(), /Approve RISK/);
    },
    { wallet: true },
  );

  await scenario(
    "5daf6645 map lighting, combat flash and reduced motion",
    async (p, o) => {
      await p.emulateMedia({ reducedMotion: "no-preference" });
      await start(p);
      await p.getByLabel("Pepe count").fill("3");
      await p.locator("#commit-order").click();
      await p
        .getByLabel("Adjacent target")
        .selectOption({ label: "Alaska · 3 Pepes" })
        .catch(async () => {
          const value = await p
            .getByLabel("Adjacent target")
            .locator("option")
            .nth(1)
            .getAttribute("value");
          await p.getByLabel("Adjacent target").selectOption(value);
        });
      const animations = () =>
        p
          .locator(".map-scene")
          .evaluate((el) =>
            el.getAnimations({ subtree: true }).map((a) => a.animationName),
          );
      o.ambient = await animations();
      await p
        .getByRole("button", { name: "Roll attack dice" })
        .evaluate((el) => el.click());
      await p.locator(".dice-row").waitFor();
      o.combat = await animations();
      assert(
        o.ambient.includes("searchlight-sweep"),
        "Searchlight moves across board",
      );
      assert(o.ambient.includes("ownership-pulse"), "Claimed tiles pulse");
      assert(
        o.combat.includes("battle-flash"),
        "Combat triggers short neon flash",
      );
      await p.waitForTimeout(250);
      assert(
        !(await animations()).includes("battle-flash"),
        "Combat flash ends",
      );
      await p.getByRole("button", { name: "Pause", exact: true }).click();
      assert(
        await p
          .locator(".map-scene")
          .evaluate((el) =>
            el
              .getAnimations({ subtree: true })
              .every((a) => a.playState !== "running"),
          ),
      );
      await p.keyboard.press("Escape");
      await p.emulateMedia({ reducedMotion: "reduce" });
      assert.deepEqual(await animations(), []);
      await p.screenshot({
        path: resolve(evidence, "revision-motion-reduced.png"),
      });
    },
    { width: 1440 },
  );

  await scenario(
    "75270981 stencil display retains text, hierarchy and body font",
    async (p, o) => {
      o.styles = await p
        .locator(".game-heading h1, .brand > span")
        .evaluateAll((els) =>
          els.map((el) => ({
            text: el.textContent,
            mask: getComputedStyle(el).maskImage,
            size: getComputedStyle(el).fontSize,
            weight: getComputedStyle(el).fontWeight,
          })),
        );
      assert(o.styles.every((s) => s.mask !== "none"));
      assert.equal(o.styles.find((s) => s.text.includes("Take")).size, "48px");
      await p.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await p
          .locator(".game-heading h1")
          .evaluate((e) => getComputedStyle(e).fontSize),
        "28px",
      );
      assert.equal(
        await p.locator(".game-heading h1").textContent(),
        "Take the territory.",
      );
      await p.screenshot({
        path: resolve(evidence, "revision-first-screen-390.png"),
      });
    },
    { width: 1440 },
  );

  if (!process.env.IMD_REVISION_BASELINE) {
    await scenario(
      "rank promotions through Commando and General, fortification to Recruit",
      async (p, o) => {
        await p.getByLabel("Factions").selectOption("2");
        await start(p);
        o.ranks = [];
        for (let turn = 0; turn < 7; turn++) {
          o.lastTurn = turn;
          // Wait for the existing turn-change effect to reset the troop field.
          await p.waitForFunction(
            () =>
              document.querySelector('[aria-label="Pepe count"]')?.value ===
              "1",
          );
          // Quebec has a friendly neighbour in this pinned seed; Alberta does not.
          if (turn % 2 === 0)
            await p.getByLabel("Selected territory").selectOption("5");
          const reserve = (await p.locator(".command-panel").innerText()).match(
            /(\d+) reinforcements ready/,
          )[1];
          await p.getByLabel("Pepe count").fill(reserve);
          await p.locator("#commit-order").click();
          const marker = p.locator(".territory.selected .pepe-miniature");
          if (turn === 0 || turn === 6) {
            const expected = turn === 0 ? "Commando" : "General";
            assert.equal(await marker.getAttribute("data-rank"), expected);
            assert.equal(
              await marker.locator(".rank-pip").count(),
              turn === 0 ? 4 : 5,
            );
            o.ranks.push({
              rank: expected,
              gear: await marker.locator(".job-gear").innerHTML(),
            });
          }
          await p.getByRole("button", { name: "Continue to fortify" }).click();
          if (turn < 6)
            await p
              .getByRole("button", { name: "End turn", exact: false })
              .click();
        }
        const units = Number(
          (await p.locator(".selection p").innerText()).match(/\d+/)[0],
        );
        const destination = await p
          .getByLabel("Adjacent target")
          .locator("option")
          .nth(1)
          .getAttribute("value");
        await p.getByLabel("Adjacent target").selectOption(destination);
        await p.getByLabel("Pepe count").fill(String(units - 1));
        await p
          .getByRole("button", { name: "Move Pepes", exact: true })
          .click();
        const recruit = p.locator(".territory.selected .pepe-miniature");
        assert.equal(await recruit.getAttribute("data-rank"), "Recruit");
        assert.equal(await recruit.locator(".rank-pip").count(), 1);
        o.ranks.push({ rank: "Recruit", units: 1 });
        assert.equal(
          await p
            .locator(
              `.territory[data-territory="${destination}"] .pepe-miniature`,
            )
            .getAttribute("data-rank"),
          "General",
        );
        await p.getByLabel("Map view").selectOption("0");
        await p.screenshot({
          path: resolve(evidence, "revision-rank-promotions.png"),
        });
      },
      { width: 1440 },
    );
    await scenario(
      "late simulation cannot release a newer review; unmounted review releases its own lock",
      async (p, o) => {
        await navigate(p, "Matches & rewards");
        rpcControl.delays.claim = 1800;
        await p
          .getByRole("button", { name: "Claim IMD prize", exact: true })
          .click();
        await p.getByRole("button", { name: "Checking action…" }).waitFor();
        await p.waitForTimeout(100);
        await quote(p);
        await p
          .getByRole("button", {
            name: "1. Approve IMD to Permit2",
            exact: true,
          })
          .click();
        await p.getByRole("dialog", { name: "Review transaction" }).waitFor();
        await p.waitForTimeout(2000);
        o.review = await p.locator("dialog[open]").innerText();
        assert.match(o.review, /exact allowance/);
        assert(
          await p
            .getByRole("button", {
              name: "Buy RISK",
              exact: true,
              includeHidden: true,
            })
            .isDisabled(),
        );
        // Browser history/hash navigation can unmount a review even while modal.
        await p.evaluate(() => {
          location.hash = "rewards";
        });
        await p.locator("dialog[open]").waitFor({ state: "hidden" });
        await p.waitForFunction(() =>
          [...document.querySelectorAll("button")].some(
            (b) => b.textContent === "Claim IMD prize" && !b.disabled,
          ),
        );
        assert(
          await p
            .getByRole("button", { name: "Claim IMD prize", exact: true })
            .isEnabled(),
        );
        o.sent = await p.evaluate(
          () =>
            window.walletCalls.filter((x) => x.method === "eth_sendTransaction")
              .length,
        );
        assert.equal(o.sent, 0);
      },
      { wallet: true },
    );
    await scenario(
      "submitted transaction keeps global lock across navigation",
      async (p, o) => {
        await navigate(p, "Matches & rewards");
        rpcControl.delays.receipt = 1800;
        await p
          .getByRole("button", { name: "Claim IMD prize", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Confirm claim imd prize", exact: true })
          .click();
        await p
          .locator(".transaction-status")
          .filter({ hasText: "awaiting confirmation" })
          .waitFor();
        await navigate(p, "Trade RISK");
        assert(
          await p
            .getByRole("button", { name: "Buy RISK", exact: true })
            .isDisabled(),
        );
        await p
          .locator(".transaction-status")
          .filter({ hasText: "confirmed" })
          .waitFor();
        assert(
          await p
            .getByRole("button", { name: "Buy RISK", exact: true })
            .isEnabled(),
        );
        o.sent = await p.evaluate(
          () =>
            window.walletCalls.filter((x) => x.method === "eth_sendTransaction")
              .length,
        );
        assert.equal(o.sent, 1);
      },
      { wallet: true },
    );
    if (!process.env.IMD_SKIP_WEBKIT) {
      let wk;
      await check("revision: WebKit regression browser launches", async () => {
        wk = await webkit.launch({ headless: true });
      });
      if (wk) {
        try {
          await scenario("WebKit keyboard selection", enterCheck, {
            width: 1440,
            engine: wk,
          });
          await scenario("WebKit replay recovery", replayCheck, { engine: wk });
          await scenario("WebKit slippage recovery", slippageCheck, {
            wallet: true,
            engine: wk,
          });
        } finally {
          await wk.close();
        }
      }
    }
  }
  await writeFile(
    resolve(evidence, "revision-observations.json"),
    JSON.stringify(observations, null, 2) + "\n",
  );
}
