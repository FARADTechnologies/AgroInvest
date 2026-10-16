"use client";

import { ArrowUp, LoaderCircle, MapPin, Maximize2, Minimize2, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

import { EASE } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "aqrar-assistant";
const SUGGESTIONS = [
  "Büdcəm 200 000 AZN-dir, bağçılıq üçün nə tövsiyə edərsən?",
  "CAB-0001, CAB-0002 və QBI-0001 sahələrini müqayisə et",
  "Hansı müsabiqələr açıqdır və son tarixləri nə vaxtdır?"
];
const GREETING =
  "Salam! Mən Aqrar köməkçiyəm. Portaldakı bütün sahələrə, müsabiqələrə və statistikaya baxa, sahələri müqayisə edə, müraciət qaydasını izah edə bilərəm. Nə axtarırsınız?";

const TOKEN = /(\[[^\]]+\]\(\/[^)\s]*\)|\[[A-Z]{3}-\d{4}\]|\*\*[^*]+\*\*)/g;

/** Plot codes like [CAB-0001] and site links like [Kataloq](/catalogue) become links. */
function Inline({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        // Only paths on this site are linked; the assistant is told never to link elsewhere.
        const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(p);
        if (link) {
          return (
            <Link key={i} href={link[2]} className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              {link[1]}
            </Link>
          );
        }
        const code = /^\[([A-Z]{3}-\d{4})\]$/.exec(p)?.[1];
        if (code) {
          return (
            <Link
              key={i}
              href={`/areas/${code}`}
              className="mx-0.5 inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 align-baseline font-mono text-[11px] font-semibold text-accent no-underline transition hover:bg-primary-hover"
            >
              <MapPin className="size-3" aria-hidden />
              {code}
            </Link>
          );
        }
        // Bold text often wraps a plot code ("**[AGM-0008] …**"), so it is parsed again inside.
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}><Inline text={p.slice(2, -2)} /></strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

function Table({ rows }: { rows: string[] }) {
  const [head, , ...body] = rows;
  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-left text-[12.5px] leading-snug">
        <thead className="bg-primary-50 text-primary">
          <tr>
            {cells(head).map((c, i) => (
              <th key={i} className="whitespace-nowrap px-2.5 py-2 font-semibold">
                <Inline text={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-t border-border/70 odd:bg-surface-2/40">
              {cells(r).map((c, j) => (
                <td key={j} className={cn("px-2.5 py-1.5 align-top", j === 0 && "font-medium text-ink-2")}>
                  <Inline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    // A markdown table: header, separator, rows.
    if (t.startsWith("|") && /^\|?\s*:?-{2,}/.test(lines[i + 1]?.trim() ?? "")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      i--;
      blocks.push(<Table key={i} rows={rows} />);
      continue;
    }
    const bullet = /^([-•*]|\d+[.)])\s+/.exec(t);
    if (bullet) {
      blocks.push(
        <div key={i} className="flex gap-2">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
          <span>
            <Inline text={t.slice(bullet[0].length)} />
          </span>
        </div>
      );
    } else if (/^#{1,4}\s/.test(t)) {
      blocks.push(
        <p key={i} className="font-semibold">
          <Inline text={t.replace(/^#{1,4}\s/, "")} />
        </p>
      );
    } else if (!/^-{3,}$/.test(t)) {
      blocks.push(
        <p key={i}>
          <Inline text={t} />
        </p>
      );
    }
  }
  return <div className="space-y-1.5">{blocks}</div>;
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // The conversation survives page changes within the visit.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      // storage blocked: start empty
    }
  }, []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // storage blocked: the conversation lives in memory only
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setStatus(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, page: pathname }),
        signal: controller.signal
      });
      if (!res.ok || !res.body) {
        const reason = (await res.text().catch(() => "")) || "Köməkçi hazırda cavab vermir.";
        setMessages([...history, { role: "assistant", content: reason }]);
        return;
      }
      // Newline-delimited JSON: {"type":"text"|"status","text":"…"}
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        let changed = false;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; text: string };
            if (event.type === "status") setStatus(event.text);
            else if (event.type === "text") {
              answer += event.text;
              changed = true;
            }
          } catch {
            // a malformed line is skipped
          }
        }
        if (changed) {
          setStatus(null);
          setMessages([...history, { role: "assistant", content: answer }]);
        }
      }
      if (!answer.trim()) {
        setMessages([...history, { role: "assistant", content: "Cavab alınmadı. Sualı bir az fərqli yazıb yenidən cəhd edin." }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages([...history, { role: "assistant", content: "Serverə qoşulmaq alınmadı. İnternet bağlantısını yoxlayın." }]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const restart = () => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
    setStatus(null);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-label="Aqrar köməkçi"
            className={cn(
              "flex flex-col overflow-hidden rounded-[28px] border border-border/70 bg-surface shadow-float transition-[width,height] duration-300",
              wide
                ? "h-[min(760px,calc(100vh-7rem))] w-[min(760px,calc(100vw-2.5rem))]"
                : "h-[min(600px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))]"
            )}
          >
            <header className="flex items-center gap-3 bg-primary px-5 py-4 text-white">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-accent text-ink">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Aqrar köməkçi</div>
                <div className="text-13 text-white/65">Sahələr, müqayisə, müsabiqələr</div>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={restart} title="Yeni söhbət" aria-label="Yeni söhbət" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setWide((v) => !v)}
                title={wide ? "Kiçilt" : "Böyüt"}
                aria-label={wide ? "Kiçilt" : "Böyüt"}
                className="hidden rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white sm:block"
              >
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Bağla" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4 text-sm leading-relaxed">
              <div className="max-w-[88%] rounded-3xl rounded-tl-lg bg-surface px-4 py-3 text-ink shadow-card">{GREETING}</div>
              {messages.length === 0 && (
                <div className="space-y-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-2xl border border-primary/20 bg-primary-50 px-3.5 py-2.5 text-left text-13 font-medium text-primary transition hover:border-primary/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] rounded-3xl rounded-tr-lg bg-primary px-4 py-2.5 text-white">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="max-w-[96%] rounded-3xl rounded-tl-lg bg-surface px-4 py-3 text-ink shadow-card">
                    {m.content && <Rich text={m.content} />}
                    {busy && i === messages.length - 1 && (status || !m.content) && (
                      <span className={cn("inline-flex items-center gap-2 text-13 text-ink-3", m.content && "mt-2")}>
                        <LoaderCircle className="size-4 animate-spin" aria-hidden /> {status ?? "Düşünürəm…"}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 border-t border-border bg-surface p-3"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Sualınızı yazın…"
                aria-label="Sual"
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:bg-surface"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Göndər"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink transition hover:bg-accent-strong disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
              </button>
            </form>
            <p className="bg-surface px-4 pb-2 text-center text-[10px] text-ink-3">
              Köməkçi süni intellektdir; qərar verməzdən əvvəl sahə səhifəsindəki məlumatı yoxlayın.
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-expanded={open}
        aria-label={open ? "Köməkçini bağla" : "Aqrar köməkçini aç"}
        className={cn(
          "flex h-14 items-center gap-2.5 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-white shadow-float transition-colors hover:bg-primary-hover",
          open && "pr-4"
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ink">
          {open ? <X className="size-4" /> : <Sparkles className="size-4" />}
        </span>
        {!open && <span className="hidden sm:inline">Aqrar köməkçi</span>}
      </motion.button>
    </div>
  );
}
