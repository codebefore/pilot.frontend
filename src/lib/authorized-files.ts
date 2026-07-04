import { getStoredAccessToken, notifyUnauthorized } from "./auth-storage";

export async function createAuthorizedObjectUrl(url: string, signal?: AbortSignal): Promise<string> {
  const blob = await fetchAuthorizedBlob(url, signal);
  return URL.createObjectURL(blob);
}

export async function openAuthorizedFile(url: string): Promise<void> {
  const objectUrl = await createAuthorizedObjectUrl(url);
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("File window could not be opened.");
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadAuthorizedFile(url: string, filename?: string | null): Promise<void> {
  const file = await fetchAuthorizedFile(url);
  const objectUrl = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = resolveDownloadFileName(filename, file);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
}

export async function printAuthorizedFile(url: string, title: string): Promise<void> {
  const objectUrl = await createAuthorizedObjectUrl(url);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Print window could not be opened.");
  }

  const escapedTitle = escapeHtml(title);
  const escapedUrl = objectUrl.replace(/"/g, "%22");
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapedTitle}</title>
        <style>
          html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
        </style>
      </head>
      <body>
        <iframe src="${escapedUrl}" onload="setTimeout(function(){ window.focus(); window.print(); }, 250)"></iframe>
      </body>
    </html>
  `);
  printWindow.document.close();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function fetchAuthorizedBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  return (await fetchAuthorizedFile(url, signal)).blob;
}

type AuthorizedFile = {
  blob: Blob;
  contentType: string;
  fileName: string | null;
};

async function fetchAuthorizedFile(url: string, signal?: AbortSignal): Promise<AuthorizedFile> {
  const headers = new Headers();
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { headers, signal });
  if (response.status === 401) {
    notifyUnauthorized();
  }
  if (!response.ok) {
    throw new Error(`File request failed with status ${response.status}`);
  }
  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "",
    fileName: readContentDispositionFileName(response.headers.get("content-disposition")),
  };
}

function resolveDownloadFileName(requestedFileName: string | null | undefined, file: AuthorizedFile): string {
  return normalizeFileNameForContentType(
    file.fileName?.trim() || requestedFileName?.trim() || "dosya",
    file.blob.type || file.contentType
  );
}

function normalizeFileNameForContentType(fileName: string, contentType: string): string {
  const extension = extensionForContentType(contentType);
  if (!extension) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${baseName || "dosya"}${extension}`;
}

function extensionForContentType(contentType: string): string | null {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "application/pdf":
      return ".pdf";
    default:
      return null;
  }
}

function readContentDispositionFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1]?.trim() || null;
}

function escapeHtml(value: string): string {
  return value.replace(/[<>&"]/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "\"": "&quot;",
    };
    return entities[char] ?? char;
  });
}
