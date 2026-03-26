import { formatTimer } from "@/lib/format";

interface TimerRingProps {
  secondsRemaining: number;
  totalSeconds: number;
  statusLabel: string;
  subtitle?: string;
}

export function TimerRing({
  secondsRemaining,
  totalSeconds,
  statusLabel,
  subtitle = "預設 50 分鐘專注循環",
}: TimerRingProps) {
  const progress = 1 - secondsRemaining / totalSeconds;

  return (
    <div
      className="timer-ring"
      style={{
        background: `conic-gradient(var(--navy-700) ${progress * 360}deg, var(--navy-100) 0deg)`,
      }}
    >
      <div className="timer-ring__inner">
        <span className="timer-status">{statusLabel}</span>
        <strong className="timer-value">{formatTimer(secondsRemaining)}</strong>
        <span className="timer-subtitle">{subtitle}</span>
      </div>
    </div>
  );
}
