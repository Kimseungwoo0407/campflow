import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Field } from "@campflow/ui";
import {
  loginSchema,
  signUpSchema,
  type AuthResult,
  type LoginInput,
  type SignUpInput,
} from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

function AuthShell({ children, title, lead }: { children: React.ReactNode; title: string; lead: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="back-link" to="/">
          <ArrowLeft size={17} />
          처음으로
        </Link>
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
    <AuthShell title="다시 만나 반가워요" lead="여행 준비가 기다리고 있어요.">
      <form className="stack-form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <Field
          label="아이디 또는 이메일"
          error={errors.identifier?.message}
          inputProps={{
            id: "login-identifier",
            type: "text",
            autoComplete: "username",
            ...register("identifier"),
          }}
        />
        <Field
          label="비밀번호"
          error={errors.password?.message}
          inputProps={{
            id: "login-password",
            type: "password",
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
        <Link className="recovery-link" to="/forgot-password">
          비밀번호를 잊으셨나요?
        </Link>
        <p className="auth-switch">
          아직 계정이 없나요? <Link to="/signup">회원가입</Link>
        </p>
        <div className="demo-hint">
          <b>친구 계정</b>
          <span>관리자에게 받은 이름 아이디로 로그인하세요.</span>
        </div>
      </form>
    </AuthShell>
  );
}

export function SignUpPage() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", nickname: "" },
  });

  async function submit(input: SignUpInput) {
    try {
      const result = await apiRequest<AuthResult>(
        "auth/signup",
        { method: "POST", body: JSON.stringify(input) },
        false,
      );
      setSession(result);
      navigate("/groups", { replace: true });
    } catch (error: unknown) {
      setError("root", {
        message:
          error instanceof ApiClientError
            ? error.message
            : "회원가입 중 문제가 발생했습니다.",
      });
    }
  }

  return (
    <AuthShell title="첫 여행을 시작해요" lead="친구별 계정으로 안전하게 협업합니다.">
      <form className="stack-form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <Field
          label="닉네임"
          error={errors.nickname?.message}
          inputProps={{
            id: "signup-nickname",
            autoComplete: "nickname",
            ...register("nickname"),
          }}
        />
        <Field
          label="이메일"
          error={errors.email?.message}
          inputProps={{
            id: "signup-email",
            type: "email",
            autoComplete: "email",
            ...register("email"),
          }}
        />
        <Field
          label="비밀번호"
          hint="영문과 숫자를 포함해 12자 이상"
          error={errors.password?.message}
          inputProps={{
            id: "signup-password",
            type: "password",
            autoComplete: "new-password",
            ...register("password"),
          }}
        />
        {errors.root?.message && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "계정 만드는 중…" : "계정 만들기"}
        </Button>
        <p className="auth-switch">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </AuthShell>
  );
}
