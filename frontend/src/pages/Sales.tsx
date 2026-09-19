import { useEffect, useMemo, useState } from "react";
import { BillReceipt, printTicket } from "../components/BillReceipt";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Cell, DualDate, Field, Money, PageHeader } from "../ui";

export function Sales() {
  const { t } = useI18n();
  const [sales, setSales] = useState<any[]>([]);
  const [view, setView] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [ret, setRet] = useState<any>(null);
  const [addQ, setAddQ] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [printSale, setPrintSale] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await api.get("/sales");
    setSales(data);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = addQ.trim();
    if (!q || !edit) {
      setMatches([]);
      return;
    }
    const id = window.setTimeout(() => {
      api.get("/catalog/medicines", { params: { q, lite: 1 } }).then((res) => {
        setMatches(res.data.filter((m: any) => !edit.items.some((line: any) => line.medicineId === m.id)).slice(0, 8));
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [addQ, edit]);

  useEffect(() => {
    if (!printSale) return;
    const id = window.setTimeout(() => printTicket(), 80);
    return () => window.clearTimeout(id);
  }, [printSale]);

  function statusLabel(status: string) {
    if (status === "COMPLETED") return t("completed");
    if (status === "PARTIAL_RETURN") return t("partial");
    return t("returned");
  }

  function canEdit(sale: any) {
    return sale?.status === "COMPLETED";
  }

  function canReturn(sale: any) {
    return sale?.status === "COMPLETED" || sale?.status === "PARTIAL_RETURN";
  }

  async function fullSale(sale: any) {
    const { data } = await api.get(`/sales/${sale.id}`);
    return data;
  }

  async function openView(sale: any) {
    setView(await fullSale(sale));
  }

  function startEdit(sale: any) {
    setEdit({
      id: sale.id,
      discount: Number(sale.discount || 0),
      notes: sale.notes || "",
      items: (sale.items || []).map((item: any) => ({
        saleItemId: item.id,
        medicineId: item.medicineId,
        batchId: item.batchId,
        name: item.medicine?.brandName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        maxQty: item.quantity + (item.batch?.quantity || 0),
      })),
    });
    setAddQ("");
  }

  async function openEdit(sale: any) {
    startEdit(await fullSale(sale));
  }

  function startReturn(sale: any) {
    setRet({
      id: sale.id,
      reason: "",
      lines: (sale.items || []).map((item: any) => ({ ...item, returnQty: "" })),
    });
  }

  async function openReturn(sale: any) {
    startReturn(await fullSale(sale));
  }

  function printFrom(sale: any) {
    setPrintSale({
      invoiceNo: sale.invoiceNo,
      items: (sale.items || []).map((item: any) => ({
        name: item.medicine?.brandName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      paid: Number(sale.paid),
    });
  }

  async function printBill(sale: any) {
    printFrom(sale.items ? sale : await fullSale(sale));
  }

  function setEditQty(line: any, quantity: number) {
    const next = Math.max(0, quantity);
    setEdit((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any) => (item === line ? { ...item, quantity: next } : item)),
    }));
  }

  async function saveEdit() {
    try {
      const items = edit.items.filter((item: any) => Number(item.quantity) > 0);
      if (!items.length) {
        setMessage(t("needReturnQty"));
        return;
      }
      const { data } = await api.patch(`/sales/${edit.id}`, {
        discount: Number(edit.discount || 0),
        notes: edit.notes,
        items: items.map((item: any) => ({
          saleItemId: item.saleItemId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      });
      setEdit(null);
      setView(data);
      setMessage(t("billSaved"));
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function saveReturn() {
    const items = ret.lines
      .map((line: any) => ({ saleItemId: line.id, quantity: Number(line.returnQty) || 0 }))
      .filter((row: { quantity: number }) => row.quantity > 0);
    if (!items.length) {
      setMessage(t("needReturnQty"));
      return;
    }
    try {
      await api.post(`/sales/${ret.id}/return`, { reason: ret.reason || t("returnSome"), items });
      setRet(null);
      const { data } = await api.get(`/sales/${ret.id}`);
      setView(data);
      setMessage(t("returnDone"));
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function returnAll(sale: any) {
    try {
      const full = sale.items ? sale : await fullSale(sale);
      await api.post(`/sales/${full.id}/return`, {
        reason: t("returnAll"),
        items: (full.items || []).map((item: any) => ({ saleItemId: item.id, quantity: item.quantity })),
      });
      setView(null);
      setRet(null);
      setMessage(t("returnDone"));
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  const editTotal = useMemo(() => {
    if (!edit) return 0;
    const sub = edit.items.reduce((sum: number, line: any) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    return Math.max(sub - Number(edit.discount || 0), 0);
  }, [edit]);

  function actionButtons(sale: any, compact = false) {
    return (
      <div className="flex flex-wrap gap-1">
        {compact && <button className="btn btn-small btn-view" onClick={() => openView(sale)}>{t("view")}</button>}
        <button className="btn btn-small btn-print" onClick={() => printBill(sale)}>{t("print")}</button>
        {canEdit(sale) && (
          <button className="btn btn-small btn-edit" onClick={() => openEdit(sale)}>{t("editBill")}</button>
        )}
        {canReturn(sale) && (
          <button className="btn btn-small btn-view" onClick={() => openReturn(sale)}>{t("returnBill")}</button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("sales")} help={t("salesHelp")} />
      {message && <div className="note">{message}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("invoice")}</th>
              <th className="p-3">{t("customer")}</th>
              <th className="p-3">{t("total")}</th>
              <th className="p-3">{t("pay")}</th>
              <th className="p-3">{t("status")}</th>
              <th className="p-3">{t("by")}</th>
              <th className="p-3">{t("date")}</th>
              <th className="p-3">{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-[var(--line)]">
                <Cell title={t("invoice")}><span className="font-bold">{s.invoiceNo}</span></Cell>
                <Cell title={t("customer")}>{s.customer?.name || t("walkIn")}</Cell>
                <Cell title={t("total")}><Money value={s.total} /></Cell>
                <Cell title={t("pay")}>{s.paymentMethod === "CREDIT" ? t("credit") : s.paymentMethod === "CASH" ? t("cash") : s.paymentMethod === "CARD" ? t("card") : s.paymentMethod === "WALLET" ? t("wallet") : s.paymentMethod}</Cell>
                <Cell title={t("status")}>
                  <span className={`badge ${s.status === "COMPLETED" ? "badge-ok" : "badge-warn"}`}>{statusLabel(s.status)}</span>
                </Cell>
                <Cell title={t("by")}>{s.createdBy.name}</Cell>
                <Cell title={t("date")}><DualDate value={s.createdAt} /></Cell>
                <Cell title={t("action")}>{actionButtons(s, true)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-extrabold">{view.invoiceNo}</div>
                <div className="muted">{view.customer?.name || t("walkIn")}</div>
              </div>
              <button className="btn btn-small btn-ghost" onClick={() => setView(null)}>{t("close")}</button>
            </div>
            <DualDate value={view.createdAt} />
            {(view.items || []).map((item: any) => (
              <div className="bill-item-card" key={item.id}>
                <b>{item.medicine?.brandName}</b>
                <div className="bill-item-cols">
                  <div className="bill-col"><span>{t("quantity")}</span><strong>{item.quantity}</strong></div>
                  <div className="bill-col"><span>{t("price")}</span><strong><Money value={item.unitPrice} /></strong></div>
                  <div className="bill-col"><span>{t("batch")}</span><strong>{item.batch?.batchNo}</strong></div>
                  <div className="bill-col"><span>{t("lineTotal")}</span><strong><Money value={item.lineTotal} /></strong></div>
                </div>
              </div>
            ))}
            <p>
              {t("subtotal")} <Money value={view.subtotal} /> · {t("discount")} <Money value={view.discount} /> · {t("taxName")} <Money value={view.tax} /> · {t("total")} <Money value={view.total} />
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-small btn-print" onClick={() => printFrom(view)}>{t("print")}</button>
              {canEdit(view) && (
                <button className="btn btn-small btn-edit" onClick={() => startEdit(view)}>{t("editBill")}</button>
              )}
              {canReturn(view) && (
                <>
                  <button className="btn btn-small btn-view" onClick={() => startReturn(view)}>{t("returnSome")}</button>
                  <button className="btn btn-small btn-danger" onClick={() => returnAll(view)}>{t("returnAll")}</button>
                </>
              )}
              <button className="btn btn-small btn-ghost" onClick={() => setView(null)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-auto">
            <div className="text-xl font-extrabold">{t("editBill")}</div>
            {edit.items.map((line: any) => (
              <div className="bill-item-card" key={line.saleItemId || line.medicineId}>
                <div className="flex justify-between gap-2">
                  <b>{line.name}</b>
                  <button className="btn btn-small btn-danger" onClick={() => setEdit((prev: any) => ({ ...prev, items: prev.items.filter((i: any) => i !== line) }))}>{t("remove")}</button>
                </div>
                <div className="bill-item-cols">
                  <Field title={t("quantity")}>
                    <div className="qty-row">
                      <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditQty(line, Number(line.quantity) - 1)}>-</button>
                      <input className="field" type="number" min={0} value={line.quantity} onChange={(e) => setEditQty(line, Number(e.target.value))} />
                      <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditQty(line, Number(line.quantity) + 1)}>+</button>
                    </div>
                  </Field>
                  <Field title={t("price")}>
                    <input className="field" type="number" min={0} value={line.unitPrice} onChange={(e) => setEdit((prev: any) => ({ ...prev, items: prev.items.map((i: any) => i === line ? { ...i, unitPrice: Number(e.target.value) } : i) }))} />
                  </Field>
                  <div className="bill-col">
                    <span>{t("lineTotal")}</span>
                    <strong><Money value={Number(line.quantity) * Number(line.unitPrice)} /></strong>
                  </div>
                </div>
              </div>
            ))}
            <Field title={t("searchAdd")}>
              <input className="field" value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder={`${t("barcode")} / ${t("generic")} / ${t("brand")}`} />
            </Field>
            {addQ.trim() ? (
              <div className="space-y-2">
                {matches.length ? matches.map((m) => (
                  <button key={m.id} className="btn btn-ghost w-full justify-start" type="button" onClick={() => {
                    setEdit((prev: any) => ({
                      ...prev,
                      items: [...prev.items, {
                        medicineId: m.id,
                        batchId: m.batches?.[0]?.id,
                        name: m.brandName,
                        quantity: 1,
                        unitPrice: Number(m.salePrice),
                      }],
                    }));
                    setAddQ("");
                  }}>
                    {m.brandName} · {m.genericName} · <Money value={m.salePrice} />
                  </button>
                )) : <div className="muted">{t("noAdd")}</div>}
              </div>
            ) : null}
            <Field title={t("discount")}>
              <input className="field" type="number" value={edit.discount} onChange={(e) => setEdit((prev: any) => ({ ...prev, discount: Number(e.target.value) }))} />
            </Field>
            <p>{t("total")} <Money value={editTotal} /></p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>{t("cancel")}</button>
              <button className="btn btn-primary" onClick={saveEdit}>{t("save")}</button>
            </div>
          </div>
        </div>
      )}

      {ret && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-auto">
            <div className="text-xl font-extrabold">{t("returnSome")}</div>
            <p className="muted">{t("returnHelp")}</p>
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="p-3">{t("brand")}</th>
                  <th className="p-3">{t("quantity")}</th>
                  <th className="p-3">{t("returnQty")}</th>
                  <th className="p-3">{t("price")}</th>
                </tr>
              </thead>
              <tbody>
                {ret.lines.map((line: any) => (
                  <tr key={line.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="p-3 font-bold">{line.medicine?.brandName}</td>
                    <td className="p-3">{line.quantity}</td>
                    <td className="p-3">
                      <div className="qty-row">
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => {
                          const n = Math.max(0, (Number(line.returnQty) || 0) - 1);
                          setRet((prev: any) => ({
                            ...prev,
                            lines: prev.lines.map((row: any) => row.id === line.id ? { ...row, returnQty: n || "" } : row),
                          }));
                        }}>-</button>
                        <input className="field" type="number" min={0} max={line.quantity} value={line.returnQty} onChange={(e) => {
                          const n = Math.min(line.quantity, Math.max(0, Number(e.target.value) || 0));
                          setRet((prev: any) => ({
                            ...prev,
                            lines: prev.lines.map((row: any) => row.id === line.id ? { ...row, returnQty: e.target.value === "" ? "" : n } : row),
                          }));
                        }} />
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => {
                          const n = Math.min(line.quantity, (Number(line.returnQty) || 0) + 1);
                          setRet((prev: any) => ({
                            ...prev,
                            lines: prev.lines.map((row: any) => row.id === line.id ? { ...row, returnQty: n } : row),
                          }));
                        }}>+</button>
                      </div>
                    </td>
                    <td className="p-3"><Money value={line.unitPrice} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Field title={t("reason")}>
              <input className="field" value={ret.reason} onChange={(e) => setRet((prev: any) => ({ ...prev, reason: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setRet(null)}>{t("cancel")}</button>
              <button className="btn btn-danger" onClick={() => returnAll({ id: ret.id, items: ret.lines })}>{t("returnAll")}</button>
              <button className="btn btn-primary" onClick={saveReturn}>{t("returnSome")}</button>
            </div>
          </div>
        </div>
      )}
      <BillReceipt sale={printSale} />
    </div>
  );
}
