import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { applyApiErrorsToForm } from "../lib/form-errors";
import { ApiError } from "../lib/http";
import { useAuth } from "../lib/auth";
import { useT, type TranslationKey } from "../lib/i18n";

const loginSchema = z.object({
  phone: z.string().min(1, "login.errors.phoneRequired"),
  code: z.string().min(1, "login.errors.codeRequired"),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, requestLoginCode, user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError,
    setFocus,
    trigger,
  } = useForm<LoginForm>({
    defaultValues: { phone: "", code: "" },
    resolver: zodResolver(loginSchema),
  });

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const requestCode = async () => {
    // Run the Zod schema for `phone` before contacting the backend; without
    // this the empty-phone path would throw inside auth.tsx and surface a
    // raw Turkish string that bypasses i18n. Surfacing the schema's i18n
    // key as a field-level error matches what handleSubmit would do.
    const phoneValid = await trigger("phone");
    if (!phoneValid) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const response = await requestLoginCode(getValues("phone"));
      setCodeRequested(true);
      setExpiresAt(response.expiresAtUtc);
      setFocus("code");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("login.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await login(data.phone, data.code);
      navigate(from, { replace: true });
    } catch (err) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(err, setError);
      if (err instanceof ApiError && err.status === 401 && !applied) {
        setFormError(t("login.errors.codeFailed"));
      } else if (!applied) {
        const fallback = unmappedMessages[0]
          ?? (err instanceof Error ? err.message : t("login.errors.failed"));
        setFormError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img alt="Pilot" className="login-brand-logo" src="/pilot.png" />
        </div>

        <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="login-field">
            <label htmlFor="login-phone">{t("login.phone")}</label>
            <input
              autoComplete="tel"
              disabled={submitting || codeRequested}
              id="login-phone"
              inputMode="tel"
              placeholder={t("login.phonePlaceholder")}
              type="tel"
              {...register("phone")}
            />
            {errors.phone && <span className="login-error">{t((errors.phone.message ?? "") as TranslationKey)}</span>}
          </div>

          {codeRequested ? (
            <div className="login-field">
              <label htmlFor="login-code">{t("login.code")}</label>
              <input
                autoComplete="one-time-code"
                id="login-code"
                inputMode="numeric"
                maxLength={8}
                placeholder={t("login.codePlaceholder")}
                type="text"
                {...register("code")}
              />
              {errors.code && <span className="login-error">{t((errors.code.message ?? "") as TranslationKey)}</span>}
              {expiresAt ? <span className="login-hint">{t("login.codeSent")}</span> : null}
            </div>
          ) : null}

          {formError && <div className="login-form-error">{formError}</div>}

          {codeRequested ? (
            <div className="login-actions">
              <button className="btn btn-secondary" disabled={submitting} onClick={requestCode} type="button">
                {t("login.resendCode")}
              </button>
              <button className="btn btn-primary login-submit" disabled={submitting} type="submit">
                {submitting ? t("login.verifying") : t("login.submit")}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary login-submit"
              disabled={submitting}
              onClick={requestCode}
              type="button"
            >
              {submitting ? t("login.sendingCode") : t("login.sendCode")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
