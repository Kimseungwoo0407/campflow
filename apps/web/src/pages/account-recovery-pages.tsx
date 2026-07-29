import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Field, Spinner } from "@campflow/ui";
import {
  forgotPasswordSchema,
  passwordSchema,
  type ForgotPasswordInput,
} from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";

interface ForgotResult {
  accepted: true;
  delivery: string;
  developmentResetToken?: string;
}

function RecoveryShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="invite-page">
      <Link className="brand" to="/">
        <span className="brand__mark" aria-hidden="true">
          △
        </span>
        CampFlow
      </Link>
      {children}
    </main>
  );
}

export function ForgotPasswordPage() {
  const [result, setResult] = useState<ForgotResult | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function submit(input: ForgotPasswordInput) {
    try {
      setResult(
        await apiRequest<ForgotResult>(
          "auth/forgot-password",
          { method: "POST", body: JSON.stringify(input) },
          false,
        ),
      );
    } catch (error: unknown) {
      setError("root", {
        message: error instanceof ApiClientError ? error.message : "요청을 처리하지 못했습니다.",
      });
    }
  }

  return (
    <RecoveryShell>
      <Card className="invite-hero recovery-card">
        <span className="invite-hero__icon">
          <KeyRound />
        </span>
        <h1>비밀번호 재설정</h1>
        <p>가입한 이메일을 입력하면 재설정 링크를 보냅니다.</p>
        {result ? (
          <>
            <p className="form-notice" role="status">
              해당 이메일의 계정이 있다면 재설정 안내를 보냈습니다.
            </p>
            {result.developmentResetToken && (
              <Link
                className="button button--secondary"
                to={`/reset-password?token=${encodeURIComponent(result.developmentResetToken)}`}
              >
                개발용 재설정 링크 열기
              </Link>
            )}
            <Link className="text-link" to="/login">
              로그인으로 돌아가기
            </Link>
          </>
        ) : (
          <form
            className="stack-form recovery-form"
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <Field
              label="이메일"
              error={errors.email?.message}
              inputProps={{
                id: "forgot-email",
                type: "email",
                autoComplete: "email",
                ...register("email"),
              }}
            />
            {errors.root?.message && (
              <p className="form-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "요청 중…" : "재설정 링크 요청"}
            </Button>
          </form>
        )}
      </Card>
    </RecoveryShell>
  );
}

interface ResetForm {
  password: string;
  confirmation: string;
}

export function ResetPasswordPage() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const token = search.get("token") ?? "";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetForm>({ defaultValues: { password: "", confirmation: "" } });

  async function submit(input: ResetForm) {
    const password = passwordSchema.safeParse(input.password);
    if (!password.success) {
      setError("password", {
        message: password.error.issues[0]?.message ?? "안전한 비밀번호를 입력해 주세요.",
      });
      return;
    }
    if (input.password !== input.confirmation) {
      setError("confirmation", { message: "비밀번호가 서로 다릅니다." });
      return;
    }
    try {
      await apiRequest(
        "auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({ token, password: input.password }),
        },
        false,
      );
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error: unknown) {
      setError("root", {
        message: error instanceof ApiClientError ? error.message : "비밀번호를 변경하지 못했습니다.",
      });
    }
  }

  return (
    <RecoveryShell>
      <Card className="invite-hero recovery-card">
        <span className="invite-hero__icon">
          {isSubmitSuccessful ? <CheckCircle2 /> : <KeyRound />}
        </span>
        <h1>새 비밀번호 설정</h1>
        {!token ? (
          <>
            <p className="form-error" role="alert">
              재설정 토큰이 없습니다.
            </p>
            <Link className="button button--secondary" to="/forgot-password">
              링크 다시 요청
            </Link>
          </>
        ) : isSubmitSuccessful ? (
          <p className="form-notice" role="status">
            비밀번호를 변경했습니다. 로그인 화면으로 이동합니다.
          </p>
        ) : (
          <form
            className="stack-form recovery-form"
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <Field
              label="새 비밀번호"
              error={errors.password?.message}
              inputProps={{
                id: "reset-password",
                type: "password",
                autoComplete: "new-password",
                ...register("password"),
              }}
            />
            <Field
              label="새 비밀번호 확인"
              error={errors.confirmation?.message}
              inputProps={{
                id: "reset-confirmation",
                type: "password",
                autoComplete: "new-password",
                ...register("confirmation"),
              }}
            />
            {errors.root?.message && (
              <p className="form-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "변경 중…" : "비밀번호 변경"}
            </Button>
          </form>
        )}
      </Card>
    </RecoveryShell>
  );
}

export function VerifyEmailPage() {
  const [search] = useSearchParams();
  const [state, setState] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("");
  const token = search.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("이메일 확인 토큰이 없습니다.");
      return;
    }
    void apiRequest(
      "auth/verify-email",
      { method: "POST", body: JSON.stringify({ token }) },
      false,
    )
      .then(() => setState("success"))
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "이메일을 확인하지 못했습니다.");
      });
  }, [token]);

  return (
    <RecoveryShell>
      <Card className="invite-hero recovery-card">
        {state === "checking" && <Spinner label="이메일 확인 중" />}
        {state === "success" && (
          <>
            <span className="invite-hero__icon">
              <CheckCircle2 />
            </span>
            <h1>이메일을 확인했습니다</h1>
            <Link className="button button--primary" to="/app">
              CampFlow로 이동
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1>이메일을 확인할 수 없습니다</h1>
            <p className="form-error" role="alert">
              {message}
            </p>
            <Link className="button button--secondary" to="/">
              처음으로
            </Link>
          </>
        )}
      </Card>
    </RecoveryShell>
  );
}
