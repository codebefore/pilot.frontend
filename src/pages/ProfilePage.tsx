import { DrawerRow, DrawerSection } from "../components/ui/Drawer";
import { useAuth } from "../lib/auth";
import { useLanguage, useT } from "../lib/i18n";

export function ProfilePage() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();

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
