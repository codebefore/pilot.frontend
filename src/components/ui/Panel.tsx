import type { ReactNode } from "react";

type PanelProps = {
  title?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  padded?: boolean;
};

export function Panel({ title, action, icon, children, padded }: PanelProps) {
  const hasHeader = title !== undefined || action !== undefined;
  const bodyClass = padded ? "panel-body padded" : "panel-body";
  return (
    <section className="panel">
      {hasHeader && (
        <div className="panel-header">
          <span className="panel-title">
            {icon}
            {title}
          </span>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
