import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  createCandidate,
  getCandidateReuseSources,
} from "../../lib/candidates-api";
import { getCertificatePrograms } from "../../lib/certificate-programs-api";
import { ApiError } from "../../lib/http";
import { useT } from "../../lib/i18n";
import type {
  CandidateReuseSourceResponse,
  CertificateProgramResponse,
  LicenseClass,
} from "../../lib/types";
import {
  REFERENCE_LICENSE_CLASS_OPTIONS,
  type LicenseClassOption,
} from "../../lib/use-license-class-options";
import { CandidateTagsInput } from "../ui/CandidateTagsInput";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { useToast } from "../ui/Toast";

type NewCandidateForm = {
  tc: string;
  className: LicenseClass;
  firstName: string;
  lastName: string;
  phone: string;
  tags: string[];
  reuseFromCandidateId: string;
  documentIdsToCopy: string[];
};

type NewCandidateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function buildReuseSourceAvatarCandidate(source: CandidateReuseSourceResponse) {
  const photoDocument = source.documents.find(
    (document) =>
      (document.documentTypeKey === "biometric_photo" ||
        document.documentTypeKey === "webcam_photo") &&
      document.hasFile
  );

  return {
    id: source.id,
    firstName: source.firstName,
    lastName: source.lastName,
    gender: source.gender,
    photo: photoDocument
      ? {
          documentId: photoDocument.id,
          kind: photoDocument.documentTypeKey,
        }
      : null,
  };
}

function buildTargetLicenseClassOptions(
  programs: CertificateProgramResponse[]
): LicenseClassOption[] {
  const byTarget = new Map<string, LicenseClassOption & { displayOrder: number }>();

  for (const program of programs) {
    const target = program.targetLicenseClass.trim();
    if (!target) continue;

    const existing = byTarget.get(target);
    if (!existing || program.displayOrder < existing.displayOrder) {
      byTarget.set(target, {
        value: target,
        label: program.targetLicenseDisplayName || target,
        displayOrder: program.displayOrder,
      });
    }
  }

  return [...byTarget.values()]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label, "tr"))
    .map(({ value, label }) => ({ value, label }));
}

const defaultValues = (): NewCandidateForm => ({
  tc: "",
  className: "B",
  firstName: "",
  lastName: "",
  phone: "",
  tags: [],
  reuseFromCandidateId: "",
  documentIdsToCopy: [],
});

export function NewCandidateModal({ open, onClose, onSubmit }: NewCandidateModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [reuseSources, setReuseSources] = useState<CandidateReuseSourceResponse[]>([]);
  const [reuseSourcesLoading, setReuseSourcesLoading] = useState(false);
  const [certificatePrograms, setCertificatePrograms] = useState<CertificateProgramResponse[]>([]);

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
  const tc = watch("tc");
  const normalizedTc = (tc ?? "").replace(/\D/g, "");
  const reuseFromCandidateId = watch("reuseFromCandidateId");
  const documentIdsToCopy = watch("documentIdsToCopy");
  const tags = watch("tags");
  const selectedReuseSource =
    reuseSources.find((source) => source.id === reuseFromCandidateId) ?? null;
  const classRegistration = register("className", { required: true });
  // The license-class dropdown is derived from the active certificate
  // programs catalog so only valid registration targets show up; this list
  // is independent from the now-removed program/group selectors.
  const licenseClassOptions = useMemo(() => {
    const targetOptions = buildTargetLicenseClassOptions(certificatePrograms);
    return targetOptions.length > 0 ? targetOptions : REFERENCE_LICENSE_CLASS_OPTIONS;
  }, [certificatePrograms]);

  useEffect(() => {
    if (!open || licenseClassOptions.length === 0) return;
    if (licenseClassOptions.some((option) => option.value === selectedClass)) {
      return;
    }

    setValue("className", licenseClassOptions[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, open, selectedClass, setValue]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    getCertificatePrograms(
      { activity: "active", page: 1, pageSize: 1000, sortBy: "displayOrder", sortDir: "asc" },
      controller.signal
    )
      .then((response) => setCertificatePrograms(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCertificatePrograms([]);
      });

    return () => controller.abort();
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) reset(defaultValues());
  }, [open, reset]);

  useEffect(() => {
    if (!open || normalizedTc.length !== 11) {
      setReuseSources([]);
      setValue("reuseFromCandidateId", "");
      setValue("documentIdsToCopy", []);
      return;
    }

    const controller = new AbortController();
    setReuseSourcesLoading(true);
    getCandidateReuseSources(normalizedTc, controller.signal)
      .then((sources) => {
        setReuseSources(sources);
        if (!sources.some((source) => source.id === reuseFromCandidateId)) {
          setValue("reuseFromCandidateId", "");
          setValue("documentIdsToCopy", []);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setReuseSources([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReuseSourcesLoading(false);
      });

    return () => controller.abort();
  }, [normalizedTc, open, setValue]);

  useEffect(() => {
    if (!selectedReuseSource) return;

    setValue("firstName", selectedReuseSource.firstName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("lastName", selectedReuseSource.lastName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("phone", selectedReuseSource.phoneNumber ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    // Existing license, birth date, gender, and email from the reuse source
    // are intentionally NOT copied here — they now live only on the
    // candidate detail page.
  }, [selectedReuseSource, setValue]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await createCandidate({
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId: data.tc,
        phoneNumber: data.phone || null,
        // Quick registration captures only identity + phone + license class.
        // Email, birth date, gender, existing license, certificate program,
        // and group assignment are all edited from the candidate detail page.
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: data.className,
        certificateProgramId: null,
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "pre_registered",
        examFeePaid: false,
        initialPaymentReceived: false,
        tags: data.tags,
        reuseFromCandidateId: data.documentIdsToCopy.length > 0
          ? data.reuseFromCandidateId || null
          : null,
        documentIdsToCopy: data.documentIdsToCopy,
      });

      showToast("Aday başarıyla kaydedildi");
      onSubmit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("tc", {
          message: "Bu TC kimlik numarası ve ehliyet sınıfı için açık başvuru mevcut",
        });
      } else {
        showToast("Aday kaydedilemedi. Lütfen tekrar deneyin.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  const toggleDocumentToCopy = (documentId: string) => {
    const next = documentIdsToCopy.includes(documentId)
      ? documentIdsToCopy.filter((id) => id !== documentId)
      : [...documentIdsToCopy, documentId];
    setValue("documentIdsToCopy", next, { shouldDirty: true, shouldValidate: true });
  };

  const toggleReuseSource = (sourceId: string) => {
    setValue("reuseFromCandidateId", reuseFromCandidateId === sourceId ? "" : sourceId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("documentIdsToCopy", [], { shouldDirty: true, shouldValidate: true });
  };

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
        {reuseSourcesLoading || reuseSources.length > 0 ? (
          <section className="form-subsection">
            {reuseSourcesLoading ? (
              <div className="form-subsection-note">Eski kayıtlar aranıyor...</div>
            ) : (
              <>
                <div className="form-row full">
                  <div className="form-group">
                    <label className="form-label">
                      Eski Başvuru{" "}
                      {!errors.tc && reuseSources.length > 0 ? (
                        <span className="candidate-reuse-label-hint">
                          (Bu kişi uygulamada zaten kayıtlı. İstersen eski bilgileri
                          otomatik doldurabilirim.)
                        </span>
                      ) : null}
                    </label>
                    <div className="candidate-reuse-source-list">
                      {reuseSources.map((source) => {
                        const checked = reuseFromCandidateId === source.id;
                        return (
                          <label
                            className={[
                              "candidate-reuse-source-row",
                              checked ? "selected" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={source.id}
                          >
                            <span className="candidate-reuse-source-main">
                              <CandidateAvatar
                                candidate={buildReuseSourceAvatarCandidate(source)}
                                size={42}
                              />
                              <span className="candidate-reuse-source-copy">
                                <strong>
                                  {source.firstName} {source.lastName}
                                </strong>
                                <span>
                                  {source.licenseClass} · {source.status}
                                </span>
                              </span>
                            </span>
                            <span className="candidate-reuse-source-toggle">
                              <input
                                aria-label={`${source.firstName} ${source.lastName} eski başvuru`}
                                checked={checked}
                                onChange={() => toggleReuseSource(source.id)}
                                type="checkbox"
                              />
                              <span className="switch-toggle-control" aria-hidden="true" />
                              <span>{checked ? "Evet" : "Hayır"}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {selectedReuseSource ? (
                  <div className="form-row full">
                    <div className="form-group">
                      <label className="form-label">Kopyalanacak Evraklar</label>
                      {selectedReuseSource.documents.length === 0 ? (
                        <div className="form-subsection-note">Bu kayıtta evrak bulunmuyor.</div>
                      ) : (
                        <div className="candidate-reuse-document-list">
                          {selectedReuseSource.documents.map((document) => (
                            <label className="candidate-reuse-document-row" key={document.id}>
                              <span className="candidate-reuse-document-copy">
                                <strong>{document.documentTypeName}</strong>
                                <span>
                                  {document.originalFileName ??
                                    (document.isPhysicallyAvailable
                                      ? "Fiziksel evrak"
                                      : "Dosya yok")}
                                </span>
                              </span>
                              <span className="candidate-reuse-document-toggle">
                                <input
                                  checked={documentIdsToCopy.includes(document.id)}
                                  onChange={() => toggleDocumentToCopy(document.id)}
                                  type="checkbox"
                                />
                                <span className="switch-toggle-control" aria-hidden="true" />
                                <span>
                                  {documentIdsToCopy.includes(document.id) ? "Evet" : "Hayır"}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

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
            {!errors.tc && normalizedTc.length === 11 && reuseSourcesLoading ? (
              <div className="candidate-reuse-hint candidate-reuse-hint-muted">
                Eski kayıtlar kontrol ediliyor...
              </div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">Ehliyet Tipi</label>
            <CustomSelect
              className={fieldClass(!!errors.className, "form-select")}
              value={selectedClass}
              {...classRegistration}
            >
              {licenseClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
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
          <div className="form-group">
            <label className="form-label">{t("candidates.tags.label")}</label>
            <CandidateTagsInput
              ariaLabel={t("candidates.tags.label")}
              onChange={(next) =>
                setValue("tags", next, { shouldDirty: true, shouldValidate: true })
              }
              value={tags}
            />
          </div>
        </div>

      </form>
    </Modal>
  );
}
