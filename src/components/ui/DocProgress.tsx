type DocProgressProps = {
  done: number;
  total: number;
  label?: string;
};

export function DocProgress({ done, total, label }: DocProgressProps) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const incomplete = done < total;
  return (
    <div className="doc-progress">
      <div className="doc-bar">
        <div
          className={incomplete ? "doc-bar-fill incomplete" : "doc-bar-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="doc-text">{label ?? `${done}/${total}`}</span>
    </div>
  );
}
