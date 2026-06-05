import { useState } from "react";

import { PageTabs } from "../components/layout/PageToolbar";
import { DrawerRow, DrawerSection } from "../components/ui/Drawer";
import { useAuth } from "../lib/auth";
import { useLanguage, useT } from "../lib/i18n";
import { useTheme } from "../lib/theme";

type ProfileTab = "profile" | "theme";

export function ProfilePage() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const { options: themeOptions, setTheme, theme } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

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
        <div className="profile-tab-toolbar">
          <PageTabs
            active={activeTab}
            onChange={setActiveTab}
            tabs={[
              { key: "profile", label: t("profile.tab.profile") },
              { key: "theme", label: t("profile.tab.theme") },
            ]}
          />
        </div>

        {activeTab === "profile" ? (
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
        ) : null}

        {activeTab === "theme" ? (
          <div className="profile-section profile-theme-section">
            <div className="profile-section-header">
              <div>
                <h2>{t("settings.general.theme.title")}</h2>
                <p>{t("settings.general.theme.localNote")}</p>
              </div>
            </div>

            <div className="settings-theme-grid">
              {themeOptions.map((option) => (
                <button
                  aria-pressed={theme === option.key}
                  className={theme === option.key ? "settings-theme-card active" : "settings-theme-card"}
                  key={option.key}
                  onClick={() => setTheme(option.key)}
                  type="button"
                >
                  <span className="settings-theme-preview">
                    <span
                      className="settings-theme-preview-bar"
                      style={{ backgroundColor: option.swatches[0] }}
                    />
                    <span className="settings-theme-preview-body" style={{ backgroundColor: option.swatches[1] }}>
                      <span style={{ backgroundColor: option.swatches[2] }} />
                      <span style={{ backgroundColor: option.swatches[2] }} />
                      <span style={{ backgroundColor: option.swatches[0] }} />
                    </span>
                  </span>
                  <span className="settings-theme-copy">
                    <strong>{t(option.labelKey)}</strong>
                    <span>{t(option.descriptionKey)}</span>
                  </span>
                  <span className="settings-theme-swatches">
                    {option.swatches.map((swatch) => (
                      <span
                        aria-hidden="true"
                        key={swatch}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
