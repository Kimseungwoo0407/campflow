import { describe, expect, it } from "vitest";
import { nextPollSelection } from "./poll-selection";

describe("투표 선택", () => {
  it("단일 선택에서는 기존 항목을 새 항목으로 바꾼다", () => {
    expect(nextPollSelection(["first"], "second", 1)).toEqual(["second"]);
  });

  it("복수 선택 항목을 한도까지 추가하고 다시 눌러 해제한다", () => {
    expect(nextPollSelection(["first"], "second", 2)).toEqual(["first", "second"]);
    expect(nextPollSelection(["first", "second"], "first", 2)).toEqual(["second"]);
  });

  it("최대 선택 개수를 넘거나 마지막 선택을 해제하지 않는다", () => {
    const fullSelection = ["first", "second"];
    expect(nextPollSelection(fullSelection, "third", 2)).toBe(fullSelection);

    const lastSelection = ["first"];
    expect(nextPollSelection(lastSelection, "first", 2)).toBe(lastSelection);
  });
});
