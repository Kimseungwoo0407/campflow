import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServerStatusBanner } from "./server-status-banner";

describe("ServerStatusBanner", () => {
  it("API 오프라인 상태를 텍스트로 안내한다", () => {
    render(<ServerStatusBanner online={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("홈 서버가 오프라인");
  });

  it("정상 상태에서는 배너를 숨긴다", () => {
    const { container } = render(<ServerStatusBanner online />);
    expect(container).toBeEmptyDOMElement();
  });
});
