import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LoginPage } from "./auth-pages";

describe("LoginPage", () => {
  it("변경한 비밀번호도 입력할 수 있다", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const password = screen.getByLabelText("비밀번호");

    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("maxlength", "128");
    expect(password).not.toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText(/변경했다면 새 비밀번호를 입력하세요/)).toBeInTheDocument();
  });
});
