import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Spinner } from "@campflow/ui";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

interface Me {
  id: string;
  email: string;
  nickname: string;
  timezone: string;
  locale: string;
  profile: {
    phone: string | null;
    allergies: string[];
    foodDislikes: string[];
    canDrive: boolean;
  } | null;
}

interface SettingsForm {
  nickname: string;
  phone: string;
  allergiesText: string;
  foodDislikesText: string;
  canDrive: boolean;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiRequest<Me>("me") });
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SettingsForm>({
    defaultValues: {
      nickname: "",
      phone: "",
      allergiesText: "",
      foodDislikesText: "",
      canDrive: false,
    },
  });
  const passwordForm = useForm<PasswordForm>({
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
  });

  useEffect(() => {
    if (!me.data) return;
    reset({
      nickname: me.data.nickname,
      phone: me.data.profile?.phone ?? "",
      allergiesText: me.data.profile?.allergies.join(", ") ?? "",
      foodDislikesText: me.data.profile?.foodDislikes.join(", ") ?? "",
      canDrive: me.data.profile?.canDrive ?? false,
    });
  }, [me.data, reset]);

  const update = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiRequest<Me>("me", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: async (result) => {
      if (currentUser) {
        updateUser({ ...currentUser, nickname: result.nickname });
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const passwordChange = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiRequest<{ changed: true; revokedSessionCount: number }>("auth/change-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => passwordForm.reset(),
  });

  async function submit(form: SettingsForm) {
    const split = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const parsed = updateProfileSchema.safeParse({
      nickname: form.nickname,
      phone: form.phone.trim() || null,
      allergies: split(form.allergiesText),
      foodDislikes: split(form.foodDislikesText),
      canDrive: form.canDrive,
    });
    if (!parsed.success) {
      setError("root", { message: "입력값을 확인해 주세요." });
      return;
    }
    await update.mutateAsync(parsed.data);
  }

  async function submitPassword(form: PasswordForm) {
    passwordForm.clearErrors();
    if (form.newPassword !== form.confirmation) {
      passwordForm.setError("confirmation", { message: "새 비밀번호가 서로 다릅니다." });
      return;
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      if (field === "currentPassword" || field === "newPassword") {
        passwordForm.setError(field, { message: issue?.message ?? "입력값을 확인해 주세요." });
      } else {
        passwordForm.setError("root", { message: issue?.message ?? "입력값을 확인해 주세요." });
      }
      return;
    }
    await passwordChange.mutateAsync(parsed.data).catch(() => undefined);
  }

  if (me.isPending) {
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <header className="page-heading">
        <span className="eyebrow">개인 정보와 공개 범위</span>
        <h1>개인 설정</h1>
        <p>선택 정보는 같은 그룹의 여행 준비에만 사용됩니다.</p>
      </header>
      <Card>
        <form className="stack-form" onSubmit={(event) => void handleSubmit(submit)(event)}>
          <Field
            label="이메일"
            hint="이메일 변경은 다음 인증 확장에서 제공됩니다."
            inputProps={{ id: "settings-email", value: me.data?.email ?? "", disabled: true }}
          />
          <Field
            label="닉네임"
            error={errors.nickname?.message}
            inputProps={{ id: "settings-nickname", ...register("nickname", { required: true }) }}
          />
          <Field
            label="전화번호 (선택)"
            inputProps={{
              id: "settings-phone",
              autoComplete: "tel",
              ...register("phone"),
            }}
          />
          <Field
            label="알레르기 (쉼표로 구분)"
            hint="건강 진단이 아닌 사용자 입력 정보입니다."
            inputProps={{ id: "settings-allergies", ...register("allergiesText") }}
          />
          <Field
            label="비선호 음식 (쉼표로 구분)"
            inputProps={{ id: "settings-dislikes", ...register("foodDislikesText") }}
          />
          <label className="check-field">
            <input type="checkbox" {...register("canDrive")} />
            <span>여행에서 운전할 수 있어요</span>
          </label>
          {(errors.root?.message || update.error) && (
            <p className="form-error" role="alert">
              {errors.root?.message ??
                (update.error instanceof ApiClientError
                  ? update.error.message
                  : "프로필을 저장하지 못했습니다.")}
            </p>
          )}
          {update.isSuccess && (
            <p className="form-notice" role="status">
              설정을 저장했습니다.
            </p>
          )}
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "저장 중…" : "설정 저장"}
          </Button>
        </form>
      </Card>
      <Card className="settings-security-card">
        <div className="settings-card-heading">
          <span className="eyebrow">계정 보안</span>
          <h2>비밀번호 변경</h2>
          <p>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
        </div>
        <form
          className="stack-form"
          onSubmit={(event) => void passwordForm.handleSubmit(submitPassword)(event)}
        >
          <Field
            label="현재 비밀번호"
            error={passwordForm.formState.errors.currentPassword?.message}
            inputProps={{
              id: "settings-current-password",
              type: "password",
              autoComplete: "current-password",
              ...passwordForm.register("currentPassword", { required: true }),
            }}
          />
          <Field
            label="새 비밀번호"
            hint="12자 이상, 영문자와 숫자를 각각 하나 이상 포함해 주세요."
            error={passwordForm.formState.errors.newPassword?.message}
            inputProps={{
              id: "settings-new-password",
              type: "password",
              autoComplete: "new-password",
              ...passwordForm.register("newPassword", { required: true }),
            }}
          />
          <Field
            label="새 비밀번호 확인"
            error={passwordForm.formState.errors.confirmation?.message}
            inputProps={{
              id: "settings-password-confirmation",
              type: "password",
              autoComplete: "new-password",
              ...passwordForm.register("confirmation", { required: true }),
            }}
          />
          {(passwordForm.formState.errors.root?.message || passwordChange.error) && (
            <p className="form-error" role="alert">
              {passwordForm.formState.errors.root?.message ??
                (passwordChange.error instanceof ApiClientError
                  ? passwordChange.error.message
                  : "비밀번호를 변경하지 못했습니다.")}
            </p>
          )}
          {passwordChange.data && (
            <p className="form-notice" role="status">
              비밀번호를 변경했습니다. 다른 기기 세션 {passwordChange.data.revokedSessionCount}개를
              로그아웃했습니다.
            </p>
          )}
          <Button type="submit" disabled={passwordChange.isPending}>
            {passwordChange.isPending ? "변경 중…" : "비밀번호 변경"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
