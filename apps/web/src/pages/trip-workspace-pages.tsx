import {
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Download,
  FileUp,
  ListChecks,
  MapPinned,
  MessageCircle,
  MessageSquareText,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  Trophy,
  Utensils,
  Vote,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { Button, Card, EmptyState, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";

interface UserRef {
  id: string;
  nickname: string;
}

interface WorkspaceTrip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  members: Array<{ user: UserRef }>;
}

interface Place {
  id: string;
  canonicalName: string;
  address: string;
  category: string;
  description: string | null;
  amenities: unknown;
  sourceProvider: string;
  isSample: boolean;
}

interface Candidate {
  id: string;
  status: "ACTIVE" | "SELECTED" | "REJECTED";
  estimatedTotal: number | null;
  priceNote: string | null;
  pros: unknown;
  cons: unknown;
  place: Place;
  addedBy: UserRef;
}

interface PollOption {
  id: string;
  label: string;
}

interface PollResult extends PollOption {
  count: number;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  options: PollOption[];
  voteCount: number;
  myVote: { optionIds?: string[] } | null;
  results: PollResult[] | null;
}

interface ItineraryItem {
  id: string;
  type: string;
  title: string;
  startsAt: string | null;
  assignee: UserRef | null;
}

interface ItineraryDay {
  id: string;
  date: string;
  title: string | null;
  items: ItineraryItem[];
}

interface TripTask {
  id: string;
  category: string;
  title: string;
  priority: string;
  completedAt: string | null;
  assignee: UserRef | null;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface Meal {
  id: string;
  mealAt: string;
  menu: string;
  ingredients: unknown;
  assignee: UserRef | null;
}

interface ShoppingItem extends Ingredient {
  meals: string[];
}

interface Vehicle {
  id: string;
  name: string;
  seats: number;
  departureLocation: string;
  departureAt: string | null;
  driver: UserRef;
  passengers: Array<{ user: UserRef }>;
}

interface TransportValidation {
  totalMembers: number;
  totalSeats: number;
  assignedCount: number;
  unassigned: UserRef[];
  valid: boolean;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  spentAt: string;
  memo: string;
  payer: UserRef;
}

interface SettlementPayment {
  id: string;
  amount: number;
  status: "PENDING" | "PAID";
  fromUser: UserRef;
  toUser: UserRef;
}

interface Settlement {
  id: string;
  revisionNo: number;
  status: "DRAFT" | "LOCKED";
  payments: SettlementPayment[];
}

interface ExpenseData {
  expenses: Expense[];
  total: number;
  latestSettlement: Settlement | null;
}

interface Comment {
  id: string;
  bodyMarkdown: string;
  createdAt: string;
  author: UserRef;
}

interface Post {
  id: string;
  category: string;
  title: string;
  bodyMarkdown: string;
  createdAt: string;
  author: UserRef;
  comments: Comment[];
}

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
}

interface FileObject {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  createdAt: string;
  owner: UserRef;
}

const workspaceLinks = [
  { path: "discover", label: "장소", icon: MapPinned },
  { path: "polls", label: "투표", icon: Vote },
  { path: "itinerary", label: "일정", icon: CalendarDays },
  { path: "tasks", label: "준비", icon: ListChecks },
  { path: "meals", label: "식단", icon: Utensils },
  { path: "transport", label: "차량", icon: Car },
  { path: "expenses", label: "정산", icon: Coins },
  { path: "points", label: "포인트", icon: Trophy },
  { path: "board", label: "게시판", icon: MessageSquareText },
  { path: "lounge", label: "대화", icon: MessageCircle },
  { path: "files", label: "파일", icon: FileUp },
] as const;

function money(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function dateTime(value: string | null): string {
  if (!value) return "시간 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Ingredient =>
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      typeof item.name === "string" &&
      "quantity" in item &&
      typeof item.quantity === "number" &&
      "unit" in item &&
      typeof item.unit === "string",
  );
}

function useTrip() {
  const { tripId = "" } = useParams();
  const query = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => apiRequest<WorkspaceTrip>(`trips/${tripId}`),
    enabled: Boolean(tripId),
  });
  return { tripId, ...query };
}

export function WorkspaceShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { tripId, data: trip } = useTrip();
  return (
    <div className="page workspace-page">
      <nav className="workspace-breadcrumb" aria-label="여행 위치">
        <Link to={`/trips/${tripId}`}>{trip?.title ?? "여행"}</Link>
        <ChevronRight size={15} />
        <span>{eyebrow}</span>
      </nav>
      <div className="workspace-tabs" aria-label="여행 기능">
        {workspaceLinks.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={`/trips/${tripId}/${path}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </div>
      <header className="page-heading page-heading--split workspace-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

function ErrorNotice({ error }: { error: Error | null }) {
  return error ? (
    <div className="form-error" role="alert">
      {error.message}
    </div>
  ) : null;
}

export function TripDiscoverPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("가평");
  const places = useQuery({
    queryKey: ["places", tripId, query],
    queryFn: () =>
      apiRequest<{
        items: Place[];
        providerWarnings: Array<{ message: string }>;
        attribution: string;
      }>(`trips/${tripId}/places/search?q=${encodeURIComponent(query)}`),
  });
  const candidates = useQuery({
    queryKey: ["candidates", tripId],
    queryFn: () => apiRequest<Candidate[]>(`trips/${tripId}/candidates`),
  });
  const candidatePlaceIds = new Set(candidates.data?.map((candidate) => candidate.place.id));
  const addCandidate = useMutation({
    mutationFn: (placeId: string) =>
      apiRequest<Candidate>(`trips/${tripId}/candidates`, {
        method: "POST",
        body: JSON.stringify({ placeId, pros: [], cons: [] }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidates", tripId] }),
  });
  const selectCandidate = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Candidate>(`candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "SELECTED" }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["candidates", tripId] });
      void queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
  const removeCandidate = useMutation({
    mutationFn: (id: string) => apiRequest(`candidates/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidates", tripId] }),
  });

  return (
    <WorkspaceShell
      eyebrow="장소 탐색"
      title="우리에게 맞는 글램핑 찾기"
      description="샘플 후보 또는 직접 등록한 장소를 모아 가격과 장단점을 비교하세요."
    >
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void places.refetch();
        }}
      >
        <Search size={19} />
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="장소 검색"
          placeholder="지역, 장소명, 유형"
        />
        <Button type="submit">검색</Button>
      </form>
      {places.data?.providerWarnings.map((warning) => (
        <p className="workspace-warning" key={warning.message}>
          {warning.message}
        </p>
      ))}
      <ErrorNotice error={addCandidate.error ?? selectCandidate.error ?? removeCandidate.error} />
      <section className="workspace-section">
        <div className="section-heading-row">
          <h2>검색 결과</h2>
          <small>{places.data?.attribution}</small>
        </div>
        {places.isPending && <Spinner label="장소 찾는 중" />}
        <div className="place-grid">
          {places.data?.items.map((place) => (
            <Card className="place-card" key={place.id}>
              <div className="place-card__top">
                <span className="badge">{place.category}</span>
                {place.isSample && <span className="sample-pill">샘플</span>}
              </div>
              <h3>{place.canonicalName}</h3>
              <p>{place.address}</p>
              <small>{place.description}</small>
              <div className="chip-row">
                {asStrings(place.amenities)
                  .slice(0, 4)
                  .map((amenity) => (
                    <i key={amenity}>{amenity}</i>
                  ))}
              </div>
              <Button
                variant="secondary"
                disabled={candidatePlaceIds.has(place.id) || addCandidate.isPending}
                onClick={() => addCandidate.mutate(place.id)}
              >
                {candidatePlaceIds.has(place.id) ? <Check size={16} /> : <Plus size={16} />}
                {candidatePlaceIds.has(place.id) ? "후보에 있음" : "후보로 추가"}
              </Button>
            </Card>
          ))}
        </div>
      </section>
      <section className="workspace-section">
        <h2>후보 비교</h2>
        {candidates.data?.length === 0 && (
          <EmptyState title="비교할 후보가 없어요">검색 결과에서 후보를 추가해 주세요.</EmptyState>
        )}
        <div className="candidate-list">
          {candidates.data?.map((candidate) => (
            <Card
              className={`candidate-card ${
                candidate.status === "SELECTED" ? "candidate-card--selected" : ""
              }`}
              key={candidate.id}
            >
              <div>
                <span className="badge">
                  {candidate.status === "SELECTED"
                    ? "최종 장소"
                    : candidate.status === "REJECTED"
                      ? "미선정"
                      : "검토 중"}
                </span>
                <h3>{candidate.place.canonicalName}</h3>
                <p>{candidate.place.address}</p>
                <small>{candidate.priceNote ?? `추가: ${candidate.addedBy.nickname}`}</small>
              </div>
              <strong>
                {candidate.estimatedTotal === null ? "가격 미정" : money(candidate.estimatedTotal)}
              </strong>
              <div className="candidate-card__actions">
                {candidate.status === "ACTIVE" && (
                  <Button onClick={() => selectCandidate.mutate(candidate.id)}>이 장소 확정</Button>
                )}
                {candidate.status !== "SELECTED" && (
                  <Button variant="ghost" onClick={() => removeCandidate.mutate(candidate.id)}>
                    <Trash2 size={16} />
                    제거
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function TripPollsPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const polls = useQuery({
    queryKey: ["polls", tripId],
    queryFn: () => apiRequest<Poll[]>(`trips/${tripId}/polls`),
  });
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState("");
  const create = useMutation({
    mutationFn: () =>
      apiRequest<Poll>(`trips/${tripId}/polls`, {
        method: "POST",
        body: JSON.stringify({
          type: "SINGLE",
          title,
          optionLabels: options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          anonymous: false,
          resultsVisibility: "ALWAYS",
        }),
      }),
    onSuccess: () => {
      setTitle("");
      setOptions("");
      void queryClient.invalidateQueries({ queryKey: ["polls", tripId] });
    },
  });
  const vote = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      apiRequest(`polls/${pollId}/votes`, {
        method: "POST",
        body: JSON.stringify({ optionIds: [optionId] }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["polls", tripId] }),
  });
  const close = useMutation({
    mutationFn: (pollId: string) => apiRequest(`polls/${pollId}/close`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["polls", tripId] }),
  });

  return (
    <WorkspaceShell
      eyebrow="빠른 의사결정"
      title="친구들과 투표하기"
      description="장소, 메뉴, 출발 시간처럼 의견이 갈리는 일을 한 번에 정하세요."
    >
      <Card>
        <form
          className="inline-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="투표 제목"
            minLength={2}
            required
          />
          <input
            className="input"
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            placeholder="선택지 (쉼표로 구분)"
            required
          />
          <Button type="submit" disabled={create.isPending}>
            <Plus size={17} />
            투표 만들기
          </Button>
        </form>
        <ErrorNotice error={create.error} />
      </Card>
      {polls.isPending && <Spinner label="투표 불러오는 중" />}
      <div className="poll-list">
        {polls.data?.map((poll) => (
          <Card className="poll-card" key={poll.id}>
            <div className="section-heading-row">
              <div>
                <span className="badge">{poll.status === "OPEN" ? "진행 중" : "마감"}</span>
                <h2>{poll.title}</h2>
              </div>
              <small>{poll.voteCount}명 참여</small>
            </div>
            {poll.description && <p>{poll.description}</p>}
            <div className="poll-options">
              {poll.options.map((option) => {
                const selected = poll.myVote?.optionIds?.includes(option.id) ?? false;
                const count = poll.results?.find((result) => result.id === option.id)?.count;
                return (
                  <button
                    className={selected ? "poll-option poll-option--selected" : "poll-option"}
                    key={option.id}
                    type="button"
                    disabled={poll.status !== "OPEN" || vote.isPending}
                    onClick={() => vote.mutate({ pollId: poll.id, optionId: option.id })}
                  >
                    <span>
                      {selected && <Check size={16} />}
                      {option.label}
                    </span>
                    {count !== undefined && <strong>{count}표</strong>}
                  </button>
                );
              })}
            </div>
            {poll.status === "OPEN" && (
              <Button variant="ghost" onClick={() => close.mutate(poll.id)}>
                투표 마감
              </Button>
            )}
          </Card>
        ))}
      </div>
      <ErrorNotice error={vote.error ?? close.error} />
    </WorkspaceShell>
  );
}

export function TripItineraryPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const days = useQuery({
    queryKey: ["itinerary", tripId],
    queryFn: () => apiRequest<ItineraryDay[]>(`trips/${tripId}/itinerary/days`),
  });
  const [title, setTitle] = useState("");
  const generate = useMutation({
    mutationFn: () =>
      apiRequest<ItineraryDay[]>(`trips/${tripId}/itinerary/generate-template`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
  const add = useMutation({
    mutationFn: () => {
      const firstDay = days.data?.[0];
      if (!firstDay) throw new Error("먼저 일정 템플릿을 만들어 주세요.");
      return apiRequest(`trips/${tripId}/itinerary/items`, {
        method: "POST",
        body: JSON.stringify({ dayId: firstDay.id, type: "ACTIVITY", title }),
      });
    },
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] });
    },
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => apiRequest(`itinerary/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
  return (
    <WorkspaceShell
      eyebrow="1박 2일 일정"
      title="8월 29–30일 여행 타임라인"
      description="고정된 날짜를 기준으로 이동, 식사, 체크인과 활동을 순서대로 관리하세요."
      actions={
        <Button variant="secondary" onClick={() => generate.mutate()}>
          <ClipboardCheck size={17} />
          기본 일정 채우기
        </Button>
      }
    >
      <form
        className="inline-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <input
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="첫째 날에 활동 추가"
          required
        />
        <Button type="submit">
          <Plus size={17} /> 추가
        </Button>
      </form>
      <ErrorNotice error={generate.error ?? add.error ?? remove.error} />
      {days.isPending && <Spinner label="일정 불러오는 중" />}
      <div className="timeline-days">
        {days.data?.map((day) => (
          <section className="timeline-day" key={day.id}>
            <header>
              <span>
                {new Intl.DateTimeFormat("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  timeZone: "Asia/Seoul",
                }).format(new Date(day.date))}
              </span>
              <h2>{day.title}</h2>
            </header>
            <ol>
              {day.items.map((item) => (
                <li key={item.id}>
                  <time>
                    {item.startsAt
                      ? dateTime(item.startsAt).split(" ").slice(-2).join(" ")
                      : "미정"}
                  </time>
                  <div>
                    <span className="badge">{item.type}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`${item.title} 삭제`}
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </WorkspaceShell>
  );
}

export function TripTasksPage() {
  const { tripId, data: trip } = useTrip();
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ["tasks", tripId],
    queryFn: () => apiRequest<TripTask[]>(`trips/${tripId}/tasks`),
  });
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const template = useMutation({
    mutationFn: () => apiRequest(`trips/${tripId}/tasks/from-template`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", tripId] }),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`trips/${tripId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          category: "공용",
          title,
          priority: "MEDIUM",
          ...(assigneeId ? { assigneeId } : {}),
        }),
      }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["tasks", tripId] });
    },
  });
  const toggle = useMutation({
    mutationFn: (task: TripTask) =>
      apiRequest(`tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: task.completedAt === null }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", tripId] }),
  });
  const done = tasks.data?.filter((task) => task.completedAt).length ?? 0;
  return (
    <WorkspaceShell
      eyebrow="준비 체크리스트"
      title="빠뜨릴 것 없이 나눠 준비하기"
      description="담당자를 정하고 준비가 끝난 항목을 바로 체크하세요."
      actions={
        <Button variant="secondary" onClick={() => template.mutate()}>
          기본 체크리스트
        </Button>
      }
    >
      <Card className="progress-card">
        <div>
          <strong>
            {done}/{tasks.data?.length ?? 0}
          </strong>
          <span>준비 완료</span>
        </div>
        <progress value={done} max={tasks.data?.length || 1} />
      </Card>
      <form
        className="inline-create-form inline-create-form--three"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="새 준비 항목"
          required
        />
        <select
          className="input"
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          aria-label="담당자"
        >
          <option value="">담당자 미정</option>
          {trip?.members.map((member) => (
            <option value={member.user.id} key={member.user.id}>
              {member.user.nickname}
            </option>
          ))}
        </select>
        <Button type="submit">추가</Button>
      </form>
      <ErrorNotice error={template.error ?? create.error ?? toggle.error} />
      <div className="task-list">
        {tasks.data?.map((task) => (
          <button
            className={task.completedAt ? "task-row task-row--done" : "task-row"}
            type="button"
            key={task.id}
            onClick={() => toggle.mutate(task)}
          >
            <span className="task-row__check">{task.completedAt && <Check size={17} />}</span>
            <span>
              <strong>{task.title}</strong>
              <small>
                {task.category} · {task.assignee?.nickname ?? "담당자 미정"}
              </small>
            </span>
            <i>{task.priority === "HIGH" ? "중요" : task.priority === "LOW" ? "여유" : "보통"}</i>
          </button>
        ))}
      </div>
    </WorkspaceShell>
  );
}

export function TripMealsPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const meals = useQuery({
    queryKey: ["meals", tripId],
    queryFn: () => apiRequest<Meal[]>(`trips/${tripId}/meals`),
  });
  const shopping = useQuery({
    queryKey: ["shopping", tripId],
    queryFn: () => apiRequest<ShoppingItem[]>(`trips/${tripId}/shopping-list`),
  });
  const [menu, setMenu] = useState("");
  const [ingredient, setIngredient] = useState("");
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`trips/${tripId}/meals`, {
        method: "POST",
        body: JSON.stringify({
          mealAt: new Date("2026-08-29T18:00:00+09:00").toISOString(),
          menu,
          ingredients: ingredient ? [{ name: ingredient, quantity: 1, unit: "개" }] : [],
        }),
      }),
    onSuccess: () => {
      setMenu("");
      setIngredient("");
      void queryClient.invalidateQueries({ queryKey: ["meals", tripId] });
      void queryClient.invalidateQueries({ queryKey: ["shopping", tripId] });
    },
  });
  return (
    <WorkspaceShell
      eyebrow="식단과 장보기"
      title="뭘 먹을지 정하면 장보기는 자동"
      description="메뉴에 재료를 넣으면 중복 재료를 합쳐 장보기 목록으로 보여줍니다."
    >
      <form
        className="inline-create-form inline-create-form--three"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="input"
          value={menu}
          onChange={(event) => setMenu(event.target.value)}
          placeholder="메뉴"
          required
        />
        <input
          className="input"
          value={ingredient}
          onChange={(event) => setIngredient(event.target.value)}
          placeholder="대표 재료 (선택)"
        />
        <Button type="submit">메뉴 추가</Button>
      </form>
      <ErrorNotice error={create.error} />
      <div className="meal-layout">
        <section>
          <h2>식단</h2>
          <div className="meal-list">
            {meals.data?.map((meal) => (
              <Card key={meal.id}>
                <span className="badge">{dateTime(meal.mealAt)}</span>
                <h3>{meal.menu}</h3>
                <div className="chip-row">
                  {asIngredients(meal.ingredients).map((item) => (
                    <i key={`${item.name}-${item.unit}`}>
                      {item.name} {item.quantity}
                      {item.unit}
                    </i>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
        <Card className="shopping-card">
          <ShoppingBasket />
          <h2>통합 장보기</h2>
          <ul>
            {shopping.data?.map((item) => (
              <li key={`${item.name}-${item.unit}`}>
                <span>{item.name}</span>
                <strong>
                  {item.quantity}
                  {item.unit}
                </strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </WorkspaceShell>
  );
}

export function TripTransportPage() {
  const { tripId, data: trip } = useTrip();
  const queryClient = useQueryClient();
  const vehicles = useQuery({
    queryKey: ["vehicles", tripId],
    queryFn: () => apiRequest<Vehicle[]>(`trips/${tripId}/vehicles`),
  });
  const validation = useQuery({
    queryKey: ["transport-validation", tripId],
    queryFn: () => apiRequest<TransportValidation>(`trips/${tripId}/transport/validation`),
  });
  const [name, setName] = useState("추가 차량");
  const [driverId, setDriverId] = useState("");
  const create = useMutation({
    mutationFn: () => {
      const actualDriver = driverId || trip?.members[0]?.user.id;
      if (!actualDriver) throw new Error("운전자를 선택해 주세요.");
      return apiRequest(`trips/${tripId}/vehicles`, {
        method: "POST",
        body: JSON.stringify({
          name,
          driverId: actualDriver,
          seats: 4,
          departureLocation: "서울역",
          departureAt: new Date("2026-08-29T09:00:00+09:00").toISOString(),
          passengerIds:
            trip?.members.map((member) => member.user.id).filter((id) => id !== actualDriver) ?? [],
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vehicles", tripId] });
      void queryClient.invalidateQueries({ queryKey: ["transport-validation", tripId] });
    },
  });
  return (
    <WorkspaceShell
      eyebrow="차량 배정"
      title="누가 운전하고 어디서 탈지"
      description="차량별 운전자와 탑승자를 정하고 빠진 사람이 없는지 확인하세요."
    >
      <Card
        className={
          validation.data?.valid ? "validation-card validation-card--valid" : "validation-card"
        }
      >
        <Car />
        <div>
          <strong>
            {validation.data?.valid ? "모든 멤버 배정 완료" : "탑승 배정을 확인해 주세요"}
          </strong>
          <span>
            {validation.data?.assignedCount ?? 0}/{validation.data?.totalMembers ?? 0}명 · 총{" "}
            {validation.data?.totalSeats ?? 0}석
          </span>
        </div>
      </Card>
      <form
        className="inline-create-form inline-create-form--three"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <select
          className="input"
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
        >
          <option value="">운전자 선택</option>
          {trip?.members.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.nickname}
            </option>
          ))}
        </select>
        <Button type="submit">차량 추가</Button>
      </form>
      <ErrorNotice error={create.error} />
      <div className="vehicle-grid">
        {vehicles.data?.map((vehicle) => (
          <Card className="vehicle-card" key={vehicle.id}>
            <span className="badge">{vehicle.seats}인승</span>
            <h2>{vehicle.name}</h2>
            <p>
              <strong>{vehicle.driver.nickname}</strong> 운전 · {vehicle.departureLocation} 출발
            </p>
            <small>{dateTime(vehicle.departureAt)}</small>
            <div className="avatar-stack">
              <i title={vehicle.driver.nickname}>{vehicle.driver.nickname.slice(0, 1)}</i>
              {vehicle.passengers.map(({ user }) => (
                <i title={user.nickname} key={user.id}>
                  {user.nickname.slice(0, 1)}
                </i>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  );
}

export function TripExpensesPage() {
  const { tripId, data: trip } = useTrip();
  const queryClient = useQueryClient();
  const expenses = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: () => apiRequest<ExpenseData>(`trips/${tripId}/expenses`),
  });
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const create = useMutation({
    mutationFn: () => {
      const actualPayer = payerId || trip?.members[0]?.user.id;
      if (!actualPayer) throw new Error("결제자를 선택해 주세요.");
      return apiRequest(`trips/${tripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          payerId: actualPayer,
          amount: Number(amount),
          category: "OTHER",
          spentAt: new Date().toISOString(),
          memo,
          participantUserIds: trip?.members.map((member) => member.user.id) ?? [],
        }),
      });
    },
    onSuccess: () => {
      setMemo("");
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
    },
  });
  const calculate = useMutation({
    mutationFn: () =>
      apiRequest<Settlement>(`trips/${tripId}/settlements/calculate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", tripId] }),
  });
  const lock = useMutation({
    mutationFn: (id: string) => apiRequest(`settlements/${id}/lock`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", tripId] }),
  });
  const pay = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) =>
      apiRequest(`settlement-payments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ paid }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", tripId] }),
  });
  const settlement = expenses.data?.latestSettlement;
  return (
    <WorkspaceShell
      eyebrow="비용과 정산"
      title="1원까지 정확한 더치페이"
      description="지출을 등록하면 모든 멤버에게 균등 분할하고 최소 송금 경로를 계산합니다."
      actions={
        <Button onClick={() => calculate.mutate()}>
          <Coins size={17} /> 정산 다시 계산
        </Button>
      }
    >
      <Card className="expense-total">
        <span>현재 총지출</span>
        <strong>{money(expenses.data?.total ?? 0)}</strong>
        <small>{expenses.data?.expenses.length ?? 0}건</small>
      </Card>
      <form
        className="inline-create-form expense-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="input"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="지출 내용"
          required
        />
        <input
          className="input"
          type="number"
          min="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="금액"
          required
        />
        <select
          className="input"
          value={payerId}
          onChange={(event) => setPayerId(event.target.value)}
        >
          <option value="">결제자 선택</option>
          {trip?.members.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.nickname}
            </option>
          ))}
        </select>
        <Button type="submit">지출 추가</Button>
      </form>
      <ErrorNotice error={create.error ?? calculate.error ?? lock.error ?? pay.error} />
      <div className="expense-layout">
        <section className="expense-list">
          <h2>지출 내역</h2>
          {expenses.data?.expenses.map((expense) => (
            <Card key={expense.id}>
              <div>
                <strong>{expense.memo}</strong>
                <small>
                  {expense.payer.nickname} 결제 · {dateTime(expense.spentAt)}
                </small>
              </div>
              <b>{money(expense.amount)}</b>
            </Card>
          ))}
        </section>
        <Card className="settlement-card">
          <div className="section-heading-row">
            <h2>송금할 금액</h2>
            {settlement && (
              <span className="badge">
                {settlement.status === "LOCKED" ? "확정" : `계산 ${settlement.revisionNo}차`}
              </span>
            )}
          </div>
          {!settlement && <p>정산 계산을 누르면 송금 목록이 생깁니다.</p>}
          <div className="payment-list">
            {settlement?.payments.map((payment) => (
              <button
                className={
                  payment.status === "PAID" ? "payment-row payment-row--paid" : "payment-row"
                }
                type="button"
                key={payment.id}
                onClick={() => pay.mutate({ id: payment.id, paid: payment.status !== "PAID" })}
              >
                <span>
                  {payment.fromUser.nickname} → {payment.toUser.nickname}
                </span>
                <strong>{money(payment.amount)}</strong>
                <i>{payment.status === "PAID" ? "완료" : "송금 전"}</i>
              </button>
            ))}
          </div>
          {settlement?.status === "DRAFT" && (
            <Button variant="secondary" onClick={() => lock.mutate(settlement.id)}>
              이 정산 확정하기
            </Button>
          )}
        </Card>
      </div>
    </WorkspaceShell>
  );
}

export function TripBoardPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const posts = useQuery({
    queryKey: ["posts", tripId],
    queryFn: () => apiRequest<Post[]>(`trips/${tripId}/posts`),
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentByPost, setCommentByPost] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`trips/${tripId}/posts`, {
        method: "POST",
        body: JSON.stringify({ category: "자유", title, bodyMarkdown: body }),
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["posts", tripId] });
    },
  });
  const comment = useMutation({
    mutationFn: (postId: string) =>
      apiRequest(`posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ bodyMarkdown: commentByPost[postId] }),
      }),
    onSuccess: (_, postId) => {
      setCommentByPost((current) => ({ ...current, [postId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["posts", tripId] });
    },
  });
  return (
    <WorkspaceShell
      eyebrow="여행 게시판"
      title="중요한 얘기는 묻히지 않게"
      description="공지, 질문, 장소 정보와 준비 메모를 주제별로 남기세요."
    >
      <Card>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="게시글 제목"
            required
          />
          <textarea
            className="input textarea"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="내용"
            required
          />
          <Button type="submit">게시하기</Button>
        </form>
      </Card>
      <ErrorNotice error={create.error ?? comment.error} />
      <div className="post-list">
        {posts.data?.map((post) => (
          <Card className="post-card" key={post.id}>
            <span className="badge">{post.category}</span>
            <h2>{post.title}</h2>
            <p>{post.bodyMarkdown}</p>
            <small>
              {post.author.nickname} · {dateTime(post.createdAt)}
            </small>
            <div className="comment-list">
              {post.comments.map((entry) => (
                <p key={entry.id}>
                  <strong>{entry.author.nickname}</strong> {entry.bodyMarkdown}
                </p>
              ))}
            </div>
            <form
              className="comment-form"
              onSubmit={(event) => {
                event.preventDefault();
                comment.mutate(post.id);
              }}
            >
              <input
                className="input"
                value={commentByPost[post.id] ?? ""}
                onChange={(event) =>
                  setCommentByPost((current) => ({ ...current, [post.id]: event.target.value }))
                }
                placeholder="댓글 쓰기"
                required
              />
              <Button type="submit" variant="secondary">
                등록
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  );
}

export function TripLoungePage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const messages = useQuery({
    queryKey: ["messages", tripId],
    queryFn: () => apiRequest<ChatMessage[]>(`trips/${tripId}/messages`),
    refetchInterval: 4_000,
  });
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () =>
      apiRequest(`trips/${tripId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, clientMessageId: crypto.randomUUID() }),
      }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["messages", tripId] });
    },
  });
  return (
    <WorkspaceShell
      eyebrow="여행 라운지"
      title="가볍게 이어지는 단체 대화"
      description="페이지를 열어 둔 동안 새 대화를 자동으로 확인합니다."
    >
      <Card className="chat-panel">
        <div className="chat-messages">
          {messages.data?.map((message) => (
            <div className="chat-message" key={message.id}>
              <span>{message.author.nickname.slice(0, 1)}</span>
              <div>
                <strong>{message.author.nickname}</strong>
                <p>{message.body}</p>
                <small>{dateTime(message.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send.mutate();
          }}
        >
          <input
            className="input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="메시지 입력"
            required
          />
          <Button type="submit">보내기</Button>
        </form>
      </Card>
      <ErrorNotice error={send.error} />
    </WorkspaceShell>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export function TripFilesPage() {
  const { tripId } = useTrip();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<File | null>(null);
  const files = useQuery({
    queryKey: ["files", tripId],
    queryFn: () => apiRequest<FileObject[]>(`trips/${tripId}/files`),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("업로드할 파일을 선택해 주세요.");
      return apiRequest(`trips/${tripId}/files`, {
        method: "POST",
        body: JSON.stringify({
          originalName: selected.name,
          mime: selected.type,
          dataBase64: await fileToBase64(selected),
        }),
      });
    },
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["files", tripId] });
    },
  });
  const download = useMutation({
    mutationFn: (file: FileObject) =>
      apiRequest<{ originalName: string; mime: string; dataBase64: string }>(
        `files/${file.id}/content`,
      ),
    onSuccess: (content) => {
      const anchor = document.createElement("a");
      anchor.href = `data:${content.mime};base64,${content.dataBase64}`;
      anchor.download = content.originalName;
      anchor.click();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`files/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files", tripId] }),
  });
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelected(event.target.files?.[0] ?? null);
  };
  return (
    <WorkspaceShell
      eyebrow="공유 파일"
      title="예약 확인서와 사진 모아두기"
      description="이미지와 PDF를 5MB까지 올리고 여행 멤버끼리 내려받을 수 있습니다."
    >
      <Card>
        <form
          className="file-upload"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <label className="file-picker">
            <FileUp />
            <span>{selected?.name ?? "이미지 또는 PDF 선택"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={onFile}
            />
          </label>
          <Button type="submit" disabled={!selected || upload.isPending}>
            업로드
          </Button>
        </form>
      </Card>
      <ErrorNotice error={upload.error ?? download.error ?? remove.error} />
      <div className="file-list">
        {files.data?.map((file) => (
          <Card key={file.id}>
            <div>
              <strong>{file.originalName}</strong>
              <small>
                {file.owner.nickname} · {(file.size / 1024).toFixed(1)}KB
              </small>
            </div>
            <Button variant="ghost" onClick={() => download.mutate(file)}>
              <Download size={16} /> 내려받기
            </Button>
            <Button variant="ghost" onClick={() => remove.mutate(file.id)}>
              <Trash2 size={16} /> 삭제
            </Button>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  );
}
