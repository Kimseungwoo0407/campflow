import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Button, Card, EmptyState, Field, Spinner } from "@campflow/ui";
import { createGroupSchema, type CreateGroupInput, type GroupRole } from "@campflow/contracts";
import { apiRequest, ApiClientError } from "../api/client";

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  role: GroupRole;
  memberCount: number;
  updatedAt: string;
}

export function GroupsPage() {
  const queryClient = useQueryClient();
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiRequest<GroupSummary[]>("groups"),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof createGroupSchema>, unknown, CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", description: "" },
  });
  const createGroup = useMutation({
    mutationFn: (input: CreateGroupInput) =>
      apiRequest<GroupSummary>("groups", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error: Error) => {
      setError("root", {
        message: error instanceof ApiClientError ? error.message : "그룹을 만들지 못했습니다.",
      });
    },
  });

  return (
    <div className="page">
      <header className="page-heading">
        <span className="eyebrow">함께하는 사람들</span>
        <h1>내 그룹</h1>
        <p>친구 모임마다 여행과 권한이 분리됩니다.</p>
      </header>
      <div className="groups-layout">
        <section aria-labelledby="group-list-title">
          <h2 id="group-list-title" className="section-title">
            참여 중인 그룹
          </h2>
          {groups.isPending && <Spinner />}
          {groups.isError && (
            <div className="state-panel state-panel--error" role="alert">
              <p>{groups.error.message}</p>
              <Button variant="secondary" onClick={() => void groups.refetch()}>
                다시 시도
              </Button>
            </div>
          )}
          {groups.data?.length === 0 && (
            <EmptyState
              title="아직 그룹이 없어요"
              action={<span className="empty-state__hint">오른쪽 양식에서 첫 그룹을 만들어 보세요.</span>}
            >
              여행을 함께할 친구들의 공간을 먼저 만듭니다.
            </EmptyState>
          )}
          <div className="group-list">
            {groups.data?.map((group) => (
              <Link key={group.id} to={`/groups/${group.id}`} className="group-card">
                <span className="group-card__cover" aria-hidden="true">
                  <Users />
                </span>
                <span className="group-card__body">
                  <span className="badge">{group.role === "OWNER" ? "소유자" : "멤버"}</span>
                  <strong>{group.name}</strong>
                  <small>{group.description || "설명이 아직 없습니다."}</small>
                </span>
                <span className="group-card__count">{group.memberCount}명</span>
              </Link>
            ))}
          </div>
        </section>
        <Card className="create-card">
          <span className="create-card__icon">
            <Plus />
          </span>
          <h2>새 그룹 만들기</h2>
          <p>그룹을 만든 사람은 소유자가 되며 초대와 권한을 관리합니다.</p>
          <form
            className="stack-form"
            onSubmit={(event) => void handleSubmit((input) => createGroup.mutateAsync(input))(event)}
            noValidate
          >
            <Field
              label="그룹 이름"
              error={errors.name?.message}
              inputProps={{
                id: "group-name",
                placeholder: "예: 주말엔 밖으로",
                ...register("name"),
              }}
            />
            <Field
              label="한 줄 소개"
              error={errors.description?.message}
              inputProps={{
                id: "group-description",
                placeholder: "우리 모임을 소개해 주세요",
                ...register("description"),
              }}
            />
            {errors.root?.message && (
              <p className="form-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? "만드는 중…" : "그룹 만들기"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
