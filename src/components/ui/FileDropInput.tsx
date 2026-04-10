import { forwardRef, useState, type ChangeEvent, type DragEvent } from "react";

import { FileIcon, UploadCloudIcon, XIcon } from "../icons";

type FileDropInputProps = {
  name: string;
  accept?: string;
  hint?: string;
  error?: boolean;
  file?: File;
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
    { name, accept, hint, error, file, onChange, onClear, onBlur },
    ref
  ) {
    const [dragging, setDragging] = useState(false);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(true);
    };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
            aria-label="Dosyayı kaldır"
            className="file-selected-remove"
            onClick={onClear}
            type="button"
          >
            <XIcon size={14} />
          </button>
        </div>
      );
    }

    const className = `file-drop${dragging ? " dragging" : ""}${error ? " error" : ""}`;

    return (
      <div
        className={className}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="file-drop-icon">
          <UploadCloudIcon size={18} />
        </div>
        <div className="file-drop-main">
          <strong>Seçmek için tıkla</strong> veya dosyayı buraya sürükle
        </div>
        {hint && <div className="file-drop-hint">{hint}</div>}
        <input
          accept={accept}
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
