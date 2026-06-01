/**
 * Form label'larında zorunlu alan göstergesi. Ekran okuyucular için gizlenir
 * (alanın zorunluluğu schema/aria-required tarafından zaten bildirilir).
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="required-mark">
      *
    </span>
  );
}
