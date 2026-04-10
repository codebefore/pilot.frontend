import { useState } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { NewUserModal } from "../components/modals/NewUserModal";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { formatPhone, mockUsers } from "../mock/users";

export function UsersPage() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            Kullanıcı Ekle
          </button>
        }
        title="Kullanıcılar & Yetki"
      />

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Telefon</th>
                <th>Rol</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((user) => (
                <tr key={user.id}>
                  <td><span className="job-type">{user.fullName}</span></td>
                  <td>{user.email}</td>
                  <td>{formatPhone(user.phone)}</td>
                  <td><span className="cand-class-badge">{user.role}</span></td>
                  <td><StatusPill label={user.statusLabel} status={user.status} /></td>
                  <td>
                    {user.editable && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => showToast(`${user.fullName} düzenleniyor`)}
                        type="button"
                      >
                        Düzenle
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <NewUserModal
        onClose={() => setModalOpen(false)}
        onSubmit={() => {
          setModalOpen(false);
          showToast("Kullanıcı eklendi");
        }}
        open={modalOpen}
      />
    </>
  );
}
