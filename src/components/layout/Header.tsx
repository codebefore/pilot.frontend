import { BellIcon, MenuIcon } from "../icons";
import { useToast } from "../ui/Toast";
import { mockInstitutions } from "../../mock/institutions";
import { InstitutionSelector } from "./InstitutionSelector";

type HeaderProps = {
  activeInstitutionId: string;
  onInstitutionChange: (id: string) => void;
  userInitials: string;
  onMenuToggle: () => void;
  hasNotifications?: boolean;
};

export function Header({
  activeInstitutionId,
  onInstitutionChange,
  userInitials,
  onMenuToggle,
  hasNotifications = true,
}: HeaderProps) {
  const { showToast } = useToast();

  return (
    <header className="header">
      <button
        aria-label="Menüyü aç"
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
          aria-label="Bildirimler"
          className="header-notif"
          onClick={() => showToast("3 yeni bildirim")}
          type="button"
        >
          <BellIcon />
          {hasNotifications && <span className="notif-dot" />}
        </button>
        <div className="header-avatar">{userInitials}</div>
      </div>
    </header>
  );
}
