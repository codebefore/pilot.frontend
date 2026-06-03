import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { applyApiErrorsToForm } from "../lib/form-errors";
import { ApiError } from "../lib/http";
import { useAuth, type LoginChannel } from "../lib/auth";
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
  // Which channel ("whatsapp" | "sms") the most recent request used. Drives the
  // resend button, code label, and "code sent" hint after the first request.
  const [selectedChannel, setSelectedChannel] = useState<LoginChannel | null>(null);
  // Which button is in the spinner state, so the OTHER channel button stays
  // clickable while a request is in flight (rare race, but the UI honors it).
  const [pendingChannel, setPendingChannel] = useState<LoginChannel | null>(null);

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

  const requestCode = async (channel: LoginChannel) => {
    // Run the Zod schema for `phone` before contacting the backend; without
    // this the empty-phone path would throw inside auth.tsx and surface a
    // raw Turkish string that bypasses i18n. Surfacing the schema's i18n
    // key as a field-level error matches what handleSubmit would do.
    const phoneValid = await trigger("phone");
    if (!phoneValid) return;
    setFormError(null);
    setSubmitting(true);
    setPendingChannel(channel);
    try {
      const response = await requestLoginCode(getValues("phone"), channel);
      setSelectedChannel(channel);
      setCodeRequested(true);
      setExpiresAt(response.expiresAtUtc);
      setFocus("code");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("login.errors.failed"));
    } finally {
      setSubmitting(false);
      setPendingChannel(null);
    }
  };

  const resendCode = () => {
    if (!selectedChannel) return;
    void requestCode(selectedChannel);
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
              <label htmlFor="login-code">
                {selectedChannel === "sms"
                  ? t("login.code.sms")
                  : selectedChannel === "whatsapp"
                    ? t("login.code.whatsapp")
                    : t("login.code")}
              </label>
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
              {expiresAt ? (
                <span className="login-hint">
                  {selectedChannel === "sms"
                    ? t("login.codeSent.sms")
                    : selectedChannel === "whatsapp"
                      ? t("login.codeSent.whatsapp")
                      : t("login.codeSent")}
                </span>
              ) : null}
            </div>
          ) : null}

          {formError && <div className="login-form-error">{formError}</div>}

          {codeRequested ? (
            <div className="login-actions">
              <button className="btn btn-secondary" disabled={submitting} onClick={resendCode} type="button">
                {t("login.resendCode")}
              </button>
              <button className="btn btn-primary login-submit" disabled={submitting} type="submit">
                {submitting ? t("login.verifying") : t("login.submit")}
              </button>
            </div>
          ) : (
            <>
              <span className="login-hint login-channel-hint">{t("login.channelHint")}</span>
              <div className="login-actions login-channel-actions">
                <button
                  className="btn btn-primary login-submit"
                  disabled={submitting}
                  onClick={() => void requestCode("whatsapp")}
                  type="button"
                >
                  {pendingChannel === "whatsapp"
                    ? t("login.sendingCode.whatsapp")
                    : t("login.sendCode.whatsapp")}
                </button>
                <button
                  className="btn btn-secondary login-submit"
                  disabled={submitting}
                  onClick={() => void requestCode("sms")}
                  type="button"
                >
                  {pendingChannel === "sms"
                    ? t("login.sendingCode.sms")
                    : t("login.sendCode.sms")}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
