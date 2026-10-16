// Development-only stand-in for the portal API, for working on the UI without
// Docker/PostGIS. It serves the same routes and shapes as the FastAPI app from
// the seed files, keeps state in memory and resets on restart.
//
//   node mock-api/server.mjs          (listens on :8000, where next.config proxies /api)
//
// Demo password for every account: Demo2026!

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seed");
const PORT = Number(process.env.MOCK_PORT ?? 8000);
const PASSWORD = "Demo2026!";

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const readCsv = (p) => {
  const [head, ...rows] = readFileSync(join(ROOT, p), "utf8").trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
    return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ""]));
  });
};

// ── Reference data ──────────────────────────────────────────────────────────
const regions = readCsv("reference/regions.csv").map((r) => ({ code: r.code, name_az: r.name_az, name_en: r.name_en }));
const rayons = readCsv("reference/rayons.csv").map((r, i) => ({
  id: i + 1,
  iso_code: r.iso_code,
  name_az: r.name_az,
  name_en: r.name_en,
  region_code: r.region_code
}));
const rayonByIso = Object.fromEntries(rayons.map((r) => [r.iso_code, r]));
const docTypes = readCsv("reference/document_types.csv").map((d) => ({ ...d, max_mb: Number(d.max_mb) }));

const rayonGeo = readJson("geo/rayons.geojson");
const country = readJson("geo/country.geojson");

function bbox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
      maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
    } else c.forEach(walk);
  };
  walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}
const centre = (g) => {
  const [a, b, c, d] = bbox(g);
  return [Number(((a + c) / 2).toFixed(5)), Number(((b + d) / 2).toFixed(5))];
};

const mapContext = (() => {
  const boxes = rayonGeo.features.map((f) => bbox(f.geometry));
  const bounds = [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))
  ];
  const named = rayonGeo.features.map((f, i) => ({
    type: "Feature",
    id: i + 1,
    properties: { name: rayonByIso[f.properties.iso_code]?.name_az ?? f.properties.iso_code },
    geometry: f.geometry
  }));
  // Outside-country mask: a world envelope with the country polygons as holes.
  const env = [[30, 30], [60, 30], [60, 50], [30, 50], [30, 30]];
  const holes = country.features[0].geometry.coordinates.map((poly) => poly[0]);
  return {
    bounds,
    rayons: { type: "FeatureCollection", features: named },
    rayon_labels: {
      type: "FeatureCollection",
      features: named.map((f) => ({ type: "Feature", properties: f.properties, geometry: { type: "Point", coordinates: centre(f.geometry) } }))
    },
    mask: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [env, ...holes] } }
  };
})();

// ── Farm areas ──────────────────────────────────────────────────────────────
const NOUN = { CROP: "əkin sahəsi", ORCHARD: "bağ sahəsi", LIVESTOCK: "otlaq sahəsi", OTHER: "təsərrüfat sahəsi" };
const LEASE = { CROP: 25, ORCHARD: 30, LIVESTOCK: 15, OTHER: 20 };
const FEE = { CROP: 28, ORCHARD: 35, LIVESTOCK: 12, OTHER: 60 };
const IRR = ["CANAL", "WELL", "RIVER", "NONE"];
const SOILS = ["Boz-qəhvəyi torpaq", "Şabalıdı torpaq", "Dağ-çəmən torpağı", "Allüvial torpaq"];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const areas = readJson("geo/farm_areas.geojson").features.map((f, i) => {
  const p = f.properties;
  const h = hash(p.code);
  const rayon = rayonByIso[p.iso_code];
  const demining = h % 11 === 0 ? "IN_PROGRESS" : h % 17 === 0 ? "NOT_SURVEYED" : "CLEARED";
  const ha = Number(p.area_ha);
  const score = (k) => 35 + ((h >>> k) % 60);
  const suit = ["CROP", "ORCHARD", "LIVESTOCK"].map((activity, k) => {
    const s = score(k * 3);
    const cls = s >= 80 ? "S1" : s >= 60 ? "S2" : s >= 45 ? "S3" : "N";
    return {
      activity,
      score: s,
      fao_class: cls,
      constraint_reason: cls === "N" ? "Yamac 15°-dən çoxdur" : null,
      factors: {
        slope: { label: "Yamac", value: (h % 90) / 10, unit: "°", membership: 0.82, weight: 0.25 },
        water: { label: "Su mənbəyinə məsafə", value: ((h >>> 2) % 60) / 10, unit: "km", membership: 0.71, weight: 0.3 },
        soil: { label: "Torpaq münbitliyi", value: 60 + (h % 30), unit: "", membership: 0.77, weight: 0.25 },
        road: { label: "Yola məsafə", value: ((h >>> 4) % 50) / 10, unit: "km", membership: 0.64, weight: 0.2 },
        _cr: 0.04
      }
    };
  });
  const best = suit.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    id: randomUUID(),
    code: p.code,
    name_az: `${p.village_name ?? rayon.name_az} ${NOUN[p.purpose]}`,
    rayon_id: rayon.id,
    rayon_name: rayon.name_az,
    region_code: rayon.region_code,
    village_name: p.village_name ?? null,
    area_ha: ha.toFixed(2),
    purpose: p.purpose,
    status: demining === "CLEARED" ? "AVAILABLE" : "DRAFT",
    irrigation: IRR[h % 4],
    demining_status: demining,
    data_source: p.data_source,
    centroid: centre(f.geometry),
    competition: null,
    best_fao_class: best.fao_class,
    conditions_of_use: `Sahə kənd təsərrüfatı təyinatı üzrə istifadə olunur. İcarə müddəti ${LEASE[p.purpose]} ildir. Sahənin təyinatının dəyişdirilməsi və subicarəyə verilməsi qadağandır.`,
    lease_term_years: LEASE[p.purpose],
    annual_fee_azn_per_ha: String(FEE[p.purpose]),
    soil_type: SOILS[h % 4],
    dist_water_m: 300 + (h % 4000),
    dist_road_m: 200 + ((h >>> 3) % 3000),
    dist_village_m: p.dist_village_m ?? null,
    elevation_m: 200 + (h % 1500),
    slope_deg: ((h % 90) / 10).toFixed(1),
    demining_certified_on: demining === "CLEARED" ? "2025-06-12" : null,
    geometry: f.geometry,
    min_investment_azn: null,
    suitability: suit,
    _index: i
  };
});
const areaByCode = Object.fromEntries(areas.map((a) => [a.code, a]));

// ── Competitions ────────────────────────────────────────────────────────────
const day = 86_400_000;
const now = Date.now();
const iso = (t) => new Date(t).toISOString();
const requiredDocs = docTypes.slice(0, 6).map((d, i) => ({
  code: d.code, name_az: d.name_az, description_az: d.description_az, applies_to: d.applies_to, mandatory: i < 5, max_mb: d.max_mb
}));

const competitions = [
  { number: "MS-2026-001", title_az: "Qarabağ əkin sahələri: taxılçılıq və texniki bitkilər", region: "KARABAKH", purposes: ["CROP"], opens: now - 20 * day, deadline: now + 23 * day },
  { number: "MS-2026-002", title_az: "Bağçılıq və üzümçülük üçün çoxillik əkmə sahələri", region: null, purposes: ["ORCHARD"], opens: now - 10 * day, deadline: now + 5 * day },
  { number: "MS-2026-003", title_az: "Şərqi Zəngəzur: otlaq və heyvandarlıq təsərrüfatları", region: "EAST_ZANGEZUR", purposes: ["LIVESTOCK", "CROP"], opens: now - 40 * day, deadline: now + 41 * day }
].map((c) => {
  const lots = areas
    .filter((a) => a.demining_status === "CLEARED" && c.purposes.includes(a.purpose) && (!c.region || a.region_code === c.region) && !a.competition)
    .slice(0, 14);
  const comp = {
    id: randomUUID(),
    number: c.number,
    title_az: c.title_az,
    description_az: "Kənd təsərrüfatı təyinatlı torpaqların uzunmüddətli icarəyə verilməsi üzrə investisiya müsabiqəsi. Qalib investisiya həcmi, iş yerləri və təcrübə meyarları əsasında müəyyən edilir.",
    conditions_az: "Qalib 30 gün ərzində icarə müqaviləsi bağlamalıdır. İnvestisiya öhdəlikləri illik hesabatla izlənilir. Yerli sahibkarlara və məcburi köçkünlərə əlavə bal verilir.",
    status: "PUBLISHED",
    opens_at: iso(c.opens),
    deadline_at: iso(c.deadline),
    is_open: now >= c.opens && now < c.deadline,
    area_count: lots.length,
    total_ha: lots.reduce((s, a) => s + Number(a.area_ha), 0).toFixed(2),
    lots: [],
    required_documents: requiredDocs.map(({ max_mb, ...d }) => d)
  };
  lots.forEach((a, i) => {
    a.status = "IN_COMPETITION";
    a.min_investment_azn = String(Math.round(Number(a.area_ha) * (a.purpose === "ORCHARD" ? 9000 : 4500) / 1000) * 1000);
    a.competition = { id: comp.id, number: comp.number, title_az: comp.title_az, deadline_at: comp.deadline_at, is_open: comp.is_open };
    comp.lots.push({
      lot_no: i + 1, area_id: a.id, code: a.code, name_az: a.name_az, rayon_name: a.rayon_name,
      area_ha: a.area_ha, purpose: a.purpose, min_investment_azn: a.min_investment_azn
    });
  });
  return comp;
});
const compByNumber = Object.fromEntries(competitions.map((c) => [c.number, c]));

// ── Users, sessions, profiles ───────────────────────────────────────────────
const users = [
  // The first user owns the seeded profile and applications.
  ["investor", "Elvin Məmmədov", "INVESTOR"],
  ["sahibkar", "Rauf Əliyev", "ENTREPRENEUR"],
  ["mutexessis", "Nigar Həsənova", "SPECIALIST"],
  ["rehber", "Tural Qasımov", "SUPERVISOR"],
  ["admin", "Portal Administratoru", "ADMIN"]
].map(([e, full_name, role]) => ({ id: randomUUID(), email: `${e}@agro-demo.test`, full_name, role, password: PASSWORD }));
const sessions = new Map();
const profiles = new Map();
profiles.set(users[0].id, {
  id: randomUUID(), type: "COMPANY", fin: null, voen: "1403567821", full_name: "Elvin Məmmədov",
  company_name: "Araz Aqro MMC", legal_form: "MMC", phone: "+994 50 123 45 67", email: users[0].email,
  address: "Bakı, Nərimanov r., Təbriz küç. 12", is_local: true, origin_rayon_id: rayonByIso["AZ-FUZ"].id, ektis_farmer_id: null
});
// Staff permissions, as in the API (identity/permissions.py).
const PERMISSIONS = [
  ["APPLICATIONS_VIEW", "Müraciətlərə baxmaq", "Müraciətlər, sənədlər və tarixçə"],
  ["APPLICATIONS_DECIDE", "Sənədləri yoxlamaq və qərar vermək", "Baxılmağa götürmək, əlavə məlumat istəmək, qalib və ya imtina"],
  ["IDENTIFIER_REVEAL", "FİN/VÖEN/pasportu tam görmək", "Səbəb göstərilir və audit jurnalına yazılır"],
  ["AREAS_MANAGE", "Sahələri əlavə etmək və redaktə etmək", "Poliqon, şərtlər, status"],
  ["COMPETITIONS_MANAGE", "Müsabiqə hazırlamaq", "Qaralama, lotlar, təsdiqə göndərmək, nəticəni elan etmək"],
  ["COMPETITIONS_APPROVE", "Müsabiqəni təsdiqləmək", "Torpağın təklifə çıxarılmasını təsdiq etmək və ya qaytarmaq"],
  ["LISTINGS_MANAGE", "Elan yerləşdirmək", "Sahəni xəritədə çəkib birbaşa elan etmək"],
  ["STATS_VIEW", "Statistika və hesabatlar", "Göstəricilər və Excel hesabatı"],
  ["SUITABILITY_MANAGE", "Uyğunluq metodologiyası", "Ekspert çəkilərini dəyişmək və yeni versiya dərc etmək"],
  ["INTEGRATION_MANAGE", "EKTİS inteqrasiyası", "Mesajları yenidən göndərmək, test nasazlığı"],
  ["AUDIT_VIEW", "Audit jurnalı", "Kimin nə etdiyini görmək və yoxlamaq"]
];
const ROLE_DEFAULTS = {
  SPECIALIST: ["APPLICATIONS_VIEW", "APPLICATIONS_DECIDE", "IDENTIFIER_REVEAL", "AREAS_MANAGE", "COMPETITIONS_MANAGE", "STATS_VIEW", "SUITABILITY_MANAGE", "INTEGRATION_MANAGE"],
  SUPERVISOR: ["APPLICATIONS_VIEW", "COMPETITIONS_APPROVE", "STATS_VIEW", "AUDIT_VIEW"]
};
const STAFF_ROLES = ["SPECIALIST", "SUPERVISOR", "STAFF", "ADMIN"];
const effective = (u) =>
  u.role === "ADMIN" ? PERMISSIONS.map((p) => p[0]) : STAFF_ROLES.includes(u.role) ? (u.permissions ?? ROLE_DEFAULTS[u.role] ?? []) : [];
const userOut = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name, role: u.role, has_profile: profiles.has(u.id),
  position: u.position ?? null, permissions: effective(u)
});
const staffOut = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name, role: u.role, position: u.position ?? null,
  permissions: effective(u), custom_permissions: u.permissions != null, is_active: u.is_active !== false,
  last_login_at: u.last_login_at ?? null, created_at: u.created_at ?? new Date().toISOString()
});

// ── Applications & notifications ────────────────────────────────────────────
const applications = new Map();
const notifications = [];
let appSeq = 41;

function notify(userId, title_az, body_az, link) {
  notifications.unshift({ id: randomUUID(), user_id: userId, kind: "STATUS", title_az, body_az, link, created_at: iso(Date.now()), read_at: null });
}

function completeness(a) {
  const p = a.business_plan;
  const profile = profiles.has(a.user_id);
  const plan = !!(p.investment_azn && p.jobs_planned && p.implementation_months && p.summary);
  const docs = requiredDocs.filter((d) => d.mandatory).every((d) => a.documents.some((x) => x.doc_type_code === d.code));
  const missing = [];
  if (!profile) missing.push("Sahibkar məlumatları");
  if (!plan) missing.push("Biznes planın məcburi sahələri");
  if (!docs) missing.push("Məcburi sənədlər");
  return { profile, activity: !!a.activity, business_plan: plan, documents: docs, missing };
}

function applicationOut(a) {
  const area = areaByCode[a.area_code];
  const comp = compByNumber[area.competition?.number ?? a.competition_number];
  const prof = profiles.get(a.user_id);
  return {
    id: a.id, number: a.number, status: a.status, outcome: a.outcome, decision_reason: a.decision_reason,
    decided_at: a.decided_at, submitted_at: a.submitted_at, created_at: a.created_at, last_status_at: a.last_status_at,
    version: a.version, activity: a.activity, project_title: a.project_title,
    applicant: prof
      ? {
          type: prof.type, display_name: prof.company_name ?? prof.full_name, full_name: prof.full_name,
          company_name: prof.company_name, identifier_label: prof.type === "COMPANY" ? "VÖEN" : "FİN",
          identifier: prof.voen ?? prof.fin, identifier_masked: false, phone: prof.phone, email: prof.email,
          address: prof.address, is_local: prof.is_local, origin_rayon_name: null, ektis_farmer_id: null
        }
      : null,
    area: { id: area.id, code: area.code, name_az: area.name_az, rayon_name: area.rayon_name, village_name: area.village_name, area_ha: area.area_ha, purpose: area.purpose },
    competition: { id: comp.id, number: comp.number, title_az: comp.title_az, deadline_at: comp.deadline_at, is_open: comp.is_open },
    min_investment_azn: area.min_investment_azn,
    business_plan: a.business_plan,
    documents: a.documents,
    required_documents: requiredDocs.map((d) => ({ ...d, document: a.documents.find((x) => x.doc_type_code === d.code) ?? null })),
    history: a.history,
    info_request: a.info_request,
    completeness: completeness(a),
    allowed_transitions: []
  };
}

function summaryOut(a) {
  const area = areaByCode[a.area_code];
  return {
    id: a.id, number: a.number, status: a.status, outcome: a.outcome, area_code: area.code, area_name: area.name_az,
    rayon_name: area.rayon_name, purpose: area.purpose, area_ha: area.area_ha, competition_number: area.competition.number,
    deadline_at: area.competition.deadline_at, submitted_at: a.submitted_at, last_status_at: a.last_status_at,
    investment_azn: a.business_plan.investment_azn ?? null, jobs_planned: a.business_plan.jobs_planned ?? null,
    applicant_name: profiles.get(a.user_id)?.company_name ?? null, applicant_identifier: null
  };
}

function seedApplication(user, code, status, outcome = null, ageDays = 10) {
  const t = Date.now() - ageDays * day;
  const a = {
    id: randomUUID(), user_id: user.id, area_code: code, number: status === "DRAFT" ? null : `MR-2026-${String(appSeq++).padStart(5, "0")}`,
    status, outcome, decision_reason: outcome === "WON" ? "Ən yüksək investisiya və iş yeri öhdəliyi" : null,
    decided_at: status === "DECIDED" ? iso(t + 6 * day) : null, submitted_at: status === "DRAFT" ? null : iso(t),
    created_at: iso(t - day), last_status_at: iso(t + 2 * day), version: 1, activity: areaByCode[code].purpose,
    project_title: "Damcı suvarma ilə intensiv təsərrüfat",
    business_plan: { investment_azn: "450000", own_funds_pct: "40", jobs_planned: 18, jobs_local: 12, implementation_months: 24, experience_years: 6, summary: "İntensiv texnologiya ilə yüksək məhsuldarlıq.", products_market: null, technology: null, water_plan: null },
    documents: [], history: [], info_request: null
  };
  a.history.push({ from_status: null, to_status: "DRAFT", outcome: null, actor_label: user.full_name, reason: null, created_at: iso(t - day) });
  if (status !== "DRAFT") a.history.push({ from_status: "DRAFT", to_status: "RECEIVED", outcome: null, actor_label: user.full_name, reason: null, created_at: iso(t) });
  if (["UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"].includes(status))
    a.history.push({ from_status: "RECEIVED", to_status: "UNDER_REVIEW", outcome: null, actor_label: "Nigar Həsənova · Mütəxəssis", reason: null, created_at: iso(t + day) });
  if (status === "INFO_REQUESTED") {
    a.history.push({ from_status: "UNDER_REVIEW", to_status: "INFO_REQUESTED", outcome: null, actor_label: "Nigar Həsənova · Mütəxəssis", reason: "Bank arayışı əlavə edilməlidir", created_at: iso(t + 2 * day) });
    a.info_request = { id: randomUUID(), message: "Maliyyə imkanını təsdiq edən bank arayışını əlavə edin.", requested_docs: [{ code: "FINANCIAL_CAPACITY", name_az: "Maliyyə imkanını təsdiq edən sənəd" }], created_at: iso(t + 2 * day), responded_at: null, response_text: null };
  }
  if (status === "DECIDED")
    a.history.push({ from_status: "UNDER_REVIEW", to_status: "DECIDED", outcome, actor_label: "Komissiya", reason: a.decision_reason, created_at: iso(t + 6 * day) });
  if (status !== "DRAFT") {
    a.documents = requiredDocs.slice(0, 5).map((d, i) => ({
      id: randomUUID(), doc_type_code: d.code, doc_type_name: d.name_az, original_name: `${d.code.toLowerCase()}.pdf`, mime: "application/pdf",
      size_bytes: 180_000 + i * 51_000, version: 1, uploaded_at: iso(t - day / 2), info_request_id: null
    }));
  }
  applications.set(a.id, a);
  return a;
}

{
  const open = areas.filter((a) => a.competition);
  const e = users[0];
  seedApplication(e, open[0].code, "UNDER_REVIEW", null, 12);
  const ir = seedApplication(e, open[3].code, "INFO_REQUESTED", null, 8);
  seedApplication(e, open[8].code, "DECIDED", "WON", 30);
  seedApplication(e, open[12].code, "RECEIVED", null, 2);
  notify(e.id, "Əlavə məlumat tələb olunur", `${ir.number} nömrəli müraciət üzrə mütəxəssis əlavə sənəd istəyib.`, `/cabinet/applications/${ir.id}`);
  notify(e.id, "Müraciət baxılır", "Müraciətiniz mütəxəssis tərəfindən baxılmağa götürülüb.", null);
}

// ── Area queries ────────────────────────────────────────────────────────────
function filterAreas(q) {
  const purposes = q.getAll("purpose");
  const region = q.get("region");
  const rayonId = q.get("rayon_id") ? Number(q.get("rayon_id")) : null;
  const min = q.get("min_ha") ? Number(q.get("min_ha")) : null;
  const max = q.get("max_ha") ? Number(q.get("max_ha")) : null;
  const openOnly = q.get("open_only") === "true";
  const text = (q.get("q") ?? "").toLocaleLowerCase("az");
  return areas.filter(
    (a) =>
      (!purposes.length || purposes.includes(a.purpose)) &&
      (!region || a.region_code === region) &&
      (rayonId === null || a.rayon_id === rayonId) &&
      (min === null || Number(a.area_ha) >= min) &&
      (max === null || Number(a.area_ha) <= max) &&
      (!openOnly || a.competition?.is_open) &&
      (!text || `${a.code} ${a.name_az} ${a.rayon_name} ${a.village_name ?? ""}`.toLocaleLowerCase("az").includes(text))
  );
}
const listItem = ({ geometry, suitability, conditions_of_use, _index, lease_term_years, annual_fee_azn_per_ha, soil_type, dist_water_m, dist_road_m, dist_village_m, elevation_m, slope_deg, demining_certified_on, min_investment_azn, ...rest }) => rest;
const detail = (a) => {
  const { _index, ...rest } = a;
  return { ...rest, required_documents: a.competition ? requiredDocs.map(({ max_mb, ...d }) => d) : [] };
};

// ── HTTP plumbing ───────────────────────────────────────────────────────────
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const problem = (res, status, detail, errors = []) => send(res, status, { title: `http_${status}`, detail, errors });
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
const cookieUser = (req) => {
  const sid = /(?:^|;\s*)mock_sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  return sid ? users.find((u) => u.id === sessions.get(sid)) ?? null : null;
};
const login = (res, user, status = 200) => {
  const sid = randomUUID();
  sessions.set(sid, user.id);
  send(res, status, userOut(user), { "set-cookie": `mock_sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
};

const routes = [];
const route = (method, pattern, handler) =>
  routes.push({ method, re: new RegExp(`^/api/v1${pattern.replace(/\{(\w+)\}/g, "(?<$1>[^/]+)")}$`), handler });

route("GET", "/health", (_q, res) => send(res, 200, { status: "ok" }));
route("GET", "/auth/session", (ctx, res) => send(res, 200, { user: ctx.user ? userOut(ctx.user) : null }));
route("POST", "/auth/login", async (ctx, res) => {
  const { email, password } = await ctx.json();
  const u = users.find((x) => x.email === String(email).toLowerCase().trim());
  if (!u || u.password !== password || u.is_active === false) return problem(res, 401, "E-poçt və ya şifrə yanlışdır");
  u.last_login_at = new Date().toISOString();
  login(res, u);
});
route("POST", "/auth/register", async (ctx, res) => {
  const b = await ctx.json();
  const errors = [];
  if (!b.full_name || b.full_name.length < 3) errors.push({ field: "full_name", message: "Ad və soyadı daxil edin" });
  if (!/^\S+@\S+\.\S+$/.test(b.email ?? "")) errors.push({ field: "email", message: "E-poçt ünvanı düzgün deyil" });
  else if (users.some((u) => u.email === b.email.toLowerCase())) errors.push({ field: "email", message: "Bu e-poçt artıq qeydiyyatdadır" });
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(b.password ?? "")) errors.push({ field: "password", message: "Ən azı 8 simvol, hərf və rəqəm" });
  if (!b.consent) errors.push({ field: "consent", message: "Razılıq tələb olunur" });
  if (errors.length) return problem(res, 422, "Məlumatları yoxlayın", errors);
  const u = { id: randomUUID(), email: b.email.toLowerCase(), full_name: b.full_name, role: "INVESTOR", password: b.password };
  users.push(u);
  login(res, u, 201);
});
route("POST", "/auth/logout", (_ctx, res) => send(res, 200, { ok: true }, { "set-cookie": "mock_sid=; Path=/; Max-Age=0" }));

route("GET", "/reference/regions", (_c, res) => send(res, 200, regions));
route("GET", "/reference/rayons", (_c, res) => send(res, 200, [...rayons].sort((a, b) => a.name_az.localeCompare(b.name_az, "az"))));
route("GET", "/reference/document-types", (_c, res) => send(res, 200, docTypes));
route("GET", "/reference/map-context", (_c, res) => send(res, 200, mapContext));

route("GET", "/areas", (ctx, res) => {
  const q = ctx.query;
  const list = filterAreas(q);
  const sort = q.get("sort") ?? "deadline";
  const sorted = [...list].sort((a, b) =>
    sort === "area_desc" ? b.area_ha - a.area_ha
      : sort === "area_asc" ? a.area_ha - b.area_ha
        : sort === "code" ? a.code.localeCompare(b.code)
          : (a.competition ? Date.parse(a.competition.deadline_at) : Infinity) - (b.competition ? Date.parse(b.competition.deadline_at) : Infinity) || a.code.localeCompare(b.code)
  );
  const page = Number(q.get("page") ?? 1);
  const size = Number(q.get("size") ?? 50);
  const counts = {};
  const noPurpose = new URLSearchParams(q);
  noPurpose.delete("purpose");
  filterAreas(noPurpose).forEach((a) => (counts[a.purpose] = (counts[a.purpose] ?? 0) + 1));
  send(res, 200, { items: sorted.slice((page - 1) * size, page * size).map(listItem), total: list.length, page, size, purpose_counts: counts });
});
route("GET", "/areas/geojson", (ctx, res) =>
  send(res, 200, {
    type: "FeatureCollection",
    features: filterAreas(ctx.query).map((a) => ({
      type: "Feature",
      geometry: a.geometry,
      properties: {
        id: a.id, code: a.code, purpose: a.purpose, area_ha: Number(a.area_ha), rayon: a.rayon_name, village: a.village_name,
        open: !!a.competition?.is_open, deadline_at: a.competition?.deadline_at ?? null, fao_class: a.best_fao_class, demining: a.demining_status
      }
    }))
  })
);
route("GET", "/areas/compare", (ctx, res) =>
  send(res, 200, (ctx.query.get("codes") ?? "").split(",").map((c) => areaByCode[c]).filter(Boolean).map(detail))
);
route("GET", "/areas/{code}", (ctx, res) => {
  const a = areaByCode[ctx.params.code];
  return a ? send(res, 200, detail(a)) : problem(res, 404, "Sahə tapılmadı");
});

const compSummary = ({ lots, required_documents, conditions_az, ...c }) => c;
route("GET", "/competitions", (_c, res) => send(res, 200, competitions.map(compSummary)));
route("GET", "/competitions/{number}", (ctx, res) => {
  const c = compByNumber[ctx.params.number];
  return c ? send(res, 200, c) : problem(res, 404, "Müsabiqə tapılmadı");
});

const stats = () => {
  const apps = [...applications.values()].filter((a) => a.status !== "DRAFT");
  const offered = areas.filter((a) => a.competition);
  return {
    competitions_open: competitions.filter((c) => c.is_open).length,
    areas_offered: offered.length,
    hectares_offered: offered.reduce((s, a) => s + Number(a.area_ha), 0).toFixed(2),
    applications_total: apps.length + 37,
    decisions: apps.filter((a) => a.status === "DECIDED").length + 9,
    planned_investment_azn: String(apps.reduce((s, a) => s + Number(a.business_plan.investment_azn ?? 0), 0) + 18_400_000),
    planned_jobs: apps.reduce((s, a) => s + (a.business_plan.jobs_planned ?? 0), 0) + 612
  };
};
route("GET", "/stats/public", (_c, res) => send(res, 200, stats()));

// Authenticated routes from here on.
const authed = (handler, roles) => async (ctx, res) => {
  if (!ctx.user) return problem(res, 401, "Daxil olmaq tələb olunur");
  if (roles && !roles.includes(ctx.user.role)) return problem(res, 403, "Giriş qadağandır");
  return handler(ctx, res);
};
const STAFF = ["SPECIALIST", "SUPERVISOR", "STAFF", "ADMIN"];

// ── Staff accounts (administrator only) ─────────────────────────────────────
const adminOnly = (handler) => authed(handler, ["ADMIN"]);
route("GET", "/admin/users/permissions", adminOnly((_c, res) => send(res, 200, PERMISSIONS.map(([code, label, description]) => ({ code, label, description })))));
route("GET", "/admin/users", adminOnly((_c, res) => send(res, 200, users.filter((u) => STAFF_ROLES.includes(u.role)).map(staffOut))));
route("POST", "/admin/users", adminOnly(async (ctx, res) => {
  const b = await ctx.json();
  const errors = [];
  if (!b.full_name || b.full_name.length < 3) errors.push({ field: "full_name", message: "Ad və soyadı daxil edin" });
  if (!/^\S+@\S+\.\S+$/.test(b.email ?? "")) errors.push({ field: "email", message: "E-poçt ünvanı düzgün deyil" });
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(b.password ?? "")) errors.push({ field: "password", message: "Ən azı 8 simvol, hərf və rəqəm" });
  if (errors.length) return problem(res, 422, "Məlumatları yoxlayın", errors);
  if (users.some((u) => u.email === b.email.toLowerCase())) return problem(res, 409, "Bu e-poçt ilə hesab artıq mövcuddur");
  const u = { id: randomUUID(), email: b.email.toLowerCase(), full_name: b.full_name, role: "STAFF", password: b.password,
    position: b.position || null, permissions: [...new Set(b.permissions ?? [])].sort(), is_active: true, created_at: new Date().toISOString() };
  users.push(u);
  send(res, 201, staffOut(u));
}));
route("PATCH", "/admin/users/{user_id}", adminOnly(async (ctx, res) => {
  const u = users.find((x) => x.id === ctx.params.user_id && STAFF_ROLES.includes(x.role));
  if (!u) return problem(res, 404, "İşçi tapılmadı");
  const b = await ctx.json();
  if (u.role === "ADMIN" && (b.permissions != null || b.is_active === false)) return problem(res, 403, "Administratorun hüquqları və statusu dəyişdirilə bilməz");
  if (b.full_name != null) u.full_name = b.full_name;
  if ("position" in b) u.position = b.position || null;
  if (b.permissions != null) u.permissions = [...new Set(b.permissions)].sort();
  if (b.is_active != null) u.is_active = b.is_active;
  send(res, 200, staffOut(u));
}));
route("POST", "/admin/users/{user_id}/password", adminOnly(async (ctx, res) => {
  const u = users.find((x) => x.id === ctx.params.user_id && STAFF_ROLES.includes(x.role));
  if (!u) return problem(res, 404, "İşçi tapılmadı");
  u.password = (await ctx.json()).password;
  res.writeHead(204).end();
}));



route("GET", "/me/entrepreneur", authed((ctx, res) => {
  const p = profiles.get(ctx.user.id);
  return p ? send(res, 200, p) : problem(res, 404, "Profil yoxdur");
}));
route("PUT", "/me/entrepreneur", authed(async (ctx, res) => {
  const b = await ctx.json();
  const errors = [];
  if (!b.full_name) errors.push({ field: "full_name", message: "Doldurulmalıdır" });
  if (!b.phone) errors.push({ field: "phone", message: "Telefon nömrəsini daxil edin" });
  if (b.type === "COMPANY" && !/^\d{10}$/.test(b.voen ?? "")) errors.push({ field: "voen", message: "VÖEN 10 rəqəmdən ibarətdir" });
  if (b.type === "COMPANY" && !b.company_name) errors.push({ field: "company_name", message: "Şirkətin adını daxil edin" });
  if (b.type === "INDIVIDUAL" && !/^[A-Z0-9]{7}$/.test(b.fin ?? "")) errors.push({ field: "fin", message: "FİN 7 simvoldan ibarətdir" });
  if (errors.length) return problem(res, 422, "Məlumatları yoxlayın", errors);
  const p = { id: profiles.get(ctx.user.id)?.id ?? randomUUID(), ektis_farmer_id: null, ...b };
  profiles.set(ctx.user.id, p);
  send(res, 200, p);
}));

const ownApp = (ctx, res) => {
  const a = applications.get(ctx.params.application_id);
  if (!a || a.user_id !== ctx.user.id) {
    problem(res, 404, "Müraciət tapılmadı");
    return null;
  }
  return a;
};
route("GET", "/applications", authed((ctx, res) =>
  send(res, 200, [...applications.values()].filter((a) => a.user_id === ctx.user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(summaryOut))
));
route("POST", "/applications", authed(async (ctx, res) => {
  const { area_code } = await ctx.json();
  const area = areaByCode[area_code];
  if (!area?.competition?.is_open) return problem(res, 409, "Bu sahə üzrə müraciət qəbulu açıq deyil");
  const existing = [...applications.values()].find((a) => a.user_id === ctx.user.id && a.area_code === area_code);
  if (existing) return send(res, 200, applicationOut(existing));
  const t = iso(Date.now());
  const a = {
    id: randomUUID(), user_id: ctx.user.id, area_code, number: null, status: "DRAFT", outcome: null, decision_reason: null,
    decided_at: null, submitted_at: null, created_at: t, last_status_at: t, version: 1, activity: area.purpose, project_title: null,
    business_plan: {}, documents: [], history: [{ from_status: null, to_status: "DRAFT", outcome: null, actor_label: ctx.user.full_name, reason: null, created_at: t }], info_request: null
  };
  applications.set(a.id, a);
  send(res, 201, applicationOut(a));
}, ["INVESTOR"]));
route("GET", "/applications/{application_id}", authed((ctx, res) => {
  const a = ownApp(ctx, res);
  if (a) send(res, 200, applicationOut(a));
}));
route("PATCH", "/applications/{application_id}", authed(async (ctx, res) => {
  const a = ownApp(ctx, res);
  if (!a) return;
  const b = await ctx.json();
  if (b.activity) a.activity = b.activity;
  if (b.project_title !== undefined) a.project_title = b.project_title;
  if (b.business_plan) {
    const errors = [];
    const inv = Number(b.business_plan.investment_azn);
    if (b.business_plan.investment_azn != null && !(inv > 0)) errors.push({ field: "business_plan.investment_azn", message: "Müsbət məbləğ daxil edin" });
    if (errors.length) return problem(res, 422, "Məlumatları yoxlayın", errors);
    a.business_plan = Object.fromEntries(Object.entries(b.business_plan).map(([k, v]) => [k, v == null ? null : ["investment_azn", "own_funds_pct"].includes(k) ? String(v) : v]));
  }
  a.version++;
  send(res, 200, applicationOut(a));
}));
route("POST", "/applications/{application_id}/documents", authed(async (ctx, res) => {
  const a = ownApp(ctx, res);
  if (!a) return;
  const raw = (await ctx.raw()).toString("latin1");
  const code = /name="doc_type_code"\r\n\r\n([^\r]+)/.exec(raw)?.[1];
  const name = /filename="([^"]+)"/.exec(raw)?.[1] ?? "fayl.pdf";
  const type = docTypes.find((d) => d.code === code);
  if (!type) return problem(res, 422, "Sənəd növü tanınmadı");
  const prev = a.documents.find((d) => d.doc_type_code === code && d.info_request_id === (a.status === "INFO_REQUESTED" ? a.info_request?.id : null));
  const doc = {
    id: randomUUID(), doc_type_code: code, doc_type_name: type.name_az, original_name: Buffer.from(name, "latin1").toString("utf8"),
    mime: "application/pdf", size_bytes: Math.max(1024, raw.length - 400), version: (prev?.version ?? 0) + 1, uploaded_at: iso(Date.now()),
    info_request_id: a.status === "INFO_REQUESTED" ? a.info_request?.id ?? null : null
  };
  a.documents = a.documents.filter((d) => d !== prev).concat(doc);
  send(res, 201, applicationOut(a));
}));
route("DELETE", "/applications/{application_id}/documents/{document_id}", authed((ctx, res) => {
  const a = ownApp(ctx, res);
  if (!a) return;
  a.documents = a.documents.filter((d) => d.id !== ctx.params.document_id);
  send(res, 200, applicationOut(a));
}));
route("GET", "/applications/{application_id}/documents/{document_id}", authed((ctx, res) => {
  res.writeHead(200, { "content-type": "application/pdf", "content-disposition": "attachment; filename=demo.pdf" });
  res.end("%PDF-1.4\n% demo\n");
}));
route("POST", "/applications/{application_id}/submit", authed((ctx, res) => {
  const a = ownApp(ctx, res);
  if (!a) return;
  if (completeness(a).missing.length) return problem(res, 409, "Müraciət tam deyil");
  const t = iso(Date.now());
  a.status = "RECEIVED";
  a.number = `MR-2026-${String(appSeq++).padStart(5, "0")}`;
  a.submitted_at = t;
  a.last_status_at = t;
  a.history.push({ from_status: "DRAFT", to_status: "RECEIVED", outcome: null, actor_label: ctx.user.full_name, reason: null, created_at: t });
  notify(ctx.user.id, "Müraciət qəbul edildi", `${a.number} nömrəli müraciətiniz qeydə alındı.`, `/cabinet/applications/${a.id}`);
  send(res, 200, applicationOut(a));
}));
route("POST", "/applications/{application_id}/info-response", authed(async (ctx, res) => {
  const a = ownApp(ctx, res);
  if (!a) return;
  const { response_text } = await ctx.json();
  const t = iso(Date.now());
  a.info_request.responded_at = t;
  a.info_request.response_text = response_text;
  a.status = "UNDER_REVIEW";
  a.history.push({ from_status: "INFO_REQUESTED", to_status: "UNDER_REVIEW", outcome: null, actor_label: ctx.user.full_name, reason: response_text, created_at: t });
  send(res, 200, applicationOut(a));
}));

// Sahibkar listings: the mock keeps none; the real API stores them.
route("GET", "/listings/mine", authed((_c, res) => send(res, 200, [])));
route("GET", "/listings/mine/applications", authed((_c, res) => send(res, 200, [])));

route("GET", "/notifications", authed((ctx, res) => {
  const mine = notifications.filter((n) => n.user_id === ctx.user.id).map(({ user_id, ...n }) => n);
  send(res, 200, { items: mine, unread: mine.filter((n) => !n.read_at).length });
}));
route("POST", "/notifications/{notification_id}/read", authed((ctx, res) => {
  const n = notifications.find((x) => x.id === ctx.params.notification_id && x.user_id === ctx.user.id);
  if (n) n.read_at = iso(Date.now());
  send(res, 200, { ok: true });
}));
route("POST", "/notifications/read-all", authed((ctx, res) => {
  notifications.filter((x) => x.user_id === ctx.user.id).forEach((n) => (n.read_at ??= iso(Date.now())));
  send(res, 200, { ok: true });
}));

// Staff: read-only views, enough for the admin screens to render.
route("GET", "/admin/applications", authed((ctx, res) => {
  const status = ctx.query.get("status");
  const all = [...applications.values()].filter((a) => a.status !== "DRAFT");
  const counts = {};
  all.forEach((a) => (counts[a.status] = (counts[a.status] ?? 0) + 1));
  const items = all.filter((a) => !status || a.status === status).map(summaryOut);
  send(res, 200, { items, total: items.length, page: 1, size: 25, status_counts: counts });
}, STAFF));
route("GET", "/admin/applications/{application_id}", authed((ctx, res) => {
  const a = applications.get(ctx.params.application_id);
  return a ? send(res, 200, { ...applicationOut(a), allowed_transitions: ["UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"] }) : problem(res, 404, "Tapılmadı");
}, STAFF));
route("GET", "/admin/competitions", authed((_c, res) =>
  send(res, 200, {
    items: competitions.map((c) => ({
      ...c, created_by_name: "Nigar Həsənova", created_by_id: users[1].id, submitted_at: c.opens_at, approved_by_name: "Tural Qasımov",
      approved_at: c.opens_at, review_comment: null, published_at: c.opens_at, application_count: 4,
      lots: c.lots.map((l) => ({ ...l, farm_area_id: l.area_id, applications: 1, winner_number: null })),
      required_documents: c.required_documents.map((d) => ({ code: d.code, mandatory: d.mandatory })), can_edit: false, can_submit: false, can_review: false
    })),
    status_counts: { PUBLISHED: competitions.length }
  }), STAFF));
route("GET", "/admin/areas", authed((_c, res) =>
  send(res, 200, areas.map((a) => ({ id: a.id, code: a.code, name_az: a.name_az, rayon_name: a.rayon_name, area_ha: a.area_ha, purpose: a.purpose, status: a.status, demining_status: a.demining_status, data_source: a.data_source, competition_number: a.competition?.number ?? null }))),
STAFF));
route("GET", "/admin/stats", authed((_c, res) => {
  const s = stats();
  const byRayon = rayons.map((r) => {
    const list = areas.filter((a) => a.rayon_id === r.id);
    return { rayon: r.name_az, areas: list.length, hectares: list.reduce((x, a) => x + Number(a.area_ha), 0).toFixed(2), applications: list.length % 5, investment_azn: String(list.length * 310_000) };
  });
  send(res, 200, {
    ...s, competitions_total: 3, competitions_pending_approval: 0, areas_allocated: 3,
    applications_by_status: { RECEIVED: 9, UNDER_REVIEW: 14, INFO_REQUESTED: 5, DECIDED: 13 }, decided_won: 6, decided_rejected: 7,
    local_applicant_share: 0.46, avg_decision_days: 11.4, by_rayon: byRayon,
    by_purpose: ["CROP", "ORCHARD", "LIVESTOCK", "OTHER"].map((p) => {
      const list = areas.filter((a) => a.purpose === p);
      return { purpose: p, areas: list.length, hectares: list.reduce((x, a) => x + Number(a.area_ha), 0).toFixed(2), applications: list.length };
    }),
    daily: Array.from({ length: 28 }, (_, i) => ({ day: iso(now - (27 - i) * day).slice(0, 10), applications: (i * 7) % 5 })),
    by_competition: competitions.map((c) => ({ number: c.number, title_az: c.title_az, status: c.status, opens_at: c.opens_at, deadline_at: c.deadline_at, lots: c.lots.length, applications: 4 }))
  });
}, STAFF));

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  for (const r of routes) {
    const m = r.method === req.method && r.re.exec(url.pathname);
    if (!m) continue;
    let raw;
    const ctx = {
      user: cookieUser(req),
      params: Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)])),
      query: url.searchParams,
      raw: async () => (raw ??= await readBody(req)),
      json: async () => JSON.parse(((await ctx.raw()).toString("utf8")) || "{}")
    };
    try {
      return await r.handler(ctx, res);
    } catch (e) {
      console.error(e);
      return problem(res, 500, "Mock API xətası");
    }
  }
  problem(res, 404, "Not found");
}).listen(PORT, () => console.log(`mock API on http://localhost:${PORT}/api/v1 (password: ${PASSWORD})`));
