import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import entrypoint from "../../nginx/docker-entrypoint.sh?raw";
import template from "../../nginx/env-config.template.json?raw";

import {
  applyRuntimeConfig,
  getAuthApiBaseUrl,
  getCandidateApiBaseUrl,
  getCatalogApiBaseUrl,
  getDocumentApiBaseUrl,
  getFinanceApiBaseUrl,
  getMebbisApiBaseUrl,
  getPlatformApiBaseUrl,
  getTrainingApiBaseUrl,
} from "./api";

describe("service api base urls", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
  });

  it("falls back to the default API base URL when service-specific runtime config is absent", () => {
    applyRuntimeConfig({ apiBaseUrl: "http://127.0.0.1:5080" });

    expect(getAuthApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getCandidateApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getCatalogApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getDocumentApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getFinanceApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getMebbisApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getPlatformApiBaseUrl()).toBe("http://127.0.0.1:5080");
    expect(getTrainingApiBaseUrl()).toBe("http://127.0.0.1:5080");
  });

  it("uses service-specific runtime config values when present", () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      authApiBaseUrl: "http://127.0.0.1:5091",
      catalogApiBaseUrl: "http://127.0.0.1:5090",
      documentApiBaseUrl: "http://127.0.0.1:5092",
      financeApiBaseUrl: "http://127.0.0.1:5093",
      candidateApiBaseUrl: "http://127.0.0.1:5094",
      trainingApiBaseUrl: "http://127.0.0.1:5095",
      mebbisApiBaseUrl: "http://127.0.0.1:5096",
      platformApiBaseUrl: "http://127.0.0.1:5097",
    });

    expect(getAuthApiBaseUrl()).toBe("http://127.0.0.1:5091");
    expect(getCatalogApiBaseUrl()).toBe("http://127.0.0.1:5090");
    expect(getDocumentApiBaseUrl()).toBe("http://127.0.0.1:5092");
    expect(getFinanceApiBaseUrl()).toBe("http://127.0.0.1:5093");
    expect(getCandidateApiBaseUrl()).toBe("http://127.0.0.1:5094");
    expect(getTrainingApiBaseUrl()).toBe("http://127.0.0.1:5095");
    expect(getMebbisApiBaseUrl()).toBe("http://127.0.0.1:5096");
    expect(getPlatformApiBaseUrl()).toBe("http://127.0.0.1:5097");
  });

  it("keeps container runtime config template aligned with service-specific env vars", () => {
    const expectedPairs = [
      ["authApiBaseUrl", "VITE_AUTH_API_BASE_URL"],
      ["candidateApiBaseUrl", "VITE_CANDIDATE_API_BASE_URL"],
      ["catalogApiBaseUrl", "VITE_CATALOG_API_BASE_URL"],
      ["documentApiBaseUrl", "VITE_DOCUMENT_API_BASE_URL"],
      ["financeApiBaseUrl", "VITE_FINANCE_API_BASE_URL"],
      ["mebbisApiBaseUrl", "VITE_MEBBIS_API_BASE_URL"],
      ["platformApiBaseUrl", "VITE_PLATFORM_API_BASE_URL"],
      ["trainingApiBaseUrl", "VITE_TRAINING_API_BASE_URL"],
    ];

    for (const [runtimeKey, envVar] of expectedPairs) {
      expect(template).toContain(`"${runtimeKey}": "\${${envVar}}"`);
      expect(entrypoint).toContain(`: "\${${envVar}:=$VITE_API_BASE_URL}"`);
      expect(entrypoint).toContain(`\${${envVar}}`);
    }
  });

  it("documents service-specific env vars in the local example file", () => {
    const envExample = readFileSync(resolve(".env.example"), "utf8");
    const expectedEnvVars = [
      "VITE_AUTH_API_BASE_URL",
      "VITE_CANDIDATE_API_BASE_URL",
      "VITE_CATALOG_API_BASE_URL",
      "VITE_DOCUMENT_API_BASE_URL",
      "VITE_FINANCE_API_BASE_URL",
      "VITE_MEBBIS_API_BASE_URL",
      "VITE_PLATFORM_API_BASE_URL",
      "VITE_TRAINING_API_BASE_URL",
    ];

    for (const envVar of expectedEnvVars) {
      expect(envExample).toContain(`${envVar}=`);
    }
  });
});
