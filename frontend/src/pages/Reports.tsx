import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { dualDate } from "../dates";
import { useI18n } from "../i18n";
import { CardTitle, DualDate, InfoBit, Money, PageHeader } from "../ui";

type Period = "day" | "week" | "month" | "year";

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function Reports() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("day");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>(null);

  function loadReport() {
    api.get("/reports/sales", { params: { type: period, date } }).then((res) => setSales(res.data));
  }

  useEffect(() => {
    loadReport();
  }, [period, date]);

  useEffect(() => {
    api.get("/reports/top-medicines").then((res) => setTop(res.data));
    api.get("/inventory/alerts").then((res) => setAlerts(res.data));
  }, []);

  function downloadCsv() {
    if (!sales) return;
    const from = dualDate(sales.from, lang, false);
    const to = dualDate(sales.to, lang, false);
    const lines = [
      [t("reports"), `${from.meladi} / ${from.shamsi}`, `${to.meladi} / ${to.shamsi}`].join(","),
      [t("revenue"), sales.revenue].join(","),
      [t("taxTotal"), sales.tax].join(","),
      [t("cost"), sales.cost].join(","),
      [t("buys"), sales.buys].join(","),
      [t("expensesTotal"), sales.expenses].join(","),
      [t("profit"), sales.profit].join(","),
      [t("profitAfterTax"), sales.profitAfterTax].join(","),
      "",
      [t("invoice"), t("date"), t("customer"), t("total"), t("paid"), t("status")].join(","),
      ...(sales.sales || []).map((row: any) => {
        const both = dualDate(row.createdAt, lang, false);
        return [row.invoiceNo, `${both.meladi} / ${both.shamsi}`, row.customer?.name || t("walkIn"), row.total, row.paid, row.status].map(csvEscape).join(",");
      }),
      "",
      [t("expenses"), t("category"), t("amount"), t("date")].join(","),
      ...(sales.expenseRows || []).map((row: any) => {
        const both = dualDate(row.date, lang, false);
        return [row.title, row.category, row.amount, `${both.meladi} / ${both.shamsi}`].map(csvEscape).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy-report-${period}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!sales || !alerts) return <div>{t("loading")}</div>;

  const fromBoth = dualDate(sales.from, lang, false);
  const toBoth = dualDate(sales.to, lang, false);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("reports")}
        help={t("reportsHelp")}
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => window.print()}>{t("printReport")}</button>
            <button className="btn btn-primary" onClick={downloadCsv}>{t("download")}</button>
          </div>
        }
      />

      <div className="card p-5 grid md:grid-cols-4 gap-3">
        <FieldPeriod t={t} period={period} setPeriod={setPeriod} date={date} setDate={setDate} />
        <div className="md:col-span-2">
          <div className="soft-label">{t("reportFrom")}</div>
          <div>{t("meladi")}: {fromBoth.meladi}</div>
          <div>{t("shamsi")}: {fromBoth.shamsi}</div>
        </div>
        <div>
          <div className="soft-label">{t("reportTo")}</div>
          <div>{t("meladi")}: {toBoth.meladi}</div>
          <div>{t("shamsi")}: {toBoth.shamsi}</div>
        </div>
      </div>

      <div className="print-sheet space-y-5">
        <div className="hidden print:block">
          <div className="text-2xl font-extrabold">{t("reports")}</div>
          <div>{t("meladi")}: {fromBoth.meladi} — {toBoth.meladi}</div>
          <div>{t("shamsi")}: {fromBoth.shamsi} — {toBoth.shamsi}</div>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat label={t("revenue")} value={sales.revenue} />
          <Stat label={t("taxTotal")} value={sales.tax} />
          <Stat label={t("cost")} value={sales.cost} />
          <Stat label={t("buys")} value={sales.buys} />
          <Stat label={t("expensesTotal")} value={sales.expenses} />
          <Stat label={t("profitAfterTax")} value={sales.profitAfterTax} />
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 font-extrabold">{t("recentBills")}</div>
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3">{t("invoice")}</th>
                <th className="p-3">{t("date")}</th>
                <th className="p-3">{t("customer")}</th>
                <th className="p-3">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {(sales.sales || []).slice(0, 20).map((row: any) => (
                <tr key={row.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="p-3 font-bold">{row.invoiceNo}</td>
                  <td className="p-3"><DualDate value={row.createdAt} withTime={false} /></td>
                  <td className="p-3">{row.customer?.name || t("walkIn")}</td>
                  <td className="p-3"><Money value={row.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <CardTitle>{t("topMedicines")}</CardTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top.map((item) => ({ name: item.medicine?.brandName, qty: item.quantity }))}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qty" fill="var(--copper)" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5 space-y-3">
          <CardTitle>{t("expiryAndLow")}</CardTitle>
          <InfoBit title={t("expiredBatches")}>{alerts.expired.length}</InfoBit>
          <InfoBit title={t("nearExpiry")}>{alerts.nearExpiry.length}</InfoBit>
          <InfoBit title={t("lowStock")}>{alerts.lowStock.length}</InfoBit>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-bold muted">{label}</div>
      <div className="text-xl font-extrabold mt-2"><Money value={value} /></div>
    </div>
  );
}

function FieldPeriod({
  t,
  period,
  setPeriod,
  date,
  setDate,
}: {
  t: (key: any) => string;
  period: Period;
  setPeriod: (value: Period) => void;
  date: string;
  setDate: (value: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="block text-sm font-semibold mb-1">{t("period")}</span>
        <select className="field" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="day">{t("daily")}</option>
          <option value="week">{t("weekly")}</option>
          <option value="month">{t("monthly")}</option>
          <option value="year">{t("yearly")}</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-sm font-semibold mb-1">{period === "year" ? t("pickYear") : period === "month" ? t("pickMonth") : period === "week" ? t("pickWeek") : t("pickDay")}</span>
        {period === "year" ? (
          <input className="field" type="number" min={2020} max={2100} value={date.slice(0, 4)} onChange={(e) => setDate(`${e.target.value}-01-01`)} />
        ) : period === "month" ? (
          <input className="field" type="month" value={date.slice(0, 7)} onChange={(e) => setDate(`${e.target.value}-01`)} />
        ) : (
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </label>
    </>
  );
}
