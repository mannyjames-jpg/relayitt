import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { effectiveQuickValues, quickDateOptions } from "./quick-capture-values";
import { parseQuickEntry } from "./quick-parse";
import { NO_RECURRENCE } from "./recurrence";

const today = "2026-10-06";
const parsed = parseQuickEntry("Book flights 2026-10-09 9am #travel !important weekly");

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => assert.equal(actual, expected),
    toBeNull: () => assert.equal(actual, null),
    toEqual: (expected: unknown) => assert.deepEqual(actual, expected),
  };
}

describe("quick-add controls", () => {
  test("untouched controls display parsed scheduling and details", () => {
    const value = effectiveQuickValues(parsed, {}, today);
    expect(value.due_date).toBe("2026-10-09");
    expect(value.due_time).toBe("09:00");
    expect(value.priority).toBe("Important");
    expect(value.category).toBe("Travel");
    expect(value.recurrence.recurrence_type).toBe("weekly");
  });
  test("manual due date overrides the parsed date", () => {
    expect(effectiveQuickValues(parsed, { due_date: "2026-10-13" }, today).due_date).toBe(
      "2026-10-13",
    );
  });
  test("manual time overrides the parsed time", () => {
    expect(effectiveQuickValues(parsed, { due_time: "15:00" }, today).due_time).toBe("15:00");
  });
  test("manual Normal priority overrides parsed Important", () => {
    expect(effectiveQuickValues(parsed, { priority: "Normal" }, today).priority).toBe("Normal");
  });
  test("manual None category clears parsed Travel", () => {
    expect(effectiveQuickValues(parsed, { category: null }, today).category).toBeNull();
  });
  test("manual no recurrence overrides parsed weekly", () => {
    expect(
      effectiveQuickValues(parsed, { recurrence: NO_RECURRENCE }, today).recurrence.recurrence_type,
    ).toBe("none");
  });
  test("No date suppresses date and time even with parsed recurrence", () => {
    const value = effectiveQuickValues(parsed, { due_date: null }, today);
    expect(value.due_date).toBeNull();
    expect(value.due_time).toBeNull();
  });
  test("clearing manual time remains cleared", () => {
    expect(effectiveQuickValues(parsed, { due_time: null }, today).due_time).toBeNull();
  });
  test("quick dates include today, tomorrow, two days out, seven days out, no date", () => {
    expect(quickDateOptions(today).map((d) => d.value)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-13",
      null,
    ]);
  });
  test("resetting overrides restores parsed values", () => {
    const manual = { priority: "Normal" as const };
    expect(effectiveQuickValues(parsed, manual, today).priority).toBe("Normal");
    expect(effectiveQuickValues(parsed, {}, today).priority).toBe("Important");
  });
});
