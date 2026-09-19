export type Lang = "en" | "ps" | "dari";

const shamsiMonths = {
  en: ["Hamal", "Saur", "Jawza", "Saratan", "Asad", "Sonbola", "Mizan", "Aqrab", "Qaws", "Jadi", "Dalwa", "Hoot"],
  ps: ["وري", "غويي", "غبرګولی", "چنګاښ", "زمری", "وږی", "تله", "لړم", "لیندۍ", "مرغومی", "سلواغه", "کب"],
  dari: ["حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله", "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"],
};

const meladiMonths = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ps: ["جنوري", "فبروري", "مارچ", "اپریل", "می", "جون", "جولای", "اګست", "سپټمبر", "اکتوبر", "نومبر", "ډیسمبر"],
  dari: ["جنوری", "فبروری", "مارچ", "اپریل", "می", "جون", "جولای", "اگست", "سپتمبر", "اکتوبر", "نومبر", "دسمبر"],
};

export function toShamsi(date: Date) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatTime(date: Date, lang: Lang) {
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const am = hours < 12;
  const hour12 = hours % 12 || 12;
  if (lang === "en") {
    return `${hour12}:${minutes}:${seconds} ${am ? "AM" : "PM"}`;
  }
  return `${pad(hours)}:${minutes}:${seconds}`;
}

export function formatMeladi(date: Date, lang: Lang, withTime = true) {
  const text = `${date.getDate()} ${meladiMonths[lang][date.getMonth()]} ${date.getFullYear()}`;
  return withTime ? `${text}  ${formatTime(date, lang)}` : text;
}

export function formatShamsi(date: Date, lang: Lang, withTime = true) {
  const s = toShamsi(date);
  const text = `${s.day} ${shamsiMonths[lang][s.month - 1]} ${s.year}`;
  return withTime ? `${text}  ${formatTime(date, lang)}` : text;
}

export function parseLocalDate(value: string | Date) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function dualDate(value: string | Date, lang: Lang, withTime = true) {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return { meladi: "-", shamsi: "-" };
  return {
    meladi: formatMeladi(date, lang, withTime),
    shamsi: formatShamsi(date, lang, withTime),
  };
}
