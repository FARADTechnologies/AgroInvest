"use client";

import { ArrowUp, LoaderCircle, MapPin, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { EASE } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "aqrar-assistant";
const SUGGESTIONS = [
  "Büdcəm 200 000 AZN-dir, bağçılıq üçün nə tövsiyə edərsən?",
  "Suvarılan, 50 hektardan böyük əkin sahəsi axtarıram",
  "Heyvandarlıq üçün müraciəti açıq sahələr hansılardır?"
];
const GREETING =
  "Salam! Mən Aqrar köməkçiyəm. Nə yetişdirmək və ya hansı fəaliyyətlə məşğul olmaq istədiyinizi, büdcənizi və istədiyiniz rayonu yazın — portaldakı sahələrdən sizə uyğun olanları tapım.";

/** Plot codes the assistant writes as [CAB-0001] become links to the plot page. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z]{3}-\d{4}\]|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        const code = /^\[([A-Z]{3}-\d{4})\]$/.exec(p)?.[1];
        if (code) {
          return (
            <Link
              key={i}
              href={`/areas/${code}`}
              className="mx-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 align-baseline font-mono text-[11px] font-semibold text-accent no-underline transition hover:bg-primary-hover"
            >
              <MapPin className="size-3" aria-hidden />
              {code}
            </Link>
          );
        }
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        const bullet = /^([-•*]|\d+[.)])\s+/.exec(t);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
              <span>
                <Inline text={t.slice(bullet[0].length)} />
              </span>
            </div>
          );
        }
        if (/^#{1,4}\s/.test(t)) {
          return (
            <p key={i} className="font-semibold">
              <Inline text={t.replace(/^#{1,4}\s/, "")} />
            </p>
          );
        }
        return (
          <p key={i}>
            <Inline text={t} />
          </p>
        );
      })}
    </div>
  );
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
  }, [messages]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
      });
      if (!res.ok || !res.body) {
        const reason = (await res.text().catch(() => "")) || "Köməkçi hazırda cavab vermir.";
        setMessages([...history, { role: "assistant", content: reason }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
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
      abortRef.current = null;
    }
  };

  const restart = () => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
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
            className="flex h-[min(600px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-surface shadow-float"
          >
            <header className="flex items-center gap-3 bg-primary px-5 py-4 text-white">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-accent text-ink">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Aqrar köməkçi</div>
                <div className="text-13 text-white/65">Sizə uyğun sahəni tapım</div>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={restart} title="Yeni söhbət" aria-label="Yeni söhbət" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-4" />
                </button>
              )}
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
                  <div key={i} className="max-w-[92%] rounded-3xl rounded-tl-lg bg-surface px-4 py-3 text-ink shadow-card">
                    {m.content ? (
                      <Rich text={m.content} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-ink-3">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Sahələrə baxıram…
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
        {!open && <span className="hidden sm:inline">Sahə tapmağa kömək</span>}
      </motion.button>
    </div>
  );
}
