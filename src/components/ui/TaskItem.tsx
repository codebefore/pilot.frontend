import type { TaskPriority, TaskStatus } from "../../types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  bekliyor:    "Bekliyor",
  devam:       "Devam",
  tamamlandi:  "Tamam",
  hata:        "Hata",
  manuel:      "Manuel",
};

type TaskItemProps = {
  priority: TaskPriority;
  title: string;
  source: string;
  time: string;
  status: TaskStatus;
  onClick?: () => void;
};

export function TaskItem({ priority, title, source, time, status, onClick }: TaskItemProps) {
  return (
    <button className="task-item" onClick={onClick} type="button">
      <div className={`task-priority ${priority}`} />
      <div className="task-info">
        <div className="task-title">{title}</div>
        <div className="task-meta">
          <span>{source}</span>
          <span>·</span>
          <span>{time}</span>
        </div>
      </div>
      <span className={`task-status status-${status}`}>{STATUS_LABELS[status]}</span>
    </button>
  );
}
