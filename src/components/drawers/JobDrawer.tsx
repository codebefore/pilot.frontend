import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { StatusPill } from "../ui/StatusPill";
import { StepTracker, type Step } from "../ui/StepTracker";
import type { MebJob } from "../../mock/mebJobs";

type JobDrawerProps = {
  job: MebJob | null;
  onClose: () => void;
  onRetry: () => void;
};

const FAILED_JOB_STEPS: Step[] = [
  { state: "done",    title: "MEBBIS Giriş",         detail: "Başarılı — 14:28:05" },
  { state: "done",    title: "Aday Arama & Eşleme",  detail: "TC ile eşleşti — 14:28:12" },
  { state: "error",   title: "Belge Yükleme",        detail: "Hata: Fotoğraf formatı desteklenmiyor (HEIC). JPEG veya PNG yükleyin." },
  { state: "pending", title: "Form Onay",            detail: "Bekliyor" },
  { state: "pending", title: "MEB Kayıt Tamamlama",  detail: "Bekliyor" },
];

const RUNNING_JOB_STEPS: Step[] = [
  { state: "done",   title: "MEBBIS Giriş",        detail: "Başarılı" },
  { state: "active", title: "Belge Yükleme",       detail: "Devam ediyor" },
  { state: "pending", title: "Form Onay",          detail: "Bekliyor" },
];

const COMPLETED_JOB_STEPS: Step[] = [
  { state: "done", title: "MEBBIS Giriş",        detail: "Başarılı" },
  { state: "done", title: "Aday Kaydı",          detail: "Tamamlandı" },
  { state: "done", title: "Form Onay",           detail: "Tamamlandı" },
];

function stepsFor(job: MebJob): Step[] {
  if (job.status === "failed") return FAILED_JOB_STEPS;
  if (job.status === "running") return RUNNING_JOB_STEPS;
  return COMPLETED_JOB_STEPS;
}

export function JobDrawer({ job, onClose, onRetry }: JobDrawerProps) {
  if (!job) return null;
  const showRetry = job.status === "failed";

  return (
    <Drawer
      actions={
        <>
          {showRetry && (
            <button className="btn btn-primary" onClick={onRetry} type="button">
              Tekrar Dene
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Kapat
          </button>
        </>
      }
      onClose={onClose}
      open
      title={`MEB İşi ${job.jobNo}`}
    >
      <DrawerSection title="Genel Bilgi">
        <DrawerRow label="İş Tipi">{job.jobType}</DrawerRow>
        <DrawerRow label="Hedef">{job.target}</DrawerRow>
        <DrawerRow label="Adım">{job.step}</DrawerRow>
        <DrawerRow label="Başlangıç">{job.startedAt}</DrawerRow>
        <DrawerRow label="Durum">
          <StatusPill status={job.status} />
        </DrawerRow>
      </DrawerSection>

      <DrawerSection title="Adımlar">
        <StepTracker steps={stepsFor(job)} />
      </DrawerSection>

      {job.status === "failed" && (
        <DrawerSection title="Hata Detayı">
          <div className="drawer-log">
            <div>
              <span className="ts">14:28:18</span> <span className="level">STEP_FAILED</span> belge_yukleme
            </div>
            <div>
              <span className="ts">14:28:18</span> Dosya formatı geçersiz: ahmet_foto.heic
            </div>
            <div>
              <span className="ts">14:28:18</span> Beklenen: JPEG, PNG, BMP
            </div>
            <div>
              <span className="ts">14:28:18</span> <span className="err">Retry için dosyayı dönüştürüp tekrar kuyruğa alın.</span>
            </div>
          </div>
        </DrawerSection>
      )}
    </Drawer>
  );
}
