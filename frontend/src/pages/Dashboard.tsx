import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { useI18n } from "../i18n";
import { useShop } from "../shop";
import { CardTitle, DualDate, InfoBit, Money, PageHeader } from "../ui";

function ChartMoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-sm">
      <div className="font-bold">{label}</div>
      <div className="mt-1">
        {t("todaySales")}: <Money value={payload[0].value} />
      </div>
    </div>
  );
}

type DashboardData = {
  todayRevenue: number;
  todayBills: number;
  todayProfit: number;
  stockValue: number;
  medicineCount: number;
  customerCount: number;
  lowStock: number;
  nearExpiry: number;
  week: { date: string; sales: number; bills: number }[];
  recentSales: {
    id: string;
    invoiceNo: string;
    total: number;
    paymentMethod: string;
    createdAt: string;
    customer?: { name: string } | null;
  }[];
};

export function Dashboard() {
  const { t } = useI18n();
  const { symbol } = useShop();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get("/reports/dashboard").then((res) => setData(res.data));
  }, []);

  if (!data) return <div>{t("loading")}</div>;

  const cards = [
    { title: t("todaySales"), value: <Money value={data.todayRevenue} />, hint: `${t("billsCount")}: ${data.todayBills}` },
    { title: t("todayProfit"), value: <Money value={data.todayProfit} />, hint: t("afterCost") },
    { title: t("stockValue"), value: <Money value={data.stockValue} />, hint: `${t("medicinesCount")}: ${data.medicineCount}` },
    { title: t("watchList"), value: `${data.lowStock + data.nearExpiry}`, hint: `${t("lowStock")}: ${data.lowStock} · ${t("nearExpiry")}: ${data.nearExpiry}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} help={t("dashboardHelp")} action={<Link to="/pos" className="btn btn-primary">{t("openPos")}</Link>} />

      <div className="grid md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="card p-5">
            <div className="text-sm font-bold muted">{card.title}</div>
            <div className="text-2xl font-extrabold mt-2">{card.value}</div>
            <div className="text-xs muted mt-1">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <CardTitle>{t("last7Days")}</CardTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.week}>
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `${Number(value).toLocaleString()} ${symbol}`} width={80} />
                <Tooltip content={<ChartMoneyTooltip />} />
                <Area type="monotone" dataKey="sales" stroke="var(--copper)" fill="color-mix(in srgb, var(--copper) 18%, white)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <CardTitle>{t("recentBills")}</CardTitle>
          <div className="space-y-4">
            {data.recentSales.map((sale) => (
              <div key={sale.id} className="grid grid-cols-2 gap-2 text-sm border-b pb-3" style={{ borderColor: "var(--line)" }}>
                <InfoBit title={t("invoice")}>{sale.invoiceNo}</InfoBit>
                <InfoBit title={t("customer")}>{sale.customer?.name || t("walkIn")}</InfoBit>
                <InfoBit title={t("total")}><Money value={sale.total} /></InfoBit>
                <InfoBit title={t("pay")}>{sale.paymentMethod}</InfoBit>
                <div className="col-span-2">
                  <div className="soft-label">{t("date")}</div>
                  <DualDate value={sale.createdAt} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
