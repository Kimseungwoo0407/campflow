import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RewardSaleDialog } from "./reward-sale-dialog";

describe("아이템 판매 확인", () => {
  afterEach(() => cleanup());

  it("70% 환급액과 취소 불가 안내 후 판매를 확정한다", () => {
    const confirm = vi.fn();
    render(
      <RewardSaleDialog
        itemTitle="한 잔 지목권"
        refundedPoints={126}
        pending={false}
        error={null}
        onCancel={() => undefined}
        onConfirm={confirm}
      />,
    );
    expect(screen.getByText("실제 구매가의 70%인", { exact: false })).toHaveTextContent("126P");
    fireEvent.click(screen.getByRole("button", { name: "126P에 판매" }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("Escape 키로 확인 창을 닫는다", () => {
    const cancel = vi.fn();
    render(
      <RewardSaleDialog
        itemTitle="포인트 방어권"
        refundedPoints={210}
        pending={false}
        error={null}
        onCancel={cancel}
        onConfirm={() => undefined}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
