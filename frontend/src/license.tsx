import axios from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useI18n } from "./i18n";
import { LicensePage } from "./pages/License";

export function LicenseGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<"load" | "need" | "ok" | "down">("load");

  async function check() {
    try {
      const { data } = await api.get("/license");
      setState(data.licensed ? "ok" : "need");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setState("need");
        return;
      }
      setState("down");
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (state === "load") {
    return <div className="min-h-screen grid place-items-center">{t("loading")}</div>;
  }
  if (state === "down") {
    return (
      <div className="min-h-screen grid place-items-center p-8">
        <div className="card p-6 max-w-md space-y-3 text-center">
          <h3 className="text-lg font-extrabold">{t("appName")}</h3>
          <p className="muted">{t("loading")}</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setState("load");
              void check();
            }}
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }
  if (state === "need") {
    return <LicensePage onDone={() => setState("ok")} />;
  }
  return children;
}
