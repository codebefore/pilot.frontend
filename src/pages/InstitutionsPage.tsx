import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "../components/icons";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/http";
import {
  createInstitutionFounder,
  createInstitution,
  deleteInstitution,
  getInstitutions,
  updateInstitution,
  type InstitutionResponse,
} from "../lib/institutions-api";

const SEARCH_DEBOUNCE_MS = 250;

type InstitutionFormValues = {
  name: string;
  slug: string;
  isActive: boolean;
  firstAdminFullName: string;
  firstAdminPhone: string;
};

const emptyForm: InstitutionFormValues = {
  name: "",
  slug: "",
  isActive: true,
  firstAdminFullName: "",
  firstAdminPhone: "",
};

export function InstitutionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<InstitutionResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingInstitutionId, setDeletingInstitutionId] = useState<string | null>(null);

  const institutionsQuery = useQuery({
    queryKey: ["institutions", "list", { includeInactive }],
    queryFn: () => getInstitutions({ includeInactive }),
    enabled: user?.isSuperAdmin === true,
  });

  const institutions = institutionsQuery.data ?? [];
  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return institutions;

    return institutions.filter((institution) => {
      const name = institution.name.toLocaleLowerCase("tr-TR");
      const slug = institution.slug.toLocaleLowerCase("tr-TR");
      return name.includes(query) || slug.includes(query);
    });
  }, [institutions, search]);

  const counts = useMemo(
    () => ({
      total: institutions.length,
      active: institutions.filter((institution) => institution.isActive).length,
      inactive: institutions.filter((institution) => !institution.isActive).length,
    }),
    [institutions]
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (institution: InstitutionResponse) => {
    setEditing(institution);
    setFormOpen(true);
  };

  const handleSaved = (saved: InstitutionResponse) => {
    queryClient.setQueryData<InstitutionResponse[]>(
      ["institutions", "list", { includeInactive }],
      (previous) => {
        if (!previous) return [saved];
        if (!includeInactive && !saved.isActive) {
          return previous.filter((institution) => institution.id !== saved.id);
        }
        const index = previous.findIndex((institution) => institution.id === saved.id);
        if (index === -1) return [...previous, saved].sort(sortByName);
        const next = previous.slice();
        next[index] = saved;
        return next.sort(sortByName);
      }
    );
    void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
    showToast(editing ? "Kurum güncellendi" : "Kurum eklendi");
    setEditing(null);
    setFormOpen(false);
  };

  const deleteMutation = useMutation({
    mutationFn: deleteInstitution,
    onMutate: (institutionId) => {
      setDeletingInstitutionId(institutionId);
    },
    onSuccess: (_, institutionId) => {
      queryClient.setQueryData<InstitutionResponse[]>(
        ["institutions", "list", { includeInactive }],
        (previous) => {
          if (!previous) return previous;
          if (!includeInactive) {
            return previous.filter((institution) => institution.id !== institutionId);
          }
          return previous.map((institution) =>
            institution.id === institutionId
              ? { ...institution, isActive: false, updatedAtUtc: new Date().toISOString() }
              : institution
          );
        }
      );
      void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
      showToast("Kurum pasife alındı");
    },
    onError: () => {
      showToast("Kurum silinemedi.", "error");
    },
    onSettled: () => {
      setDeletingInstitutionId(null);
    },
  });

  const handleDelete = (institution: InstitutionResponse) => {
    const confirmed = window.confirm(
      `${institution.name} pasife alınacak. Bu kurum kullanıcıları artık aktif kurum olarak kullanamayacak. Devam edilsin mi?`
    );
    if (!confirmed) return;
    deleteMutation.mutate(institution.id);
  };

  if (!user?.isSuperAdmin) {
    return (
      <div className="page-shell">
        <section className="empty-state">
          <h2>Yetkiniz yok</h2>
          <p>Kurum listesini yalnızca super admin kullanıcılar yönetebilir.</p>
        </section>
      </div>
    );
  }

  const toolbarActions = (
    <>
      <div className="search-box settings-module-search settings-module-search-compact">
        <SearchInput
          debounceMs={SEARCH_DEBOUNCE_MS}
          onChange={setSearch}
          placeholder="Kurum adı veya slug ara"
          value={search}
        />
      </div>
      <label className="switch-toggle toolbar-switch-toggle">
        <input
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
          type="checkbox"
        />
        <span className="switch-toggle-control" aria-hidden="true" />
        <span>Pasifleri göster</span>
      </label>
      <button className="btn btn-primary" onClick={openCreate} type="button">
        <PlusIcon size={14} />
        Yeni Kurum
      </button>
    </>
  );

  return (
    <>
      <PageToolbar actions={toolbarActions} title="Kurumlar" />

      <div className="settings-summary-grid institutions-summary-grid">
        <div className="settings-summary-card institutions-summary-card">
          <span className="settings-summary-label">Toplam</span>
          <strong className="settings-summary-value">{counts.total}</strong>
        </div>
        <div className="settings-summary-card institutions-summary-card">
          <span className="settings-summary-label">Aktif</span>
          <strong className="settings-summary-value">{counts.active}</strong>
        </div>
        <div className="settings-summary-card institutions-summary-card">
          <span className="settings-summary-label">Pasif</span>
          <strong className="settings-summary-value">{counts.inactive}</strong>
        </div>
      </div>

      <div className="table-wrap spaced">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kurum</th>
              <th>Slug</th>
              <th>Üye</th>
              <th>Durum</th>
              <th>Güncelleme</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {institutionsQuery.isPending ? (
              Array.from({ length: 5 }, (_, index) => (
                <tr key={index} style={{ pointerEvents: "none" }}>
                  <td><span className="skeleton" style={{ width: 180 }} /></td>
                  <td><span className="skeleton" style={{ width: 120 }} /></td>
                  <td><span className="skeleton" style={{ width: 32 }} /></td>
                  <td><span className="skeleton skeleton-pill" style={{ width: 64 }} /></td>
                  <td><span className="skeleton" style={{ width: 120 }} /></td>
                  <td><span className="skeleton" style={{ width: 24 }} /></td>
                </tr>
              ))
            ) : institutionsQuery.isError ? (
              <tr>
                <td className="data-table-empty" colSpan={6}>
                  Kurum listesi yüklenemedi.
                </td>
              </tr>
            ) : filteredInstitutions.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={6}>
                  Kurum bulunamadı.
                </td>
              </tr>
            ) : (
              filteredInstitutions.map((institution) => (
                <tr key={institution.id}>
                  <td>
                    <strong>{institution.name}</strong>
                  </td>
                  <td>{institution.slug}</td>
                  <td>{institution.memberCount}</td>
                  <td>
                    <StatusPill
                      label={institution.isActive ? "Aktif" : "Pasif"}
                      status={institution.isActive ? "success" : "manual"}
                    />
                  </td>
                  <td>{formatDateTime(institution.updatedAtUtc)}</td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        aria-label={`${institution.name} düzenle`}
                        className="icon-btn"
                        disabled={deletingInstitutionId === institution.id}
                        onClick={() => openEdit(institution)}
                        title="Düzenle"
                        type="button"
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        aria-label={`${institution.name} sil`}
                        className="icon-btn danger"
                        disabled={!institution.isActive || deletingInstitutionId === institution.id}
                        onClick={() => handleDelete(institution)}
                        title={institution.isActive ? "Sil" : "Kurum zaten pasif"}
                        type="button"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <InstitutionFormModal
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        open={formOpen}
      />
    </>
  );
}

function InstitutionFormModal({
  editing,
  onClose,
  onSaved,
  open,
}: {
  editing: InstitutionResponse | null;
  onClose: () => void;
  onSaved: (institution: InstitutionResponse) => void;
  open: boolean;
}) {
  const [values, setValues] = useState<InstitutionFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof InstitutionFormValues, string>>>({});
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (body: InstitutionFormValues) => {
      const payload = {
        name: body.name.trim(),
        slug: body.slug.trim() || null,
        isActive: body.isActive,
      };

      if (editing) {
        return updateInstitution(editing.id, payload);
      }

      const response = await createInstitution(payload);
      if (body.firstAdminFullName.trim() && body.firstAdminPhone.trim()) {
        await createInstitutionFounder(response.institution.id, {
          fullName: body.firstAdminFullName.trim(),
          phone: body.firstAdminPhone.trim(),
          isActive: true,
        });
      }

      return response.institution;
    },
    onSuccess: onSaved,
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(mapApiErrors(error.validationErrors));
        showToast(error.problemTitle ?? "Kurum kaydedilemedi.", "error");
        return;
      }
      showToast("Kurum kaydedilemedi.", "error");
    },
  });

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            name: editing.name,
            slug: editing.slug,
            isActive: editing.isActive,
            firstAdminFullName: "",
            firstAdminPhone: "",
          }
        : emptyForm
    );
    setErrors({});
  }, [editing, open]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values, editing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate(values);
  };

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">{editing ? "Kurum Düzenle" : "Yeni Kurum"}</h3>
          </div>
          <button
            aria-label="Kapat"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label" htmlFor="institution-name">
                Kurum adı <span className="required-mark">*</span>
              </label>
              <input
                className={errors.name ? "form-input error" : "form-input"}
                id="institution-name"
                maxLength={200}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                value={values.name}
              />
              {errors.name ? <div className="form-error">{errors.name}</div> : null}
            </div>
          </div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label" htmlFor="institution-slug">
                Slug
              </label>
              <input
                className={errors.slug ? "form-input error" : "form-input"}
                id="institution-slug"
                maxLength={80}
                onChange={(event) => setValues((current) => ({ ...current, slug: event.target.value }))}
                placeholder="Boş bırakılırsa kurum adından üretilir"
                value={values.slug}
              />
              {errors.slug ? <div className="form-error">{errors.slug}</div> : null}
            </div>
          </div>
          {!editing ? (
            <div className="form-subsection">
              <div className="form-subsection-header">
                <div>
                  <div className="form-subsection-title">Kurucu yetkilisi</div>
                  <div className="form-subsection-note">
                    Bu kişi için Kurucu rolü açılır ve tüm yetkiler full atanır.
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="institution-first-admin-name">
                    Ad soyad <span className="required-mark">*</span>
                  </label>
                  <input
                    className={errors.firstAdminFullName ? "form-input error" : "form-input"}
                    id="institution-first-admin-name"
                    maxLength={128}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, firstAdminFullName: event.target.value }))
                    }
                    value={values.firstAdminFullName}
                  />
                  {errors.firstAdminFullName ? (
                    <div className="form-error">{errors.firstAdminFullName}</div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="institution-first-admin-phone">
                    Telefon <span className="required-mark">*</span>
                  </label>
                  <input
                    className={errors.firstAdminPhone ? "form-input error" : "form-input"}
                    id="institution-first-admin-phone"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        firstAdminPhone: event.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="5XXXXXXXXX"
                    value={values.firstAdminPhone}
                  />
                  {errors.firstAdminPhone ? (
                    <div className="form-error">{errors.firstAdminPhone}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <label className="switch-toggle">
            <input
              checked={values.isActive}
              onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))}
              type="checkbox"
            />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span>Kurum aktif: {values.isActive ? "Aktif" : "Pasif"}</span>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="btn btn-primary" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function validate(values: InstitutionFormValues, editing: InstitutionResponse | null) {
  const errors: Partial<Record<keyof InstitutionFormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Kurum adı zorunlu.";
  if (values.name.trim().length > 200) errors.name = "Kurum adı 200 karakteri geçemez.";
  if (values.slug.trim().length > 80) errors.slug = "Slug 80 karakteri geçemez.";
  if (!editing) {
    if (!values.firstAdminFullName.trim()) {
      errors.firstAdminFullName = "Kurucu ad soyad zorunlu.";
    } else if (values.firstAdminFullName.trim().length > 128) {
      errors.firstAdminFullName = "Kurucu ad soyad 128 karakteri geçemez.";
    }
    if (!/^5\d{9}$/.test(values.firstAdminPhone.trim())) {
      errors.firstAdminPhone = "Telefon 5 ile başlayan 10 haneli olmalı.";
    }
  }
  return errors;
}

function mapApiErrors(validationErrors?: Record<string, string[]>) {
  if (!validationErrors) return {};
  return {
    name: validationErrors.name?.[0],
    slug: validationErrors.slug?.[0],
    firstAdminFullName: validationErrors.FullName?.[0] ?? validationErrors.fullName?.[0],
    firstAdminPhone: validationErrors.Phone?.[0] ?? validationErrors.phone?.[0],
  };
}

function sortByName(a: InstitutionResponse, b: InstitutionResponse) {
  return a.name.localeCompare(b.name, "tr-TR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
