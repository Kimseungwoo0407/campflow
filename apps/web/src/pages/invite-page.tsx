import { ArrowRight, CalendarClock, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Spinner } from "@campflow/ui";
import type { GroupRole, MemberStatus } from "@campflow/contracts";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

interface InvitePreview {
  group: { id: string; name: string; description: string | null };
  role: GroupRole;
  expiresAt: string;
  remainingUses: number;
  requireApproval: boolean;
}

interface InviteAcceptResult {
  group: { id: string; name: string };
  membership: { status: MemberStatus };
  alreadyMember: boolean;
}

export function InvitePage() {
  const { token } = useParams();
  const status = useAuthStore((state) => state.status);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => apiRequest<InvitePreview>(`invites/${token ?? ""}/preview`),
    enabled: Boolean(token),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () =>
      apiRequest<InviteAcceptResult>(`invites/${token ?? ""}/accept`, { method: "POST" }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      if (result.membership.status === "ACTIVE") {
        navigate(`/groups/${result.group.id}`, { replace: true });
      }
    },
  });

  return (
    <main className="invite-page">
      <Link className="brand" to="/">
        <span className="brand__mark" aria-hidden="true">
          △
        </span>
        CampFlow
      </Link>
      {preview.isPending && <Spinner label="초대 확인 중" />}
      {preview.isError && (
        <Card className="invite-hero invite-hero--error">
          <h1>사용할 수 없는 초대입니다</h1>
          <p>{preview.error.message}</p>
          <Link className="button button--secondary" to="/">
            처음으로
          </Link>
        </Card>
      )}
      {preview.data && (
        <Card className="invite-hero">
          <span className="invite-hero__icon">
            <Users />
          </span>
          <span className="eyebrow">친구가 보낸 CampFlow 초대</span>
          <h1>{preview.data.group.name}</h1>
          <p>{preview.data.group.description || "함께할 다음 여행을 준비하고 있어요."}</p>
          <div className="invite-meta">
            <span>
              <Users size={17} /> 남은 초대 {preview.data.remainingUses}회
            </span>
            <span>
              <CalendarClock size={17} />{" "}
              {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(
                new Date(preview.data.expiresAt),
              )}
              까지
            </span>
          </div>
          {status === "authenticated" ? (
            <>
              <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                {accept.isPending ? "참여 처리 중…" : "이 그룹에 참여하기"}
                <ArrowRight size={18} />
              </Button>
              {accept.error && (
                <p className="form-error" role="alert">
                  {accept.error.message}
                </p>
              )}
              {accept.data?.membership.status === "PENDING" && (
                <p className="form-notice" role="status">
                  참여 요청을 보냈습니다. 그룹 소유자의 승인을 기다려 주세요.
                </p>
              )}
            </>
          ) : (
            <Link
              className="button button--primary"
              to="/login"
              state={{ from: `/invite/${token ?? ""}` }}
            >
              로그인하고 참여하기
              <ArrowRight size={18} />
            </Link>
          )}
          <small>
            {preview.data.requireApproval
              ? "이 초대는 그룹 소유자의 승인이 필요합니다."
              : "참여하면 멤버 목록에 바로 표시됩니다."}
          </small>
        </Card>
      )}
    </main>
  );
}
