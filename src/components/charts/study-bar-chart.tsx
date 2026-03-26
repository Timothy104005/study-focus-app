import type { DailyStudyPoint } from "@/contracts/study-focus";

interface StudyBarChartProps {
  points: DailyStudyPoint[];
}

export function StudyBarChart({ points }: StudyBarChartProps) {
  const maxMinutes = Math.max(...points.map((point) => point.minutes), 1);

  return (
    <div className="bar-chart">
      {points.map((point) => (
        <div key={point.date} className="bar-chart__item">
          <div className="bar-chart__track">
            <div
              className="bar-chart__value"
              style={{
                height: `${Math.max((point.minutes / maxMinutes) * 100, point.minutes > 0 ? 18 : 6)}%`,
              }}
            />
          </div>
          <span className="bar-chart__label">{point.label}</span>
          <span className="bar-chart__minutes">{point.minutes} 分</span>
        </div>
      ))}
    </div>
  );
}
