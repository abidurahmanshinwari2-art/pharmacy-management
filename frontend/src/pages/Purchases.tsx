import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { formatShamsi, parseLocalDate } from "../dates";
import { useI18n } from "../i18n";
import { Cell, DualDate, Field, Money, PageHeader } from "../ui";

type Supplier = { id: string; name: string };
type Medicine = { id: string; brandName: string; genericName: string; purchasePrice: number };
type Line = { medicineId: string; batchNo: string; expiryDate: string; quantity: number; costPrice: number };

export function Purchases() {
  const { t, lang } = useI18n();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { medicineId: "", batchNo: "", expiryDate: "", quantity: 1, costPrice: 0 },
  ]);
  const [error, setError] = useState("");
  const [medSearch, setMedSearch] = useState("");

  async function load() {
    const [p, s, m] = await Promise.all([
      api.get("/purchases"),
      api.get("/suppliers"),
      api.get("/catalog/medicines", { params: { lite: 1 } }),
    ]);
    setPurchases(p.data);
    setSuppliers(s.data);
    setMedicines(m.data);
    if (!supplierId && s.data[0]) setSupplierId(s.data[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/purchases", { supplierId, notes, items: lines });
      setOpen(false);
      setLines([{ medicineId: "", batchNo: "", expiryDate: "", quantity: 1, costPrice: 0 }]);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("purchases")} help={t("purchasesHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("receiveStock")}</button>} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("invoice")}</th>
              <th className="p-3">{t("supplier")}</th>
              <th className="p-3">{t("items")}</th>
              <th className="p-3">{t("total")}</th>
              <th className="p-3">{t("date")}</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <Cell title={t("invoice")}><span className="font-bold">{p.invoiceNo}</span></Cell>
                <Cell title={t("supplier")}>{p.supplier.name}</Cell>
                <Cell title={t("items")}>{p.items.length}</Cell>
                <Cell title={t("total")}><Money value={p.total} /></Cell>
                <Cell title={t("date")}><DualDate value={p.createdAt} /></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-3xl space-y-3 max-h-[90vh] overflow-auto" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("receivePurchase")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Field title={t("searchMedicine")}>
              <input className="field" value={medSearch} onChange={(e) => setMedSearch(e.target.value)} placeholder={`${t("brand")} / ${t("generic")}`} />
            </Field>
            <Field title={t("supplier")}>
              <select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {lines.map((line, index) => (
              <div key={index} className="grid md:grid-cols-5 gap-2">
                <Field title={t("brand")} className="md:col-span-2">
                  <select className="field" value={line.medicineId} onChange={(e) => {
                    const medicine = medicines.find((m) => m.id === e.target.value);
                    setLines((current) => current.map((item, i) => i === index ? { ...item, medicineId: e.target.value, costPrice: Number(medicine?.purchasePrice || 0) } : item));
                  }}>
                    <option value="">{t("chooseMedicine")}</option>
                    {medicines
                      .filter((m) => {
                        const q = medSearch.trim().toLowerCase();
                        if (!q) return true;
                        return m.brandName.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q);
                      })
                      .map((m) => <option key={m.id} value={m.id}>{m.brandName} · {m.genericName}</option>)}
                  </select>
                </Field>
                <Field title={t("batch")}>
                  <input className="field" value={line.batchNo} onChange={(e) => setLines((c) => c.map((item, i) => i === index ? { ...item, batchNo: e.target.value } : item))} />
                </Field>
                <Field title={`${t("expiry")} (${t("meladi")})`}>
                  <input className="field" type="date" value={line.expiryDate} onChange={(e) => setLines((c) => c.map((item, i) => i === index ? { ...item, expiryDate: e.target.value } : item))} />
                  {line.expiryDate ? (
                    <div className="text-xs mt-1">
                      <span className="font-bold">{t("shamsi")}: </span>
                      {formatShamsi(parseLocalDate(line.expiryDate), lang, false)}
                    </div>
                  ) : null}
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field title={t("quantity")}>
                    <input className="field" type="number" value={line.quantity} onChange={(e) => setLines((c) => c.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} />
                  </Field>
                  <Field title={t("cost")}>
                    <input className="field" type="number" value={line.costPrice} onChange={(e) => setLines((c) => c.map((item, i) => i === index ? { ...item, costPrice: Number(e.target.value) } : item))} />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => setLines((c) => [...c, { medicineId: "", batchNo: "", expiryDate: "", quantity: 1, costPrice: 0 }])}>
              {t("addLine")}
            </button>
            <Field title={t("notes")}>
              <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("receiveAndAdd")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
