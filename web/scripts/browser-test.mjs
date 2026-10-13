import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  keccak256,
  toHex,
  parseAbi,
} from "viem";
const root = resolve(import.meta.dirname, "../.."),
  dist = resolve(root, "dist"),
  evidence = resolve(root, "docs/frontend");
await mkdir(evidence, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(dist, "imd-deployment.json"), "utf8"),
);
const abis = Object.fromEntries(
  await Promise.all(
    manifest.contracts.map(async (c) => [
      c.address.toLowerCase(),
      JSON.parse(await readFile(resolve(dist, c.abiPath), "utf8")),
    ]),
  ),
);
const account = "0x3d6a89c8751a45dd577a4c1f3b34e71c58236193";
const contract = (n) => manifest.contracts.find((c) => c.name === n).address;
const zeroAddress = `0x${"0".repeat(40)}`,
  hash = keccak256(toHex("mock-only-confirmed-transaction")),
  blockHash = keccak256(toHex("mock-only-block"));
const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);
const permitAbi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
let claimed = false,
  rejectRpc = false,
  ercApproved = false,
  permitApproved = false;
const rpcCalls = [];
async function rpcResult(req) {
  rpcCalls.push(req.method);
  if (rejectRpc) throw Error("Mock RPC outage");
  switch (req.method) {
    case "eth_chainId":
      return "0x1237";
    case "eth_getCode":
      return "0x60006000";
    case "eth_blockNumber":
      return "0x100";
    case "eth_getTransactionCount":
      return "0x0";
    case "eth_gasPrice":
      return "0x1";
    case "eth_estimateGas":
      return "0x186a0";
    case "eth_getBalance":
      return "0x100000000000000000";
    case "eth_getTransactionReceipt":
      return {
        transactionHash: hash,
        transactionIndex: "0x0",
        blockHash,
        blockNumber: "0x100",
        from: account,
        to: contract("PrizeVault"),
        cumulativeGasUsed: "0x5208",
        gasUsed: "0x5208",
        contractAddress: null,
        logs: [],
        logsBloom: `0x${"0".repeat(512)}`,
        status: "0x1",
        effectiveGasPrice: "0x1",
        type: "0x2",
      };
    case "eth_getBlockByNumber":
      return {
        number: "0x100",
        hash: blockHash,
        parentHash: blockHash,
        timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
        baseFeePerGas: "0x1",
        gasLimit: "0x1c9c380",
        gasUsed: "0x0",
        transactions: [],
        miner: account,
        extraData: "0x",
        difficulty: "0x0",
        totalDifficulty: "0x0",
        size: "0x0",
        nonce: "0x0000000000000000",
        sha3Uncles: blockHash,
        logsBloom: `0x${"0".repeat(512)}`,
        transactionsRoot: blockHash,
        stateRoot: blockHash,
        receiptsRoot: blockHash,
        uncles: [],
      };
    case "eth_call": {
      const to = req.params[0].to.toLowerCase();
      let abi = abis[to] ?? erc20Abi;
      if (to === manifest.network.uniswapV4.quoter) abi = quoterAbi;
      if (to === manifest.network.uniswapV4.permit2) abi = permitAbi;
      let decoded;
      try {
        decoded = decodeFunctionData({ abi, data: req.params[0].data });
      } catch {
        return "0x";
      }
      const fn = decoded.functionName;
      let result;
      if (fn === "owner") result = account;
      else if (fn === "matchFactory") result = contract("MatchFactory");
      else if (
        fn === "venue" ||
        fn === "outcomeSigner" ||
        fn === "seatRewardsRecipient"
      )
        result = zeroAddress;
      else if (fn === "nextMatchId") result = 1n;
      else if (fn === "claimable") result = claimed ? 0n : 25n * 10n ** 18n;
      else if (fn === "remainingRewardedWins") result = 2n;
      else if (fn === "nextRewardedWinAt")
        result = BigInt(Math.floor(Date.now() / 1000));
      else if (fn === "burnedSupply")
        result = 123456789012345678901234567890123456789n;
      else if (fn === "circulatingSupply" || fn === "balanceOf")
        result = 1000000000n * 10n ** 18n;
      else if (fn === "refunds") result = 3n * 10n ** 18n;
      else if (fn === "items") result = [2n * 10n ** 18n, 100n, 4n, true];
      else if (fn === "allowance" && to === manifest.network.uniswapV4.permit2)
        result = [
          permitApproved ? 10n ** 30n : 0n,
          Math.floor(Date.now() / 1000) + 3600,
          0,
        ];
      else if (fn === "allowance") result = ercApproved ? 10n ** 30n : 0n;
      else if (fn === "quoteExactInputSingle")
        result = [10n * 10n ** 18n, 100000n];
      else if (
        fn === "claim" ||
        fn === "withdrawRefund" ||
        fn === "burnHeldRisk" ||
        fn === "buy"
      )
        result = 1n;
      else if (fn === "approve")
        result = to === manifest.network.uniswapV4.permit2 ? undefined : true;
      else {
        const f = abi.find((x) => x.type === "function" && x.name === fn);
        if (!f?.outputs.length) return "0x";
        if (f.outputs[0].type === "address") result = zeroAddress;
        else if (f.outputs[0].type === "bool") result = false;
        else if (f.outputs[0].type === "string") result = "RISK";
        else result = 0n;
      }
      return encodeFunctionResult({ abi, functionName: fn, result });
    }
    default:
      throw Error(`Unhandled mocked RPC ${req.method}`);
  }
}
const sdk = await readFile(
  resolve(root, "web/src/sdk/onchain-bridge.js"),
  "utf8",
);
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    let path = decodeURIComponent(new URL(req.url, "http://local").pathname);
    if (path === "/sdk.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(sdk);
      return;
    }
    if (path === "/sdk-test.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<html><body><button id="claim">Claim</button><output></output><script type="module">import{createPepeChainBridge}from'/sdk.js';window.b=createPepeChainBridge({onPause:()=>document.body.dataset.paused='yes',onResume:()=>document.body.dataset.paused='no'});document.querySelector('button').onclick=async()=>{try{document.querySelector('output').textContent=await b.request({type:'claim'})}catch(e){document.querySelector('output').textContent=e.message}};</script></body></html>`,
      );
      return;
    }
    if (path === "/host.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<html><body><iframe title="Game" sandbox="allow-scripts allow-pointer-lock" src="/gateway/site/play.html" style="width:390px;height:844px"></iframe><script>window.messages=[];window.testChannel='test-host-session';window.addEventListener('message',e=>{if(e.source!==document.querySelector('iframe').contentWindow)return;messages.push(e.data);if(e.data.type==='chain'&&!window.ignoreHost)document.querySelector('iframe').contentWindow.postMessage({protocol:'pepe-game/1',type:'chain-result',channel:testChannel,id:e.data.id,...(window.rejectHost?{error:'Mock host rejection'}:{result:e.data.request.type==='account'?{address:'${account}',chainId:4663}:'${hash}'})},'*')});document.querySelector('iframe').onload=()=>document.querySelector('iframe').contentWindow.postMessage({protocol:'pepe-game/1',type:'init',channel:testChannel},'*');window.hostMessage=(type,channel=testChannel)=>document.querySelector('iframe').contentWindow.postMessage({protocol:'pepe-game/1',type,channel},'*');</script></body></html>`,
      );
      return;
    }
    if (!path.startsWith("/gateway/site/")) {
      res.writeHead(404).end();
      return;
    }
    path = path.slice("/gateway/site/".length) || "index.html";
    const file = resolve(dist, path);
    if (!file.startsWith(dist + "/")) throw Error("Invalid path");
    const bytes = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(bytes);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  failures = [];
let browser;
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    checks.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (e) {
    checks.push({ name, passed: false, error: e.message });
    failures.push(name);
    console.error(`FAIL ${name}: ${e.message}`);
  }
}
async function setup(page, { wallet = false } = {}) {
  await page.route(
    /^https:\/\/(robinhood-rpc\.publicnode\.com|rpc\.mainnet\.chain\.robinhood\.com)/,
    async (route) => {
      try {
        const req = route.request().postDataJSON();
        const response = await Promise.all(
          (Array.isArray(req) ? req : [req]).map(async (r) => {
            try {
              return { jsonrpc: "2.0", id: r.id, result: await rpcResult(r) };
            } catch (e) {
              return {
                jsonrpc: "2.0",
                id: r.id,
                error: { code: -32000, message: e.message },
              };
            }
          }),
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(Array.isArray(req) ? response : response[0]),
        });
      } catch {
        await route.abort();
      }
    },
  );
  if (wallet) {
    await page.exposeFunction("mockWrite", async (tx) => {
      try {
        if (tx.to.toLowerCase() === contract("PrizeVault")) claimed = true;
        else if (tx.to.toLowerCase() === manifest.network.uniswapV4.permit2)
          permitApproved = true;
        else {
          const parsed = decodeFunctionData({ abi: erc20Abi, data: tx.data });
          if (parsed.functionName === "approve") ercApproved = true;
        }
      } catch {}
      return hash;
    });
    await page.addInitScript(
      ({ account }) => {
        window.walletCalls = [];
        window.rejectWallet = false;
        window.mockChain = "0x1";
        window.added = false;
        const handlers = {};
        window.ethereum = {
          on: (name, fn) => {
            handlers[name] = fn;
          },
          removeListener: () => {},
          request: async (req) => {
            walletCalls.push(req);
            if (
              req.method === "eth_requestAccounts" ||
              req.method === "eth_accounts"
            )
              return [account];
            if (req.method === "eth_chainId") return window.mockChain;
            if (req.method === "wallet_switchEthereumChain") {
              if (!window.added) throw { code: 4902, message: "Unknown chain" };
              window.mockChain = req.params[0].chainId;
              handlers.chainChanged?.(window.mockChain);
              return null;
            }
            if (req.method === "wallet_addEthereumChain") {
              window.added = true;
              return null;
            }
            if (req.method === "eth_sendTransaction") {
              if (window.rejectWallet)
                throw { code: 4001, message: "User rejected the request" };
              return await window.mockWrite(req.params[0]);
            }
            throw Error(`Unexpected wallet request ${req.method}`);
          },
        };
      },
      { account },
    );
  }
  await page.goto(`${base}/gateway/site/index.html`);
  await page.getByRole("button", { name: "Start operation" }).waitFor();
}
async function noOverflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Page scrolls sideways",
  );
}
try {
  browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await check(
    "390px first screen: product, start and wallet; static gateway subpath",
    async () => {
      await noOverflow(page);
      for (const role of ["Start operation", "Connect wallet"]) {
        const b = await page.getByRole("button", { name: role }).boundingBox();
        assert(b.y + b.height < 844);
      }
      const map = await page.locator(".world-map").boundingBox();
      assert(map.y < 844);
      await page.screenshot({
        path: resolve(evidence, "mobile-390.png"),
        type: "png",
      });
      assert.equal(errors.length, 0);
    },
  );
  await check("320px and 1440px layout; no missing local assets", async () => {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page);
    }
    await page.screenshot({
      path: resolve(evidence, "desktop-1440.png"),
      type: "png",
    });
    assert.equal(await page.locator("link[rel=icon]").count(), 1);
  });
  await check(
    "missing wallet: actionable error, game remains usable",
    async () => {
      await page.getByRole("button", { name: "Connect wallet" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "No browser wallet found" })
        .waitFor();
      assert(
        await page.getByRole("button", { name: "Start operation" }).isEnabled(),
      );
    },
  );
  await check(
    "touch: start, deploy, target, attack, fortify, next turn",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel("Opponents").selectOption("local");
      await page.getByRole("button", { name: "Start operation" }).tap();
      const reserve = Number(
        (await page.locator(".command-panel").innerText()).match(
          /(\d+) reinforcements ready/,
        )[1],
      );
      await page.getByLabel("Pepe count").fill(String(reserve));
      await page.locator("#commit-order").tap();
      assert.match(
        await page.locator(".phases .current").innerText(),
        /attack/i,
      );
      const options = await page
        .getByLabel("Adjacent target")
        .locator("option")
        .all();
      if (options.length > 1) {
        await page
          .getByLabel("Adjacent target")
          .selectOption(await options[1].getAttribute("value"));
        await page.getByRole("button", { name: "Roll attack dice" }).tap();
        assert.equal(await page.locator(".dice-row").count(), 1);
      }
      await page.getByRole("button", { name: "Continue to fortify" }).tap();
      await page.getByRole("button", { name: "End turn", exact: false }).tap();
      assert.match(
        await page.locator(".turn-heading").innerText(),
        /Faction 2/,
      );
      await noOverflow(page);
      await page.screenshot({
        path: resolve(evidence, "gameplay-mobile.png"),
        type: "png",
      });
    },
  );
  await check(
    "keyboard: map arrows, pause, focus trap, resume, results and restart",
    async () => {
      const map = page.locator('.territory[tabindex="0"]');
      await map.focus();
      await page.keyboard.press("ArrowRight");
      assert(
        await page.evaluate(
          () => document.activeElement?.getAttribute("data-territory") !== null,
        ),
      );
      await page.locator("h1").click();
      await page.keyboard.press("p");
      await page.getByRole("dialog", { name: "Operation paused" }).waitFor();
      await page.keyboard.press("Tab");
      assert(
        await page.evaluate(
          () => document.activeElement?.closest("dialog") !== null,
        ),
      );
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "End practice and see results" })
        .click();
      await page.getByRole("dialog").waitFor();
      assert.match(
        await page.getByRole("dialog").innerText(),
        /No tokens were earned/,
      );
      await page.screenshot({
        path: resolve(evidence, "results.png"),
        type: "png",
      });
      await page.getByRole("button", { name: "Play again" }).click();
      assert.match(
        await page.locator(".operation-bar").innerText(),
        /Round 1\/12/,
      );
    },
  );
  await check("reduced motion and accessible initial-page scan", async () => {
    await page.reload();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      resolve(evidence, "accessibility.json"),
      JSON.stringify(
        {
          engine: result.testEngine,
          violations: result.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              failureSummary: n.failureSummary,
            })),
          })),
          incomplete: result.incomplete.map((v) => v.id),
        },
        null,
        2,
      ),
    );
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  });
  await page.close();
  await context.close();
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  await setup(page, { wallet: true });
  await check(
    "wallet connect, wrong chain, exact add-chain fallback then switch",
    async () => {
      await page.getByRole("button", { name: "Connect wallet" }).click();
      await page
        .getByRole("button", { name: "Switch to Robinhood Chain" })
        .click();
      await page
        .getByRole("button", { name: "Switch to Robinhood Chain" })
        .waitFor({ state: "hidden" });
      const calls = await page.evaluate(() => window.walletCalls);
      assert.deepEqual(
        calls.find((c) => c.method === "wallet_addEthereumChain").params,
        [manifest.walletAddChain],
      );
      await page
        .getByRole("link", { name: "Matches & rewards", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Claim IMD prize", exact: true })
        .waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".button-row .primary")?.disabled,
      );
      await noOverflow(page);
    },
  );
  await check(
    "reward claim: simulation, review, rejection, retry, confirmation, reread",
    async () => {
      await page.evaluate(() => (window.rejectWallet = true));
      await page
        .getByRole("button", { name: "Claim IMD prize", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Review transaction" }).waitFor();
      await page
        .getByRole("button", { name: "Confirm claim imd prize", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Request declined" })
        .waitFor();
      assert(
        await page
          .getByRole("button", { name: "Claim IMD prize", exact: true })
          .isEnabled(),
      );
      await page.evaluate(() => (window.rejectWallet = false));
      await page
        .getByRole("button", { name: "Claim IMD prize", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm claim imd prize", exact: true })
        .click();
      await page
        .getByText("Transaction confirmed. State refreshed.", { exact: true })
        .waitFor();
      assert(
        await page.getByRole("link", { name: /View transaction/ }).count(),
      );
      await page.waitForFunction(
        () => document.querySelector(".button-row .primary")?.disabled === true,
      );
      assert(claimed);
      await page.screenshot({
        path: resolve(evidence, "wallet-claim.png"),
        type: "png",
      });
    },
  );
  await check(
    "owner controls, invalid input, exact contract set and large numeric overflow",
    async () => {
      await page.getByText("Token and vault totals", { exact: true }).click();
      await noOverflow(page);
      await page.getByRole("link", { name: "Contracts", exact: true }).click();
      assert.equal(await page.locator(".address-row").count(), 6);
      await page.getByLabel("Contract method").selectOption("setMatchFactory");
      await page
        .getByLabel("factory (address)", { exact: false })
        .fill("bad address");
      await page
        .getByRole("button", { name: "Review action", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "valid address" })
        .waitFor();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await noOverflow(page);
    },
  );
  await check(
    "swap quote, exact ERC20 / Permit2 approvals, simulated execution and receipt",
    async () => {
      await page.getByRole("link", { name: "Trade RISK", exact: true }).click();
      await page.getByLabel("You pay · IMD").fill("1");
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent === "Get quote" && !b.disabled,
        ),
      );
      await page
        .getByRole("button", { name: "Get quote", exact: true })
        .click();
      await page.getByText("10 RISK", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "1. Approve IMD to Permit2", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Confirm 1. approve imd to permit2",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "2. Authorize router allowance",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", {
          name: "2. Authorize router allowance",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Confirm 2. authorize router allowance",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Review action", exact: true })
        .waitFor();
      assert(ercApproved && permitApproved);
      await page
        .getByRole("button", { name: "Review action", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Review transaction" }).waitFor();
      await page
        .getByRole("button", { name: "Confirm swap imd for risk", exact: true })
        .click();
      await page
        .getByText("Transaction confirmed. State refreshed.", { exact: true })
        .waitFor();
      const calls = await page.evaluate(() =>
        window.walletCalls.filter((c) => c.method === "eth_sendTransaction"),
      );
      assert(
        calls.some(
          (c) =>
            c.params[0].to.toLowerCase() === manifest.network.pairToken.address,
        ),
      );
      assert(
        calls.some(
          (c) =>
            c.params[0].to.toLowerCase() === manifest.network.uniswapV4.permit2,
        ),
      );
      assert(
        calls.some(
          (c) =>
            c.params[0].to.toLowerCase() ===
            manifest.network.uniswapV4.universalRouter,
        ),
      );
      const swapTx = calls.find(
        (c) =>
          c.params[0].to.toLowerCase() ===
          manifest.network.uniswapV4.universalRouter,
      ).params[0];
      assert(!swapTx.value || BigInt(swapTx.value) === 0n);
      await noOverflow(page);
    },
  );
  await check(
    "opaque iframe: authenticated init, account, pause/resume, unsupported claim disabled",
    async () => {
      await page.goto(`${base}/host.html`);
      const frame = page.frameLocator("iframe");
      await frame.getByText("Host connected", { exact: true }).waitFor();
      await frame.getByRole("button", { name: "Start operation" }).click();
      await page.evaluate(() => window.hostMessage("pause", "wrong-channel"));
      assert.equal(
        await frame
          .getByText("The host has paused the game.", { exact: true })
          .count(),
        0,
      );
      await page.evaluate(() => window.hostMessage("pause"));
      await frame
        .getByText("The host has paused the game.", { exact: true })
        .waitFor();
      await page.evaluate(() => window.hostMessage("resume"));
      await frame
        .getByText("The host has paused the game.", { exact: true })
        .waitFor({ state: "hidden" });
      await frame.getByRole("button", { name: "Read host account" }).click();
      await frame
        .locator(".host-panel [role=status]")
        .filter({ hasText: account })
        .waitFor();
      assert(
        await frame
          .getByRole("button", { name: "Host claim unavailable" })
          .isDisabled(),
      );
      assert(
        (await page.evaluate(() => window.messages)).some(
          (m) => m.type === "ready",
        ),
      );
      await page.screenshot({
        path: resolve(evidence, "iframe.png"),
        type: "png",
      });
    },
  );
  await check(
    "host bridge claim transport: confirmed hash, rejection and channel renewal",
    async () => {
      await page
        .locator("iframe")
        .evaluate((el) => (el.src = "/sdk-test.html"));
      const frame = page.frameLocator("iframe");
      await frame.getByRole("button", { name: "Claim", exact: true }).waitFor();
      await page.waitForTimeout(100);
      await frame.getByRole("button", { name: "Claim", exact: true }).click();
      await frame.locator("output").filter({ hasText: hash }).waitFor();
      await page.evaluate(() => (window.rejectHost = true));
      await frame.getByRole("button", { name: "Claim", exact: true }).click();
      await frame
        .locator("output")
        .filter({ hasText: "Mock host rejection" })
        .waitFor();
      await page.evaluate(() => {
        window.testChannel = "renewed-channel";
        window.hostMessage("init");
      });
      await page.waitForFunction(() =>
        window.messages.some(
          (m) => m.type === "ready" && m.channel === "renewed-channel",
        ),
      );
      await frame.locator("output").evaluate((el) => (el.textContent = ""));
      await frame.getByRole("button", { name: "Claim", exact: true }).click();
      await frame
        .locator("output")
        .filter({ hasText: "Mock host rejection" })
        .waitFor();
      assert(
        (await page.evaluate(() => window.messages)).some(
          (m) => m.type === "chain" && m.channel === "renewed-channel",
        ),
      );
    },
  );
  await check(
    "host request timeout keeps an uncertain write from auto-retrying",
    async () => {
      await page.clock.install();
      await page.evaluate(() => (window.ignoreHost = true));
      const frame = page.frameLocator("iframe");
      await frame.locator("output").evaluate((el) => (el.textContent = ""));
      const before = await page.evaluate(
        () => window.messages.filter((m) => m.type === "chain").length,
      );
      await frame.getByRole("button", { name: "Claim", exact: true }).click();
      await page.waitForFunction(
        (n) =>
          window.messages.filter((m) => m.type === "chain").length === n + 1,
        before,
      );
      await page.clock.fastForward(180001);
      await frame
        .locator("output")
        .filter({ hasText: "Confirmation timed out" })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => window.messages.filter((m) => m.type === "chain").length,
        ),
        before + 1,
      );
    },
  );
  await page.close();
  await check(
    "ABI tampering blocks transactions without blocking free practice",
    async () => {
      const p = await context.newPage();
      await p.route("**/abi/LaunchToken.json", async (route) => {
        const abi = structuredClone(abis[contract("LaunchToken")]);
        abi.push({
          type: "function",
          name: "tampered",
          inputs: [],
          outputs: [],
          stateMutability: "view",
        });
        await route.fulfill({ json: abi });
      });
      await setup(p);
      await p
        .getByRole("alert")
        .filter({ hasText: "ABI verification failed" })
        .waitFor();
      assert(
        await p.getByRole("button", { name: "Start operation" }).isEnabled(),
      );
      await p.close();
    },
  );
  await check(
    "RPC outage shows retry while practice stays available",
    async () => {
      rejectRpc = true;
      const p = await context.newPage();
      try {
        await setup(p);
        await p.getByRole("link", { name: "Contracts", exact: true }).click();
        await p.getByRole("button", { name: "Retry verification" }).waitFor();
        await p.getByRole("link", { name: "War room", exact: true }).click();
        assert(
          await p.getByRole("button", { name: "Start operation" }).isEnabled(),
        );
      } finally {
        rejectRpc = false;
        await p.close();
      }
    },
  );
  await check("WebKit primary interaction", async () => {
    let b;
    try {
      b = await webkit.launch({ headless: true });
      const p = await b.newPage({ viewport: { width: 390, height: 844 } });
      await setup(p);
      await p.getByRole("button", { name: "Start operation" }).click();
      await p.locator("#commit-order").click();
      await p.getByRole("button", { name: "Pause", exact: true }).click();
      await p
        .getByRole("button", { name: "Resume operation", exact: true })
        .click();
      await noOverflow(p);
    } finally {
      await b?.close();
    }
  });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  const report = {
    observedAt: new Date().toISOString(),
    testedExport: manifest.assets.find(
      (a) => a.path.endsWith(".js") && /(?:index|main)-/.test(a.path),
    ),
    mode: "Production static export; mocked wallet/RPC; no live transactions",
    checks,
    rpcMethods: [...new Set(rpcCalls)],
    failures,
  };
  await writeFile(
    resolve(evidence, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: checks.filter((c) => c.passed).length,
      total: checks.length,
      failures,
    }),
  );
  if (failures.length) process.exitCode = 1;
}
