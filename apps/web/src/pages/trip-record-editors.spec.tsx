import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseForm, VehicleForm } from "./trip-workspace-pages";

const members = [
  { user: { id: "member-user-01", nickname: "민지" } },
  { user: { id: "member-user-02", nickname: "현수" } },
];

afterEach(cleanup);

describe("여행 기록 편집 폼", () => {
  it("차량의 고정값을 레이블이 있는 입력 필드로 수정한다", () => {
    const onChange = vi.fn();
    render(
      <VehicleForm
        value={{
          name: "1호 차량",
          driverId: "member-user-01",
          seats: "4",
          departureLocation: "서울역",
          departureAt: "2026-08-29T09:00",
          note: "",
          passengerIds: ["member-user-02"],
        }}
        members={members}
        pending={false}
        submitLabel="변경 저장"
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("총 좌석"), { target: { value: "5" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ seats: "5" }));
    expect(screen.getByRole("button", { name: /변경 저장/ })).toBeInTheDocument();
  });

  it("지출의 금액과 분담자를 수정한다", () => {
    const onChange = vi.fn();
    render(
      <ExpenseForm
        value={{
          memo: "숙소 예약금",
          amount: "320000",
          category: "ACCOMMODATION",
          spentAt: "2026-08-29T12:00",
          payerId: "member-user-01",
          participantUserIds: ["member-user-01"],
        }}
        members={members}
        pending={false}
        submitLabel="변경 저장"
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "300000" } });
    fireEvent.click(screen.getByLabelText("현수"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ amount: "300000" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ participantUserIds: ["member-user-01", "member-user-02"] }),
    );
  });
});
