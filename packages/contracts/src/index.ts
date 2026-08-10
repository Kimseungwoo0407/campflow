import { z } from "zod";

export const groupRoleSchema = z.enum(["OWNER", "MEMBER", "GUEST"]);
export const memberStatusSchema = z.enum(["PENDING", "ACTIVE", "REMOVED"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);
export const tripStatusSchema = z.enum([
  "DRAFT",
  "SEARCHING",
  "VOTING",
  "CONFIRMED",
  "IN_PROGRESS",
  "SETTLING",
  "ARCHIVED",
]);
export const tripRoleSchema = z.enum(["MANAGER", "MEMBER", "GUEST"]);

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(2, "아이디 또는 이메일을 입력해 주세요.")
  .max(254);
export const passwordSchema = z
  .string()
  .min(4, "비밀번호는 4자 이상이어야 합니다.")
  .max(128, "비밀번호는 128자 이하여야 합니다.");
export const nicknameSchema = z.string().trim().min(2).max(30);

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    nickname: nicknameSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: loginIdentifierSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: passwordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
  });

export const updateProfileSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    allergies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    foodDislikes: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    canDrive: z.boolean().optional(),
    notificationPrefs: z.record(z.string(), z.unknown()).optional(),
    privacyPrefs: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const groupSettingsSchema = z
  .object({
    defaultDeparture: z.string().trim().max(120).optional(),
    currency: z.literal("KRW").default("KRW"),
    settlementRule: z.enum(["EQUAL", "WEIGHTED"]).default("EQUAL"),
    boardCategories: z
      .array(z.string().trim().min(1).max(30))
      .max(12)
      .default(["공지", "자유", "장소", "준비", "질문", "후기"]),
  })
  .strict();

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(500).optional(),
    settings: groupSettingsSchema.optional(),
  })
  .strict();

export const updateGroupSchema = createGroupSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const createInviteSchema = z
  .object({
    role: groupRoleSchema.exclude(["OWNER"]).default("MEMBER"),
    expiresInHours: z
      .number()
      .int()
      .min(1)
      .max(24 * 30)
      .default(72),
    maxUses: z.number().int().min(1).max(100).default(10),
    requireApproval: z.boolean().default(false),
  })
  .strict();

export const updateMemberSchema = z
  .object({
    role: groupRoleSchema.exclude(["OWNER"]).optional(),
    status: memberStatusSchema.exclude(["REMOVED"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const createTripSchema = z
  .object({
    title: z.string().trim().min(2, "여행 이름을 두 글자 이상 입력해 주세요.").max(80),
    purpose: z.string().trim().max(500).optional(),
    regionText: z.string().trim().min(2).max(120).default("가평"),
    budgetPerPerson: z.number().int().min(0).max(10_000_000).optional(),
    attendeeCount: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const updateTripSchema = createTripSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const transitionTripSchema = z
  .object({
    status: tripStatusSchema,
    reason: z.string().trim().min(2).max(300).optional(),
  })
  .strict();

export const createPlaceSchema = z
  .object({
    canonicalName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(2).max(300),
    roadAddress: z.string().trim().max(300).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    phone: z.string().trim().max(40).optional(),
    websiteUrl: z.string().url().max(500).optional(),
    category: z.string().trim().min(1).max(80).default("글램핑"),
    description: z.string().trim().max(1000).optional(),
    amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  })
  .strict();

export const createCandidateSchema = z
  .object({
    placeId: z.string().trim().min(10).max(40),
    estimatedTotal: z.number().int().min(0).max(100_000_000).optional(),
    priceNote: z.string().trim().max(300).optional(),
    pros: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
    cons: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const createManualCandidateSchema = z
  .object({
    canonicalName: z.string().trim().min(2).max(120),
    location: z.string().trim().min(2).max(300),
    distance: z.string().trim().max(120).optional(),
    price: z.string().trim().max(120).optional(),
    mapUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .regex(/^https?:\/\//i, "http 또는 https 지도 링크만 입력해 주세요.")
      .optional(),
  })
  .strict();

export const updateCandidateSchema = createCandidateSchema
  .omit({ placeId: true })
  .extend({
    status: z.enum(["ACTIVE", "SELECTED", "REJECTED"]).optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const createPollSchema = z
  .object({
    type: z.enum(["SINGLE", "MULTIPLE", "RATING", "RANKED", "YES_NO"]).default("SINGLE"),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    optionLabels: z.array(z.string().trim().min(1).max(120)).min(2).max(12),
    anonymous: z.boolean().default(false),
    resultsVisibility: z.enum(["ALWAYS", "AFTER_CLOSE"]).default("ALWAYS"),
    closesAt: z.string().datetime().optional(),
  })
  .strict();

export const pollVoteSchema = z
  .object({
    optionIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  })
  .strict();

export const createPollCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(1000),
  })
  .strict();

export const createItineraryItemSchema = z
  .object({
    dayId: z.string().trim().min(10).max(40),
    type: z.enum([
      "TRANSPORT",
      "PLACE",
      "MEAL",
      "SHOPPING",
      "CHECK_IN",
      "CHECK_OUT",
      "ACTIVITY",
      "FREE_TIME",
      "NOTICE",
    ]),
    title: z.string().trim().min(1).max(120),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    placeId: z.string().trim().min(10).max(40).optional(),
    assigneeId: z.string().trim().min(10).max(40).optional(),
    costEstimate: z.number().int().min(0).max(100_000_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateItineraryItemSchema = createItineraryItemSchema
  .omit({ dayId: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const createPostSchema = z
  .object({
    category: z.enum(["공지", "자유", "장소", "준비", "질문", "후기"]),
    title: z.string().trim().min(2).max(150),
    bodyMarkdown: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const createCommentSchema = z
  .object({
    bodyMarkdown: z.string().trim().min(1).max(3000),
    parentId: z.string().trim().min(10).max(40).optional(),
  })
  .strict();

export const createMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().trim().min(8).max(80),
  })
  .strict();

export const createTaskSchema = z
  .object({
    category: z.enum(["숙박", "취사", "의약", "전자기기", "날씨", "공용", "개인"]),
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).optional(),
    assigneeId: z.string().trim().min(10).max(40).optional(),
    dueAt: z.string().datetime().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    quantity: z.string().trim().max(40).optional(),
  })
  .strict();

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ completed: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "변경할 값을 입력해 주세요.");

export const createMealSchema = z
  .object({
    mealAt: z.string().datetime(),
    menu: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).optional(),
    assigneeId: z.string().trim().min(10).max(40).optional(),
    ingredients: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            quantity: z.number().positive().max(10_000),
            unit: z.string().trim().min(1).max(20),
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();

export const updateMealSchema = createMealSchema;

export const createVehicleSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    driverId: z.string().trim().min(10).max(40),
    seats: z.number().int().min(1).max(20),
    departureLocation: z.string().trim().min(1).max(200),
    departureAt: z.string().datetime().optional(),
    note: z.string().trim().max(500).optional(),
    passengerIds: z.array(z.string().trim().min(10).max(40)).max(20).default([]),
  })
  .strict();

export const updateVehicleSchema = createVehicleSchema;

export const createFileUploadSchema = z
  .object({
    originalName: z.string().trim().min(1).max(180),
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    dataBase64: z.string().min(4).max(7_500_000),
  })
  .strict();

export const createExpenseSchema = z
  .object({
    payerId: z.string().trim().min(10).max(40),
    amount: z.number().int().positive().max(100_000_000),
    category: z.enum(["ACCOMMODATION", "TRANSPORT", "FOOD", "ACTIVITY", "OTHER"]),
    spentAt: z.string().datetime(),
    memo: z.string().trim().min(1).max(300),
    participantUserIds: z.array(z.string().trim().min(10).max(40)).min(1).max(100),
  })
  .strict();

export const updateExpenseSchema = createExpenseSchema;

export const updatePaymentSchema = z.object({ paid: z.boolean() }).strict();

export const redeemRewardSchema = z
  .object({
    targetUserId: z.string().trim().min(10).max(40).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const managerPointGrantSchema = z
  .object({
    targetUserId: z.string().trim().min(10).max(40),
    amount: z
      .number()
      .int()
      .min(10, "최소 지급 포인트는 10P입니다.")
      .max(10_000, "한 번에 최대 10,000P까지 지급할 수 있습니다.")
      .refine((value) => value % 10 === 0, "10P 단위로 입력해 주세요."),
    reason: z.string().trim().min(2, "지급 사유를 입력해 주세요.").max(100),
    clientRequestId: z.string().trim().min(8).max(80),
  })
  .strict();

export const managerPointSetSchema = z
  .object({
    targetUserId: z.string().trim().min(10).max(40),
    balance: z
      .number()
      .int()
      .min(0, "포인트는 0P보다 작게 설정할 수 없습니다.")
      .max(1_000_000, "포인트는 최대 1,000,000P까지 설정할 수 있습니다."),
    reason: z.string().trim().min(2, "설정 사유를 입력해 주세요.").max(100),
    clientRequestId: z.string().trim().min(8).max(80),
  })
  .strict();

export const managerRewardGrantSchema = z
  .object({
    targetUserId: z.string().trim().min(10).max(40),
    rewardItemId: z.string().trim().min(10).max(40),
    quantity: z
      .number()
      .int()
      .min(1, "아이템은 최소 1개 이상 지급해야 합니다.")
      .max(100, "아이템은 한 번에 최대 100개까지 지급할 수 있습니다."),
    reason: z.string().trim().min(2, "지급 사유를 입력해 주세요.").max(100),
    clientRequestId: z.string().trim().min(8).max(80),
  })
  .strict();

export const achievementKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]+$/, "올바른 업적 키가 아닙니다.");

export const oddEvenGameSchema = z
  .object({
    startChoice: z.enum(["LEFT", "RIGHT"]).optional(),
    rungCountChoice: z.union([z.literal(3), z.literal(4)]).optional(),
    endChoice: z.enum(["ODD", "EVEN"]).optional(),
    wager: z.number().int().min(10).max(500),
    clientRoundId: z.string().trim().min(8).max(80),
  })
  .strict()
  .superRefine((value, context) => {
    const selectedCount = [value.startChoice, value.rungCountChoice, value.endChoice].filter(
      (choice) => choice !== undefined,
    ).length;
    if (selectedCount === 0) {
      context.addIssue({
        code: "custom",
        message: "출발점, 줄 수, 도착 결과 중 하나 이상을 선택해야 합니다.",
      });
      return;
    }
    if (selectedCount === 3 && value.startChoice && value.rungCountChoice && value.endChoice) {
      const endSide =
        value.rungCountChoice % 2 === 0
          ? value.startChoice
          : value.startChoice === "LEFT"
            ? "RIGHT"
            : "LEFT";
      const expectedEnd = endSide === "LEFT" ? "ODD" : "EVEN";
      if (value.endChoice !== expectedEnd) {
        context.addIssue({
          code: "custom",
          message: "실제 사다리로 이어질 수 없는 조합입니다.",
        });
      }
    }
  });

export const snailRaceGameSchema = z
  .object({
    snail: z.number().int().min(1).max(4),
    wager: z.number().int().min(10).max(500),
    clientRoundId: z.string().trim().min(8).max(80),
  })
  .strict();

export const rpsRouletteGameSchema = z
  .object({
    choice: z.enum(["ROCK", "PAPER", "SCISSORS"]),
    wager: z.union([z.literal(10), z.literal(50), z.literal(100)]),
    clientRoundId: z.string().trim().min(8).max(80),
  })
  .strict();

export const lotteryDrawSchema = z
  .object({
    count: z.number().int().min(1).max(10).default(1),
    clientRoundId: z.string().trim().min(8).max(80),
  })
  .strict();

export const submitTapScoreSchema = z
  .object({
    score: z.number().int().min(1).max(300),
    clientRoundId: z.string().trim().min(8).max(80),
  })
  .strict();

export const createPenaltyMatchSchema = z
  .object({
    action: z.enum(["KICK", "DIVE"]),
    direction: z.enum(["LEFT", "CENTER", "RIGHT"]),
    wager: z.number().int().min(10).max(500),
  })
  .strict();

export const joinPenaltyMatchSchema = z
  .object({
    action: z.enum(["KICK", "DIVE"]),
    direction: z.enum(["LEFT", "CENTER", "RIGHT"]),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TransitionTripInput = z.infer<typeof transitionTripSchema>;
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type CreateManualCandidateInput = z.infer<typeof createManualCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type PollVoteInput = z.infer<typeof pollVoteSchema>;
export type CreatePollCommentInput = z.infer<typeof createPollCommentSchema>;
export type CreateItineraryItemInput = z.infer<typeof createItineraryItemSchema>;
export type UpdateItineraryItemInput = z.infer<typeof updateItineraryItemSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type CreateFileUploadInput = z.infer<typeof createFileUploadSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;
export type ManagerPointGrantInput = z.infer<typeof managerPointGrantSchema>;
export type ManagerPointSetInput = z.infer<typeof managerPointSetSchema>;
export type ManagerRewardGrantInput = z.infer<typeof managerRewardGrantSchema>;
export type AchievementKey = z.infer<typeof achievementKeySchema>;
export type OddEvenGameInput = z.infer<typeof oddEvenGameSchema>;
export type SnailRaceGameInput = z.infer<typeof snailRaceGameSchema>;
export type RpsRouletteGameInput = z.infer<typeof rpsRouletteGameSchema>;
export type LotteryDrawInput = z.infer<typeof lotteryDrawSchema>;
export type SubmitTapScoreInput = z.infer<typeof submitTapScoreSchema>;
export type CreatePenaltyMatchInput = z.infer<typeof createPenaltyMatchSchema>;
export type JoinPenaltyMatchInput = z.infer<typeof joinPenaltyMatchSchema>;
export type GroupRole = z.infer<typeof groupRoleSchema>;
export type MemberStatus = z.infer<typeof memberStatusSchema>;
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type TripRole = z.infer<typeof tripRoleSchema>;

export interface ApiMeta {
  requestId: string;
  serverTime: string;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface SessionUser {
  id: string;
  username: string | null;
  email: string;
  nickname: string;
  locale: string;
  timezone: string;
}

export interface AuthResult {
  accessToken: string;
  csrfToken: string;
  user: SessionUser;
}
