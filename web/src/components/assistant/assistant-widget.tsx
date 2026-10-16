"use client";

import { ArrowUp, LoaderCircle, MapPin, Maximize2, Mic, MicOff, Minimize2, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, createContext, useContext, useEffect, useRef, useState } from "react";

import { EASE } from "@/components/ui/motion";
import { setCompareCodes } from "@/features/areas/compare-store";
import { useL, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "aqrar-assistant";
const SUGGESTIONS: [string, string][] = [
  ["Büdcəm 200 000 AZN-dir, bağçılıq üçün nə tövsiyə edərsən?", "My budget is 200,000 AZN. What do you recommend for an orchard?"],
  ["CAB-0001, CAB-0002 və QBI-0001 sahələrini müqayisə et", "Compare plots CAB-0001, CAB-0002 and QBI-0001"],
  ["Hansı müsabiqələr açıqdır və son tarixləri nə vaxtdır?", "Which competitions are open and when do they close?"]
];
const GREETING: [string, string] = [
  "Salam! Mən Aqrar köməkçiyəm. Portaldakı bütün sahələrə, müsabiqələrə və statistikaya baxa, sahələri müqayisə edə, müraciət qaydasını izah edə bilərəm. Nə axtarırsınız?",
  "Hello! I am the Agro assistant. I can look through every plot, competition and statistic on the portal, compare plots and explain how to apply. What are you looking for?"
];

/** The browser's speech recognition (Chrome, Edge, Safari); Firefox has none. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const TOKEN = /(\[[^\]]+\]\(\/[^)\s]*\)|\[[A-Z]{3}-\d{4}\]|\*\*[^*]+\*\*)/g;

/** Called when a link in an answer is followed (closes the chat on small screens). */
const OpenContext = createContext<() => void>(() => undefined);

/** A plot code, optionally with its name: one click opens the plot page. */
function PlotLink({ code, name }: { code: string; name?: string }) {
  const onOpen = useContext(OpenContext);
  return (
    <Link
      href={`/areas/${code}`}
      onClick={onOpen}
      className="group/plot inline font-semibold text-primary no-underline decoration-primary/40 underline-offset-2 hover:underline"
    >
      <span className="mr-1 inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 align-baseline font-mono text-[11px] font-semibold text-accent transition group-hover/plot:bg-primary-hover">
        <MapPin className="size-3" aria-hidden />
        {code}
      </span>
      {name}
    </Link>
  );
}

/** Plot codes like [CAB-0001] and site links like [Kataloq](/catalogue) become links. */
function Inline({ text }: { text: string }) {
  const onOpen = useContext(OpenContext);
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        // Only paths on this site are linked; the assistant is told never to link elsewhere.
        const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(p);
        if (link) {
          const plot = /^\/areas\/([A-Z]{3}-\d{4})$/.exec(link[2])?.[1];
          if (plot) return <PlotLink key={i} code={plot} name={link[1].replace(`${plot}`, "").replace(/^[\s\]–-]+/, "")} />;
          return (
            <Link key={i} href={link[2]} onClick={onOpen} className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              {link[1]}
            </Link>
          );
        }
        const code = /^\[([A-Z]{3}-\d{4})\]$/.exec(p)?.[1];
        if (code) return <PlotLink key={i} code={code} />;
        if (p.startsWith("**") && p.endsWith("**")) {
          const inner = p.slice(2, -2);
          // "**[AGM-0008] Ağdamda suvarılan taxıl sahəsi**": the whole name opens the plot page.
          const named = /^\[([A-Z]{3}-\d{4})\]\s*(.*)$/.exec(inner);
          if (named) return <PlotLink key={i} code={named[1]} name={named[2]} />;
          return (
            <strong key={i}>
              <Inline text={inner} />
            </strong>
          );
        }
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [canListen, setCanListen] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const L = useL();
  const { lang } = useLang();
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

  // Checked after mount so the server render and the first client render agree.
  useEffect(() => setCanListen(recognitionClass() !== null), []);
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const note = (text: string) => {
    setVoiceNote(text);
    window.setTimeout(() => setVoiceNote(null), 3500);
  };

  // Dictation: what is said is written into the box, and the visitor checks it before sending.
  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = recognitionClass();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang === "en" ? "en-US" : "az-AZ";
    rec.interimResults = true;
    rec.continuous = false;
    const before = input.trim();
    rec.onresult = (e) => {
      const heard = Array.from(e.results, (r) => r[0]?.transcript ?? "").join("");
      setInput(before ? `${before} ${heard}` : heard);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        note(L("Mikrofona icazə verilmədi. Brauzerin ünvan sətrindən icazə verin.", "Microphone access was denied. Allow it from the address bar."));
      } else if (e.error === "no-speech") {
        note(L("Səs eşidilmədi. Yenidən cəhd edin.", "No speech was heard. Try again."));
      } else if (e.error !== "aborted") {
        note(L("Səsi tanımaq alınmadı. Sualınızı yazın.", "Speech could not be recognised. Please type your question."));
      }
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const send = async (text: string) => {
    recognitionRef.current?.stop();
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
        headers: { "Content-Type": "application/json", "X-UI-Lang": lang },
        body: JSON.stringify({ messages: history, page: pathname }),
        signal: controller.signal
      });
      if (!res.ok || !res.body) {
        const reason = (await res.text().catch(() => "")) || L("Köməkçi hazırda cavab vermir.", "The assistant is not answering right now.");
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
            else if (event.type === "navigate" && event.text.startsWith("/compare?codes=")) {
              // The assistant compared plots: show them side by side on the compare page.
              setCompareCodes(event.text.slice("/compare?codes=".length).split(","));
              router.push(event.text, { scroll: false });
              closeOnPhone();
            }
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
        setMessages([...history, { role: "assistant", content: L("Cavab alınmadı. Sualı bir az fərqli yazıb yenidən cəhd edin.", "No answer came back. Rephrase the question and try again.") }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages([...history, { role: "assistant", content: L("Serverə qoşulmaq alınmadı. İnternet bağlantısını yoxlayın.", "Could not reach the server. Check your internet connection.") }]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  // On a phone the chat covers the page, so following a link closes it; on wider screens the
  // page opens beside the chat and the conversation stays in view.
  const closeOnPhone = () => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
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
            aria-label={L("Aqrar köməkçi", "Agro assistant")}
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
                <div className="font-semibold">{L("Aqrar köməkçi", "Agro assistant")}</div>
                <div className="text-13 text-white/65">{L("Sahələr, müqayisə, müsabiqələr", "Plots, comparison, competitions")}</div>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={restart} title={L("Yeni söhbət", "New conversation")} aria-label={L("Yeni söhbət", "New conversation")} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setWide((v) => !v)}
                title={wide ? L("Kiçilt", "Shrink") : L("Böyüt", "Enlarge")}
                aria-label={wide ? L("Kiçilt", "Shrink") : L("Böyüt", "Enlarge")}
                className="hidden rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white sm:block"
              >
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label={L("Bağla", "Close")} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </header>

            <OpenContext.Provider value={closeOnPhone}>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4 text-sm leading-relaxed">
              <div className="max-w-[88%] rounded-3xl rounded-tl-lg bg-surface px-4 py-3 text-ink shadow-card">{L(...GREETING)}</div>
              {messages.length === 0 && (
                <div className="space-y-2 pt-1">
                  {SUGGESTIONS.map((pair) => L(...pair)).map((s) => (
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
                        <LoaderCircle className="size-4 animate-spin" aria-hidden /> {status ?? L("Düşünürəm…", "Thinking…")}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
            </OpenContext.Provider>

            <AnimatePresence>
              {voiceNote && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  role="status"
                  className="border-t border-border bg-primary-50 px-4 py-2 text-center text-13 font-medium text-primary"
                >
                  {voiceNote}
                </motion.p>
              )}
            </AnimatePresence>
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
                placeholder={listening ? L("Danışın, eşidirəm…", "Speak, I am listening…") : L("Sualınızı yazın…", "Type your question…")}
                aria-label={L("Sual", "Question")}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:bg-surface"
              />
              {/* Only where the browser can recognise speech; elsewhere there is no dead button. */}
              {canListen && (
                <button
                  type="button"
                  onClick={toggleListening}
                  aria-pressed={listening}
                  aria-label={listening ? L("Dinləməni dayandır", "Stop listening") : L("Səslə yaz", "Dictate")}
                  title={listening ? L("Dinləməni dayandır", "Stop listening") : L("Səslə yaz", "Dictate")}
                  className={cn(
                    "relative flex size-11 shrink-0 items-center justify-center rounded-2xl border transition",
                    listening
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface-2/60 text-ink-2 hover:border-primary/40 hover:text-primary"
                  )}
                >
                  {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  {listening && <span className="absolute inset-0 animate-ping rounded-2xl border-2 border-primary/50" aria-hidden />}
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={L("Göndər", "Send")}
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink transition hover:bg-accent-strong disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
              </button>
            </form>
            <p className="bg-surface px-4 pb-2 text-center text-[10px] text-ink-3">
              {L(
                "Köməkçi süni intellektdir; qərar verməzdən əvvəl sahə səhifəsindəki məlumatı yoxlayın.",
                "The assistant is an AI; check the plot page before you decide."
              )}
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
        aria-label={open ? L("Köməkçini bağla", "Close the assistant") : L("Aqrar köməkçini aç", "Open the Agro assistant")}
        className={cn(
          "flex h-14 items-center gap-2.5 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-white shadow-float transition-colors hover:bg-primary-hover",
          open && "pr-4"
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ink">
          {open ? <X className="size-4" /> : <Sparkles className="size-4" />}
        </span>
        {!open && <span className="hidden sm:inline">{L("Aqrar köməkçi", "Agro assistant")}</span>}
      </motion.button>
    </div>
  );
}
