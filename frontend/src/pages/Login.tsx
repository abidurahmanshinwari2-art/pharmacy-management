import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errorMessage } from "../api";
import { useI18n } from "../i18n";
import { useShop } from "../shop";
import { Field } from "../ui";

export function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const { settings } = useShop();
  const navigate = useNavigate();
  const shopName = settings.name || t("shopName");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-art">
        <div>
          <p className="login-kicker">{t("welcome")}</p>
          <h2>{shopName}</h2>
        </div>
        <p className="login-tagline">{settings.tagline || t("loginLeftText")}</p>
      </section>
      <section className="login-card">
        <form className="login-box" onSubmit={onSubmit}>
          <div>
            <h3>{t("welcome")}</h3>
            <p className="muted">{t("signInTo")} {shopName}</p>
          </div>
          {error && <div className="rounded-xl bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
          <Field title={t("email")}>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field title={t("password")}>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? t("signingIn") : t("enterPharmacy")}
          </button>
        </form>
      </section>
    </div>
  );
}
