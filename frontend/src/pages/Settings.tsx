import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { FONTS, THEMES, useLook } from "../appearance";
import { useI18n, type MessageKey } from "../i18n";
import { useShop, type ShopSettings } from "../shop";
import { Field, Money, PageHeader } from "../ui";

export function Settings() {
  const { t } = useI18n();
  const { reload, setSymbol } = useShop();
  const { theme, setTheme, font, setFont, textSize, setTextSize } = useLook();
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string; address: string }[]>([]);
  const [room, setRoom] = useState<{ id?: string; name: string; address: string } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/settings").then((res) => {
      const data = res.data;
      setForm({
        name: data.name || "",
        tagline: data.tagline || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        licenseNo: data.licenseNo || "",
        taxId: data.taxId || "",
        currency: data.currency || "AFN",
        currencySymbol: data.currencySymbol || localStorage.getItem("pharmacy_money") || "؋",
        taxName: data.taxName || "Tax",
        taxPercent: Number(data.taxPercent || 0),
        invoicePrefix: data.invoicePrefix || "INV",
        purchasePrefix: data.purchasePrefix || "PO",
        receiptFooter: data.receiptFooter || "",
      });
      setRooms(data.locations || []);
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      setSymbol(form.currencySymbol);
      await api.put("/settings", form);
      await reload();
      setMessage(t("settingsSaved"));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function saveRoom() {
    if (!room) return;
    try {
      if (room.id) await api.patch(`/settings/locations/${room.id}`, room);
      else await api.post("/settings/locations", room);
      const { data } = await api.get("/settings/locations");
      setRooms(data);
      setRoom(null);
      setMessage(t("roomSaved"));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  if (!form) return <div>{t("loading")}</div>;

  const themeKeys: Record<string, { name: MessageKey; hint: MessageKey }> = {
    leaf: { name: "themeLeaf", hint: "themeLeafHint" },
    pine: { name: "themePine", hint: "themePineHint" },
    ink: { name: "themeInk", hint: "themeInkHint" },
    ruby: { name: "themeRuby", hint: "themeRubyHint" },
    teal: { name: "themeTeal", hint: "themeTealHint" },
    stone: { name: "themeStone", hint: "themeStoneHint" },
  };
  const fontKeys: Record<string, { name: MessageKey; hint: MessageKey }> = {
    shop: { name: "fontShop", hint: "fontShopHint" },
    clear: { name: "fontClear", hint: "fontClearHint" },
    naskh: { name: "fontNaskh", hint: "fontNaskhHint" },
    simple: { name: "fontSimple", hint: "fontSimpleHint" },
  };

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <PageHeader title={t("settings")} help={t("settingsHelp")} action={<button className="btn btn-primary">{t("saveSettings")}</button>} />
      {message && <div className="note">{message}</div>}

      <div className="card p-6">
        <h3 className="text-lg font-extrabold">{t("look")}</h3>
        <p className="text-sm muted mb-4">{t("lookHint")}</p>
        <div className="theme-grid">
          {THEMES.map((item) => (
            <button key={item.id} type="button" className={`theme-card ${theme === item.id ? "active" : ""}`} onClick={() => setTheme(item.id)}>
              <div className="theme-swatches">
                {item.colors.map((color) => <i key={color} style={{ background: color }} />)}
              </div>
              <b>{t(themeKeys[item.id].name)}</b>
              <div className="text-xs mt-1">{t(themeKeys[item.id].hint)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-extrabold">{t("font")}</h3>
        <p className="text-sm muted mb-4">{t("fontHint")}</p>
        <div className="theme-grid">
          {FONTS.map((item) => (
            <button key={item.id} type="button" className={`theme-card ${font === item.id ? "active" : ""}`} onClick={() => setFont(item.id)}>
              <b>{t(fontKeys[item.id].name)}</b>
              <div className="text-xs mt-1">{t(fontKeys[item.id].hint)}</div>
            </button>
          ))}
        </div>
        <div className="size-row mt-4">
          <button type="button" className="btn btn-ghost" disabled={textSize <= 10} onClick={() => setTextSize(textSize - 1)}>−</button>
          <input type="range" min={10} max={16} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} />
          <button type="button" className="btn btn-ghost" disabled={textSize >= 16} onClick={() => setTextSize(textSize + 1)}>+</button>
          <span className="font-bold">{t("fontSize")}: {textSize}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-6 grid md:grid-cols-2 gap-3">
          <h3 className="text-lg font-extrabold md:col-span-2">{t("shopInfo")}</h3>
          <Field title={t("shopTitle")} className="md:col-span-2"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field title={t("tagline")} className="md:col-span-2"><input className="field" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
          <Field title={t("address")} className="md:col-span-2"><input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field title={t("phone")}><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field title={t("email")}><input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field title={t("licenseNo")}><input className="field" value={form.licenseNo} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} /></Field>
          <Field title={t("taxId")}><input className="field" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></Field>
          <Field title={t("receiptFooter")} className="md:col-span-2">
            <textarea className="field" rows={3} value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} />
          </Field>
        </div>
        <div className="card p-6 grid md:grid-cols-2 gap-3">
          <h3 className="text-lg font-extrabold md:col-span-2">{t("moneyTax")}</h3>
          <Field title={t("currencySymbol")}><input className="field" value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })} /></Field>
          <Field title={t("currencyCode")}><input className="field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          <Field title={t("taxName")}><input className="field" value={form.taxName} onChange={(e) => setForm({ ...form, taxName: e.target.value })} /></Field>
          <Field title={t("taxPercent")}><input className="field" type="number" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })} /></Field>
          <Field title={t("invoicePrefix")}><input className="field" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} /></Field>
          <Field title={t("purchasePrefix")}><input className="field" value={form.purchasePrefix} onChange={(e) => setForm({ ...form, purchasePrefix: e.target.value })} /></Field>
          <p className="md:col-span-2 text-sm muted">{t("taxHint")} · <Money value={1234.5} symbol={form.currencySymbol || "؋"} /></p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold">{t("rooms")}</h3>
          <button type="button" className="btn btn-ghost" onClick={() => setRoom({ name: "", address: "" })}>{t("addRoom")}</button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {rooms.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--line)] p-3">
              <div className="font-bold">{item.name}</div>
              <div className="text-sm muted">{item.address || "-"}</div>
              <button type="button" className="btn btn-small btn-edit mt-2" onClick={() => setRoom(item)}>{t("edit")}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-6 space-y-3">
          <h3 className="text-lg font-extrabold">{t("backupBox")}</h3>
          <p className="text-sm muted">{t("backupHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-print" onClick={async () => {
              try {
                const { data } = await api.post("/backup/save");
                if (data.pack) {
                  const blob = new Blob([JSON.stringify(data.pack, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = data.fileName || "pharmacy-backup.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }
                setMessage(data.message || t("backupSaved"));
              } catch (error) {
                setMessage(errorMessage(error));
              }
            }}>{t("saveBackup")}</button>
            <label className="btn btn-edit">
              {t("loadBackup")}
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const pack = JSON.parse(await file.text());
                    const { data } = await api.post("/backup/restore", pack);
                    setMessage(data.message || t("backupLoaded"));
                    await reload();
                  } catch (error) {
                    setMessage(errorMessage(error));
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div className="card p-6 space-y-3">
          <h3 className="text-lg font-extrabold">{t("updateBox")}</h3>
          <p className="text-sm muted">{t("updateHelp")}</p>
          <button type="button" className="btn btn-primary" onClick={async () => {
            try {
              const check = await api.get("/update");
              if (check.data.note === "offline" || check.data.note === "no-repo") {
                setMessage(t("updateOffline"));
              }
              const { data } = await api.post("/update/apply");
              setMessage(data.message || t("updateOk"));
            } catch (error) {
              setMessage(errorMessage(error));
            }
          }}>{t("applyUpdate")}</button>
        </div>
      </div>

      {room && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="card p-6 w-full max-w-md space-y-3">
            <div className="font-extrabold">{room.id ? t("editRoom") : t("newRoom")}</div>
            <Field title={t("name")}><input className="field" value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} /></Field>
            <Field title={t("address")}><input className="field" value={room.address} onChange={(e) => setRoom({ ...room, address: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setRoom(null)}>{t("cancel")}</button>
              <button type="button" className="btn btn-primary" onClick={saveRoom}>{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
