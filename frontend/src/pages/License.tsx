import { FormEvent, useState } from "react";
import { api, errorMessage } from "../api";
import { LanguageSwitch, useI18n } from "../i18n";
import { Field } from "../ui";

export function LicensePage({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [shopName, setShopName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/license", { shopName, key });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-art">
        <div>
          <p className="login-kicker">{t("welcome")}</p>
          <h2>{t("licenseTitle")}</h2>
        </div>
        <p className="login-tagline">{t("licenseTagline")}</p>
      </section>
      <section className="login-card">
        <form className="login-box" onSubmit={onSubmit}>
          <div className="flex justify-end">
            <LanguageSwitch />
          </div>
          <div>
            <h3>{t("licenseUnlock")}</h3>
            <p className="muted">{t("licenseHint")}</p>
          </div>
          {error && <div className="rounded-xl bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
          <Field title={t("licenseShop")}>
            <input className="field" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
          </Field>
          <Field title={t("licenseKey")}>
            <input className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder="PMS-XXXX-XXXX-XXXX-XXXX" required />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? t("licenseChecking") : t("licenseEnter")}
          </button>
        </form>
      </section>
    </div>
  );
}
