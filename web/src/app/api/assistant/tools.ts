/**
 * Tools the assistant may call. Each one is a read-only GET (or the read-only ranking POST)
 * against the portal API, so the assistant sees exactly what a visitor sees on the site,
 * and, when the visitor is signed in, their own applications and notifications.
 * Answers are trimmed to what the model needs (no geometry, rounded numbers).
 */

const API = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

export type ToolContext = { cookie: string | null };

const PURPOSE: Record<string, string> = { CROP: "əkinçilik", LIVESTOCK: "heyvandarlıq", ORCHARD: "bağçılıq", OTHER: "digər" };
const IRRIGATION: Record<string, string> = { NONE: "suvarma yoxdur", CANAL: "kanal", WELL: "artezian quyusu", RIVER: "çay" };
const STATUS: Record<string, string> = {
  DRAFT: "qaralama",
  RECEIVED: "qəbul edilib",
  UNDER_REVIEW: "baxılır",
  INFO_REQUESTED: "əlavə məlumat tələb olunub",
  DECIDED: "qərar verilib",
  WITHDRAWN: "geri götürülüb"
};

class ToolError extends Error {}

async function get(path: string, ctx: ToolContext, init?: RequestInit): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json", ...(init?.headers as Record<string, string>) };
  if (ctx.cookie) headers.Cookie = ctx.cookie;
  const res = await fetch(`${API}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  if (res.status === 401) throw new ToolError("İstifadəçi daxil olmayıb. Ondan portala daxil olmasını xahiş et.");
  if (res.status === 404) throw new ToolError("Tapılmadı.");
  if (!res.ok) throw new ToolError(`Portal API ${res.status} qaytardı.`);
  return res.json();
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const km = (m: unknown) => (n(m) === null ? null : Math.round((n(m) as number) / 100) / 10);

/* eslint-disable @typescript-eslint/no-explicit-any -- API answers are trimmed field by field */
function areaRow(a: any) {
  return {
    code: a.code,
    name: a.name_az,
    rayon: a.rayon_name,
    village: a.village_name,
    area_ha: n(a.area_ha),
    purpose: PURPOSE[a.purpose] ?? a.purpose,
    irrigation: IRRIGATION[a.irrigation] ?? a.irrigation,
    best_class: a.best_fao_class ?? null,
    fee_azn_per_ha_year: n(a.annual_fee_azn_per_ha),
    min_investment_azn: n(a.min_investment_azn),
    demined: a.demining_status === "CLEARED",
    competition: a.competition
      ? { number: a.competition.number, deadline: a.competition.deadline_at?.slice(0, 10), open: a.competition.is_open }
      : null
  };
}

function areaDetail(a: any) {
  return {
    ...areaRow(a),
    url: `/areas/${a.code}`,
    status: a.status,
    soil_type: a.soil_type,
    lease_term_years: a.lease_term_years,
    conditions_of_use: a.conditions_of_use,
    dist_water_km: km(a.dist_water_m),
    dist_road_km: km(a.dist_road_m),
    dist_village_km: km(a.dist_village_m),
    elevation_m: a.elevation_m,
    slope_deg: a.slope_deg,
    demining_certified_on: a.demining_certified_on,
    data_source: a.data_source,
    competition_title: a.competition?.title_az ?? null,
    required_documents: (a.required_documents ?? []).map(
      (d: any) => `${d.name_az}${d.mandatory ? "" : " (könüllü)"}${d.applies_to === "INDIVIDUAL" ? " – fiziki şəxs" : d.applies_to === "COMPANY" ? " – hüquqi şəxs" : ""}`
    ),
    suitability: (a.suitability ?? []).map((s: any) => ({
      activity: PURPOSE[s.activity] ?? s.activity,
      score: s.score,
      class: s.fao_class,
      constraint: s.constraint_reason,
      factors: Object.entries(s.factors ?? {})
        .filter(([k]) => !k.startsWith("_"))
        .map(([, f]: [string, any]) => `${f.label}: ${f.text ?? f.value}${f.unit ? ` ${f.unit}` : ""} (töhfə ${f.contribution})`)
    }))
  };
}

const ACTIVITY = { type: "string", enum: ["CROP", "ORCHARD", "LIVESTOCK", "OTHER"] };

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_areas",
      description:
        "Kataloqda sahə axtarışı (saytdakı Kataloq və Xəritə səhifələrinin süzgəcləri). Bütün sahələri görmək üçün süzgəcsiz çağır.",
      parameters: {
        type: "object",
        properties: {
          purpose: { type: "array", items: ACTIVITY, description: "Təyinat" },
          q: { type: "string", description: "Kod, kənd və ya rayon adı ilə axtarış" },
          rayon: { type: "string", description: "Rayon adı, məsələn Ağdam" },
          region: { type: "string", enum: ["KARABAKH", "EAST_ZANGEZUR"] },
          min_ha: { type: "number" },
          max_ha: { type: "number" },
          inv_max: { type: "number", description: "Minimum investisiya ən çox, AZN" },
          inv_min: { type: "number" },
          fee_max: { type: "number", description: "İllik icarə ən çox, AZN/ha" },
          open_only: { type: "boolean", description: "Yalnız müraciəti açıq olanlar" },
          sort: { type: "string", enum: ["deadline", "area_desc", "area_asc", "fee_asc", "investment_asc", "suitability"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_area",
      description: "Bir sahənin səhifəsindəki bütün məlumat: şərtlər, məsafələr, torpaq, minatəmizləmə, tələb olunan sənədlər, hər fəaliyyət üzrə uyğunluq balı və amilləri.",
      parameters: { type: "object", properties: { code: { type: "string", description: "Sahə kodu, məsələn CAB-0001" } }, required: ["code"] }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_areas",
      description:
        "2–3 sahəni yan-yana müqayisə edir (saytdakı Müqayisə səhifəsi): hər sahənin tam məlumatı və seçilmiş fəaliyyət üçün TOPSIS sıralaması (uyğunluq, icarə, investisiya, suya və yola məsafə). Müqayisə istənəndə həmişə bunu çağır.",
      parameters: {
        type: "object",
        properties: {
          codes: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
          activity: { ...ACTIVITY, description: "Hansı fəaliyyət üçün sıralamaq; bilinmirsə sahələrin təyinatı" },
          preset: {
            type: "string",
            enum: ["balanced", "suitability", "cost", "access"],
            description: "Çəkilər: balanslı, uyğunluq önəmli, xərc önəmli, əlçatanlıq önəmli"
          }
        },
        required: ["codes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_competitions",
      description: "Bütün dərc olunmuş müsabiqələr (açıq olanlar əvvəldə): nömrə, ad, açılış və son tarix, sahə sayı.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_competition",
      description: "Bir müsabiqənin şərtləri, lotları (sahələri) və tələb olunan sənədləri.",
      parameters: { type: "object", properties: { number: { type: "string", description: "Məsələn MS-2026-002" } }, required: ["number"] }
    }
  },
  {
    type: "function",
    function: {
      name: "portal_stats",
      description: "Şəffaflıq səhifəsinin rəqəmləri: açıq müsabiqələr, təklif olunan sahə və hektar, müraciətlər, qərarlar, planlaşdırılan investisiya və iş yerləri, rayonlar üzrə bölgü.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "my_applications",
      description: "Daxil olmuş istifadəçinin öz müraciətləri və statusları. Yalnız istifadəçi öz müraciətləri barədə soruşanda çağır.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "my_notifications",
      description: "Daxil olmuş istifadəçinin son bildirişləri.",
      parameters: { type: "object", properties: {} }
    }
  }
] as const;

type Args = Record<string, any>;

const handlers: Record<string, (args: Args, ctx: ToolContext) => Promise<unknown>> = {
  async search_areas(args, ctx) {
    const apiSort = ["deadline", "area_desc", "area_asc"].includes(args.sort) ? args.sort : "deadline";
    const p = new URLSearchParams({ size: "200", sort: apiSort });
    for (const v of args.purpose ?? []) p.append("purpose", v);
    for (const k of ["q", "region", "min_ha", "max_ha", "inv_min", "inv_max", "fee_max"]) {
      if (args[k] !== undefined && args[k] !== null && args[k] !== "") p.set(k, String(args[k]));
    }
    if (args.open_only) p.set("open_only", "true");
    let rows = ((await get(`/areas?${p}`, ctx)) as any).items.map(areaRow);
    if (args.rayon) {
      const want = String(args.rayon).toLocaleLowerCase("az");
      rows = rows.filter((r: any) => r.rayon.toLocaleLowerCase("az").includes(want));
    }
    // The API sorts by deadline and size only; cheaper and more suitable plots are sorted here.
    const last = (v: number | null) => (v === null ? Infinity : v);
    const rank: Record<string, number> = { S1: 1, S2: 2, S3: 3, N: 4 };
    if (args.sort === "fee_asc") rows.sort((a: any, b: any) => last(a.fee_azn_per_ha_year) - last(b.fee_azn_per_ha_year));
    if (args.sort === "investment_asc") rows.sort((a: any, b: any) => last(a.min_investment_azn) - last(b.min_investment_azn));
    if (args.sort === "suitability") rows.sort((a: any, b: any) => (rank[a.best_class] ?? 5) - (rank[b.best_class] ?? 5));
    return { total: rows.length, areas: rows };
  },

  async get_area(args, ctx) {
    return areaDetail(await get(`/areas/${encodeURIComponent(String(args.code).toUpperCase())}`, ctx));
  },

  async compare_areas(args, ctx) {
    const codes = [...new Set((args.codes ?? []).map((c: string) => String(c).trim().toUpperCase()))].slice(0, 3) as string[];
    if (codes.length < 2) throw new ToolError("Müqayisə üçün ən az 2 sahə kodu lazımdır.");
    // Factor breakdowns stay on get_area; side by side, the scores and classes are enough.
    const areas = ((await get(`/areas/compare?codes=${codes.join(",")}`, ctx)) as any[]).map((a) => {
      const d = areaDetail(a);
      return { ...d, required_documents: undefined, suitability: d.suitability.map(({ factors: _f, ...s }: any) => s) };
    });
    const activity = args.activity ?? (await get(`/areas/${codes[0]}`, ctx) as any).purpose;
    let ranking: unknown = null;
    try {
      const r = (await get("/areas/compare/rank", ctx, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, activity, preset: args.preset ?? "balanced" })
      })) as any;
      ranking = {
        method: r.method,
        activity: PURPOSE[r.activity] ?? r.activity,
        weights: r.weights,
        order: r.ranking.map((x: any) => ({ code: x.code, rank: x.rank, closeness: x.closeness, excluded: x.excluded_reason })),
        criteria: r.criteria.map((c: any) => ({
          label: c.label,
          values: Object.fromEntries(Object.entries(c.values).map(([code, v]: [string, any]) => [code, `${v.display}${v.best ? " (ən yaxşı)" : ""}`]))
        })),
        explanation: r.explanation,
        stable: r.stable,
        note: r.note
      };
    } catch {
      // ranking is a bonus; the side-by-side data is still useful without it
    }
    return { compare_page: `/compare?codes=${codes.join(",")}`, areas, ranking };
  },

  async list_competitions(_args, ctx) {
    return ((await get("/competitions", ctx)) as any[]).map((c) => ({
      number: c.number,
      title: c.title_az,
      description: c.description_az,
      opens: c.opens_at?.slice(0, 10),
      deadline: c.deadline_at?.slice(0, 10),
      open: c.is_open,
      areas: c.area_count,
      total_ha: n(c.total_ha),
      url: `/competitions/${c.number}`
    }));
  },

  async get_competition(args, ctx) {
    const c = (await get(`/competitions/${encodeURIComponent(String(args.number).toUpperCase())}`, ctx)) as any;
    return {
      number: c.number,
      title: c.title_az,
      description: c.description_az,
      conditions: c.conditions_az,
      opens: c.opens_at?.slice(0, 10),
      deadline: c.deadline_at?.slice(0, 10),
      open: c.is_open,
      lots: (c.lots ?? []).map((l: any) => ({
        lot: l.lot_no,
        code: l.code,
        name: l.name_az,
        rayon: l.rayon_name,
        area_ha: n(l.area_ha),
        purpose: PURPOSE[l.purpose] ?? l.purpose,
        min_investment_azn: n(l.min_investment_azn)
      })),
      required_documents: (c.required_documents ?? []).map((d: any) => d.name_az ?? d),
      url: `/competitions/${c.number}`
    };
  },

  async portal_stats(_args, ctx) {
    return get("/stats/public", ctx);
  },

  async my_applications(_args, ctx) {
    if (!ctx.cookie) throw new ToolError("İstifadəçi daxil olmayıb. Ondan portala daxil olmasını xahiş et.");
    return ((await get("/applications", ctx)) as any[]).map((a) => ({
      number: a.number,
      status: STATUS[a.status] ?? a.status,
      outcome: a.outcome,
      area: `${a.area_code} ${a.area_name} (${a.rayon_name})`,
      competition: a.competition_number,
      deadline: a.deadline_at?.slice(0, 10),
      submitted: a.submitted_at?.slice(0, 10),
      last_change: a.last_status_at?.slice(0, 10),
      investment_azn: n(a.investment_azn),
      jobs_planned: a.jobs_planned,
      url: `/cabinet/applications/${a.id}`
    }));
  },

  async my_notifications(_args, ctx) {
    if (!ctx.cookie) throw new ToolError("İstifadəçi daxil olmayıb. Ondan portala daxil olmasını xahiş et.");
    const body = (await get("/notifications", ctx)) as any;
    return (body.items ?? body).slice(0, 15);
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Status line the visitor sees while a tool runs. */
export function toolStatus(name: string, args: Args): string {
  switch (name) {
    case "search_areas":
      return "Kataloqda axtarıram…";
    case "get_area":
      return `${String(args.code ?? "").toUpperCase()} sahəsinə baxıram…`;
    case "compare_areas":
      return `${(args.codes ?? []).join(", ")} müqayisə edirəm…`;
    case "list_competitions":
    case "get_competition":
      return "Müsabiqələrə baxıram…";
    case "portal_stats":
      return "Statistikaya baxıram…";
    default:
      return "Kabinetinizə baxıram…";
  }
}

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<string> {
  const handler = handlers[name];
  if (!handler) return JSON.stringify({ error: `Naməlum alət: ${name}` });
  let args: Args;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "Arqumentlər JSON deyil." });
  }
  try {
    return JSON.stringify(await handler(args, ctx));
  } catch (e) {
    const message = e instanceof ToolError ? e.message : "Məlumat alınmadı, bir az sonra yenidən cəhd et.";
    if (!(e instanceof ToolError)) console.error("assistant tool", name, e);
    return JSON.stringify({ error: message });
  }
}

export function parseArgs(raw: string): Args {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
