import { useState } from "react";
import { useForm } from "react-hook-form";

import { DrawerRow, DrawerSection } from "../components/ui/Drawer";
import { EditableRow } from "../components/ui/EditableRow";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { useLanguage, useT } from "../lib/i18n";
import { formatDateTR } from "../lib/status-maps";

type ProfileData = {
  fullName: string;
  email: string;
  phone: string;
  institution: string;
  joinedAt: string;
};

type PasswordForm = {
  current: string;
  next: string;
  confirm: string;
};

export function ProfilePage() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();

  // Mock — ileride backend /api/me'den gelecek.
  const [profile, setProfile] = useState<ProfileData>(() => ({
    fullName: user?.name ?? "Demo Kullanıcı",
    email: user?.email ?? "demo@pilot.com",
    phone: "+90 555 000 00 00",
    institution: "Pilot Sürücü Kursu",
    joinedAt: "2024-09-01",
  }));

  const {
    formState: { errors },
    handleSubmit: handleSubmitPwd,
    register,
    reset: resetPwd,
  } = useForm<PasswordForm>({
    defaultValues: { current: "", next: "", confirm: "" },
  });
  const [changingPwd, setChangingPwd] = useState(false);

  const saveField = async (patch: Partial<ProfileData>) => {
    // TODO: backend /api/me PUT çağrısı hazır olunca burası gerçek kayıt.
    await new Promise((r) => setTimeout(r, 250));
    setProfile((p) => ({ ...p, ...patch }));
    showToast(t("profile.saved"));
  };

  const onChangePassword = async (data: PasswordForm) => {
    if (data.next !== data.confirm) {
      showToast(t("profile.passwordsDoNotMatch"), "error");
      return;
    }
    setChangingPwd(true);
    try {
      // TODO: backend /api/me/password POST çağrısı.
      await new Promise((r) => setTimeout(r, 400));
      showToast(t("profile.passwordUpdated"));
      resetPwd();
    } finally {
      setChangingPwd(false);
    }
  };

  const initials = profile.fullName
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
            <h1>{profile.fullName}</h1>
            <p>
              {profile.email}
              <span className="profile-role-badge">{t("profile.role.admin")}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="profile-page">
        <div className="profile-layout">
          <div className="profile-col">
            <div className="profile-section">
              <DrawerSection title={t("profile.personal")}>
                <EditableRow
                  displayValue={profile.fullName}
                  inputValue={profile.fullName}
                  label={t("profile.fullName")}
                  onSave={(v) => saveField({ fullName: v })}
                />
                <EditableRow
                  displayValue={profile.email}
                  inputType="email"
                  inputValue={profile.email}
                  label={t("profile.email")}
                  onSave={(v) => saveField({ email: v })}
                />
                <EditableRow
                  displayValue={profile.phone}
                  inputType="tel"
                  inputValue={profile.phone}
                  label={t("profile.phone")}
                  onSave={(v) => saveField({ phone: v })}
                />
                <DrawerRow label={t("profile.institution")}>{profile.institution}</DrawerRow>
                <DrawerRow label={t("profile.joinedAt")}>{formatDateTR(profile.joinedAt)}</DrawerRow>
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

            <div className="profile-section">
              <DrawerSection title={t("profile.security")}>
              <form className="profile-pwd-form" onSubmit={handleSubmitPwd(onChangePassword)}>
                <div className="profile-pwd-field">
                  <label htmlFor="pwd-current">{t("profile.currentPassword")}</label>
                  <input
                    autoComplete="current-password"
                    className="form-input"
                    id="pwd-current"
                    type="password"
                    {...register("current", { required: true })}
                  />
                </div>
                <div className="profile-pwd-field">
                  <label htmlFor="pwd-next">{t("profile.newPassword")}</label>
                  <input
                    autoComplete="new-password"
                    className="form-input"
                    id="pwd-next"
                    type="password"
                    {...register("next", { required: true, minLength: 6 })}
                  />
                </div>
                <div className="profile-pwd-field">
                  <label htmlFor="pwd-confirm">{t("profile.confirmPassword")}</label>
                  <input
                    autoComplete="new-password"
                    className={
                      errors.confirm ? "form-input error" : "form-input"
                    }
                    id="pwd-confirm"
                    type="password"
                    {...register("confirm", { required: true })}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={changingPwd}
                  style={{ alignSelf: "flex-start" }}
                  type="submit"
                >
                  {t("profile.updatePassword")}
                </button>
              </form>
            </DrawerSection>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
