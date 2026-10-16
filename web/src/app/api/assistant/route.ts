/**
 * "Aqrar köməkçi": an AI assistant that helps visitors find suitable farm plots.
 *
 * Runs on the web server, so the OpenRouter key (OPENROUTER_API_KEY) never reaches the
 * browser. Every request gets the current plot catalogue from the portal API, so the
 * assistant only recommends plots that exist, and answers are streamed back as plain text.
 * This route is matched before the /api/* proxy to the backend (next.config rewrites).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-5.5";
const SITE = process.env.PUBLIC_SITE_URL ?? "https://farad-agro-web.onrender.com";

type Message = { role: "user" | "assistant"; content: string };

type Area = {
  code: string;
  name_az: string;
  rayon_name: string;
  village_name: string | null;
  area_ha: string;
  purpose: string;
  status: string;
  irrigation: string;
  demining_status: string;
  best_fao_class?: string | null;
  annual_fee_azn_per_ha?: string | null;
  min_investment_azn?: string | null;
  competition: { number: string; deadline_at: string; is_open: boolean } | null;
};

const PURPOSE: Record<string, string> = { CROP: "əkinçilik", LIVESTOCK: "heyvandarlıq", ORCHARD: "bağçılıq", OTHER: "digər" };
const IRRIGATION: Record<string, string> = { NONE: "suvarma yoxdur", CANAL: "kanal", WELL: "artezian quyusu", RIVER: "çay" };

// The catalogue changes slowly; refetching it for every message would only add latency.
let cache: { at: number; text: string } | null = null;

async function catalogue(): Promise<string> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.text;
  const res = await fetch(`${API}/api/v1/areas?size=200&sort=deadline`, { cache: "no-store" });
  if (!res.ok) throw new Error(`areas ${res.status}`);
  const body = (await res.json()) as { items: Area[] };
  const lines = body.items.map((a) => {
    const c = a.competition;
    const parts = [
      a.code,
      a.name_az,
      `${a.rayon_name}${a.village_name ? ` (${a.village_name})` : ""}`,
      `${Number(a.area_ha).toLocaleString("az")} ha`,
      PURPOSE[a.purpose] ?? a.purpose,
      IRRIGATION[a.irrigation] ?? a.irrigation,
      a.best_fao_class ? `uyğunluq ${a.best_fao_class}` : null,
      a.annual_fee_azn_per_ha ? `icarə ${Number(a.annual_fee_azn_per_ha)} AZN/ha/il` : null,
      a.min_investment_azn ? `min. investisiya ${Number(a.min_investment_azn).toLocaleString("az")} AZN` : null,
      a.demining_status === "CLEARED" ? "minalardan təmizlənib" : "minatəmizləmə tamamlanmayıb",
      c ? `${c.is_open ? "müraciət açıqdır" : "müraciət bağlıdır"}, son tarix ${c.deadline_at.slice(0, 10)}, müsabiqə ${c.number}` : "müsabiqəyə çıxarılmayıb"
    ];
    return parts.filter(Boolean).join(" | ");
  });
  cache = { at: Date.now(), text: lines.join("\n") };
  return cache.text;
}

function systemPrompt(plots: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Sən "Aqrar köməkçi"sən — Azərbaycanın işğaldan azad edilmiş ərazilərində (Qarabağ və Şərqi Zəngəzur) kənd təsərrüfatı torpaqlarının investisiya müsabiqəsi portalının köməkçisisən. Bu gün ${today}.

Vəzifən: istifadəçiyə ona uyğun sahəni tapmağa kömək etmək.
- Həmişə Azərbaycan dilində, səmimi və qısa cavab ver. İstifadəçi başqa dildə yazarsa, həmin dildə cavab ver.
- Lazım olsa, əvvəlcə 1–2 dəqiq sual ver: fəaliyyət növü (əkinçilik, bağçılıq, heyvandarlıq), büdcə, ölçü, rayon, suvarma ehtiyacı.
- Yalnız aşağıdakı siyahıdakı sahələri tövsiyə et; sahə, rəqəm və ya şərt uydurma. Uyğun sahə yoxdursa, açıq de və yaxın variantları təklif et.
- Hər tövsiyədə sahənin kodunu kvadrat mötərizədə yaz, məsələn [CAB-0001], və niyə uyğun olduğunu bir cümlə ilə izah et (ölçü, rayon, suvarma, uyğunluq sinfi, minimum investisiya, son tarix).
- Ən çox 3–5 sahə tövsiyə et. Müraciəti açıq olan sahələrə üstünlük ver; müraciəti bağlı olanları ayrıca qeyd et.
- Uyğunluq sinfi: S1 çox uyğun, S2 orta, S3 az uyğun, N uyğun deyil.
- Müraciət qaydası: portalda qeydiyyatdan keçmək, şəxsi məlumatları doldurmaq (Azərbaycan vətəndaşı FİN, xarici vətəndaş pasport ilə), sahə səhifəsində "Müraciət et", biznes plan və sənədləri yükləmək. Qərarı komissiya verir.
- Hüquqi və ya maliyyə zəmanəti vermə; rəqəmlərin portaldakı son vəziyyətə əsaslandığını unutma.

Portaldakı sahələr (kod | ad | rayon | ölçü | təyinat | suvarma | uyğunluq | icarə | min. investisiya | minatəmizləmə | müsabiqə):
${plots}`;
}

// A small per-address limit keeps one visitor from running up the OpenRouter bill.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

function plain(status: number, text: string): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return plain(503, "Köməkçi hələ qoşulmayıb. Bir az sonra yenidən cəhd edin.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return plain(429, "Çox sayda sual göndərildi. Bir neçə dəqiqə sonra yenidən yazın.");

  let messages: Message[];
  try {
    const body = (await request.json()) as { messages?: Message[] };
    messages = (body.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  } catch {
    return plain(400, "Sorğu oxunmadı.");
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") return plain(400, "Sual boşdur.");

  let plots: string;
  try {
    plots = await catalogue();
  } catch {
    return plain(503, "Sahələrin siyahısı hazırda alınmadı. Bir dəqiqə sonra yenidən cəhd edin.");
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE,
      "X-Title": "Aqrar Investisiya Portali"
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      max_tokens: 900,
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt(plots) }, ...messages]
    })
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    const status = upstream?.status ?? 502;
    console.error("assistant: OpenRouter answered", status, upstream ? await upstream.text().catch(() => "") : "");
    return plain(502, "Köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
  }

  // OpenRouter streams server-sent events; pass only the text deltas to the browser.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // keep-alive comments and partial frames are skipped
            }
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}
