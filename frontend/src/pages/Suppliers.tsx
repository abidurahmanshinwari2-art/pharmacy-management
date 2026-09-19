import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Field, InfoBit, PageHeader } from "../ui";

export function Suppliers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", paymentTerms: "Net 15" });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/suppliers");
    setRows(data);
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/suppliers", form);
      setOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", paymentTerms: "Net 15" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("suppliers")} help={t("suppliersHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("addSupplier")}</button>} />
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((s) => (
          <div key={s.id} className="card p-5 grid grid-cols-2 gap-3">
            <InfoBit title={t("name")}>{s.name}</InfoBit>
            <InfoBit title={t("phone")}>{s.phone || t("noPhone")}</InfoBit>
            <InfoBit title={t("paymentTerms")}>{s.paymentTerms || t("payTimeNone")}</InfoBit>
            <InfoBit title={t("purchaseCount")}>{s._count.purchases}</InfoBit>
            <div className="col-span-2">
              <InfoBit title={t("address")}>{s.address || "-"}</InfoBit>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-lg space-y-3" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("newSupplier")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Field title={t("name")}><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field title={t("phone")}><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field title={t("email")}><input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field title={t("address")}><input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field title={t("paymentTerms")}>
              <input className="field" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
              <p className="text-xs muted mt-1">{t("payTimeHint")}</p>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("save")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
