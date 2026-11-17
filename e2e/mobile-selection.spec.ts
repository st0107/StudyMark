import { test, expect } from "@playwright/test";
import type { CDPSession, Page } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

type Point = { x: number; y: number };

async function openReader(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /^Sam/ }).click();
  await expect(
    page.getByRole("heading", { name: "Shared library", exact: true }),
  ).toBeVisible();
  await page.goto("/reader/java-collections?page=1");
  await expect(page.locator(".pdf-page")).not.toHaveClass(/is-loading/);
  await expect(page.locator(".textLayer span").first()).toBeVisible();
}

async function wordPoint(page: Page, word: string): Promise<Point> {
  return page.locator(".textLayer").evaluate((layer, target) => {
    const pattern = new RegExp(`\\b${target}\\b`);
    const span = [...layer.querySelectorAll("span")].find((item) =>
      pattern.test(item.textContent ?? ""),
    );
    if (!span?.firstChild) throw new Error(`Missing PDF word: ${target}`);
    const offset = span.textContent!.search(pattern);
    const range = document.createRange();
    range.setStart(span.firstChild, offset);
    range.setEnd(span.firstChild, offset + target.length);
    const rect = range.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, word);
}

async function touch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  point?: Point,
) {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: point
      ? [{ ...point, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
      : [],
  });
}

async function longPress(page: Page, session: CDPSession, point: Point) {
  await touch(session, "touchStart", point);
  await expect(
    page.getByRole("toolbar", { name: "Selected text actions" }),
  ).toBeVisible();
  await touch(session, "touchEnd");
}

async function drag(page: Page, session: CDPSession, from: Point, to: Point) {
  await touch(session, "touchStart", from);
  await moveTouch(page, session, from, to);
  await touch(session, "touchEnd");
}

async function moveTouch(
  page: Page,
  session: CDPSession,
  from: Point,
  to: Point,
) {
  for (let step = 1; step <= 8; step++) {
    await touch(session, "touchMove", {
      x: from.x + ((to.x - from.x) * step) / 8,
      y: from.y + ((to.y - from.y) * step) / 8,
    });
    // Real touch frames let the browser's scroll recognizer participate.
    await page.waitForTimeout(20);
  }
}

async function dragSelectionHandle(page: Page, session: CDPSession, end: "start" | "end", targetWord: string) {
  const handle = page.getByRole("button", { name: `Adjust selection ${end}`, exact: true });
  const bounds = (await handle.boundingBox())!;
  const rects = page.locator(".pdf-touch-selection-rect");
  const selectedWord = (await (end === "start" ? rects.first() : rects.last()).boundingBox())!;
  const finger = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const target = await wordPoint(page, targetWord);
  // Preserve the finger-to-glyph offset while dragging the handle beside the text.
  const offset = {
    x: finger.x - (selectedWord.x + (end === "start" ? 1 : selectedWord.width - 1)),
    y: finger.y - (selectedWord.y + selectedWord.height / 2),
  };
  await drag(page, session, finger, { x: target.x + offset.x, y: target.y + offset.y });
}

test("touch word selection opens app actions, lookups and a persistent highlight", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openReader(page);
  const session = await context.newCDPSession(page);
  await longPress(page, session, await wordPoint(page, "collection"));
  const toolbar = page.getByRole("toolbar", { name: "Selected text actions" });
  await expect(toolbar.locator(".selection-preview")).toHaveText("collection");
  await expect(page.locator(".pdf-touch-selection-rect")).toHaveCount(1);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  expect(
    await page
      .locator(".textLayer")
      .evaluate((element) => getComputedStyle(element).userSelect),
  ).toBe("none");

  const search = toolbar.getByRole("link", {
    name: "Search Google (opens in new tab)",
    exact: true,
  });
  const meaning = toolbar.getByRole("link", {
    name: "Look up meaning on Google (opens in new tab)",
    exact: true,
  });
  expect(
    new URL((await search.getAttribute("href"))!).searchParams.get("q"),
  ).toBe("collection");
  expect(
    new URL((await meaning.getAttribute("href"))!).searchParams.get("q"),
  ).toBe("meaning of collection");
  await expect(search).toHaveAttribute("target", "_blank");
  await expect(search).toHaveAttribute("rel", /noopener/);
  await expect(meaning).toHaveAttribute("rel", /noreferrer/);

  // Fulfill locally so the test verifies the new tab without sending PDF text out.
  await context.route("https://www.google.com/**", (route) =>
    route.fulfill({ status: 200, body: "<title>Lookup</title>" }),
  );
  const popupPromise = page.waitForEvent("popup");
  await meaning.tap();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(new URL(popup.url()).searchParams.get("q")).toBe(
    "meaning of collection",
  );
  await popup.close();
  await expect(toolbar).toBeVisible();
  await page.screenshot({
    path: ".qa/mobile-selection-word.png",
    fullPage: true,
  });

  await toolbar
    .getByRole("button", { name: "Highlight green", exact: true })
    .tap();
  await expect(toolbar).not.toBeVisible();
  await expect(page.locator(".pdf-touch-selection")).toHaveCount(0);
  await expect(page.locator(".pdf-highlight")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".pdf-highlight")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("touch handles extend a passage, preserve failed highlights and attach notes", async ({
  page,
  context,
}) => {
  await openReader(page);
  const session = await context.newCDPSession(page);
  await longPress(page, session, await wordPoint(page, "collection"));
  await dragSelectionHandle(page, session, "end", "characteristics");
  const toolbar = page.getByRole("toolbar", { name: "Selected text actions" });
  await expect
    .poll(async () =>
      new URL(
        (await toolbar
          .getByRole("link", {
            name: "Search Google (opens in new tab)",
            exact: true,
          })
          .getAttribute("href"))!,
      ).searchParams.get("q"),
    )
    .toContain("performance characteristics");
  const selectedText = new URL(
    (await toolbar
      .getByRole("link", {
        name: "Search Google (opens in new tab)",
        exact: true,
      })
      .getAttribute("href"))!,
  ).searchParams.get("q")!;
  expect(selectedText).toContain("collection groups objects");
  expect(
    new URL(
      (await toolbar
        .getByRole("link", {
          name: "Look up meaning on Google (opens in new tab)",
          exact: true,
        })
        .getAttribute("href"))!,
    ).searchParams.get("q"),
  ).toBe(`explain in simple terms: ${selectedText}`);
  expect(
    await page.locator(".pdf-touch-selection-rect").count(),
  ).toBeGreaterThan(1);

  await page.evaluate(async () => {
    const path = "/src/shared/api/index.ts";
    const api = await import(/* @vite-ignore */ path);
    api.failNextMockMutation();
  });
  await toolbar
    .getByRole("button", { name: "Highlight yellow", exact: true })
    .tap();
  await expect(toolbar.getByRole("alert")).toContainText(
    "Your selection is kept",
  );
  await expect(
    page.getByRole("button", { name: "Adjust selection end", exact: true }),
  ).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Highlight yellow", exact: true })
    .tap();
  await expect(toolbar).not.toBeVisible();
  expect(await page.locator(".pdf-highlight").count()).toBeGreaterThan(1);

  await longPress(page, session, await wordPoint(page, "a"));
  await expect(toolbar.locator(".selection-preview")).toHaveText("a");
  const startHandle = (await page.getByRole("button", { name: "Adjust selection start", exact: true }).boundingBox())!;
  const endHandle = (await page.getByRole("button", { name: "Adjust selection end", exact: true }).boundingBox())!;
  expect(startHandle.y + startHandle.height).toBeLessThanOrEqual(endHandle.y);
  await dragSelectionHandle(page, session, "start", "each");
  await expect(toolbar.locator(".selection-preview")).toHaveText("each key with a");
  await toolbar.getByRole("button", { name: "Dismiss selection", exact: true }).tap();

  await longPress(page, session, await wordPoint(page, "duplicates"));
  await toolbar
    .getByRole("button", { name: "Add note to selection", exact: true })
    .tap();
  await expect(page.getByRole("textbox", { name: "Your note" })).toBeVisible();
  await expect(page.locator(".note-editor blockquote")).toContainText(
    "duplicates",
  );
  await page
    .getByRole("textbox", { name: "Your note" })
    .fill("Compare list and set behavior.");
  await page.getByRole("button", { name: "Save note", exact: true }).tap();
  await expect(
    page.getByText("Compare list and set behavior.", { exact: true }),
  ).toBeVisible();
});

test("quick swipes scroll, and dismissing or navigating clears touch selection", async ({
  page,
  context,
}) => {
  await openReader(page);
  const session = await context.newCDPSession(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
  await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
  await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
  await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
  await expect(page.locator(".pdf-page")).not.toHaveClass(/is-loading/);
  const viewport = page.locator(".pdf-viewport");
  const bounds = (await viewport.boundingBox())!;
  await drag(
    page,
    session,
    { x: bounds.x + 90, y: bounds.y + 330 },
    { x: bounds.x + 90, y: bounds.y + 160 },
  );
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(30);
  await expect(
    page.getByRole("toolbar", { name: "Selected text actions" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "200%", exact: true }).tap();
  await expect(page.locator(".pdf-page")).not.toHaveClass(/is-loading/);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });

  await longPress(page, session, await wordPoint(page, "collection"));
  await page
    .getByRole("button", { name: "Dismiss selection", exact: true })
    .tap();
  await expect(page.locator(".pdf-touch-selection")).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "Selected text actions" }),
  ).toHaveCount(0);
  await longPress(page, session, await wordPoint(page, "collection"));
  await page.getByRole("button", { name: "Next page", exact: true }).tap();
  await expect(
    page.getByRole("spinbutton", { name: "Page number" }),
  ).toHaveValue("2");
  await expect(page.locator(".pdf-touch-selection")).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "Selected text actions" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("holding then dragging selects a passage, with actions fitting narrow and landscape phones", async ({
  page,
  context,
}) => {
  await openReader(page);
  const session = await context.newCDPSession(page);
  const start = await wordPoint(page, "collection");
  await touch(session, "touchStart", start);
  const toolbar = page.getByRole("toolbar", { name: "Selected text actions" });
  await expect(toolbar).toBeVisible();
  await moveTouch(
    page,
    session,
    start,
    await wordPoint(page, "characteristics"),
  );
  await touch(session, "touchEnd");
  const search = toolbar.getByRole("link", {
    name: "Search Google (opens in new tab)",
    exact: true,
  });
  await expect
    .poll(async () =>
      new URL((await search.getAttribute("href"))!).searchParams.get("q"),
    )
    .toContain("performance characteristics");
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page
      .getByRole("button", { name: "Dismiss selection", exact: true })
      .tap();
    const previousWidth = await page.locator(".pdf-page").evaluate(element => element.clientWidth);
    await page.setViewportSize(viewport);
    // ResizeObserver updates the text layer asynchronously; wait for the new page size.
    await expect.poll(() => page.locator(".pdf-page").evaluate(element => element.clientWidth)).not.toBe(previousWidth);
    await expect(page.locator(".pdf-page")).not.toHaveClass(/is-loading/);
    await page
      .locator(".textLayer span")
      .filter({ hasText: "A collection groups" })
      .scrollIntoViewIfNeeded();
    await longPress(page, session, await wordPoint(page, "collection"));
    const bounds = (await toolbar.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      toolbar.getByRole("button", { name: "Highlight yellow", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.qa/mobile-selection-${viewport.width === 320 ? "narrow" : "landscape"}.png`,
      fullPage: true,
    });
  }
});
