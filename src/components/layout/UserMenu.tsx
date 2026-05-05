import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { LogoutIcon, SettingsIcon, UserIcon } from "../icons";

type UserMenuProps = {
  userInitials: string;
};

export function UserMenu({ userInitials }: UserMenuProps) {
  const t = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="user-menu-wrap" ref={ref}>
      <button
        className="header-avatar"
        onClick={() => setOpen((v) => !v)}
        title={user?.name ?? t("userMenu.profile")}
        type="button"
      >
        {userInitials}
      </button>

      {open && (
        <div className="user-menu">
          {user && (
            <div className="user-menu-header">
              <div className="user-menu-avatar">{userInitials}</div>
              <div className="user-menu-info">
                <div className="user-menu-name">{user.name}</div>
                <div className="user-menu-email">{user.email ?? user.roleName ?? ""}</div>
              </div>
            </div>
          )}

          <div className="user-menu-list">
            <button className="user-menu-item" onClick={() => go("/profile")} type="button">
              <span className="user-menu-icon">
                <UserIcon size={14} />
              </span>
              {t("userMenu.profile")}
            </button>
            <button className="user-menu-item" onClick={() => go("/settings")} type="button">
              <span className="user-menu-icon">
                <SettingsIcon size={14} />
              </span>
              {t("userMenu.settings")}
            </button>
          </div>

          {user && (
            <>
              <div className="user-menu-divider" />
              <div className="user-menu-list">
                <button
                  className="user-menu-item danger"
                  onClick={handleLogout}
                  type="button"
                >
                  <span className="user-menu-icon">
                    <LogoutIcon size={14} />
                  </span>
                  {t("userMenu.logout")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
