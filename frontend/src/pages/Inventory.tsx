import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Cell, DualDate, Field, Money, PageHeader } from "../ui";

type Row = {
  id: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  location: string;
  daysLeft: number;
  status: string;
  medicine: { brandName: string; genericName: string; sku: string };
};

export function Inventory() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [quantity, setQuantity] = useState(-1);
  const [reason, setReason] = useState("Damage");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await api.get("/inventory");
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveAdjust() {
    if (!adjust) return;
    try {
      await api.post("/inventory/adjust", { batchId: adjust.id, quantity, reason, note });
      setAdjust(null);
      setMessage(t("stockUpdated"));
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  const statusOrder: Record<string, number> = { EXPIRED: 0, NEAR_EXPIRY: 1, LOW: 2, OUT: 3, OK: 4 };
  const sorted = [...rows].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  const badge: Record<string, string> = {
    OK: "badge-ok",
    LOW: "bg-amber-50 text-amber-700",
    NEAR_EXPIRY: "bg-orange-50 text-orange-700",
    EXPIRED: "bg-red-50 text-red-700",
    OUT: "bg-slate-100 text-slate-600",
  };
  const statusText: Record<string, string> = {
    OK: t("ok"),
    LOW: t("low"),
    NEAR_EXPIRY: t("near"),
    EXPIRED: t("expired"),
    OUT: t("out"),
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t("inventory")} help={t("inventoryHelp")} />
      {message && <div className="note">{message}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("brand")}</th>
              <th className="p-3">{t("batch")}</th>
              <th className="p-3">{t("expiry")}</th>
              <th className="p-3">{t("quantity")}</th>
              <th className="p-3">{t("cost")}</th>
              <th className="p-3">{t("status")}</th>
              <th className="p-3">{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <Cell title={t("brand")}>
                  <div className="font-bold">{row.medicine.brandName}</div>
                  <div className="muted">{row.medicine.genericName}</div>
                </Cell>
                <Cell title={t("batch")}>{row.batchNo}</Cell>
                <Cell title={t("expiry")}>
                  <DualDate value={row.expiryDate} withTime={false} />
                  <div className="text-xs muted">{t("daysLeft")}: {row.daysLeft}</div>
                </Cell>
                <Cell title={t("quantity")}><span className="font-bold">{row.quantity}</span></Cell>
                <Cell title={t("cost")}><Money value={row.costPrice} /></Cell>
                <Cell title={t("status")}>
                  <span className={`badge ${badge[row.status]}`}>{statusText[row.status] || row.status}</span>
                </Cell>
                <Cell title={t("action")}>
                  <button className="btn btn-small btn-edit" onClick={() => setAdjust(row)}>{t("adjust")}</button>
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjust && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="card p-6 w-full max-w-md space-y-3">
            <div className="font-extrabold">{t("adjust")}: {adjust.medicine.brandName}</div>
            <Field title={t("adjustQty")}>
              <input className="field" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </Field>
            <Field title={t("reason")}>
              <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Damage">{t("damage")}</option>
                <option value="Expiry write-off">{t("expiryWriteOff")}</option>
                <option value="Count correction">{t("countCorrection")}</option>
                <option value="Opening stock">{t("openingStock")}</option>
              </select>
            </Field>
            <Field title={t("note")}>
              <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setAdjust(null)}>{t("cancel")}</button>
              <button className="btn btn-primary" onClick={saveAdjust}>{t("saveAdjust")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
