import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { CandidatesIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "../components/icons";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { updateStoredInstitutionName } from "../lib/auth-storage";
import { ApiError } from "../lib/http";
import {
  createInstitutionMember,
  createInstitutionFounder,
  createInstitution,
  deleteInstitutionMember,
  deleteInstitution,
  getInstitutionMembers,
  getInstitutionRoles,
  getInstitutions,
  lookupInstitutionMemberByPhone,
  lookupInstitutionUserByPhone,
  updateInstitutionMember,
  updateInstitution,
  type InstitutionMemberLookupResponse,
  type InstitutionMemberResponse,
  type InstitutionResponse,
  type InstitutionRoleResponse,
} from "../lib/institutions-api";

const SEARCH_DEBOUNCE_MS = 250;

type InstitutionFormValues = {
  name: string;
  isActive: boolean;
  firstAdminFullName: string;
  firstAdminPhone: string;
  confirmExistingFounder: boolean;
};

const emptyForm: InstitutionFormValues = {
  name: "",
  isActive: true,
  firstAdminFullName: "",
  firstAdminPhone: "",
  confirmExistingFounder: false,
};

type MemberFormValues = {
  fullName: string;
  phone: string;
  roleId: string;
  isActive: boolean;
  confirmExistingUser: boolean;
};

const emptyMemberForm: MemberFormValues = {
  fullName: "",
  phone: "",
  roleId: "",
  isActive: true,
  confirmExistingUser: false,
};

export function InstitutionsPage() {
  const { user, activeInstitution } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<InstitutionResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [membersInstitution, setMembersInstitution] = useState<InstitutionResponse | null>(null);
  const [deletingInstitutionId, setDeletingInstitutionId] = useState<string | null>(null);

  const institutionsQuery = useQuery({
    queryKey: ["institutions", "list", { includeInactive }],
    queryFn: ({ signal }) => getInstitutions({ includeInactive }, signal),
    enabled: user?.isSuperAdmin === true,
  });

  const institutions = institutionsQuery.data ?? [];
  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return institutions;

    return institutions.filter((institution) =>
      institution.name.toLocaleLowerCase("tr-TR").includes(query)
    );
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
    if (saved.id === activeInstitution?.id) {
      updateStoredInstitutionName(saved.id, saved.name);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
    }
    void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
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
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      if (institutionId === activeInstitution?.id) {
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
      }
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
          placeholder="Kurum adı ara"
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
                  <td><span className="skeleton" style={{ width: 32 }} /></td>
                  <td><span className="skeleton skeleton-pill" style={{ width: 64 }} /></td>
                  <td><span className="skeleton" style={{ width: 120 }} /></td>
                  <td><span className="skeleton" style={{ width: 24 }} /></td>
                </tr>
              ))
            ) : institutionsQuery.isError ? (
              <tr>
                <td className="data-table-empty" colSpan={5}>
                  Kurum listesi yüklenemedi.
                </td>
              </tr>
            ) : filteredInstitutions.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={5}>
                  Kurum bulunamadı.
                </td>
              </tr>
            ) : (
              filteredInstitutions.map((institution) => (
                <tr key={institution.id}>
                  <td>
                    <strong>{institution.name}</strong>
                  </td>
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
                        aria-label={`${institution.name} üyeler`}
                        className="icon-btn"
                        disabled={deletingInstitutionId === institution.id}
                        onClick={() => setMembersInstitution(institution)}
                        title="Üyeler"
                        type="button"
                      >
                        <CandidatesIcon size={14} />
                      </button>
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
      <InstitutionMembersModal
        institution={membersInstitution}
        onClose={() => setMembersInstitution(null)}
        onMemberChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
        }}
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
  const [founderLookup, setFounderLookup] = useState<InstitutionMemberLookupResponse | null>(null);
  const [founderLookupPhone, setFounderLookupPhone] = useState<string | null>(null);
  const [founderLookupLoading, setFounderLookupLoading] = useState(false);
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (body: InstitutionFormValues) => {
      const payload = {
        name: body.name.trim(),
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
            isActive: editing.isActive,
            firstAdminFullName: "",
            firstAdminPhone: "",
            confirmExistingFounder: false,
          }
        : emptyForm
    );
    setErrors({});
    setFounderLookup(null);
    setFounderLookupPhone(null);
    setFounderLookupLoading(false);
  }, [editing, open]);

  useEffect(() => {
    if (!open || editing || !/^5\d{9}$/.test(values.firstAdminPhone)) {
      setFounderLookup(null);
      setFounderLookupPhone(null);
      setFounderLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    setFounderLookupLoading(true);
    const timeout = window.setTimeout(() => {
      const lookupPhone = values.firstAdminPhone;
      lookupInstitutionUserByPhone(values.firstAdminPhone, controller.signal)
        .then((result) => {
          setFounderLookup(result);
          setFounderLookupPhone(lookupPhone);
          if (result.exists) {
            setValues((current) => ({
              ...current,
              firstAdminFullName: result.fullName ?? current.firstAdminFullName,
              confirmExistingFounder: false,
            }));
          }
        })
        .catch((error) => {
          if ((error as { name?: string }).name !== "AbortError") {
            setFounderLookup(null);
            setFounderLookupPhone(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setFounderLookupLoading(false);
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [editing, open, values.firstAdminPhone]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values, editing);
    const founderPhoneRequiresLookup = !editing && /^5\d{9}$/.test(values.firstAdminPhone.trim());
    if (founderPhoneRequiresLookup && founderLookupPhone !== values.firstAdminPhone.trim()) {
      nextErrors.firstAdminPhone = "Telefon kontrolü tamamlanmadan kaydedilemez.";
    }
    if (!editing && founderLookup?.exists && !values.confirmExistingFounder) {
      nextErrors.firstAdminPhone = "Mevcut kullanıcıyı bu kuruma eklemek için onay verin.";
    }
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
                    readOnly={founderLookup?.exists === true}
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
                        confirmExistingFounder: false,
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
              {founderLookupLoading ? (
                <div className="member-lookup-note">Telefon kontrol ediliyor...</div>
              ) : founderLookup?.exists ? (
                <div className="member-lookup-box">
                  <strong>Bu telefon sistemde mevcut kullanıcıya ait: {founderLookup.fullName}.</strong>
                  <label className="member-confirm-row">
                    <input
                      checked={values.confirmExistingFounder}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          confirmExistingFounder: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Bu kullanıcı bu kuruma Kurucu olarak eklensin.</span>
                  </label>
                </div>
              ) : null}
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
          <button
            className="btn btn-primary"
            disabled={
              mutation.isPending ||
              (!editing &&
                /^5\d{9}$/.test(values.firstAdminPhone.trim()) &&
                founderLookupPhone !== values.firstAdminPhone.trim())
            }
            type="submit"
          >
            {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function InstitutionMembersModal({
  institution,
  onClose,
  onMemberChanged,
}: {
  institution: InstitutionResponse | null;
  onClose: () => void;
  onMemberChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [values, setValues] = useState<MemberFormValues>(emptyMemberForm);
  const [errors, setErrors] = useState<Partial<Record<keyof MemberFormValues, string>>>({});
  const [lookup, setLookup] = useState<InstitutionMemberLookupResponse | null>(null);
  const [lookupPhone, setLookupPhone] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<InstitutionMemberResponse | null>(null);

  const institutionId = institution?.id ?? "";
  const membersQuery = useQuery({
    queryKey: ["institutions", institutionId, "members", { includeInactive }],
    queryFn: ({ signal }) => getInstitutionMembers(institutionId, { includeInactive }, signal),
    enabled: Boolean(institution),
  });
  const rolesQuery = useQuery({
    queryKey: ["institutions", institutionId, "roles", { includeInactive: false }],
    queryFn: ({ signal }) => getInstitutionRoles(institutionId, { includeInactive: false }, signal),
    enabled: Boolean(institution),
  });

  useEffect(() => {
    if (!institution) return;
    setValues(emptyMemberForm);
    setErrors({});
    setLookup(null);
    setLookupPhone(null);
    setLookupLoading(false);
    setEditingMember(null);
  }, [institution]);

  useEffect(() => {
    if (!institution || editingMember || !/^5\d{9}$/.test(values.phone)) {
      setLookup(null);
      setLookupPhone(null);
      setLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    setLookupLoading(true);
    const timeout = window.setTimeout(() => {
      const checkedPhone = values.phone;
      lookupInstitutionMemberByPhone(institution.id, values.phone, controller.signal)
        .then((result) => {
          setLookup(result);
          setLookupPhone(checkedPhone);
          if (result.exists) {
            setValues((current) => ({
              ...current,
              fullName: result.fullName ?? current.fullName,
              confirmExistingUser: false,
            }));
          }
        })
        .catch((error) => {
          if ((error as { name?: string }).name !== "AbortError") {
            setLookup(null);
            setLookupPhone(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLookupLoading(false);
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [editingMember, institution, values.phone]);

  const createMutation = useMutation({
    mutationFn: (body: MemberFormValues) =>
      createInstitutionMember(institutionId, {
        fullName: body.fullName.trim(),
        phone: body.phone.trim(),
        roleId: body.roleId || null,
        isActive: body.isActive,
      }),
    onSuccess: () => {
      setValues(emptyMemberForm);
      setLookup(null);
      setErrors({});
      void queryClient.invalidateQueries({ queryKey: ["institutions", institutionId, "members"] });
      onMemberChanged();
      showToast("Üye eklendi");
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        showToast(error.problemTitle ?? "Üye eklenemedi.", "error");
        setErrors(mapMemberApiErrors(error.validationErrors));
        return;
      }
      showToast("Üye eklenemedi.", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: MemberFormValues) =>
      updateInstitutionMember(institutionId, editingMember!.id, {
        roleId: body.roleId || null,
        isActive: body.isActive,
      }),
    onSuccess: () => {
      setEditingMember(null);
      setValues(emptyMemberForm);
      void queryClient.invalidateQueries({ queryKey: ["institutions", institutionId, "members"] });
      onMemberChanged();
      showToast("Üyelik güncellendi");
    },
    onError: () => showToast("Üyelik güncellenemedi.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (membershipId: string) => deleteInstitutionMember(institutionId, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["institutions", institutionId, "members"] });
      onMemberChanged();
      showToast("Üyelik pasife alındı");
    },
    onError: () => showToast("Üyelik pasife alınamadı.", "error"),
  });

  if (!institution) return null;

  const roles = rolesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const isExistingTargetMember = lookup?.exists === true && lookup.isMemberOfInstitution;

  const startEdit = (member: InstitutionMemberResponse) => {
    setEditingMember(member);
    setLookup(null);
    setErrors({});
    setValues({
      fullName: member.fullName,
      phone: member.phone ?? "",
      roleId: member.roleId ?? "",
      isActive: member.isActive,
      confirmExistingUser: true,
    });
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setValues(emptyMemberForm);
    setErrors({});
    setLookup(null);
    setLookupPhone(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateMember(values, editingMember, lookup, lookupPhone);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (editingMember) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div className="modal institution-members-modal">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">{institution.name} Üyeleri</h3>
          </div>
          <button aria-label="Kapat" className="modal-close" onClick={onClose} type="button">
            <XIcon size={16} />
          </button>
        </div>
        <div className="modal-body institution-members-body">
          <div className="institution-members-toolbar">
            <label className="switch-toggle toolbar-switch-toggle">
              <input
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                type="checkbox"
              />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>Pasifleri göster</span>
            </label>
          </div>
          <div className="institution-members-table-wrap">
            <table className="data-table institution-members-table">
              <thead>
                <tr>
                  <th>Üye</th>
                  <th>Telefon</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {membersQuery.isPending ? (
                  <tr><td className="data-table-empty" colSpan={5}>Üyeler yükleniyor...</td></tr>
                ) : membersQuery.isError ? (
                  <tr><td className="data-table-empty" colSpan={5}>Üyeler yüklenemedi.</td></tr>
                ) : members.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={5}>Üye bulunamadı.</td></tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.fullName}</strong></td>
                      <td>{member.phone ?? "-"}</td>
                      <td>{member.roleName ?? "-"}</td>
                      <td>
                        <StatusPill
                          label={member.isActive ? "Aktif" : "Pasif"}
                          status={member.isActive ? "success" : "manual"}
                        />
                      </td>
                      <td>
                        <div className="table-row-actions">
                          <button
                            aria-label={`${member.fullName} üyeliğini düzenle`}
                            className="icon-btn"
                            onClick={() => startEdit(member)}
                            title="Düzenle"
                            type="button"
                          >
                            <PencilIcon size={14} />
                          </button>
                          <button
                            aria-label={`${member.fullName} üyeliğini pasife al`}
                            className="icon-btn danger"
                            disabled={!member.isActive || deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(member.id)}
                            title={member.isActive ? "Pasife al" : "Üyelik pasif"}
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
          <form className="institution-member-form" onSubmit={handleSubmit}>
            <div className="form-subsection-title">{editingMember ? "Üyelik düzenle" : "Yeni üye"}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="institution-member-phone">Telefon</label>
                <input
                  className={errors.phone ? "form-input error" : "form-input"}
                  disabled={Boolean(editingMember)}
                  id="institution-member-phone"
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                      confirmExistingUser: false,
                    }))
                  }
                  placeholder="5XXXXXXXXX"
                  value={values.phone}
                />
                {errors.phone ? <div className="form-error">{errors.phone}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="institution-member-name">Ad soyad</label>
                <input
                  className={errors.fullName ? "form-input error" : "form-input"}
                  disabled={Boolean(editingMember)}
                  id="institution-member-name"
                  maxLength={128}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, fullName: event.target.value }))
                  }
                  readOnly={lookup?.exists === true}
                  value={values.fullName}
                />
                {errors.fullName ? <div className="form-error">{errors.fullName}</div> : null}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="institution-member-role">Rol</label>
                <select
                  className={errors.roleId ? "form-select error" : "form-select"}
                  id="institution-member-role"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, roleId: event.target.value }))
                  }
                  value={values.roleId}
                >
                  <option value="">Rol seçin</option>
                  {roles.map((role: InstitutionRoleResponse) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {errors.roleId ? <div className="form-error">{errors.roleId}</div> : null}
              </div>
              <div className="form-group institution-member-active-field">
                <label className="switch-toggle">
                  <input
                    checked={values.isActive}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>Üyelik aktif: {values.isActive ? "Aktif" : "Pasif"}</span>
                </label>
              </div>
            </div>
            {rolesQuery.isError ? <div className="form-error">Roller yüklenemedi.</div> : null}
            {lookupLoading ? (
              <div className="member-lookup-note">Telefon kontrol ediliyor...</div>
            ) : lookup?.exists && !editingMember ? (
              <div className={isExistingTargetMember ? "member-lookup-box error" : "member-lookup-box"}>
                <strong>
                  {isExistingTargetMember
                    ? "Bu kullanıcı bu kurumda zaten kayıtlı."
                    : `Bu telefon sistemde mevcut kullanıcıya ait: ${lookup.fullName}.`}
                </strong>
                {!isExistingTargetMember ? (
                  <label className="member-confirm-row">
                    <input
                      checked={values.confirmExistingUser}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          confirmExistingUser: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Bu kullanıcı bu kuruma eklensin.</span>
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="institution-member-form-actions">
              {editingMember ? (
                <button className="btn btn-secondary" onClick={cancelEdit} type="button">Vazgeç</button>
              ) : null}
              <button
                className="btn btn-primary"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  rolesQuery.isPending ||
                  isExistingTargetMember ||
                  (!editingMember && /^5\d{9}$/.test(values.phone.trim()) && lookupPhone !== values.phone.trim())
                }
                type="submit"
              >
                {editingMember ? "Üyeliği Kaydet" : "Üye Ekle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

function validate(values: InstitutionFormValues, editing: InstitutionResponse | null) {
  const errors: Partial<Record<keyof InstitutionFormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Kurum adı zorunlu.";
  if (values.name.trim().length > 200) errors.name = "Kurum adı 200 karakteri geçemez.";
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

function validateMember(
  values: MemberFormValues,
  editingMember: InstitutionMemberResponse | null,
  lookup: InstitutionMemberLookupResponse | null,
  lookupPhone: string | null
) {
  const errors: Partial<Record<keyof MemberFormValues, string>> = {};
  if (!editingMember) {
    if (!values.fullName.trim()) {
      errors.fullName = "Ad soyad zorunlu.";
    } else if (values.fullName.trim().length > 128) {
      errors.fullName = "Ad soyad 128 karakteri geçemez.";
    }
    if (!/^5\d{9}$/.test(values.phone.trim())) {
      errors.phone = "Telefon 5 ile başlayan 10 haneli olmalı.";
    }
    if (/^5\d{9}$/.test(values.phone.trim()) && lookupPhone !== values.phone.trim()) {
      errors.phone = "Telefon kontrolü tamamlanmadan kaydedilemez.";
    } else if (lookup?.exists && lookup.isMemberOfInstitution) {
      errors.phone = "Bu kullanıcı bu kurumda zaten kayıtlı.";
    } else if (lookup?.exists && !values.confirmExistingUser) {
      errors.phone = "Mevcut kullanıcıyı bu kuruma eklemek için onay verin.";
    }
  }
  if (!values.roleId) {
    errors.roleId = "Rol seçimi zorunlu.";
  }
  return errors;
}

function mapApiErrors(validationErrors?: Record<string, string[]>) {
  if (!validationErrors) return {};
  return {
    name: validationErrors.name?.[0],
    firstAdminFullName: validationErrors.FullName?.[0] ?? validationErrors.fullName?.[0],
    firstAdminPhone: validationErrors.Phone?.[0] ?? validationErrors.phone?.[0],
  };
}

function mapMemberApiErrors(validationErrors?: Record<string, string[]>) {
  if (!validationErrors) return {};
  return {
    fullName: validationErrors.FullName?.[0] ?? validationErrors.fullName?.[0],
    phone: validationErrors.Phone?.[0] ?? validationErrors.phone?.[0],
    roleId: validationErrors.RoleId?.[0] ?? validationErrors.roleId?.[0],
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
