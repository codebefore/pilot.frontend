import type { ReactNode } from "react";

type FilterChipProps = {
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
};

export function FilterChip({ active, icon, children, onClick }: FilterChipProps) {
  return (
    <button
      className={active ? "filter-chip active" : "filter-chip"}
      onClick={onClick}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}
