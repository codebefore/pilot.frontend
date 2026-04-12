import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { assignCandidateGroup, createCandidate } from "../../lib/candidates-api";
import { ApiError } from "../../lib/http";
import { getGroups } from "../../lib/groups-api";
import type { GroupResponse, LicenseClass } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type NewCandidateForm = {
  tc: string;
  className: LicenseClass;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  groupId: string;
};

type NewCandidateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function seventeenYearsAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().slice(0, 10);
}

function yearsSince(iso: string): number {
  const birth = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

const defaultValues = (): NewCandidateForm => ({
  tc: "",
  className: "B",
  firstName: "",
  lastName: "",
  birthDate: seventeenYearsAgoISO(),
  phone: "",
  email: "",
  groupId: "",
});

export function NewCandidateModal({ open, onClose, onSubmit }: NewCandidateModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewCandidateForm>({ defaultValues: defaultValues() });

  const selectedClass = watch("className");
  const selectedGroupId = watch("groupId");
  const availableGroups = groups.filter((group) => group.licenseClass === selectedClass);
  const classRegistration = register("className", {
    required: true,
    onChange: () => setValue("groupId", ""),
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!open) reset(defaultValues());
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    setGroupsLoading(true);

    getGroups({ status: "Aktif", pageSize: 100 }, controller.signal)
      .then((result) => setGroups(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroups([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (
      selectedGroupId &&
      !groups.some(
        (group) => group.id === selectedGroupId && group.licenseClass === selectedClass
      )
    ) {
      setValue("groupId", "");
    }
  }, [groups, selectedClass, selectedGroupId, setValue]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const selectedGroup = data.groupId
        ? groups.find((group) => group.id === data.groupId)
        : undefined;

      if (data.groupId && selectedGroup?.licenseClass !== data.className) {
        setError("groupId", {
          message: "Seçilen grup aday sınıfı ile uyumlu değil",
        });
        showToast("Aday sınıfı ile grup sınıfı uyuşmuyor.", "error");
        return;
      }

      const candidate = await createCandidate({
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId: data.tc,
        phoneNumber: data.phone || null,
        email: data.email || null,
        birthDate: data.birthDate || null,
        licenseClass: data.className,
        status: "new",
      });

      if (data.groupId) {
        try {
          await assignCandidateGroup(candidate.id, data.groupId);
        } catch {
          showToast("Aday kaydedildi, ancak grup atanamadı.", "error");
          onSubmit();
          return;
        }
      }

      showToast("Aday başarıyla kaydedildi");
      onSubmit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("tc", { message: "Bu TC ile kayıtlı aday zaten mevcut" });
      } else {
        showToast("Aday kaydedilemedi. Lütfen tekrar deneyin.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button" disabled={submitting}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Aday Kaydı"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">TC Kimlik No</label>
            <input
              className={fieldClass(!!errors.tc, "form-input")}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC"
              {...register("tc", {
                required: "Zorunlu alan",
                pattern: { value: /^\d{11}$/, message: "11 haneli rakam olmalı" },
              })}
            />
            {errors.tc && <div className="form-error">{errors.tc.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Sınıf</label>
            <select
              className={fieldClass(!!errors.className, "form-select")}
              {...classRegistration}
            >
              <option value="B">B — Otomobil</option>
              <option value="A2">A2 — Motosiklet</option>
              <option value="C">C — Kamyon</option>
              <option value="D">D — Otobüs</option>
              <option value="E">E — Dorseli</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad</label>
            <input
              className={fieldClass(!!errors.firstName, "form-input")}
              placeholder="Adı"
              {...register("firstName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.firstName && <div className="form-error">{errors.firstName.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Soyad</label>
            <input
              className={fieldClass(!!errors.lastName, "form-input")}
              placeholder="Soyadı"
              {...register("lastName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.lastName && <div className="form-error">{errors.lastName.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Doğum Tarihi</label>
            <input
              className={fieldClass(!!errors.birthDate, "form-input")}
              type="date"
              {...register("birthDate", {
                required: "Zorunlu alan",
                validate: (v) => {
                  const age = yearsSince(v);
                  if (age < 17) return "En az 17 yaşında olmalı";
                  if (age > 80) return "Geçerli bir tarih girin";
                  return true;
                },
              })}
            />
            {errors.birthDate && <div className="form-error">{errors.birthDate.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input
              className={fieldClass(!!errors.phone, "form-input")}
              inputMode="numeric"
              maxLength={10}
              placeholder="5XXXXXXXXX"
              {...register("phone", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^5\d{9}$/,
                  message: "10 hane, 5 ile başlamalı (başında 0 yok)",
                },
              })}
            />
            {errors.phone && <div className="form-error">{errors.phone.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(!!errors.email, "form-input")}
              placeholder="aday@mail.com"
              type="email"
              {...register("email", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Geçersiz e-posta",
                },
              })}
            />
            {errors.email && <div className="form-error">{errors.email.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Grup</label>
            <select
              className={fieldClass(!!errors.groupId, "form-select")}
              disabled={groupsLoading}
              {...register("groupId")}
            >
              <option value="">— Atanmamış —</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            {errors.groupId && <div className="form-error">{errors.groupId.message}</div>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
