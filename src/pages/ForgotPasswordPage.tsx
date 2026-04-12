import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { useT } from "../lib/i18n";

type ForgotPasswordForm = {
  email: string;
};

export function ForgotPasswordPage() {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<ForgotPasswordForm>({
    defaultValues: { email: "" },
  });

  const email = watch("email");

  const onSubmit = async (_data: ForgotPasswordForm) => {
    setFormError(null);
    setSubmitting(true);
    try {
      // TODO: backend /api/auth/forgot-password hazır olunca burası gerçek çağrıyla değişecek.
      await new Promise((r) => setTimeout(r, 500));
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("login.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-mark">P</div>
          <h1>{t("forgot.title")}</h1>
          <p>{sent ? t("forgot.sentTitle") : t("forgot.subtitle")}</p>
        </div>

        {sent ? (
          <div className="login-form">
            <div className="forgot-success">{t("forgot.successBody", { email })}</div>
            <Link className="btn btn-primary login-submit" to="/login">
              {t("forgot.backToLoginBtn")}
            </Link>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="login-field">
              <label htmlFor="forgot-email">{t("login.email")}</label>
              <input
                autoComplete="email"
                autoFocus
                id="forgot-email"
                placeholder={t("login.emailPlaceholder")}
                type="email"
                {...register("email", { required: t("login.errors.emailRequired") })}
              />
              {errors.email && <span className="login-error">{errors.email.message}</span>}
            </div>

            {formError && <div className="login-form-error">{formError}</div>}

            <button className="btn btn-primary login-submit" disabled={submitting} type="submit">
              {submitting ? t("forgot.submitting") : t("forgot.submit")}
            </button>

            <div className="login-foot">
              <Link className="login-link" to="/login">
                {t("forgot.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
