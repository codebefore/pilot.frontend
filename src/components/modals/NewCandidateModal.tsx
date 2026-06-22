import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  createCandidate,
  getCandidateReuseSources,
} from "../../lib/candidates-api";
import {
  getCandidateReferences,
  type CandidateReferenceResponse,
} from "../../lib/candidate-references-api";
import { ApiError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { isPhoneStartingWith5 } from "../../lib/phone";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { toTurkishUpperCase } from "../../lib/text-format";
import type {
  CandidateResponse,
  CandidateReuseSourceResponse,
} from "../../lib/types";
import {
  useCandidateLicenseClassOptions,
  useExistingLicenseTypeOptions,
} from "../../lib/use-license-class-options";
import { CandidateTagsInput } from "../ui/CandidateTagsInput";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { Modal } from "../ui/Modal";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

function isValidTurkishNationalId(value: string) {
  const nationalId = value.trim();
  if (!/^[1-9]\d{10}$/.test(nationalId)) return false;

  const digits = [...nationalId].map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenthDigit = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventhDigit = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === tenthDigit && digits[10] === eleventhDigit;
}

const newCandidateSchema = z.object({
  tc: z
    .string()
    .min(1, "common.required")
    .regex(/^\d{11}$/, "newCandidate.error.tcDigits")
    .refine((v) => isValidTurkishNationalId(v), "newCandidate.error.tcInvalid"),
  referenceName: z.string(),
  className: z.string().min(1, "common.required"),
  firstName: z.string().min(1, "common.required").min(2, "common.minChars2"),
  lastName: z.string().min(1, "common.required").min(2, "common.minChars2"),
  phone: z
    .string()
    .min(1, "common.required")
    .refine((v) => isPhoneStartingWith5(v), "newCandidate.error.phoneStartWith5"),
  hasExistingLicense: z.boolean(),
  existingLicenseType: z.string(),
  existingLicenseIssuedAt: z.string(),
  tags: z.array(z.string()),
  reuseFromCandidateId: z.string(),
  documentIdsToCopy: z.array(z.string()),
});

type NewCandidateForm = z.infer<typeof newCandidateSchema>;

type NewCandidateModalProps = {
  open: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSubmit: (candidate: CandidateResponse) => void;
};

function buildReuseSourceAvatarCandidate(source: CandidateReuseSourceResponse) {
  const photoDocument = source.documents.find(
    (document) =>
      document.documentTypeKey === "biometric_photo" &&
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

const defaultValues = (): NewCandidateForm => ({
  tc: "",
  referenceName: "",
  className: "B",
  firstName: "",
  lastName: "",
  phone: "",
  hasExistingLicense: false,
  existingLicenseType: "",
  existingLicenseIssuedAt: "",
  tags: [],
  reuseFromCandidateId: "",
  documentIdsToCopy: [],
});

export function NewCandidateModal({ open, canManage = true, onClose, onSubmit }: NewCandidateModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const tcInputId = useId();
  const referenceInputId = useId();
  const firstNameInputId = useId();
  const lastNameInputId = useId();
  const phoneInputId = useId();
  const licenseClassInputId = useId();
  const existingLicenseInputId = useId();
  const issuedAtInputId = useId();
  const [reuseSources, setReuseSources] = useState<CandidateReuseSourceResponse[]>([]);
  const [reuseSourcesLoading, setReuseSourcesLoading] = useState(false);
  const [references, setReferences] = useState<CandidateReferenceResponse[]>([]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewCandidateForm>({ defaultValues: defaultValues(), resolver: zodResolver(newCandidateSchema) });

  const selectedClass = watch("className");
  const hasExistingLicense = watch("hasExistingLicense");
  const existingLicenseType = watch("existingLicenseType");
  const tc = watch("tc");
  const normalizedTc = (tc ?? "").replace(/\D/g, "");
  const reuseFromCandidateId = watch("reuseFromCandidateId");
  const documentIdsToCopy = watch("documentIdsToCopy");
  const tags = watch("tags");
  const existingLicenseIssuedAt = watch("existingLicenseIssuedAt");
  const { options: existingLicenseTypeOptions } = useExistingLicenseTypeOptions();
  const {
    options: licenseClassOptions,
    loading: licenseClassOptionsLoading,
  } = useCandidateLicenseClassOptions(
    existingLicenseType,
    hasExistingLicense,
    open
  );
  const selectedReuseSource =
    reuseSources.find((source) => source.id === reuseFromCandidateId) ?? null;
  const classRegistration = register("className");
  const phoneRegistration = register("phone");

  const invalidateNewCandidateDependents = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "reuseSources"] });
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (!open || licenseClassOptionsLoading) return;
    if (licenseClassOptions.length === 0) {
      if (selectedClass) {
        setValue("className", "", {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      return;
    }
    if (licenseClassOptions.some((option) => option.value === selectedClass)) {
      setValue("className", selectedClass, {
        shouldDirty: false,
        shouldValidate: false,
      });
      return;
    }

    setValue("className", licenseClassOptions[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, licenseClassOptionsLoading, open, selectedClass, setValue]);

  useEffect(() => {
    if (!open || hasExistingLicense || !existingLicenseType) return;
    setValue("existingLicenseType", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [existingLicenseType, hasExistingLicense, open, setValue]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getCandidateReferences(undefined, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setReferences(items);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setReferences([]);
        }
      });
    return () => {
      controller.abort();
    };
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
    if (!canManage) return;
    setSubmitting(true);
    try {
      const selectedLicenseClassDefinitionId =
        licenseClassOptions.find((option) => option.value === data.className)?.licenseClassDefinitionId ?? null;
      const candidate = await createCandidate({
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId: data.tc,
        referenceName: data.referenceName.trim() || null,
        phoneNumber: data.phone.trim() || null,
        // Quick registration captures only identity + phone + license class.
        // Birth date, gender, existing license, and group assignment are
        // edited from the candidate detail page.
        birthDate: null,
        gender: null,
        licenseClass: data.className,
        licenseClassDefinitionId: selectedLicenseClassDefinitionId,
        hasExistingLicense: data.hasExistingLicense,
        existingLicenseType:
          data.hasExistingLicense && data.existingLicenseType
            ? data.existingLicenseType
            : null,
        existingLicenseIssuedAt:
          data.hasExistingLicense && data.existingLicenseIssuedAt
            ? data.existingLicenseIssuedAt
            : null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "pre_registered",
        tags: data.tags,
        reuseFromCandidateId: data.documentIdsToCopy.length > 0
          ? data.reuseFromCandidateId || null
          : null,
        documentIdsToCopy: data.documentIdsToCopy,
      });

      invalidateNewCandidateDependents();
      showToast(t("newCandidate.toast.success"));
      onSubmit(candidate);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("tc", {
          message: "newCandidate.toast.conflict",
        });
      } else {
        const { applied, unmappedMessages } = applyApiErrorsToForm(err, setError);
        if (unmappedMessages[0]) {
          showToast(unmappedMessages[0], "error");
        } else if (!applied) {
          showToast(t("newCandidate.toast.failed"), "error");
        }
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  const translateError = (message: string | undefined): string => {
    if (!message) return "";
    if (message.includes(".")) return t(message as TranslationKey);
    return message;
  };

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
      closeOnOverlayClick={false}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button" disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            type="button"
            disabled={submitting || !canManage}
            title={!canManage ? noPermissionTitle : undefined}
          >
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("newCandidate.modalTitle")}
    >
      <form onSubmit={submit}>
        {reuseSourcesLoading || reuseSources.length > 0 ? (
          <section className="form-subsection">
            {reuseSourcesLoading ? (
              <div className="form-subsection-note">{t("newCandidate.reuse.loading")}</div>
            ) : (
              <>
                <div className="form-row full">
                  <div className="form-group">
                    <label className="form-label">
                      {t("newCandidate.reuse.label")}{" "}
                      {!errors.tc && reuseSources.length > 0 ? (
                        <span className="candidate-reuse-label-hint">
                          {t("newCandidate.reuse.hint")}
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
                                aria-label={t("newCandidate.reuse.aria", { name: `${source.firstName} ${source.lastName}` })}
                                checked={checked}
                                onChange={() => toggleReuseSource(source.id)}
                                type="checkbox"
                              />
                              <span className="switch-toggle-control" aria-hidden="true" />
                              <span>{checked ? t("common.yes") : t("common.no")}</span>
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
                      <label className="form-label">{t("newCandidate.field.documentsToCopy")}</label>
                      {selectedReuseSource.documents.length === 0 ? (
                        <div className="form-subsection-note">{t("newCandidate.reuse.emptyDocuments")}</div>
                      ) : (
                        <div className="candidate-reuse-document-list">
                          {selectedReuseSource.documents.map((document) => (
                            <label className="candidate-reuse-document-row" key={document.id}>
                              <span className="candidate-reuse-document-copy">
                                <strong>{document.documentTypeName}</strong>
                                <span>
                                  {document.originalFileName ??
                                    (document.isPhysicallyAvailable
                                      ? t("newCandidate.reuse.physicalDocument")
                                      : t("newCandidate.reuse.noFile"))}
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
                                  {documentIdsToCopy.includes(document.id) ? t("common.yes") : t("common.no")}
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
            <label className="form-label" htmlFor={tcInputId}>{t("common.field.nationalId")}<RequiredMark /></label>
            <input
              id={tcInputId}
              className={fieldClass(!!errors.tc, "form-input")}
              inputMode="numeric"
              maxLength={11}
              placeholder={t("newCandidate.placeholder.tc")}
              {...register("tc")}
            />
            {errors.tc && <div className="form-error">{translateError(errors.tc.message)}</div>}
            {!errors.tc && normalizedTc.length === 11 && reuseSourcesLoading ? (
              <div className="candidate-reuse-hint candidate-reuse-hint-muted">
                {t("newCandidate.tcLoading")}
              </div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={referenceInputId}>{t("newCandidate.field.reference")}</label>
            <Controller
              control={control}
              name="referenceName"
              render={({ field }) => (
                <CustomSelect
                  id={referenceInputId}
                  className="form-select"
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value)}
                  value={field.value ?? ""}
                >
                  <option value="">{t("common.select")}</option>
                  {references.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={firstNameInputId}>{t("newCandidate.field.firstName")}<RequiredMark /></label>
            <input
              id={firstNameInputId}
              className={fieldClass(!!errors.firstName, "form-input")}
              placeholder={t("newCandidate.placeholder.firstName")}
              {...register("firstName", {
                onChange: (event) => {
                  event.target.value = toTurkishUpperCase(event.target.value);
                },
              })}
            />
            {errors.firstName && <div className="form-error">{translateError(errors.firstName.message)}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={lastNameInputId}>{t("common.field.lastName")}<RequiredMark /></label>
            <input
              id={lastNameInputId}
              className={fieldClass(!!errors.lastName, "form-input")}
              placeholder={t("newCandidate.placeholder.lastName")}
              {...register("lastName", {
                onChange: (event) => {
                  event.target.value = toTurkishUpperCase(event.target.value);
                },
              })}
            />
            {errors.lastName && <div className="form-error">{translateError(errors.lastName.message)}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={phoneInputId}>{t("common.field.phone")}<RequiredMark /></label>
            <input
              id={phoneInputId}
              className={fieldClass(!!errors.phone, "form-input")}
              maxLength={32}
              placeholder={t("newCandidate.placeholder.phone")}
              {...phoneRegistration}
            />
            {errors.phone && <div className="form-error">{translateError(errors.phone.message)}</div>}
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

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={licenseClassInputId}>{t("common.field.licenseClass")}<RequiredMark /></label>
            <CustomSelect
              id={licenseClassInputId}
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
          <div className="form-group">
            <label
              className="switch-toggle"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 28 }}
            >
              <span className="form-label" style={{ margin: 0 }}>{t("newCandidate.field.hasExistingLicense")}</span>
              <input type="checkbox" {...register("hasExistingLicense")} />
              <span className="switch-toggle-control" aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={existingLicenseInputId}>{t("newCandidate.field.existingLicense")}</label>
            <CustomSelect
              id={existingLicenseInputId}
              className="form-select"
              {...register("existingLicenseType", {
                onChange: (event) => {
                  // Picking any class auto-enables the "Mevcut Ehliyet" switch;
                  // clearing the dropdown leaves the switch as the user set it.
                  if (event.target.value) {
                    setValue("hasExistingLicense", true, { shouldDirty: true });
                  }
                },
              })}
            >
              <option value="">{t("newCandidate.placeholder.existingLicenseType")}</option>
              {existingLicenseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={issuedAtInputId}>{t("newCandidate.field.issuedAt")}</label>
            <LocalizedDateInput
              ariaLabel={t("newCandidate.aria.issuedAt")}
              id={issuedAtInputId}
              lang="tr-TR"
              onChange={(next) =>
                setValue("existingLicenseIssuedAt", next, { shouldDirty: true })
              }
              value={existingLicenseIssuedAt}
            />
          </div>
        </div>

      </form>
    </Modal>
  );
}
