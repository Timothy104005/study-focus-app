import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  muted = false,
}: SectionCardProps) {
  return (
    <section className={muted ? "card card--muted" : "card"}>
      {title || description || action ? (
        <div className="section-header">
          <div className="stack-xs">
            {title ? <h2 className="section-title">{title}</h2> : null}
            {description ? <p className="section-description">{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

