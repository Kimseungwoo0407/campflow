import { z } from "zod";

export const groupRoleSchema = z.enum(["OWNER", "MEMBER", "GUEST"]);
export const memberStatusSchema = z.enum(["PENDING", "ACTIVE", "REMOVED"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12, "비밀번호는 12자 이상이어야 합니다.")
  .max(128, "비밀번호는 128자 이하여야 합니다.")
  .regex(/[a-zA-Z]/, "영문자를 하나 이상 포함해 주세요.")
  .regex(/[0-9]/, "숫자를 하나 이상 포함해 주세요.");
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
    email: emailSchema,
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
    expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type GroupRole = z.infer<typeof groupRoleSchema>;
export type MemberStatus = z.infer<typeof memberStatusSchema>;

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
