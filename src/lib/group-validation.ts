import { ApiError } from "./http";
import type { TranslationKey } from "./i18n";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

const START_DATE_OUTSIDE_TERM_MESSAGE = /start date must be inside the selected term month/i;

export function translateGroupValidationMessage(
  message: string,
  t: Translate
): string {
  return START_DATE_OUTSIDE_TERM_MESSAGE.test(message)
    ? t("group.validation.startDateOutsideTerm")
    : message;
}

export function getGroupValidationToastMessage(
  error: unknown,
  t: Translate
): string | null {
  if (!(error instanceof ApiError)) return null;

  if (error.validationErrorCodes) {
    for (const codes of Object.values(error.validationErrorCodes)) {
      const first = codes[0];
      if (first?.code) {
        return t(first.code as TranslationKey, first.params);
      }
    }
  }

  if (error.validationErrors) {
    for (const messages of Object.values(error.validationErrors)) {
      const first = messages[0];
      if (first) {
        return translateGroupValidationMessage(first, t);
      }
    }
  }

  return null;
}
