import { useEffect, useState, type ReactNode } from "react";
import { dualDate, formatTime } from "./dates";
import { useI18n } from "./i18n";
import { useShop } from "./shop";

function amountNum(value: number | string) {
  const n = Number(value || 0);
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-${abs}` : abs;
}

export function Money({ value, symbol: override }: { value: number | string; symbol?: string }) {
  const { symbol } = useShop();
  return (
    <span className="money">
      {amountNum(value)}
      <span className="money-sym">{override ?? symbol}</span>
    </span>
  );
}

export function Field({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-semibold mb-1">{title}</span>
      {children}
    </label>
  );
}

export function Cell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <td className="p-3 align-top">
      <div className="soft-label mb-0.5">{title}</div>
      <div>{children}</div>
    </td>
  );
}

export function DualDate({ value, withTime = true }: { value: string | Date; withTime?: boolean }) {
  const { lang, t } = useI18n();
  const both = dualDate(value, lang, withTime);
  return (
    <div className="leading-5">
      <div>
        <span className="font-bold">{t("meladi")}: </span>
        {both.meladi}
      </div>
      <div>
        <span className="font-bold">{t("shamsi")}: </span>
        {both.shamsi}
      </div>
    </div>
  );
}

export function LiveClock() {
  const { lang, t } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const both = dualDate(now, lang, false);
  return (
    <div className="rounded-2xl bg-white border px-4 py-2 text-xs leading-5" style={{ borderColor: "var(--line)" }}>
      <div>
        <span className="font-bold">{t("meladi")}: </span>
        {both.meladi}
      </div>
      <div>
        <span className="font-bold">{t("shamsi")}: </span>
        {both.shamsi}
      </div>
      <div>
        <span className="font-bold">{t("time")}: </span>
        {formatTime(now, lang)}
      </div>
    </div>
  );
}

export function PageHeader({ title, help, action }: { title: string; help: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="muted">{help}</p>
      </div>
      {action}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="font-extrabold text-lg mb-3">{children}</div>;
}

export function InfoBit({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="soft-label">{title}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}
