import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { FileDropInput } from "../ui/FileDropInput";
import { Modal } from "../ui/Modal";
import { mockCandidates } from "../../mock/candidates";

type DocumentType =
  | "nufus"
  | "fotograf"
  | "saglik"
  | "ehliyet"
  | "ikametgah";

type UploadDocumentForm = {
  candidateId: string;
  docType: DocumentType;
  file: File | null;
  note: string;
};

type UploadDocumentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  initialCandidateId?: string;
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  nufus:     "Nüfus Cüzdanı",
  fotograf:  "Fotoğraf",
  saglik:    "Sağlık Raporu",
  ehliyet:   "Ehliyet Fotokopisi",
  ikametgah: "İkametgah",
};

const ACCEPT = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const defaultValues = (initialCandidateId?: string): UploadDocumentForm => ({
  candidateId: initialCandidateId ?? mockCandidates[0]?.id ?? "",
  docType: "nufus",
  file: null,
  note: "",
});

export function UploadDocumentModal({
  open,
  onClose,
  onSubmit,
  initialCandidateId,
}: UploadDocumentModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UploadDocumentForm>({ defaultValues: defaultValues(initialCandidateId) });

  useEffect(() => {
    if (open) reset(defaultValues(initialCandidateId));
  }, [open, initialCandidateId, reset]);

  const submit = handleSubmit(() => onSubmit());

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button">
            Yükle
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Evrak Yükle"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Aday</label>
            <select
              className={fieldClass(!!errors.candidateId, "form-select")}
              {...register("candidateId", { required: "Aday seçin" })}
            >
              {mockCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
            {errors.candidateId && (
              <div className="form-error">{errors.candidateId.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Evrak Türü</label>
            <select
              className={fieldClass(!!errors.docType, "form-select")}
              {...register("docType", { required: true })}
            >
              {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((k) => (
                <option key={k} value={k}>
                  {DOC_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Dosya</label>
            <Controller
              control={control}
              name="file"
              render={({ field, fieldState }) => (
                <FileDropInput
                  accept={ACCEPT}
                  error={!!fieldState.error}
                  file={field.value ?? undefined}
                  hint="JPEG, PNG veya PDF · maks. 10 MB"
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(list) => field.onChange(list?.[0] ?? null)}
                  onClear={() => field.onChange(null)}
                  ref={field.ref}
                />
              )}
              rules={{
                validate: (file) => {
                  if (!file) return "Dosya seçin";
                  if (file.size > MAX_BYTES) return "Dosya 10 MB'tan büyük olamaz";
                  return true;
                },
              }}
            />
            {errors.file && <div className="form-error">{errors.file.message}</div>}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea
              className="form-input"
              placeholder="Opsiyonel"
              rows={3}
              {...register("note")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
