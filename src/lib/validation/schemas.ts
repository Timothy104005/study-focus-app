import { z } from "zod";

import { normalizeAppPath } from "@/lib/navigation";
import { isoDateTimeSchema, timezoneSchema, uuidSchema } from "@/lib/validation/common";

const nullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const authEmailSchema = z.object({
  email: z.string().email(),
  mode: z.enum(["magic_link", "otp"]).default("magic_link"),
  nextPath: z
    .string()
    .optional()
    .transform((value) => normalizeAppPath(value)),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: timezoneSchema.optional(),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: nullableTrimmedString(240),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(6).max(32),
});

export const createStudySessionSchema = z.object({
  groupId: uuidSchema,
  title: z.string().trim().min(1).max(120),
  notes: nullableTrimmedString(500),
});

export const studySessionQuerySchema = z.object({
  groupId: uuidSchema.optional(),
  openOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  status: z.enum(["active", "paused", "stopped"]).optional(),
});

export const interruptionSchema = z.object({
  reason: z.enum(["tab_hidden", "window_blur", "manual"]).default("tab_hidden"),
});

export const leaderboardQuerySchema = z.object({
  range: z.enum(["daily", "weekly"]).default("daily"),
  timezone: timezoneSchema.optional(),
});

export const examCountdownQuerySchema = z.object({
  groupId: uuidSchema.optional(),
});

export const createExamCountdownSchema = z.object({
  groupId: uuidSchema.nullish().transform((value) => value ?? null),
  title: z.string().trim().min(1).max(120),
  subject: nullableTrimmedString(120),
  examAt: isoDateTimeSchema,
  notes: nullableTrimmedString(500),
});

export const updateExamCountdownSchema = createExamCountdownSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field must be provided.",
);

export const createDiscussionPostSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const updateDiscussionPostSchema = createDiscussionPostSchema;

export const moderationReasonSchema = z.object({
  reason: optionalTrimmedString(240),
});

export const reportDiscussionPostSchema = moderationReasonSchema;

export const hideDiscussionPostSchema = moderationReasonSchema;

export const flagStudySessionSchema = moderationReasonSchema;
