import { useLanguage } from "../../lib/i18n";
import { mockInstitutions } from "../../mock/institutions";
import { MenuIcon } from "../icons";
import { InstitutionSelector } from "./InstitutionSelector";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

type HeaderProps = {
  activeInstitutionId: string;
  onInstitutionChange: (id: string) => void;
  userInitials: string;
  onMenuToggle: () => void;
};

export function Header({
  activeInstitutionId,
  onInstitutionChange,
  userInitials,
  onMenuToggle,
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

      <div className="header-brand">
        <span className="logo-icon">P</span>
        Pilot
      </div>

      <div className="header-inst-wrap">
        <div className="header-divider" />
        <InstitutionSelector
          activeId={activeInstitutionId}
          institutions={mockInstitutions}
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
