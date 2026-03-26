const baseUrl =
  process.argv[2] ??
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const cdpBaseUrl = process.env.CDP_BASE_URL ?? "http://127.0.0.1:9223";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(target) {
    this.target = target;
    this.id = 0;
    this.pending = new Map();
    this.waiters = [];
    this.consoleMessages = [];
    this.exceptions = [];
    this.networkErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.target.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.id) {
        const entry = this.pending.get(message.id);

        if (!entry) {
          return;
        }

        this.pending.delete(message.id);

        if (message.error) {
          entry.reject(new Error(`${message.error.message} (${entry.method})`));
          return;
        }

        entry.resolve(message.result);
        return;
      }

      this.handleEvent(message);
    });

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Log.enable");
    await this.send("Network.enable");
  }

  handleEvent(message) {
    if (message.method === "Runtime.consoleAPICalled") {
      const text = message.params.args
        .map((arg) => arg.value ?? arg.description ?? "")
        .join(" ")
        .trim();

      this.consoleMessages.push({
        type: message.params.type,
        text,
      });
    }

    if (message.method === "Runtime.exceptionThrown") {
      this.exceptions.push(message.params.exceptionDetails?.text ?? "Runtime exception");
    }

    if (message.method === "Log.entryAdded") {
      this.consoleMessages.push({
        type: message.params.entry.level,
        text: message.params.entry.text,
      });
    }

    if (
      message.method === "Network.responseReceived" &&
      message.params.response.status >= 400
    ) {
      this.networkErrors.push({
        status: message.params.response.status,
        url: message.params.response.url,
      });
    }

    for (const waiter of [...this.waiters]) {
      if (waiter.method !== message.method) {
        continue;
      }

      if (!waiter.predicate(message.params)) {
        continue;
      }

      clearTimeout(waiter.timeoutId);
      this.waiters = this.waiters.filter((entry) => entry !== waiter);
      waiter.resolve(message.params);
    }
  }

  send(method, params = {}) {
    const id = ++this.id;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const waiter = {
        method,
        predicate,
        resolve,
        timeoutId,
      };

      this.waiters.push(waiter);
    });
  }

  async navigate(path) {
    const loadPromise = this.waitForEvent("Page.loadEventFired", () => true, 20000);
    await this.send("Page.navigate", { url: `${baseUrl}${path}` });
    await loadPromise;
    await sleep(600);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
    }

    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 10000, intervalMs = 150) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) {
        return;
      }

      await sleep(intervalMs);
    }

    throw new Error(`Timed out waiting for expression: ${expression}`);
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      // Ignore close errors during smoke cleanup.
    }

    await fetch(`${cdpBaseUrl}/json/close/${this.target.id}`);
  }
}

function json(value) {
  return JSON.stringify(value);
}

async function getTarget() {
  const response = await fetch(`${cdpBaseUrl}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Unable to open DevTools target: ${response.status}`);
  }

  return response.json();
}

async function clickText(client, text) {
  const clicked = await client.evaluate(`(() => {
    const target = [...document.querySelectorAll("button, a")]
      .find((node) => node.textContent?.trim().includes(${json(text)}));
    if (!target) {
      return false;
    }
    target.click();
    return true;
  })()`);

  if (!clicked) {
    throw new Error(`Unable to find clickable element containing "${text}".`);
  }

  await sleep(250);
}

async function clickSelector(client, selector) {
  const clicked = await client.evaluate(`(() => {
    const target = document.querySelector(${json(selector)});
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    target.click();
    return true;
  })()`);

  if (!clicked) {
    throw new Error(`Unable to click selector ${selector}.`);
  }

  await sleep(250);
}

async function clickClosestFormSubmit(client, selector) {
  const clicked = await client.evaluate(`(() => {
    const field = document.querySelector(${json(selector)});
    if (!(field instanceof HTMLElement)) {
      return false;
    }
    const form = field.closest('form');
    const button = form?.querySelector("button[type='submit']");
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    button.click();
    return true;
  })()`);

  if (!clicked) {
    throw new Error(`Unable to submit form for selector ${selector}.`);
  }

  await sleep(250);
}

async function fill(client, selector, value) {
  const filled = await client.evaluate(`(() => {
    const input = document.querySelector(${json(selector)});
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      return false;
    }
    input.focus();
    input.value = ${json(value)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);

  if (!filled) {
    throw new Error(`Unable to fill ${selector}.`);
  }

  await sleep(150);
}

async function collectText(client, selector) {
  return client.evaluate(`(() => {
    const node = document.querySelector(${json(selector)});
    return node?.textContent?.trim() ?? null;
  })()`);
}

async function collectCount(client, selector) {
  return client.evaluate(`document.querySelectorAll(${json(selector)}).length`);
}

async function runFlow(name, fn, flows, issues) {
  try {
    flows[name] = {
      status: "passed",
      details: await fn(),
    };
  } catch (error) {
    flows[name] = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
    issues.push({
      flow: name,
      error: flows[name].error,
    });
  }
}

async function main() {
  const target = await getTarget();
  const client = new CdpClient(target);
  await client.connect();

  const flows = {};
  const issues = [];

  await runFlow("home", async () => {
    await client.navigate("/");
    await client.waitFor("Boolean(document.querySelector('.home-hero__title'))", 12000);

    return {
      heroTitle: await collectText(client, ".home-hero__title"),
      activeGroupCount: await collectText(client, ".stat-card:nth-of-type(4) .stat-value"),
    };
  }, flows, issues);

  await runFlow("sign_in", async () => {
    await client.navigate("/login");
    await client.waitFor("Boolean(document.querySelector('#login-email'))");
    await fill(client, "#login-email", "student@example.com");
    await clickClosestFormSubmit(client, "#login-email");
    await client.waitFor("Boolean(document.querySelector('.state-title'))", 10000);

    return {
      stateTitle: await collectText(client, ".state-title"),
      message: await collectText(client, ".notice-banner"),
    };
  }, flows, issues);

  await runFlow("create_join_group", async () => {
    await client.navigate("/groups");
    await client.waitFor("document.querySelectorAll('.group-card').length > 0", 10000);

    const initialCount = await collectCount(client, ".group-card");

    await clickSelector(client, ".page-header__actions .btn");
    await client.waitFor("Boolean(document.querySelector('#group-name'))");
    await fill(client, "#group-name", "QA Smoke Group");
    await fill(client, "#group-class-name", "QA Demo Class");
    await fill(client, "#group-description", "Created during MVP smoke test.");
    await clickClosestFormSubmit(client, "#group-name");
    await client.waitFor(
      `document.querySelectorAll('.group-card').length >= ${initialCount + 1} || Boolean(document.querySelector('.notice-banner'))`,
      10000,
    );

    const afterCreateCount = await collectCount(client, ".group-card");

    await client.waitFor("Boolean(document.querySelector('#join-code'))");
    await fill(client, "#join-code", "BIO101A1");
    await clickClosestFormSubmit(client, "#join-code");
    await client.waitFor(
      `document.querySelectorAll('.group-card').length > ${afterCreateCount} || Boolean(document.querySelector('.notice-banner'))`,
      10000,
    );

    return {
      initialCount,
      afterCreateCount,
      afterJoinCount: await collectCount(client, ".group-card"),
      banner: await collectText(client, ".notice-banner"),
    };
  }, flows, issues);

  await runFlow("discussion_post", async () => {
    await client.navigate("/groups");
    await client.waitFor("document.querySelectorAll('.group-card').length > 0");
    const href = await client.evaluate(`(() => {
      const link = document.querySelector('.group-card');
      return link?.getAttribute('href') ?? null;
    })()`);

    if (!href) {
      throw new Error("No group detail link was available.");
    }

    await client.navigate(href);
    await client.waitFor("Boolean(document.querySelector('.textarea'))");

    const initialPosts = await collectCount(client, ".post-card");
    await fill(client, ".textarea", "QA smoke test post");
    await clickClosestFormSubmit(client, ".textarea");
    await client.waitFor(
      `document.querySelectorAll('.post-card').length >= ${initialPosts + 1}`,
      10000,
    );

    return {
      initialPosts,
      finalPosts: await collectCount(client, ".post-card"),
      newestPost: await collectText(client, ".post-card:first-of-type .post-card__content"),
    };
  }, flows, issues);

  await runFlow("focus_session", async () => {
    await client.navigate("/focus");
    await client.waitFor("document.querySelectorAll('.chip').length > 0");

    await clickSelector(client, ".button-row--center .btn:nth-of-type(1)");
    await sleep(2000);
    await clickSelector(client, ".button-row--center .btn:nth-of-type(2)");
    await sleep(500);
    await clickSelector(client, ".button-row--center .btn:nth-of-type(1)");
    await sleep(2000);
    await client.evaluate(`(() => {
      window.dispatchEvent(new Event('blur'));
      return true;
    })()`);
    await client.waitFor("Boolean(document.querySelector('.warning-banner'))", 5000);
    await sleep(31000);
    await clickSelector(client, ".button-row--center .btn:nth-of-type(3)");
    await client.waitFor(
      "(() => { const buttons = [...document.querySelectorAll('.button-row--center button')]; return buttons.length >= 3 && !buttons[0].disabled && buttons[1].disabled && buttons[2].disabled; })()",
      10000,
    );

    return {
      message: await collectText(client, ".notice-banner, .warning-banner"),
      todaySummary: await collectText(client, ".compact-stat:first-of-type .metric-value"),
    };
  }, flows, issues);

  await runFlow("leaderboards", async () => {
    await client.navigate("/leaderboard");
    await client.waitFor("document.querySelectorAll('.leaderboard-row').length > 0", 10000);

    const dailyTop = await collectText(client, ".leaderboard-row:first-of-type strong");
    const dailyCount = await collectCount(client, ".leaderboard-row");
    await clickSelector(client, ".tab-set button:nth-of-type(2)");
    await sleep(500);
    const weeklyTop = await collectText(client, ".leaderboard-row:first-of-type strong");

    return {
      dailyCount,
      dailyTop,
      weeklyCount: await collectCount(client, ".leaderboard-row"),
      weeklyTop,
    };
  }, flows, issues);

  await runFlow("exams", async () => {
    await client.navigate("/exams");
    await client.waitFor(
      "document.querySelectorAll('.exam-card').length > 0 || Boolean(document.querySelector('.btn'))",
      10000,
    );

    const initialCount = await collectCount(client, ".exam-card");
    await clickSelector(client, ".page-header__actions .btn");
    await client.waitFor("Boolean(document.querySelector('#exam-title'))");
    await fill(client, "#exam-title", "QA Practice Exam");
    await fill(client, "#exam-date", "2026-04-15");
    await fill(client, "#exam-scope", "Integration test range");
    await clickClosestFormSubmit(client, "#exam-title");
    await client.waitFor(
      `document.querySelectorAll('.exam-card').length >= ${initialCount + 1}`,
      10000,
    );

    return {
      initialCount,
      finalCount: await collectCount(client, ".exam-card"),
      newestExam: await collectText(client, ".exam-card:first-of-type strong"),
      editableButtonCount: await client.evaluate(
        "document.querySelectorAll('.exam-card:first-of-type .button-row button').length",
      ),
    };
  }, flows, issues);

  await runFlow("profile", async () => {
    await client.navigate("/profile");
    await client.waitFor("document.querySelectorAll('.stat-card').length >= 4", 10000);

    return {
      title: await collectText(client, ".page-title"),
      totalStudy: await collectText(client, ".stat-card:nth-of-type(4) .stat-value"),
      recentSessionCount: await collectCount(client, ".session-row"),
    };
  }, flows, issues);

  const summary = {
    baseUrl,
    flows,
    issues,
    consoleMessages: client.consoleMessages.filter((entry) => entry.text),
    exceptions: client.exceptions,
    networkErrors: client.networkErrors,
  };

  console.log(JSON.stringify(summary, null, 2));
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
