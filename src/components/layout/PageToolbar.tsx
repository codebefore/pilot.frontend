import type { ReactNode } from "react";

type PageToolbarProps = {
  title: string;
  actions?: ReactNode;
};

export function PageToolbar({ title, actions }: PageToolbarProps) {
  return (
    <div className="page-toolbar">
      <h2>{title}</h2>
      {actions && <div className="toolbar-actions">{actions}</div>}
    </div>
  );
}

type PageTabsProps<K extends string> = {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
};

export function PageTabs<K extends string>({ tabs, active, onChange }: PageTabsProps<K>) {
  return (
    <div className="page-tabs">
      {tabs.map((tab) => (
        <button
          className={tab.key === active ? "page-tab active" : "page-tab"}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
