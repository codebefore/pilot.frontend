import { PageToolbar } from "../components/layout/PageToolbar";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";

export function SettingsPage() {
  const { showToast } = useToast();

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => showToast("Ayarlar kaydedildi")}
            type="button"
          >
            Kaydet
          </button>
        }
        title="Kurum Ayarları"
      />

      <div className="settings-page">
        <Panel padded title="Kurum Bilgileri">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kurum Adı</label>
                <input className="form-input" defaultValue="Sezer Sürücü Kursu" />
              </div>
              <div className="form-group">
                <label className="form-label">Kurum Tipi</label>
                <select className="form-select" defaultValue="MTSK">
                  <option value="MTSK">MTSK — Sürücü Kursu</option>
                  <option value="ISMAK">İş Makinesi</option>
                  <option value="SRC">SRC</option>
                  <option value="PSI">Psikoteknik</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Yetkili Kişi</label>
                <input className="form-input" defaultValue="Mehmet Sezer" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className="form-input" defaultValue="0532 123 45 67" />
              </div>
            </div>
          </form>
        </Panel>

        <Panel padded title="MEB Bağlantısı">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">MEBBIS Kullanıcı Adı</label>
                <input className="form-input" defaultValue="sezer_mtsk" />
              </div>
              <div className="form-group">
                <label className="form-label">MEBBIS Şifre</label>
                <input className="form-input" defaultValue="••••••••" type="password" />
              </div>
            </div>
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">Bağlantı Durumu</label>
                <div className="connection-status">
                  <StatusPill label="Bağlantı Aktif" status="success" />
                  <span className="meta">Son doğrulama: 07.04.2026 14:00</span>
                </div>
              </div>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
