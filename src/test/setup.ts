import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_AUTH_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_CANDIDATE_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_CATALOG_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_DOCUMENT_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_FINANCE_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_MEBBIS_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_PLATFORM_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_TRAINING_API_BASE_URL", "http://127.0.0.1:5080");
vi.stubEnv("VITE_LOCAL_AGENT_BASE_URL", "http://127.0.0.1:37123");

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:test-object-url");
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

// jsdom bazı sürümlerde localStorage'i Storage instance olarak setup
// etmiyor; in-memory fallback ile test'ler beforeEach'te clear çağırabilsin.
if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
