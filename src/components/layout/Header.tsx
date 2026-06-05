import { useLanguage } from "../../lib/i18n";
import type { AuthInstitution } from "../../lib/auth-storage";
import { MenuIcon } from "../icons";
import { InstitutionSelector } from "./InstitutionSelector";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

const BRAND_LOGO_SRC = "/pilot.png?v=20260605";

type HeaderProps = {
  activeInstitutionId: string;
  institutions: AuthInstitution[];
  onInstitutionChange: (id: string) => Promise<void>;
  userInitials: string;
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
};

export function Header({
  activeInstitutionId,
  institutions,
  onInstitutionChange,
  userInitials,
  onMenuToggle,
  onSidebarToggle,
  sidebarCollapsed,
}: HeaderProps) {
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => setLang(lang === "tr" ? "en" : "tr");

  return (
    <header className="header">
      <button
        aria-label={t("header.menu")}
        className="header-menu-toggle"
        onClick={onMenuToggle}
        type="button"
      >
        <MenuIcon />
      </button>

      <button
        aria-label={t("header.sidebarToggle")}
        aria-pressed={!sidebarCollapsed}
        className="header-brand header-brand-button"
        onClick={onSidebarToggle}
        type="button"
      >
        <img alt="Pilot" className="logo-image" src={BRAND_LOGO_SRC} />
      </button>

      <div className="header-inst-wrap">
        <div className="header-divider" />
        <InstitutionSelector
          activeId={activeInstitutionId}
          institutions={institutions}
          onSelect={onInstitutionChange}
        />
      </div>

      <div className="header-right">
        <button
          aria-label={t("header.languageToggle")}
          className="header-lang"
          onClick={toggleLang}
          title={t("header.languageToggle")}
          type="button"
        >
          {lang === "tr" ? "EN" : "TR"}
        </button>
        <NotificationsMenu />
        <UserMenu userInitials={userInitials} />
      </div>
    </header>
  );
}
