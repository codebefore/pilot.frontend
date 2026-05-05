import { getStoredAccessToken, notifyUnauthorized } from "./auth-storage";

export async function createAuthorizedObjectUrl(url: string): Promise<string> {
  const blob = await fetchAuthorizedBlob(url);
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
  const objectUrl = await createAuthorizedObjectUrl(url);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename?.trim() || "dosya";
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

async function fetchAuthorizedBlob(url: string): Promise<Blob> {
  const headers = new Headers();
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { headers });
  if (response.status === 401) {
    notifyUnauthorized();
  }
  if (!response.ok) {
    throw new Error(`File request failed with status ${response.status}`);
  }
  return response.blob();
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
