import type { FocusSession } from "@/contracts/study-focus";
import { formatCompactMinutes, formatDateTime } from "@/lib/format";
import { resolveStudySubjectLabel } from "@/lib/study-subjects";

interface RecentSessionsProps {
  sessions: FocusSession[];
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  return (
    <div className="list-stack">
      {sessions.map((session) => (
        <article key={session.id} className="session-row">
          <div className="session-row__meta">
            <span className="subject-pill">
              {session.subjectId === "other" && session.subjectLabel
                ? session.subjectLabel
                : resolveStudySubjectLabel(session.subjectId, session.subjectLabel)}
            </span>
            <div className="stack-xs">
              <strong>{formatCompactMinutes(session.durationMinutes)}</strong>
              <span className="meta-text">{formatDateTime(session.startedAt)}</span>
            </div>
          </div>
          <div className="stack-xs session-row__right">
            {session.note ? <span className="session-note">{session.note}</span> : null}
            {session.interrupted ? (
              <span className="warning-text">有中斷</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
