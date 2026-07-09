import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLocalAgentMebbisSession,
  LocalAgentError,
  LOCAL_AGENT_UNAVAILABLE_MESSAGE,
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
});
