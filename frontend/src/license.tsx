import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useI18n } from "./i18n";
import { LicensePage } from "./pages/License";

export function LicenseGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<"load" | "need" | "ok">("load");

  async function check() {
    try {
      const { data } = await api.get("/license");
      setState(data.licensed ? "ok" : "need");
    } catch {
      setState("need");
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (state === "load") {
    return <div className="min-h-screen grid place-items-center">{t("loading")}</div>;
  }
  if (state === "need") {
    return <LicensePage onDone={() => setState("ok")} />;
  }
  return children;
}
