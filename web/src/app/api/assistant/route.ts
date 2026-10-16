/**
 * "Aqrar köməkçi": the Agro Invest AI assistant.
 *
 * Runs on the web server, so the OpenRouter key (OPENROUTER_API_KEY) never reaches the
 * browser. The model gets a short list of every plot in the system prompt and tools
 * (./tools.ts) that read the rest of the site through the portal API: plot pages, the
 * side-by-side comparison with ranking, competitions, the transparency figures and, for a
 * signed-in visitor, their own applications and notifications.
 *
 * The answer streams back as newline-delimited JSON events:
 *   {"type":"status","text":"…"}  what the assistant is looking at right now
 *   {"type":"text","text":"…"}    a piece of the answer
 *   {"type":"navigate","text":"/compare?codes=…"}  open this page (after a comparison)
 * This route is matched before the /api/* proxy to the backend (next.config rewrites).
 */

import { TOOLS, parseArgs, runTool, toolStatus, type ToolContext } from "./tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-5.5";
const SITE = process.env.PUBLIC_SITE_URL ?? "https://farad-agro-web.onrender.com";
const COOKIE = "portal_session";
const MAX_ROUNDS = 6;
const HOLD = 200; // characters of a turn held back until we know it is not a tool-call preamble

type Message = { role: "user" | "assistant"; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Area = {
  code: string;
  name_az: string;
  rayon_name: string;
  area_ha: string;
  purpose: string;
  min_investment_azn?: string | null;
  competition: { number: string; is_open: boolean } | null;
};

const PURPOSE: Record<string, string> = { CROP: "əkinçilik", LIVESTOCK: "heyvandarlıq", ORCHARD: "bağçılıq", OTHER: "digər" };

// The catalogue changes slowly; refetching it for every message would only add latency.
let cache: { at: number; text: string } | null = null;

async function catalogue(): Promise<string> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.text;
  const res = await fetch(`${API}/api/v1/areas?size=200&sort=deadline`, { cache: "no-store" });
  if (!res.ok) throw new Error(`areas ${res.status}`);
  const body = (await res.json()) as { items: Area[] };
  const lines = body.items.map((a) =>
    [
      a.code,
      a.name_az,
      a.rayon_name,
      `${Number(a.area_ha)} ha`,
      PURPOSE[a.purpose] ?? a.purpose,
      a.min_investment_azn ? `${Number(a.min_investment_azn)} AZN` : "-",
      a.competition ? `${a.competition.number} ${a.competition.is_open ? "açıq" : "bağlı"}` : "müsabiqədə deyil"
    ].join(" | ")
  );
  cache = { at: Date.now(), text: lines.join("\n") };
  return cache.text;
}

function systemPrompt(plots: string, signedIn: boolean, page: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Sən "Aqrar köməkçi"sən — Agro Invest portalının köməkçisi. Portal Azərbaycanın işğaldan azad edilmiş ərazilərində (Qarabağ və Şərqi Zəngəzur) kənd təsərrüfatı torpaqlarını investisiya müsabiqələri ilə icarəyə təklif edir. Bu gün ${today}.${page ? ` İstifadəçi hazırda bu səhifədədir: ${page}.` : ""}

Saytdakı hər şeyə alətlər vasitəsilə çıxışın var. Onlardan istifadə et:
- search_areas: kataloqda süzgəclərlə axtarış.
- get_area: sahə səhifəsinin bütün məlumatı (şərtlər, torpaq, məsafələr, sənədlər, uyğunluq balları və amilləri).
- compare_areas: 2–3 sahənin müqayisəsi və TOPSIS sıralaması. "Müqayisə et", "hansı daha yaxşıdır", "fərqi nədir" kimi suallarda MÜTLƏQ bunu çağır.
- list_competitions / get_competition: müsabiqələr, lotlar, şərtlər, son tarixlər.
- portal_stats: şəffaflıq rəqəmləri.
- my_applications / my_notifications: istifadəçinin öz müraciətləri və bildirişləri. ${signedIn ? "İstifadəçi daxil olub." : "İstifadəçi daxil olmayıb; bu suallarda ondan daxil olmasını xahiş et."}
Rəqəmləri, şərtləri və sənədləri yaddaşdan yox, alətlərdən götür. Aləti çağırmazdan əvvəl heç nə yazma ("məlumat alıram" və s. demə); istifadəçi nəyə baxdığını onsuz da görür. Aşağıdakı qısa siyahı yalnız kodları tapmaq üçündür; ətraflı sual olanda alət çağır.

Cavab qaydaları:
- Azərbaycan dilində, səmimi və konkret yaz. İstifadəçi başqa dildə yazarsa, həmin dildə cavab ver.
- Sahəni adı ilə çəkəndə həmişə belə yaz: **[CAB-0001] Daşkəsən əkin sahəsi** (qalın, kod kvadrat mötərizədə, sonra ad). Bütün ad sahə səhifəsinə link olur. Cədvəldə və qısa xatırlatmada yalnız [CAB-0001] yazmaq olar.
- Müqayisə istənəndə compare_areas çağır: müqayisə səhifəsi (cədvəl, xəritə, sıralama) istifadəçi üçün avtomatik açılır. Ona görə çatda böyük cədvəl qurma; qısa yaz: TOPSIS sıralaması (1., 2., 3.), hər sahənin əsas üstünlüyü və zəif tərəfi bir cümlə ilə, hansının kimə daha uyğun olduğu, sonda [Müqayisə səhifəsində aç](/compare?codes=...). Digər hallarda lazım olsa kiçik markdown cədvəli qura bilərsən.
- Sayt səhifələrinə markdown linki ilə yönləndir: [mətn](/yol).
- Lazım olsa, əvvəlcə 1–2 dəqiq sual ver: fəaliyyət növü, büdcə, ölçü, rayon, suvarma.
- Uyğun sahə yoxdursa, açıq de və yaxın variantları təklif et. Sahə, rəqəm və ya şərt uydurma.
- Uyğunluq sinfi: S1 çox uyğun (75+), S2 orta (50–74), S3 az uyğun (25–49), N uyğun deyil. Bal torpaq, iqlim, relyef, su və infrastruktur amillərindən AHP çəkiləri ilə hesablanır (metod: [Haqqında](/about)). Məlumatların bir hissəsi nümayiş üçün sintetikdir.
- Hüquqi və ya maliyyə zəmanəti vermə; qərarı müsabiqə komissiyası verir.

Saytın səhifələri: [Xəritə](/map), [Kataloq](/catalogue), [Müqayisə](/compare), [Müsabiqələr](/competitions), sahə səhifəsi /areas/KOD, müsabiqə səhifəsi /competitions/NÖMRƏ, [Şəffaflıq](/transparency), [Haqqında](/about), [Şəxsi kabinet](/cabinet) (müraciətlər /cabinet/applications, bildirişlər /cabinet/notifications, profil /cabinet/profile), [Qeydiyyat](/register), [Daxil ol](/login), [Məxfilik](/privacy).
Müraciət qaydası: qeydiyyat (ad, e-poçt, şifrə) → kabinetdə profil (Azərbaycan vətəndaşı FİN ilə, xarici vətəndaş pasport ilə) → sahə səhifəsində "Müraciət et" → biznes plan, investisiya həcmi, iş yerləri və tələb olunan sənədlər → müraciət nömrəsi dərhal verilir → statuslar: qəbul edilib, baxılır, əlavə məlumat tələb oluna bilər, qərar (qalib və ya imtina). Hər dəyişiklikdə bildiriş gəlir.

Sahələr (kod | ad | rayon | ölçü | təyinat | min. investisiya | müsabiqə):
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

function sessionCookie(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return hit ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return plain(503, "Köməkçi hələ qoşulmayıb. Bir az sonra yenidən cəhd edin.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return plain(429, "Çox sayda sual göndərildi. Bir neçə dəqiqə sonra yenidən yazın.");

  let messages: Message[];
  let page: string | null = null;
  try {
    const body = (await request.json()) as { messages?: Message[]; page?: string };
    messages = (body.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (typeof body.page === "string" && body.page.startsWith("/")) page = body.page.slice(0, 200);
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

  const ctx: ToolContext = { cookie: sessionCookie(request) };
  const chat: ChatMessage[] = [{ role: "system", content: systemPrompt(plots, !!ctx.cookie, page) }, ...messages];

  // Hidden reasoning counts against max_tokens: with it on, the model used to spend the whole
  // budget thinking and the visitor got an empty or cut-off answer. Ask for none; if the
  // model refuses that, retry letting it reason briefly, with room left for the answer.
  let reasoning: object = { enabled: false };
  const ask = async (): Promise<Response | null> => {
    const call = () =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": SITE,
          "X-Title": "Agro Invest"
        },
        body: JSON.stringify({ model: MODEL, stream: true, max_tokens: 4000, temperature: 0.3, reasoning, tools: TOOLS, messages: chat }),
        signal: request.signal
      }).catch(() => null);
    let res = await call();
    if (res && res.status === 400 && "enabled" in reasoning) {
      console.error("assistant: reasoning could not be disabled", await res.text().catch(() => ""));
      reasoning = { effort: "low", exclude: true };
      res = await call();
    }
    return res;
  };

  const first = await ask();
  if (!first || !first.ok || !first.body) {
    const status = first?.status ?? 502;
    console.error("assistant: OpenRouter answered", status, first ? await first.text().catch(() => "") : "");
    if (status === 402) return plain(503, "Köməkçinin limiti bitib. Administrator ilə əlaqə saxlayın.");
    return plain(502, "Köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = 0;
      const emit = (type: "text" | "status" | "navigate", text: string) => {
        if (type === "text") sent += text.length;
        controller.enqueue(encoder.encode(JSON.stringify({ type, text }) + "\n"));
      };

      /** Streams one model turn: text goes straight to the visitor, tool calls are collected. */
      const turn = async (res: Response) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        let held = "";
        let finish: string | null = null;
        let failure: string | null = null;
        const calls: ToolCall[] = [];
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
            let frame: {
              error?: { message?: string };
              choices?: {
                delta?: {
                  content?: string | null;
                  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
                };
                finish_reason?: string | null;
              }[];
            };
            try {
              frame = JSON.parse(data);
            } catch {
              continue; // keep-alive comments and partial frames are skipped
            }
            // OpenRouter reports provider failures inside an already-started stream.
            if (frame.error) failure = frame.error.message ?? "error";
            const choice = frame.choices?.[0];
            if (choice?.delta?.content) {
              content += choice.delta.content;
              // A short opening ("let me look that up") before a tool call is held back and
              // dropped if a tool call follows; real answers flush once they grow past it.
              held += choice.delta.content;
              if (content.length > HOLD) {
                emit("text", held);
                held = "";
              }
            }
            if (choice?.delta?.tool_calls?.length) held = "";
            for (const t of choice?.delta?.tool_calls ?? []) {
              const c = (calls[t.index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
              if (t.id) c.id = t.id;
              if (t.function?.name) c.function.name += t.function.name;
              if (t.function?.arguments) c.function.arguments += t.function.arguments;
            }
            if (choice?.finish_reason) finish = choice.finish_reason;
          }
        }
        const toolCalls = calls.filter(Boolean);
        if (held && !toolCalls.length) emit("text", held);
        return { content: toolCalls.length && content.length <= HOLD ? "" : content, finish, failure, calls: toolCalls };
      };

      try {
        let res: Response | null = first;
        for (let round = 0; ; round++) {
          if (!res || !res.ok || !res.body) {
            console.error("assistant: OpenRouter answered", res?.status, res ? await res.text().catch(() => "") : "");
            emit("text", sent ? "\n\n(Cavab yarımçıq qaldı. Yenidən soruşun.)" : "Köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
            break;
          }
          const r = await turn(res);
          if (r.failure || r.finish === "error") {
            console.error("assistant: stream failed", r.failure ?? r.finish);
            emit("text", sent ? "\n\n(Cavab yarımçıq qaldı. Yenidən soruşun.)" : "Köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
            break;
          }
          if (!r.calls.length) {
            if (r.finish === "length") {
              console.error("assistant: answer hit max_tokens");
              emit("text", sent ? "\n\n(Cavab çox uzun oldu. Davamı üçün “davam et” yazın.)" : "Cavab alınmadı. Sualı bir az qısa yazıb yenidən cəhd edin.");
            }
            break;
          }
          if (round >= MAX_ROUNDS) {
            emit("text", "\n\nBu sual üçün çox addım lazım oldu. Sualı bir az daraldıb yenidən yazın.");
            break;
          }
          chat.push({ role: "assistant", content: r.content || null, tool_calls: r.calls });
          if (r.content) emit("text", "\n\n");
          for (const call of r.calls) {
            emit("status", toolStatus(call.function.name, parseArgs(call.function.arguments)));
            const result = await runTool(call.function.name, call.function.arguments, ctx);
            chat.push({ role: "tool", tool_call_id: call.id, content: result });
            // A comparison opens the compare page with those plots side by side.
            if (call.function.name === "compare_areas") {
              const codes = (JSON.parse(result) as { areas?: { code: string }[] }).areas?.map((a) => a.code) ?? [];
              if (codes.length >= 2) emit("navigate", `/compare?codes=${codes.join(",")}`);
            }
          }
          emit("status", "Cavabı hazırlayıram…");
          res = await ask();
        }
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("assistant: failed", e);
          emit("text", sent ? "\n\n(Cavab yarımçıq qaldı. Yenidən soruşun.)" : "Köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
        }
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" }
  });
}
