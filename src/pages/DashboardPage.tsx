import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";

import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { NewPaymentModal } from "../components/modals/NewPaymentModal";
import {
  AlertIcon,
  CandidatesIcon,
  DocumentsIcon,
  MebIcon,
  PaymentsIcon,
  PlusIcon,
} from "../components/icons";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusPill } from "../components/ui/StatusPill";
import { TaskItem } from "../components/ui/TaskItem";
import { useToast } from "../components/ui/Toast";
import {
  dashboardStats,
  pendingTasks,
  recentActivity,
  recentMebJobs,
  type StatIconKey,
} from "../mock/dashboard";

const STAT_ICONS: Record<StatIconKey, ComponentType> = {
  candidates: CandidatesIcon,
  documents:  DocumentsIcon,
  payments:   PaymentsIcon,
  meb:        MebIcon,
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);

  return (
    <>
      <div className="dash-header">
        <h1>
          Hoş geldin, <span>Mehmet</span>
        </h1>
        <p>Sezer Sürücü Kursu — Nisan 2026 operasyon özeti</p>
      </div>

      <div className="dash-stats">
        {dashboardStats.map((stat) => {
          const StatIcon = STAT_ICONS[stat.iconKey];
          return (
            <StatCard
              icon={<StatIcon />}
              key={stat.label}
              label={stat.label}
              sub={
                <>
                  {stat.trend && stat.trendValue && (
                    <span className={`trend-${stat.trend}`}>{stat.trendValue}</span>
                  )}{" "}
                  {stat.subLabel}
                </>
              }
              tone={stat.tone}
              value={stat.value}
            />
          );
        })}
      </div>

      <div className="dash-content">
        <div>
          <Panel
            action={<button className="panel-action" type="button">Tümünü gör</button>}
            icon={<span className="icon-orange"><AlertIcon /></span>}
            title="Bekleyen Görevler"
          >
            {pendingTasks.map((task) => (
              <TaskItem
                key={task.id}
                priority={task.priority}
                source={task.source}
                status={task.status}
                time={task.time}
                title={task.title}
              />
            ))}
          </Panel>

          <Panel
            action={<button className="panel-action" type="button">Tüm işler</button>}
            icon={<span className="icon-brand"><MebIcon /></span>}
            title="Son MEB İşleri"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>İş Tipi</th>
                  <th>Aday / Grup</th>
                  <th>Durum</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {recentMebJobs.map((job) => (
                  <tr key={job.id}>
                    <td><span className="job-type">{job.jobType}</span></td>
                    <td><span className="job-candidate">{job.target}</span></td>
                    <td><StatusPill status={job.status} /></td>
                    <td><span className="job-time">{job.time}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div>
          <Panel title="Son Hareketler">
            {recentActivity.map((ev) => (
              <div className="activity-item" key={ev.id}>
                <div className={`activity-avatar tone-${ev.avatarTone}`}>
                  {ev.avatar}
                </div>
                <div>
                  <div className="activity-text">
                    <strong>{ev.actor}</strong> {ev.description}
                  </div>
                  <div className="activity-time">{ev.time}</div>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Hızlı İşlemler">
            <div className="quick-actions">
              <button
                className="btn btn-primary btn-block"
                onClick={() => setNewCandidateOpen(true)}
                type="button"
              >
                <PlusIcon size={14} />
                Yeni Aday Kaydı
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => setNewPaymentOpen(true)}
                type="button"
              >
                <PaymentsIcon />
                Tahsilat Girişi
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => navigate("/meb-jobs")}
                type="button"
              >
                <MebIcon />
                MEB İşi Başlat
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <NewCandidateModal
        onClose={() => setNewCandidateOpen(false)}
        onSubmit={() => {
          setNewCandidateOpen(false);
          showToast("Aday başarıyla kaydedildi");
        }}
        open={newCandidateOpen}
      />

      <NewPaymentModal
        onClose={() => setNewPaymentOpen(false)}
        onSubmit={() => {
          setNewPaymentOpen(false);
          showToast("Tahsilat kaydedildi, makbuz oluşturuldu");
        }}
        open={newPaymentOpen}
      />
    </>
  );
}
