import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLocalAgentMebbisSession,
  LocalAgentError,
  LOCAL_AGENT_UNAVAILABLE_MESSAGE,
  setLocalAgentMebbisBrowserVisibility,
} from "./local-agent-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local agent api", () => {
  it("maps network failures to the Turkish unavailable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getLocalAgentMebbisSession()).rejects.toMatchObject({
      name: "LocalAgentError",
      message: LOCAL_AGENT_UNAVAILABLE_MESSAGE,
    });
    await expect(getLocalAgentMebbisSession()).rejects.toBeInstanceOf(LocalAgentError);
  });

  it("can show MEBBİS without persisting the live view preference", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "ok",
        service: "pilot-localagent",
        version: "1.0.37",
        machineName: "Test Machine",
        timestampUtc: "2026-07-25T00:00:00.000Z",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        visible: true,
        supported: true,
        status: "connected",
        message: "MEBBİS penceresi gösterildi.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await setLocalAgentMebbisBrowserVisibility(true, { persistPreference: false });

    const [, init] = fetchMock.mock.calls[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({
      visible: true,
      persistPreference: false,
    }));
  });

  it("rejects transient MEBBİS visibility on LocalAgent versions older than 1.0.37", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status: "ok",
        service: "pilot-localagent",
        version: "1.0.36",
        machineName: "Test Machine",
        timestampUtc: "2026-07-25T00:00:00.000Z",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      setLocalAgentMebbisBrowserVisibility(true, { persistPreference: false })
    ).rejects.toMatchObject({
      name: "LocalAgentError",
      status: 426,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
