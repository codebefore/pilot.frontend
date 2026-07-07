import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadAuthorizedFile } from "./authorized-files";

describe("downloadAuthorizedFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renames converted jpeg downloads instead of keeping the original pdf extension", async () => {
    let clickedDownload: string | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-file");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("jpg", {
        headers: { "content-type": "image/jpeg" },
        status: 200,
      })
    ));

    await downloadAuthorizedFile("https://api.example.test/file", "mezuniyet.pdf");

    expect(click).toHaveBeenCalledTimes(1);
    expect(clickedDownload).toBe("mezuniyet.jpg");
  });

  it("keeps pdf extension when the downloaded content is still a pdf", async () => {
    let clickedDownload: string | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-file");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("%PDF-1.4", {
        headers: { "content-type": "application/pdf" },
        status: 200,
      })
    ));

    await downloadAuthorizedFile("https://api.example.test/file", "mezuniyet.pdf");

    expect(click).toHaveBeenCalledTimes(1);
    expect(clickedDownload).toBe("mezuniyet.pdf");
  });
});
