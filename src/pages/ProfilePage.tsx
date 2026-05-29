import { useState, type FormEvent } from "react";

import { changePassword } from "../lib/auth-api";
import { DrawerRow, DrawerSection } from "../components/ui/Drawer";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { useLanguage, useT } from "../lib/i18n";

export function ProfilePage() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fullName = user?.name?.trim() || t("userMenu.profile");
  const roleLabel = user?.isSuperAdmin
    ? t("profile.role.superAdmin")
    : user?.roleName?.trim() || t("profile.role.admin");
  const phone = user?.phone?.trim() || "—";

  const initials = fullName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);

    if (!currentPassword.trim() || newPassword.trim().length < 8) {
      setPasswordError(t("profile.password.error.length"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.password.error.confirm"));
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });
      showToast(t("profile.password.toast.changed"));
      logout();
    } catch {
      setPasswordError(t("profile.password.error.failed"));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
      <div className="dash-header profile-dash-header">
        <div className="profile-dash-row">
          <div className="profile-hero-avatar">{initials}</div>
          <div className="profile-dash-info">
            <h1>{fullName}</h1>
            <p>
              {phone}
              <span className="profile-role-badge">{roleLabel}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="profile-page">
        <div className="profile-layout">
          <div className="profile-col">
            <div className="profile-section">
              <DrawerSection title={t("profile.personal")}>
                <DrawerRow label={t("profile.fullName")}>{fullName}</DrawerRow>
                <DrawerRow label={t("profile.phone")}>{phone}</DrawerRow>
                <DrawerRow label={t("profile.role")}>{roleLabel}</DrawerRow>
              </DrawerSection>
            </div>
            <div className="profile-section">
              <DrawerSection title={t("profile.password.title")}>
                <form className="profile-pwd-form" onSubmit={submitPassword}>
                  <div className="profile-pwd-field">
                    <label htmlFor="profile-current-password">{t("profile.password.current")}</label>
                    <input
                      autoComplete="current-password"
                      className="form-input"
                      id="profile-current-password"
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      type="password"
                      value={currentPassword}
                    />
                  </div>
                  <div className="profile-pwd-field">
                    <label htmlFor="profile-new-password">{t("profile.password.new")}</label>
                    <input
                      autoComplete="new-password"
                      className="form-input"
                      id="profile-new-password"
                      onChange={(event) => setNewPassword(event.target.value)}
                      type="password"
                      value={newPassword}
                    />
                  </div>
                  <div className="profile-pwd-field">
                    <label htmlFor="profile-confirm-password">{t("profile.password.confirm")}</label>
                    <input
                      autoComplete="new-password"
                      className="form-input"
                      id="profile-confirm-password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type="password"
                      value={confirmPassword}
                    />
                  </div>
                  {passwordError ? <div className="form-error">{passwordError}</div> : null}
                  <div className="profile-pwd-actions">
                    <button className="btn btn-primary" disabled={passwordSaving} type="submit">
                      {passwordSaving ? t("profile.password.saving") : t("profile.password.submit")}
                    </button>
                  </div>
                </form>
              </DrawerSection>
            </div>
          </div>

          <div className="profile-col">
            <div className="profile-section">
              <DrawerSection title={t("profile.preferences")}>
                <div className="drawer-row">
                  <span className="label">{t("profile.language")}</span>
                  <span className="value">
                    <div className="lang-switch">
                      <button
                        className={lang === "tr" ? "lang-switch-btn active" : "lang-switch-btn"}
                        onClick={() => setLang("tr")}
                        type="button"
                      >
                        Türkçe
                      </button>
                      <button
                        className={lang === "en" ? "lang-switch-btn active" : "lang-switch-btn"}
                        onClick={() => setLang("en")}
                        type="button"
                      >
                        English
                      </button>
                    </div>
                  </span>
                </div>
              </DrawerSection>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
