import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Link2, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { Button, Card, Spinner } from "@campflow/ui";
import {
  createInviteSchema,
  type CreateInviteInput,
  type GroupRole,
  type MemberStatus,
} from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";

interface GroupMember {
  role: GroupRole;
  status: MemberStatus;
  joinedAt: string;
  user: {
    id: string;
    nickname: string;
    locale: string;
    profile: {
      canDrive: boolean;
      allergies: string[];
    } | null;
  };
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  myRole: GroupRole;
  members: GroupMember[];
}

interface CreatedInvite {
  id: string;
  token: string;
  code: string;
  role: GroupRole;
  expiresAt: string;
  maxUses: number;
}

export function GroupDetailPage() {
  const { groupId } = useParams();
  const [copied, setCopied] = useState(false);
  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiRequest<GroupDetail>(`groups/${groupId ?? ""}`),
    enabled: Boolean(groupId),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof createInviteSchema>, unknown, CreateInviteInput>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: {
      role: "MEMBER",
      expiresInHours: 72,
      maxUses: 10,
      requireApproval: false,
    },
  });
  const invite = useMutation({
    mutationFn: (input: CreateInviteInput) =>
      apiRequest<CreatedInvite>(`groups/${groupId ?? ""}/invites`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });

  async function copyInvite() {
    if (!invite.data) return;
    const url = `${window.location.origin}${window.location.pathname}#/invite/${invite.data.token}`;
    await navigator.clipboard.writeText(`${url}\n초대 코드: ${invite.data.code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (group.isPending) {
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  }
  if (group.isError || !group.data) {
    return (
      <div className="page state-panel state-panel--error" role="alert">
        <h1>그룹을 열 수 없습니다</h1>
        <p>{group.error?.message ?? "접근 권한과 서버 상태를 확인해 주세요."}</p>
        <Button variant="secondary" onClick={() => void group.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-heading page-heading--split">
        <div>
          <span className="eyebrow">{group.data.myRole === "OWNER" ? "내가 관리하는 그룹" : "참여 중"}</span>
          <h1>{group.data.name}</h1>
          <p>{group.data.description || "그룹 설명이 아직 없습니다."}</p>
        </div>
        <span className="status-pill">
          <ShieldCheck size={16} />
          {group.data.myRole === "OWNER" ? "그룹 소유자" : "멤버"}
        </span>
      </header>

      <div className="group-detail-grid">
        <section>
          <h2 className="section-title">멤버 {group.data.members.length}명</h2>
          <div className="member-list">
            {group.data.members.map((member) => (
              <Card className="member-card" key={member.user.id}>
                <span className="member-card__avatar" aria-hidden="true">
                  {member.user.nickname.slice(0, 1)}
                </span>
                <span className="member-card__body">
                  <strong>{member.user.nickname}</strong>
                  <small>
                    {member.role === "OWNER" ? "소유자" : member.role === "GUEST" ? "게스트" : "멤버"}
                    {member.status === "PENDING" ? " · 승인 대기" : ""}
                  </small>
                </span>
                <span className="member-card__flags">
                  {member.user.profile?.canDrive && <i>운전 가능</i>}
                  {(member.user.profile?.allergies.length ?? 0) > 0 && <i>알레르기 정보 있음</i>}
                </span>
              </Card>
            ))}
          </div>
        </section>

        {group.data.myRole === "OWNER" ? (
          <Card className="invite-card">
            <span className="create-card__icon">
              <Link2 />
            </span>
            <h2>친구 초대하기</h2>
            <p>링크와 8자리 코드는 생성 직후 한 번만 표시됩니다.</p>
            <form
              className="stack-form"
              onSubmit={(event) => void handleSubmit((input) => invite.mutateAsync(input))(event)}
            >
              <label className="field">
                <span className="field__label">기본 역할</span>
                <select className="input" {...register("role")}>
                  <option value="MEMBER">멤버</option>
                  <option value="GUEST">게스트</option>
                </select>
              </label>
              <div className="form-row">
                <label className="field">
                  <span className="field__label">유효 시간</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={720}
                    {...register("expiresInHours", { valueAsNumber: true })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">최대 인원</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    {...register("maxUses", { valueAsNumber: true })}
                  />
                </label>
              </div>
              <label className="check-field">
                <input type="checkbox" {...register("requireApproval")} />
                <span>소유자 승인 후 참여</span>
              </label>
              {(errors.expiresInHours?.message || errors.maxUses?.message) && (
                <p className="form-error" role="alert">
                  {errors.expiresInHours?.message ?? errors.maxUses?.message}
                </p>
              )}
              {invite.error && (
                <p className="form-error" role="alert">
                  {invite.error instanceof ApiClientError
                    ? invite.error.message
                    : "초대를 만들지 못했습니다."}
                </p>
              )}
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "초대 만드는 중…" : "초대 만들기"}
              </Button>
            </form>
            {invite.data && (
              <div className="invite-result" role="status">
                <span>초대 코드</span>
                <strong>{invite.data.code}</strong>
                <Button variant="secondary" onClick={() => void copyInvite()}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? "복사됨" : "링크와 코드 복사"}
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="permission-card">
            <UserRound />
            <h2>초대 관리는 소유자만 가능해요</h2>
            <p>멤버 목록은 볼 수 있지만 역할 변경과 초대 생성은 제한됩니다.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
