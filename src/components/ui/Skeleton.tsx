type SkeletonLineProps = {
  className?: string;
  height?: number;
  rounded?: boolean;
  width?: number | string;
};

export function SkeletonLine({
  className = "",
  height,
  rounded = false,
  width = "100%",
}: SkeletonLineProps) {
  return (
    <span
      className={`skeleton${rounded ? " skeleton-pill" : ""}${className ? ` ${className}` : ""}`}
      style={{ height, width }}
    />
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" className="page-skeleton">
      <section className="page-skeleton-header">
        <SkeletonLine height={28} width={240} />
        <SkeletonLine height={36} rounded width={136} />
      </section>
      <section className="page-skeleton-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="page-skeleton-card" key={index}>
            <SkeletonLine height={12} width={96} />
            <SkeletonLine height={30} width={index % 2 === 0 ? 112 : 86} />
            <SkeletonLine height={12} width={144} />
          </div>
        ))}
      </section>
      <section className="page-skeleton-surface">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="page-skeleton-row" key={index}>
            <SkeletonLine height={28} rounded width={28} />
            <div>
              <SkeletonLine height={14} width={`${180 + (index * 23) % 80}px`} />
              <SkeletonLine height={12} width={`${120 + (index * 17) % 70}px`} />
            </div>
            <SkeletonLine height={22} rounded width={72} />
          </div>
        ))}
      </section>
    </div>
  );
}

export function SettingsFormSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="settings-form-skeleton">
      <div className="settings-form-skeleton-tabs">
        <SkeletonLine height={34} rounded width={104} />
        <SkeletonLine height={34} rounded width={96} />
      </div>
      <section className="settings-surface">
        <div className="settings-surface-body">
          <div className="settings-form-skeleton-grid">
            {Array.from({ length: rows }).map((_, index) => (
              <div className="settings-form-skeleton-field" key={index}>
                <SkeletonLine height={12} width={86 + (index % 3) * 24} />
                <SkeletonLine height={40} rounded width="100%" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function PanelListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="panel-list-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="panel-list-skeleton-row" key={index}>
          <SkeletonLine height={32} rounded width={32} />
          <div>
            <SkeletonLine height={13} width={`${150 + (index * 29) % 80}px`} />
            <SkeletonLine height={11} width={`${88 + (index * 19) % 60}px`} />
          </div>
          <SkeletonLine height={20} rounded width={64} />
        </div>
      ))}
    </div>
  );
}

export function NotificationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-busy="true" className="notif-page-list">
      {Array.from({ length: rows }).map((_, index) => (
        <li className="notif-page-item unread" key={index}>
          <SkeletonLine height={8} rounded width={8} />
          <div className="notif-body">
            <SkeletonLine height={14} width={`${170 + (index * 31) % 90}px`} />
            <SkeletonLine height={12} width={`${250 + (index * 23) % 140}px`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SettingsTableSkeleton({
  columns,
  rows = 4,
}: {
  columns: Array<number | string>;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr aria-busy="true" key={rowIndex}>
          {columns.map((width, columnIndex) => (
            <td key={columnIndex}>
              <SkeletonLine
                height={columnIndex === columns.length - 1 ? 22 : 13}
                rounded={columnIndex === columns.length - 1}
                width={typeof width === "number" ? `${width + (rowIndex * 9) % 24}px` : width}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
