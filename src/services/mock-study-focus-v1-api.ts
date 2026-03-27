import type {
  ExamCountdownDto,
  InterruptionReason,
  StudySessionDto,
} from "@/contracts";
import { createMockStudyFocusApi } from "@/lib/mock-store";

const STORAGE_KEY = "study-focus-v1-open-session";
const DEFAULT_TIMEZONE_OFFSET = "+08:00";
const mockLegacyApi = createMockStudyFocusApi();

function toIsoDateAtNoon(date: string) {
  return new Date(`${date}T12:00:00${DEFAULT_TIMEZONE_OFFSET}`).toISOString();
}

function parseStoredSession(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StudySessionDto;
  } catch {
    return null;
  }
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStoredSession(window.localStorage.getItem(STORAGE_KEY));
}

function writeStoredSession(session: StudySessionDto | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session || session.status === "stopped") {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function getEffectiveDurationSeconds(session: StudySessionDto, nowMs = Date.now()) {
  if (session.status !== "active") {
    return session.effectiveDurationSeconds;
  }

  const baseline = session.accumulatedFocusSeconds;
  const resumeAt = Date.parse(session.lastResumedAt ?? session.startedAt);

  if (Number.isNaN(resumeAt)) {
    return baseline;
  }

  return baseline + Math.max(0, Math.floor((nowMs - resumeAt) / 1000));
}

function hydrateSession(session: StudySessionDto | null) {
  if (!session) {
    return null;
  }

  return {
    ...session,
    effectiveDurationSeconds: getEffectiveDurationSeconds(session),
  } satisfies StudySessionDto;
}

function requireStoredSession(sessionId: string) {
  const session = readStoredSession();

  if (!session || session.id !== sessionId || session.status === "stopped") {
    throw new Error("找不到這筆未完成的專注 session。");
  }

  return session;
}

function buildMockSession(input: {
  groupId: string;
  title: string;
  notes?: string | null;
}) {
  const now = new Date().toISOString();
  const sessionId = `mock-session-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: sessionId,
    groupId: input.groupId,
    userId: "mock-user",
    title: input.title,
    notes: input.notes ?? null,
    status: "active",
    startedAt: now,
    endedAt: null,
    lastResumedAt: now,
    lastPausedAt: null,
    accumulatedFocusSeconds: 0,
    effectiveDurationSeconds: 0,
    interruptionCount: 0,
    integrityStatus: "clean",
    lastInterruptionAt: null,
    lastInterruptionReason: null,
    createdAt: now,
    updatedAt: now,
  } satisfies StudySessionDto;
}

function mapMockExamToDto(exam: {
  id: string;
  title: string;
  date: string;
  subjectScope: string;
}): ExamCountdownDto {
  const now = new Date().toISOString();

  return {
    id: exam.id,
    userId: "mock-user",
    groupId: null,
    title: exam.title,
    subject: exam.subjectScope || null,
    examAt: toIsoDateAtNoon(exam.date),
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMockStudyFocusV1Api() {
  return {
    async listOpenStudySessions() {
      const session = hydrateSession(readStoredSession());
      return session ? [session] : [];
    },

    async createStudySession(input: {
      groupId: string;
      title: string;
      notes?: string | null;
    }) {
      const current = readStoredSession();

      if (current && current.status !== "stopped") {
        throw new Error("你已經有一場未完成的專注，請先繼續、暫停或結束。");
      }

      const created = buildMockSession(input);
      writeStoredSession(created);
      return created;
    },

    async pauseStudySession(sessionId: string) {
      const current = requireStoredSession(sessionId);

      if (current.status !== "active") {
        throw new Error("只有進行中的 session 才能暫停。");
      }

      const now = new Date().toISOString();
      const paused = {
        ...current,
        status: "paused",
        accumulatedFocusSeconds: getEffectiveDurationSeconds(current, Date.parse(now)),
        effectiveDurationSeconds: getEffectiveDurationSeconds(current, Date.parse(now)),
        lastPausedAt: now,
        updatedAt: now,
      } satisfies StudySessionDto;

      writeStoredSession(paused);
      return paused;
    },

    async resumeStudySession(sessionId: string) {
      const current = requireStoredSession(sessionId);

      if (current.status !== "paused") {
        throw new Error("只有暫停中的 session 才能繼續。");
      }

      const now = new Date().toISOString();
      const resumed = {
        ...current,
        status: "active",
        effectiveDurationSeconds: current.accumulatedFocusSeconds,
        lastResumedAt: now,
        updatedAt: now,
      } satisfies StudySessionDto;

      writeStoredSession(resumed);
      return resumed;
    },

    async stopStudySession(sessionId: string) {
      const current = requireStoredSession(sessionId);
      const now = new Date().toISOString();
      const stopped = {
        ...current,
        status: "stopped",
        accumulatedFocusSeconds: getEffectiveDurationSeconds(current, Date.parse(now)),
        effectiveDurationSeconds: getEffectiveDurationSeconds(current, Date.parse(now)),
        endedAt: now,
        updatedAt: now,
      } satisfies StudySessionDto;

      writeStoredSession(null);
      return stopped;
    },

    async reportStudySessionInterruption(
      sessionId: string,
      reason: InterruptionReason,
    ) {
      const current = requireStoredSession(sessionId);
      const now = new Date().toISOString();
      const updated = {
        ...current,
        effectiveDurationSeconds: getEffectiveDurationSeconds(current, Date.parse(now)),
        interruptionCount: current.interruptionCount + 1,
        integrityStatus: current.integrityStatus === "flagged" ? "flagged" : "warning",
        lastInterruptionAt: now,
        lastInterruptionReason: reason,
        updatedAt: now,
      } satisfies StudySessionDto;

      writeStoredSession(updated);
      return updated;
    },

    async flagStudySessionForReview(sessionId: string, _reason?: string) {
      const current = requireStoredSession(sessionId);
      const now = new Date().toISOString();
      const updated = {
        ...current,
        integrityStatus: "flagged",
        updatedAt: now,
      } satisfies StudySessionDto;

      writeStoredSession(updated);
      return updated;
    },

    async reportDiscussionPost(_postId: string, _reason?: string) {
      throw new Error("Mock v1 discussion moderation is not enabled in this mode.");
    },

    async hideDiscussionPost(_postId: string, _reason?: string) {
      throw new Error("Mock v1 discussion moderation is not enabled in this mode.");
    },

    async deleteDiscussionPost(_postId: string) {
      throw new Error("Mock v1 discussion moderation is not enabled in this mode.");
    },

    async createExamCountdown(input: {
      examAt: string;
      title: string;
      subject?: string | null;
    }) {
      const created = await mockLegacyApi.createExam({
        date: input.examAt.slice(0, 10),
        subjectScope: input.subject ?? "",
        title: input.title,
      });

      return mapMockExamToDto(created);
    },

    async updateExamCountdown(
      countdownId: string,
      input: {
        examAt?: string;
        subject?: string | null;
        title?: string;
      },
    ) {
      const updated = await mockLegacyApi.updateExam(countdownId, {
        date: input.examAt?.slice(0, 10),
        subjectScope: input.subject ?? undefined,
        title: input.title,
      });

      return mapMockExamToDto(updated);
    },

    async deleteExamCountdown(countdownId: string) {
      return mockLegacyApi.deleteExam(countdownId);
    },
  };
}
