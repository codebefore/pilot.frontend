// Adaylar sayfasında bulk seçim ile uygulama eğitim sayfasına taşınan
// aday kümesi. localStorage'da kalıcı tutulur — yeni yönlendirme her
// zaman önceki scope'u override eder. Tek anahtar, basit string[] JSON.

const KEY = "pilot.training.practiceCandidateScope";

export function setPracticeCandidateScope(ids: readonly string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function getPracticeCandidateScope(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function clearPracticeCandidateScope(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
