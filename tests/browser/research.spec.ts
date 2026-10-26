import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { playoffSeasons } from "../../lib/data";

test("advanced table filters, normalization, saved columns and full CSV", async ({
  page,
}) => {
  await page.goto("/stats?season=2024-25");
  const table = page.getByRole("table", {
    name: "Advanced player statistics",
    exact: true,
  });
  await expect(table.getByRole("row")).toHaveCount(51);
  await page.getByLabel("Column preset").selectOption("Shooting");
  await page.getByLabel("Filter value").fill("20");
  await page.getByRole("button", { name: "Add filter", exact: true }).click();
  await expect(page.locator(".research-filter-chips")).toContainText(
    "PTS ≥ 20",
  );
  await page.reload();
  await expect(page.locator(".research-filter-chips")).toContainText(
    "PTS ≥ 20",
  );
  await expect(table.getByRole("columnheader", { name: "TS%" })).toBeVisible();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".research-table-summary")).toContainText(
    "569 matching players",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export these stats" }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv).toContain("# rows,569,matching,569");
  expect(csv).toContain("# definition,ts,");
  await page.getByLabel("Search players").fill("Joki");
  await expect(table.getByRole("row")).toHaveCount(2);
  const before = await table.locator("tbody tr td").nth(7).textContent();
  await page.getByLabel("Advanced stat basis").selectOption("per36");
  await expect(page.locator(".research-table-summary")).toContainText("per36");
  expect(await table.locator("tbody tr td").nth(7).textContent()).toEqual(
    before,
  );
});

test("unavailable models display missingness and scoped playoff profiles survive reload", async ({
  page,
}) => {
  const lab = JSON.stringify({
    section: "stats",
    columns: ["gp", "pts", "dpm", "epm"],
    sort: "pts",
  });
  await page.goto(`/stats?season=2024-25&lab=${encodeURIComponent(lab)}`);
  const table = page.getByRole("table", {
    name: "Advanced player statistics",
    exact: true,
  });
  await expect(table.getByText("Unavailable", { exact: true })).toHaveCount(
    100,
  );
  await page.getByLabel("Analysis season type").selectOption("Playoffs");
  await page.getByLabel("Search players").fill("Joki");
  await expect(table.getByRole("row")).toHaveCount(2);
  await table.locator(".research-player").click();
  const profile = page.getByRole("dialog");
  await expect(profile).toContainText("2024-25 · Playoffs");
  await expect(
    profile.getByRole("heading", { name: "Game log in the selected sample" }),
  ).toBeVisible();
  await expect(profile).toContainText(
    playoffSeasons.find((season) => season.id === "2024-25")!.from,
  );
  await page.reload();
  await expect(profile).toContainText("2024-25 · Playoffs");
  await expect(
    page.getByRole("button", { name: "Close player profile" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(profile).not.toBeVisible();
});

test("five-player comparisons retain selected players across views and reload", async ({
  page,
}) => {
  await page.goto("/stats?season=2024-25");
  const table = page.getByRole("table", {
    name: "Advanced player statistics",
    exact: true,
  });
  await expect(table.getByRole("row")).toHaveCount(51);
  for (let i = 0; i < 5; i++)
    await table
      .getByRole("button", { name: /^Compare / })
      .first()
      .click();
  await expect(
    table.getByRole("button", { name: /^Compare / }).first(),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Analysis views" })
    .getByRole("button", { name: "Compare seasons (5)" })
    .click();
  await expect(page.locator(".research-comparison-column")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".research-comparison-column")).toHaveCount(5);
  const selectors = page.locator(".research-comparison-column select");
  await selectors.first().selectOption("2023-24");
  await expect(selectors.nth(1)).toHaveValue("2024-25");
  await page.reload();
  await expect(selectors.first()).toHaveValue("2023-24");
  await expect(selectors.nth(1)).toHaveValue("2024-25");
  await page
    .locator(".research-comparison-column header button")
    .first()
    .click();
  await expect(page.locator(".research-comparison-column")).toHaveCount(4);
});

test("calendar selections link game boxes and statistical windows", async ({
  page,
}) => {
  await page.goto("/season/2024-25");
  const day = page.getByRole("button", { name: /^2024-10-22, \d+ games$/ });
  await expect(day).toBeVisible();
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/from=2024-10-22&to=2024-10-22/);
  await page.locator(".hub-schedule summary").click();
  await page.getByRole("button", { name: "Open box score" }).first().click();
  await expect(
    page.getByRole("region", { name: "Game box score" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Game box score" }).locator("tbody tr"),
  ).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "Explore this window’s stats" })
    .click();
  await expect(
    page.getByRole("table", {
      name: "Advanced player statistics",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/from=2024-10-22&to=2024-10-22/);
});

test("playoff series, pooled history and keyboard rankings use persisted data", async ({
  page,
}) => {
  await page.goto("/playoffs?season=2024-25");
  await page.getByRole("navigation", { name: "Analysis views" }).waitFor();
  await expect(
    page.getByRole("heading", { name: "The path through the playoffs" }),
  ).toBeVisible();
  await expect(page.locator(".playoff-rounds details")).toHaveCount(15);
  await page
    .getByRole("navigation", { name: "Analysis views" })
    .getByRole("button", { name: "History", exact: true })
    .click();
  await page.getByLabel("Search historical players").fill("Joki");
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(4);
  await page.getByLabel("Pool selected years").check();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
  await page.goto("/rankings/players?season=2024-25");
  const selector = page
    .getByRole("combobox", { name: /^Assign .+ to tier$/ })
    .first();
  const name = (await selector.getAttribute("aria-label"))!.slice(7, -8);
  await selector.selectOption("S");
  await expect(page.locator(".ranking-board")).toContainText(name);
  await page.reload();
  await expect(page.locator(".ranking-board")).toContainText(name);
});

test("advanced workspace error recovery, responsive layout and accessibility", async ({
  page,
}) => {
  await mkdir(".impeccable/review", { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1050 });
    await page.goto("/stats?season=2024-25");
    await expect(
      page
        .getByRole("table", { name: "Advanced player statistics", exact: true })
        .getByRole("row"),
    ).toHaveCount(51);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.screenshot({
      path: `.impeccable/review/research-${width}.png`,
      fullPage: true,
    });
  }
  await page.route("**/api/stats", (route) => route.abort());
  await page.getByLabel("Advanced stat basis").selectOption("totals");
  await expect(
    page.getByRole("alert").filter({ hasText: "Analytics could not load" }),
  ).toContainText("Analytics could not load");
  await page.unroute("**/api/stats");
  await page.getByRole("button", { name: "Retry analytics" }).click();
  await expect(
    page.getByRole("table", {
      name: "Advanced player statistics",
      exact: true,
    }),
  ).toBeVisible();
});

test("phone research scatter fits all points and exports a usable PNG", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore/players?season=2024-25");
  const plot = page.locator(".research-chart");
  await plot.locator('[role="button"]').first().waitFor();
  const layout = await plot.evaluate((element) => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
    rect: element.getBoundingClientRect().toJSON(),
    points: [...element.querySelectorAll("circle")].map((point) =>
      point.getBoundingClientRect().toJSON(),
    ),
  }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.width);
  expect(
    layout.points.every(
      (point) =>
        point.left >= layout.rect.left && point.right <= layout.rect.right,
    ),
  ).toBe(true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const bytes = await readFile((await (await download).path())!);
  expect(bytes.subarray(1, 4).toString()).toEqual("PNG");
  expect(bytes.readUInt32BE(16)).toEqual(1600);
  expect(bytes.readUInt32BE(20)).toEqual(Math.round((1600 * 380) / 420));
  await plot.locator('[role="button"]').first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("matrix mode preserves the prior lineup size and methodology describes current feeds", async ({
  page,
}) => {
  await page.route("**/api/explore/lineups?*", (route) =>
    route.fulfill({
      json: {
        rows: [],
        total: 0,
        tables: [],
        fetchedAt: "2026-10-26T00:00:00Z",
        meta: {},
        interpretation: "NBA fixture with no qualifying observations",
      },
    }),
  );
  await page.goto("/lineups?season=2024-25&team=BOS");
  await page.getByLabel("Lineup size").selectOption("4");
  const request = page.waitForRequest(
    (request) =>
      request.url().includes("/api/explore/lineups?") &&
      new URL(request.url()).searchParams.get("size") === "2",
  );
  await page.getByLabel("Two-player matrix").check();
  await request;
  await expect(page.getByLabel("Lineup size")).toHaveValue("2");
  await expect(page.getByLabel("Lineup size")).toBeDisabled();
  await page.getByLabel("Two-player matrix").uncheck();
  await expect(page.getByLabel("Lineup size")).toHaveValue("4");
  await page.getByRole("button", { name: "About the NBA data" }).click();
  const help = page.getByRole("dialog");
  await expect(help).toContainText("matching public NBA possession samples");
  await expect(help).toContainText("separate full season for each column");
  await expect(help).toContainText("do not establish causal impact");
});
