import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const { login, user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
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
          <h1>{t("login.title")}</h1>
          <p>{t("login.subtitle")}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="login-field">
            <label htmlFor="login-email">{t("login.email")}</label>
            <input
              autoComplete="email"
              id="login-email"
              placeholder={t("login.emailPlaceholder")}
              type="email"
              {...register("email", { required: t("login.errors.emailRequired") })}
            />
            {errors.email && <span className="login-error">{errors.email.message}</span>}
          </div>

          <div className="login-field">
            <label htmlFor="login-password">{t("login.password")}</label>
            <input
              autoComplete="current-password"
              id="login-password"
              placeholder="••••••••"
              type="password"
              {...register("password", { required: t("login.errors.passwordRequired") })}
            />
            {errors.password && <span className="login-error">{errors.password.message}</span>}
          </div>

          {formError && <div className="login-form-error">{formError}</div>}

          <button className="btn btn-primary login-submit" disabled={submitting} type="submit">
            {submitting ? t("login.submitting") : t("login.submit")}
          </button>

          <div className="login-foot">
            <Link className="login-link" to="/forgot-password">
              {t("login.forgotPassword")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
