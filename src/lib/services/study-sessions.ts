import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { logOpsEvent } from "@/lib/observability";
import { assertGroupModerator } from "@/lib/services/access-control";
import { mapStudySession } from "@/lib/services/mappers";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];

const MAX_EFFECTIVE_DURATION_SECONDS = 12 * 60 * 60;
const MAX_DURATION_DRIFT_SECONDS = 5 * 60;
const MAX_OPEN_SESSION_AGE_SECONDS = 16 * 60 * 60;

function requireSessionRow(row: SessionRow | null, errorMessage: string) {
  if (!row) {
    throw new ApiError(500, "session_missing", errorMessage);
  }

  return row;
}

function getReferenceEndTime(session: SessionRow) {
  return session.ended_at ?? new Date().toISOString();
}

function evaluateSessionAnomalies(session: SessionRow) {
  const reasons: string[] = [];
  const startedAt = new Date(session.started_at).getTime();
  const referenceEndAt = new Date(getReferenceEndTime(session)).getTime();
  const effectiveDurationSeconds =
    session.effective_duration_seconds ?? session.accumulated_focus_seconds;

  if (!Number.isFinite(startedAt) || !Number.isFinite(referenceEndAt)) {
    reasons.push("invalid_timestamp");
    return reasons;
  }

  if (referenceEndAt < startedAt) {
    reasons.push("ended_before_started");
  }

  if (effectiveDurationSeconds < 0) {
    reasons.push("negative_duration");
  }

  if (effectiveDurationSeconds > MAX_EFFECTIVE_DURATION_SECONDS) {
    reasons.push("excessive_duration");
  }

  const wallClockSeconds = Math.max(0, Math.floor((referenceEndAt - startedAt) / 1000));

  if (effectiveDurationSeconds > wallClockSeconds + MAX_DURATION_DRIFT_SECONDS) {
    reasons.push("duration_exceeds_elapsed_time");
  }

  if (
    session.status === "active" &&
    wallClockSeconds > MAX_OPEN_SESSION_AGE_SECONDS
  ) {
    reasons.push("open_session_age_exceeded");
  }

  return reasons;
}

async function getStudySessionRow(
  context: AuthenticatedRequestContext,
  sessionId: string,
) {
  const { data, error } = await context.supabase
    .from("study_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "study_session_lookup_failed", error.message);
  }

  if (!data) {
    throw new ApiError(404, "study_session_not_found", "Study session not found.");
  }

  return data as SessionRow;
}

async function applySessionGuardrails(
  context: AuthenticatedRequestContext,
  session: SessionRow,
  trigger: string,
) {
  const reasons = evaluateSessionAnomalies(session);

  if (reasons.length === 0) {
    return session;
  }

  logOpsEvent("warn", "study_session.guardrail_triggered", {
    actorUserId: context.user.id,
    currentIntegrityStatus: session.integrity_status,
    effectiveDurationSeconds:
      session.effective_duration_seconds ?? session.accumulated_focus_seconds,
    groupId: session.group_id,
    reasons,
    sessionId: session.id,
    status: session.status,
    trigger,
  });

  if (session.integrity_status === "flagged") {
    return session;
  }

  const { data, error } = await context.supabase
    .from("study_sessions")
    .update({
      integrity_status: "flagged",
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError(
      500,
      "study_session_guardrail_flag_failed",
      error?.message ?? "Unable to flag the suspicious study session.",
    );
  }

  return data as SessionRow;
}

function logSessionTransition(
  action: string,
  context: AuthenticatedRequestContext,
  session: SessionRow,
  extra: Record<string, unknown> = {},
) {
  logOpsEvent("info", "study_session.transition", {
    action,
    actorUserId: context.user.id,
    effectiveDurationSeconds:
      session.effective_duration_seconds ?? session.accumulated_focus_seconds,
    groupId: session.group_id,
    integrityStatus: session.integrity_status,
    interruptionCount: session.interruption_count,
    sessionId: session.id,
    status: session.status,
    title: session.title,
    ...extra,
  });
}

export async function listStudySessions(
  context: AuthenticatedRequestContext,
  filters: {
    groupId?: string;
    openOnly?: boolean;
    status?: Database["public"]["Enums"]["study_session_status"];
  },
) {
  let query = context.supabase.from("study_sessions").select("*").eq("user_id", context.user.id).order("started_at", {
    ascending: false,
  });

  if (filters.groupId) {
    query = query.eq("group_id", filters.groupId);
  }

  if (filters.openOnly) {
    query = query.in("status", ["active", "paused"]);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, "study_session_list_failed", error.message);
  }

  const rows = (data ?? []) as SessionRow[];

  for (const row of rows) {
    const reasons = evaluateSessionAnomalies(row);

    if (reasons.length > 0) {
      logOpsEvent("warn", "study_session.list_detected_suspicious_session", {
        actorUserId: context.user.id,
        groupId: row.group_id,
        reasons,
        sessionId: row.id,
        status: row.status,
      });
    }
  }

  return rows.map((row) => mapStudySession(row));
}

export async function createStudySession(
  context: AuthenticatedRequestContext,
  input: { groupId: string; notes: string | null; title: string },
) {
  const { data, error } = await context.supabase.rpc("create_study_session", {
    p_group_id: input.groupId,
    p_notes: input.notes,
    p_title: input.title,
  });

  if (error) {
    throw new ApiError(400, "study_session_create_failed", error.message);
  }

  const session = requireSessionRow(data as SessionRow | null, "Unable to create study session.");
  logSessionTransition("create", context, session);
  return mapStudySession(session);
}

export async function pauseStudySession(context: AuthenticatedRequestContext, sessionId: string) {
  const { data, error } = await context.supabase.rpc("pause_study_session", {
    p_session_id: sessionId,
  });

  if (error) {
    throw new ApiError(400, "study_session_pause_failed", error.message);
  }

  const session = await applySessionGuardrails(
    context,
    requireSessionRow(data as SessionRow | null, "Unable to pause study session."),
    "pause",
  );
  logSessionTransition("pause", context, session);
  return mapStudySession(session);
}

export async function resumeStudySession(context: AuthenticatedRequestContext, sessionId: string) {
  const { data, error } = await context.supabase.rpc("resume_study_session", {
    p_session_id: sessionId,
  });

  if (error) {
    throw new ApiError(400, "study_session_resume_failed", error.message);
  }

  const session = await applySessionGuardrails(
    context,
    requireSessionRow(data as SessionRow | null, "Unable to resume study session."),
    "resume",
  );
  logSessionTransition("resume", context, session);
  return mapStudySession(session);
}

export async function stopStudySession(context: AuthenticatedRequestContext, sessionId: string) {
  const { data, error } = await context.supabase.rpc("stop_study_session", {
    p_session_id: sessionId,
  });

  if (error) {
    throw new ApiError(400, "study_session_stop_failed", error.message);
  }

  const session = await applySessionGuardrails(
    context,
    requireSessionRow(data as SessionRow | null, "Unable to stop study session."),
    "stop",
  );
  logSessionTransition("stop", context, session);
  return mapStudySession(session);
}

export async function reportStudySessionInterruption(
  context: AuthenticatedRequestContext,
  sessionId: string,
  reason: Database["public"]["Enums"]["interruption_reason"],
) {
  const { data, error } = await context.supabase.rpc("report_study_session_interruption", {
    p_reason: reason,
    p_session_id: sessionId,
  });

  if (error) {
    throw new ApiError(400, "study_session_interrupt_failed", error.message);
  }

  const session = await applySessionGuardrails(
    context,
    requireSessionRow(data as SessionRow | null, "Unable to report study session interruption."),
    "interrupt",
  );
  logSessionTransition("interrupt", context, session, { reason });
  return mapStudySession(session);
}

export async function flagStudySessionForReview(
  context: AuthenticatedRequestContext,
  sessionId: string,
  reason?: string,
) {
  const session = await getStudySessionRow(context, sessionId);
  const moderatorRole = await assertGroupModerator(context, session.group_id);
  const { data, error } = await context.supabase.rpc("flag_study_session_for_review", {
    p_session_id: sessionId,
  });

  if (error || !data) {
    throw new ApiError(
      400,
      "study_session_flag_failed",
      error?.message ?? "Unable to flag the study session for review.",
    );
  }

  logOpsEvent("warn", "study_session.flagged_for_review", {
    actorUserId: context.user.id,
    groupId: session.group_id,
    moderatorRole,
    previousIntegrityStatus: session.integrity_status,
    reason: reason ?? null,
    sessionId,
    sessionOwnerUserId: session.user_id,
  });

  return mapStudySession(data as SessionRow);
}
