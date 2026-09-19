import { useState } from "react";
import { useI18n } from "../i18n";

export function Calculator() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("0");

  function press(key: string) {
    if (key === "C") {
      setValue("0");
      return;
    }
    if (key === "=") {
      try {
        const safe = value.replace(/[^0-9+\-*/.]/g, "");
        setValue(String(Function(`"use strict"; return (${safe})`)()));
      } catch {
        setValue("0");
      }
      return;
    }
    setValue((current) => (current === "0" ? key : current + key));
  }

  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "C", "+", "="];

  return (
    <div className="relative">
      <button type="button" className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
        {t("calculator")}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-20 card p-3 w-56">
          <div className="text-[11px] font-bold mb-1">{t("calculator")}</div>
          <div className="field mb-2 text-end font-bold">{value}</div>
          <div className="grid grid-cols-4 gap-1">
            {keys.map((key) => (
              <button key={key} type="button" className="btn btn-ghost py-2" onClick={() => press(key)}>
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
