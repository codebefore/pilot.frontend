import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "./http";

export type ApplyApiErrorsResult = {
  /** True when at least one validation error was set on a known form field. */
  applied: boolean;
  /** Translated messages that were set on known form fields. */
  appliedMessages: string[];
  /** Translated messages for server fields that did not map to a form path. */
  unmappedMessages: string[];
};

const EMPTY_RESULT: ApplyApiErrorsResult = { applied: false, appliedMessages: [], unmappedMessages: [] };

/**
 * Maps backend ValidationProblemDetails (`errors` / `errorCodes`) onto a
 * react-hook-form instance.
 *
 * Mapping precedence (per server field):
 * 1. `fieldMap[serverField]` — explicit override
 * 2. No `fieldMap` provided → auto-camelCase the server name (PascalCase → camelCase)
 *    This is a best-effort fallback; if RHF silently ignores the path because
 *    it isn't part of the form schema, the message is still appended to
 *    `unmappedMessages` so callers can surface it via a toast / banner.
 * 3. `fieldMap` provided but no entry for `serverField` → message goes to
 *    `unmappedMessages` only (no setError call).
 *
 * `errorCodes` branch is preferred when `translateCode` is supplied; otherwise
 * the function falls through to the raw `errors` map.
 */
export function applyApiErrorsToForm<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  options?: {
    /** Translate validation error codes into messages. */
    translateCode?: (code: string, params?: Record<string, string>) => string;
    /** Translate raw backend validation messages into user-facing copy. */
    translateMessage?: (message: string, serverField: string) => string;
    /** Map server field names onto form paths (e.g. "Term" → "termId"). */
    fieldMap?: Record<string, Path<TFieldValues>>;
  }
): ApplyApiErrorsResult {
  if (!(error instanceof ApiError)) return EMPTY_RESULT;

  const resolvePath = (serverField: string): Path<TFieldValues> | null => {
    if (options?.fieldMap) {
      return options.fieldMap[serverField] ?? null;
    }
    const camel = serverField.charAt(0).toLowerCase() + serverField.slice(1);
    return camel as Path<TFieldValues>;
  };

  const unmappedMessages: string[] = [];
  const appliedMessages: string[] = [];
  let applied = false;

  if (error.validationErrorCodes && options?.translateCode) {
    for (const [serverField, codes] of Object.entries(error.validationErrorCodes)) {
      const first = codes[0];
      if (!first) continue;
      const message = options.translateCode(first.code, first.params);
      const path = resolvePath(serverField);
      if (path) {
        setError(path, { type: "server", message });
        appliedMessages.push(message);
        applied = true;
      } else {
        unmappedMessages.push(message);
      }
    }
    return { applied, appliedMessages, unmappedMessages };
  }

  if (error.validationErrors) {
    for (const [serverField, messages] of Object.entries(error.validationErrors)) {
      const first = messages[0];
      if (!first) continue;
      const message = options?.translateMessage?.(first, serverField) ?? first;
      const path = resolvePath(serverField);
      if (path) {
        setError(path, { type: "server", message });
        appliedMessages.push(message);
        applied = true;
      } else {
        unmappedMessages.push(message);
      }
    }
  }

  return { applied, appliedMessages, unmappedMessages };
}
