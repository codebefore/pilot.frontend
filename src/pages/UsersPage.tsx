import { useEffect, useMemo, useState } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { UserFormModal } from "../components/modals/UserFormModal";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { ApiError } from "../lib/http";
import { getRoles } from "../lib/roles-api";
import { deleteUser, getUsers } from "../lib/users-api";
import type { AppUserResponse, RoleResponse } from "../lib/types";
import { formatPhone } from "../mock/users";

type UserSortField = "fullName" | "email" | "phone" | "roleName" | "isActive";
type SortDirection = "asc" | "desc";
type SortState = { field: UserSortField; direction: SortDirection } | null;

export function UsersPage() {
  const { showToast } = useToast();

  const [users, setUsers] = useState<AppUserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState<SortState>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUserResponse | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getUsers({ includeInactive: true }, controller.signal),
      getRoles({ includeInactive: true }, controller.signal),
    ])
      .then(([userList, roleList]) => {
        setUsers(userList);
        setRoles(roleList);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Kullanıcılar yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey, showToast]);

  const sortedUsers = useMemo(() => {
    if (!sort) return users;
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return users.slice().sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return (Number(av) - Number(bv)) * multiplier;
      }
      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        sensitivity: "base",
      }) * multiplier;
    });
  }, [users, sort]);

  const handleSortToggle = (field: UserSortField) => {
    setSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { field, direction: "desc" };
      }
      return null;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (user: AppUserResponse) => {
    setEditing(user);
    setFormOpen(true);
  };

  const handleSaved = (saved: AppUserResponse) => {
    setFormOpen(false);
    showToast(editing ? "Kullanıcı güncellendi" : "Kullanıcı eklendi");
    setEditing(null);
    setUsers((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (user: AppUserResponse) => {
    setDeletingUserId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setConfirmDeleteUserId(null);
      showToast("Kullanıcı silindi");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Kullanıcı silinemedi";
      showToast(message, "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <>
      <PageToolbar
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate} type="button">
            Kullanıcı Ekle
          </button>
        }
        title="Kullanıcılar"
      />

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh
                  field="fullName"
                  label="Ad Soyad"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="email"
                  label="E-posta"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="phone"
                  label="Telefon"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="roleName"
                  label="Rol"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="isActive"
                  label="Durum"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    <td>
                      <span className="skeleton" style={{ width: 140 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 180 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 110 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 80 }} />
                    </td>
                    <td>
                      <span className="skeleton skeleton-pill" style={{ width: 56 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 64 }} />
                    </td>
                  </tr>
                ))
              ) : sortedUsers.length === 0 ? (
                <tr>
                  <td className="data-table-empty" colSpan={6}>
                    Henüz kullanıcı yok.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="job-type">{user.fullName}</span>
                    </td>
                    <td>{user.email || "—"}</td>
                    <td>{user.phone ? formatPhone(user.phone) : "—"}</td>
                    <td>
                      {user.roleName ? (
                        <span className="cand-class-badge">{user.roleName}</span>
                      ) : (
                        <span className="form-hint">Rol atanmamış</span>
                      )}
                    </td>
                    <td>
                      <StatusPill
                        label={user.isActive ? "Aktif" : "Pasif"}
                        status={user.isActive ? "success" : "manual"}
                      />
                    </td>
                    <td>
                      <div className="table-row-actions">
                        {confirmDeleteUserId === user.id ? (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={deletingUserId === user.id}
                              onClick={() => setConfirmDeleteUserId(null)}
                              type="button"
                            >
                              Vazgeç
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={deletingUserId === user.id}
                              onClick={() => handleDelete(user)}
                              type="button"
                            >
                              {deletingUserId === user.id ? "Siliniyor..." : "Sil"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEdit(user)}
                              type="button"
                            >
                              Düzenle
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={deletingUserId !== null}
                              onClick={() => setConfirmDeleteUserId(user.id)}
                              type="button"
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <UserFormModal
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        open={formOpen}
        roles={roles}
      />
    </>
  );
}

type SortableThProps = {
  field: UserSortField;
  label: string;
  sort: SortState;
  onToggle: (field: UserSortField) => void;
};

function SortableTh({ field, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="sortable-th-indicator">
          {indicator}
        </span>
      </button>
    </th>
  );
}
