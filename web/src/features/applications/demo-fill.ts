/**
 * Presentation mode for the application wizard: no step blocks on a missing or invalid field.
 * What the applicant left out is completed with clearly labelled demo values (and a one-page
 * sample PDF for each mandatory document) when they move on or submit, so the whole flow can
 * be shown in a few minutes. The portal is a prototype; these values are marked as demo data.
 */

import type { BusinessPlanInput, ProfileInput } from "./api";

const FIN = /^[A-Z0-9]{7}$/;
const VOEN = /^\d{10}$/;
const PHONE = /^\+?[0-9 ()-]{9,20}$/;
const PASSPORT = /^[A-Z0-9]{5,20}$/;

/** Profile with every missing or invalid identity field replaced by a demo value. */
export function completeProfile(p: ProfileInput, user?: { full_name?: string; email?: string } | null): ProfileInput {
  const company = p.type === "COMPANY";
  const foreign = p.citizenship === "FOREIGN";
  const fin = (p.fin ?? "").trim().toUpperCase();
  const voen = (p.voen ?? "").trim();
  const passport = (p.passport_no ?? "").replace(/\s/g, "").toUpperCase();
  const name = (p.full_name ?? "").trim();
  return {
    ...p,
    full_name: name.length >= 3 ? name : user?.full_name && user.full_name.length >= 3 ? user.full_name : "Nümayiş İstifadəçisi",
    email: p.email?.includes("@") ? p.email : user?.email ?? "demo@agro-invest.az",
    phone: PHONE.test((p.phone ?? "").trim()) ? p.phone.trim() : "+994 50 123 45 67",
    fin: company || foreign ? null : FIN.test(fin) ? fin : "5ABC123",
    passport_no: !company && foreign ? (PASSPORT.test(passport) ? passport : "C01X00T47") : null,
    citizenship_country: !company && foreign ? p.citizenship_country?.trim() || "Türkiyə" : null,
    voen: company ? (VOEN.test(voen) ? voen : "1700123456") : VOEN.test(voen) ? voen : null,
    company_name: company ? p.company_name?.trim() || "Nümayiş Aqro MMC" : null,
    legal_form: company ? p.legal_form || "MMC" : null
  };
}

const LIMITS: Partial<Record<keyof BusinessPlanInput, [number, number, boolean]>> = {
  // [min, max, integer]
  investment_azn: [0, 1_000_000_000, false],
  own_funds_pct: [0, 100, false],
  jobs_planned: [0, 100_000, true],
  jobs_local: [0, 100_000, true],
  implementation_months: [1, 240, true],
  experience_years: [0, 80, true]
};

/** Form strings to what the API accepts; a value it would reject becomes empty, never an error. */
export function cleanPlan(form: Record<keyof BusinessPlanInput, string>): BusinessPlanInput {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(form) as [keyof BusinessPlanInput, string][]) {
    const v = raw.trim();
    const limit = LIMITS[key];
    if (!v) out[key] = null;
    else if (!limit) out[key] = v.slice(0, 3000);
    else {
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      const ok = Number.isFinite(n) && n >= limit[0] && n <= limit[1] && (!limit[2] || Number.isInteger(n));
      out[key] = ok ? (limit[2] ? n : String(n)) : null;
    }
  }
  return out as BusinessPlanInput;
}

/** Fills the business-plan fields the API requires, keeping everything the applicant entered. */
export function completePlan(plan: Partial<Record<keyof BusinessPlanInput, unknown>>, minInvestment: number | null): BusinessPlanInput {
  const has = (k: keyof BusinessPlanInput) => plan[k] !== null && plan[k] !== undefined && plan[k] !== "";
  return {
    ...(plan as BusinessPlanInput),
    investment_azn: has("investment_azn") ? (plan.investment_azn as string) : String(Math.max(minInvestment ?? 0, 100_000)),
    jobs_planned: has("jobs_planned") ? (plan.jobs_planned as number) : 10,
    implementation_months: has("implementation_months") ? (plan.implementation_months as number) : 12,
    summary: has("summary")
      ? (plan.summary as string)
      : "Nümayiş məlumatı: sahədə müasir texnologiya və damcı suvarma ilə kənd təsərrüfatı istehsalı, yerli sakinlərin işə cəlb edilməsi."
  };
}

const LATIN: Record<string, string> = { ə: "e", Ə: "E", ş: "s", Ş: "S", ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ü: "u", Ü: "U" };
const ascii = (t: string) => t.replace(/[əƏşŞçÇğĞıİöÖüÜ]/g, (c) => LATIN[c]).replace(/[^\x20-\x7E]/g, "");

/** A tiny valid PDF for a document slot the applicant left empty. */
export function samplePdf(name: string): File {
  const text = `Agro Invest - numayis senedi: ${ascii(name)}`;
  const stream = `BT /F1 14 Tf 72 760 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([pdf], `numayis-${ascii(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sened"}.pdf`, { type: "application/pdf" });
}
