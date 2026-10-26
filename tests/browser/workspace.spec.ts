import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { seasons, latestSeason } from "../../lib/data";

test("player discovery, filters, sorting, and shareable state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?season=2024-25");
  await expect(
    page.getByRole("heading", { name: "Player explorer." }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: /Player statistics/ });
  await expect(table.getByRole("row")).toHaveCount(51);
  await page.getByRole("button", { name: "Next player page" }).click();
  await expect(page.locator(".table-pagination")).toContainText(
    "Showing 51–100",
  );
  await page.getByRole("button", { name: "Previous player page" }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Team filter").selectOption("DEN");
  await expect(table.getByRole("row")).not.toHaveCount(2);
  await expect(table).toContainText("Nikola");
  await expect(page.locator(".scatter-point")).toHaveCount(
    (await table.getByRole("row").count()) - 1,
  );
  await page.getByLabel("Search players").fill("jokic");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(page).toHaveURL(/team=DEN/);
  await page.reload();
  await expect(page.getByLabel("Search players")).toHaveValue("jokic");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByLabel("Team filter")).toHaveValue("DEN");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await table.getByRole("button", { name: "REB" }).click();
  await expect(table.locator('th[aria-sort="descending"]')).toContainText(
    "REB",
  );
  expect(errors).toEqual([]);
});

test("current-season snapshot exposes the full observed population and freshness", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const current = seasons.find((season) => season.id === latestSeason)!;
  await page.goto("/");
  await expect(
    page.getByRole("table", { name: /Player statistics/ }).getByRole("row"),
  ).toHaveCount(51);
  await expect(page.getByLabel("Season")).toHaveValue(latestSeason);
  await expect(page.locator(".data-provenance")).toContainText(
    `${current.playerCount} players`,
  );
  await expect(page.locator(".data-provenance")).toContainText(
    `${current.gameCount.toLocaleString()} completed games`,
  );
  await expect(page.locator(".data-provenance")).toContainText(
    `Data through ${current.to}`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/current-season-mobile.png",
  });
});

test("snapshot failure shows a retry state and never restores demo data", async ({
  page,
}) => {
  await page.route("**/data/2024-25-*.json", (route) => route.abort());
  await page.goto("/?season=2024-25");
  await expect(
    page.getByRole("alert").filter({ hasText: "Season data is unavailable" }),
  ).toContainText("Season data is unavailable");
  await expect(
    page.getByRole("table", { name: /Player statistics/ }),
  ).toHaveCount(0);
  await page.unroute("**/data/2024-25-*.json");
  await page.getByRole("button", { name: "Retry season data" }).click();
  await expect(
    page.getByRole("table", { name: /Player statistics/ }).getByRole("row"),
  ).toHaveCount(51);
});

test("comparison, profile game logs, removal, and selection limit", async ({
  page,
}) => {
  await page.goto("/?season=2024-25");
  await page
    .getByRole("button", {
      name: "Add Nikola Jokić to comparison",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Add Shai Gilgeous-Alexander to comparison",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Compare 2", exact: true }).click();
  const comparisonExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const comparisonCsv = await readFile(
    (await (await comparisonExport).path())!,
    "utf8",
  );
  expect(comparisonCsv).toContain("Shai Gilgeous-Alexander");
  expect(comparisonCsv).not.toContain("Stephen Curry");
  await expect(
    page.getByRole("heading", { name: "Player comparison." }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: /Side-by-side/ })).toContainText(
    "Nikola Jokić",
  );
  await expect(page.getByRole("table", { name: /Side-by-side/ })).toContainText(
    "Shai Gilgeous-Alexander",
  );
  await page.reload();
  await expect(page.getByRole("table", { name: /Side-by-side/ })).toContainText(
    "Nikola Jokić",
  );
  await page
    .getByRole("button", {
      name: "Remove Shai Gilgeous-Alexander from comparison",
    })
    .click();
  await page.getByRole("button", { name: "Add a player", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Nikola Jokić profile", exact: true })
    .click();
  const profile = page.getByRole("dialog", { name: "Nikola Jokić" });
  await expect(profile).toBeVisible();
  await expect(
    profile.getByRole("heading", { name: "Game log" }),
  ).toBeVisible();
  await expect(profile.locator("tbody tr")).not.toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(profile).not.toBeVisible();
  for (const name of [
    "Shai Gilgeous-Alexander",
    "Giannis Antetokounmpo",
    "Jayson Tatum",
    "Anthony Edwards",
  ]) {
    await page
      .getByRole("button", { name: `Add ${name} to comparison`, exact: true })
      .click();
  }
  await expect(page.getByRole("status")).toContainText("comparison is full");
  await expect(
    page.locator(".comparison-dock .dock-players>button"),
  ).toHaveCount(4);
});

test("metric controls and normalization update the chart and scope", async ({
  page,
}) => {
  await page.goto("/?season=2024-25");
  await page.getByLabel("X axis metric").selectOption("reb");
  await page.getByLabel("Y axis metric").selectOption("ast");
  await expect(
    page.getByRole("group", { name: /Assists versus Rebounds/ }),
  ).toBeVisible();
  await page.getByLabel("Stat normalization").selectOption("totals");
  await expect(page).toHaveURL(/perMode=totals/);
  await page.getByRole("tab", { name: "Scatter view" }).click();
  await expect(page.locator(".full-scatter")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Scatter view" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".full-scatter")).toBeVisible();
});

test("saved views persist and reopen the exact scope; CSV carries provenance", async ({
  page,
}) => {
  await page.goto("/?season=2024-25");
  await page.getByLabel("Search players").fill("curry");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await page.getByRole("button", { name: /Saved views/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".saved-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Open view" }).click();
  await expect(page.getByLabel("Search players")).toHaveValue("curry");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("2024-25");
  const contents = await readFile((await download.path())!, "utf8");
  expect(contents).toContain("NBA Stats via nba_api");
  expect(contents).toContain("Stephen Curry");
  expect(contents).not.toContain("Nikola Jokić");
});

test("calendar and team explorer have working navigation", async ({ page }) => {
  await page.goto("/?season=2024-25");
  await page
    .getByRole("button", { name: "Season calendar", exact: true })
    .click();
  await expect(page.locator(".game-result").first()).toBeVisible();
  const firstDate = await page.locator(".game-date.active").innerText();
  await page.getByRole("button", { name: "Next game dates" }).click();
  await page.locator(".game-date").first().click();
  expect(await page.locator(".game-date.active").innerText()).not.toEqual(
    firstDate,
  );
  await page
    .getByRole("button", { name: "Team explorer", exact: true })
    .click();
  await page.getByRole("button", { name: /DEN Denver Nuggets/ }).click();
  await expect(
    page.getByRole("heading", { name: "Player explorer." }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /Player statistics/ }).getByRole("row"),
  ).not.toHaveCount(2);
});

test("empty states, malformed shared URLs, and modal keyboard focus", async ({
  page,
}) => {
  await page.goto("/?from=2025-99-99&minGames=evil&view=invalid");
  await expect(
    page.getByRole("heading", { name: "Player explorer." }),
  ).toBeVisible();
  await page.getByLabel("Search players").fill("doesnotexist");
  await expect(
    page.getByRole("heading", { name: "No players in this lineup." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "About the NBA data" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close methodology" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("responsive layouts and accessibility at shipped widths", async ({
  page,
}) => {
  const results: {
    width: number;
    violations: {
      id: string;
      impact: string | null | undefined;
      nodes: unknown[];
    }[];
  }[] = [];
  await mkdir(".impeccable/review", { recursive: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/?season=2024-25");
    await page.locator(".player-table tbody tr").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `page overflow at ${width}px`).toBe(false);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      width,
      violations: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    });
    if (width === 1440 || width === 390) {
      const name = width === 1440 ? "desktop" : "mobile";
      await page.screenshot({
        path: `.impeccable/review/${name}.png`,
        fullPage: true,
      });
      await page.screenshot({
        path: `.impeccable/review/${name}-viewport.png`,
      });
    }
    if (width === 320) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("button", { name: "Compare players", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Player comparison." }),
      ).toBeVisible();
    }
  }
  await writeFile(
    ".impeccable/review/accessibility.json",
    JSON.stringify(results, null, 2),
  );
  const failures = results.flatMap((result) =>
    result.violations.map((violation) => ({
      width: result.width,
      ...violation,
    })),
  );
  expect(
    failures.map((failure) => ({
      width: failure.width,
      id: failure.id,
    })),
  ).toEqual([]);
});

test("comparison and profile accessibility, with desktop and mobile captures", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const captures = ".impeccable/review";
  await mkdir(captures, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/?view=compare&compare=203999,1628983");
    await expect(
      page.getByRole("table", { name: /Side-by-side/ }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `${captures}/comparison-${width}.png`,
      fullPage: true,
    });
    await page.goto("/?player=203999");
    await expect(
      page.getByRole("dialog", { name: "Nikola Jokić" }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    await page.screenshot({ path: `${captures}/profile-${width}.png` });
  }
});
