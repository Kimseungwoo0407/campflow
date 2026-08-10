import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Field } from "@campflow/ui";
import {
  loginSchema,
  type AuthResult,
  type LoginInput,
} from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";
import { createDemoSession, isDemoMode, saveDemoSession } from "../lib/demo-session";
import { useAuthStore } from "../stores/auth";

function AuthShell({ children, title, lead }: { children: React.ReactNode; title: string; lead: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-heading">
          <span className="brand__mark" aria-hidden="true">
            △
          </span>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
        {children}
      </section>
      <aside className="auth-scene" aria-hidden="true">
        <div className="auth-scene__moon" />
        <div className="auth-scene__mountain">△</div>
        <blockquote>“이번엔 누가 장 봐?”가 자동으로 정리되는 여행.</blockquote>
      </aside>
    </main>
  );
}

export function LoginPage() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  function enterDemo() {
    saveDemoSession();
    setSession(createDemoSession());
    const state = location.state as { from?: string } | null;
    navigate(state?.from ?? "/app", { replace: true });
  }

  async function submit(input: LoginInput) {
    try {
      const result = await apiRequest<AuthResult>(
        "auth/login",
        { method: "POST", body: JSON.stringify(input) },
        false,
      );
      setSession(result);
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? "/app", { replace: true });
    } catch (error: unknown) {
      setError("root", {
        message:
          error instanceof ApiClientError
            ? error.message
            : "로그인 중 문제가 발생했습니다.",
      });
    }
  }

  return (
    <AuthShell title="친구 계정으로 로그인" lead="이름과 비밀번호를 입력하세요.">
      {isDemoMode() && (
        <div className="demo-entry">
          <Button type="button" onClick={enterDemo}>
            데모로 바로 입장
          </Button>
          <p>홈 서버 로그인 없이 로컬 데모 화면과 게임을 둘러볼 수 있습니다.</p>
        </div>
      )}
      <form className="stack-form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <Field
          label="이름"
          error={errors.identifier?.message}
          inputProps={{
            id: "login-identifier",
            type: "text",
            autoComplete: "username",
            placeholder: "본인 이름",
            ...register("identifier"),
          }}
        />
        <Field
          label="비밀번호"
          error={errors.password?.message}
          inputProps={{
            id: "login-password",
            type: "password",
            maxLength: 128,
            placeholder: "비밀번호",
            autoComplete: "current-password",
            ...register("password"),
          }}
        />
        {errors.root?.message && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "로그인 중…" : "로그인"}
        </Button>
        <div className="demo-hint">
          <b>처음 로그인하나요?</b>
          <span>
            초기 비밀번호는 전달받은 생일 월·일 네 자리입니다. 변경했다면 새 비밀번호를 입력하세요.
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
