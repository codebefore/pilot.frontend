import { forwardRef, useState, type ChangeEvent, type DragEvent } from "react";

import { FileIcon, UploadCloudIcon, XIcon } from "../icons";
import { useT } from "../../lib/i18n";

type FileDropInputProps = {
  name: string;
  accept?: string;
  hint?: string;
  error?: boolean;
  disabled?: boolean;
  file?: File;
  variant?: "dropzone" | "button";
  onChange: (files: FileList | null) => void;
  onClear: () => void;
  onBlur?: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const FileDropInput = forwardRef<HTMLInputElement, FileDropInputProps>(
  function FileDropInput(
    { name, accept, hint, error, disabled, file, variant = "dropzone", onChange, onClear, onBlur },
    ref
  ) {
    const t = useT();
    const [dragging, setDragging] = useState(false);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(true);
    };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) onChange(e.dataTransfer.files);
    };
    const handleInput = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files);

    if (file) {
      return (
        <div className="file-selected">
          <div className="file-selected-icon">
            <FileIcon size={18} />
          </div>
          <div className="file-selected-info">
            <div className="file-selected-name">{file.name}</div>
            <div className="file-selected-meta">{formatBytes(file.size)}</div>
          </div>
          <button
            aria-label={t("fileDropInput.aria.removeFile")}
            className="file-selected-remove"
            onClick={onClear}
            type="button"
          >
            <XIcon size={14} />
          </button>
        </div>
      );
    }

    const className = `${variant === "button" ? "file-button" : "file-drop"}${dragging ? " dragging" : ""}${
      error ? " error" : ""
    }${disabled ? " disabled" : ""}`;

    return (
      <div
        className={className}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={variant === "button" ? "file-button-icon" : "file-drop-icon"}>
          <UploadCloudIcon size={18} />
        </div>
        {variant === "button" ? (
          <span>
            <strong>Dosya yükle</strong>
          </span>
        ) : (
          <>
            <div className="file-drop-main">
              <strong>Seçmek için tıkla</strong> veya dosyayı buraya sürükle
            </div>
            {hint && <div className="file-drop-hint">{hint}</div>}
          </>
        )}
        <input
          accept={accept}
          disabled={disabled}
          name={name}
          onBlur={onBlur}
          onChange={handleInput}
          ref={ref}
          type="file"
        />
      </div>
    );
  }
);
