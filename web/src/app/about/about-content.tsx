"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";

import { useL } from "@/lib/i18n";

/** Every text is an [Azerbaijani, English] pair; the language toggle picks one. */
type Tx = [string, string];

const TOC: [string, Tx][] = [
  ["mesele", ["Problem və həll", "Problem and solution"]],
  ["proses", ["Proses xəritəsi", "Process map"]],
  ["arxitektura", ["Arxitektura", "Architecture"]],
  ["ektis", ["EKTİS inteqrasiyası", "EKTİS integration"]],
  ["uygunluq", ["Uyğunluq metodikası", "Suitability method"]],
  ["komekci", ["Aqrar köməkçi", "Agro assistant"]],
  ["tehlukesizlik", ["Təhlükəsizlik və fərdi məlumatlar", "Security and personal data"]],
  ["menbeler", ["Məlumat mənbələri", "Data sources"]],
  ["yol-xeritesi", ["İnkişaf yol xəritəsi", "Roadmap"]]
];

type Lane = "ADMIN" | "USER" | "COMMISSION" | "EKTIS" | "SYSTEM";

const LANE: Record<Lane, { label: Tx; style: string }> = {
  ADMIN: { label: ["Administrator", "Administrator"], style: "bg-accent-50 text-accent-text" },
  USER: { label: ["İstifadəçi", "User"], style: "bg-status-received-bg text-status-received-fg" },
  COMMISSION: { label: ["Komissiya", "Commission"], style: "bg-primary-50 text-primary" },
  EKTIS: { label: ["EKTİS", "EKTİS"], style: "bg-status-info-bg text-status-info-fg" },
  SYSTEM: { label: ["Sistem", "System"], style: "bg-surface-2 text-ink-2" }
};

const PROCESS: { lane: Lane; title: Tx; text: Tx; status?: Tx }[] = [
  {
    lane: "ADMIN",
    title: ["Elan yerləşdirir", "Places a listing"],
    text: [
      "İdarəetmə panelində sahəni xəritədə künc nöqtələri ilə qeyd edir, təyinatı, icarə şərtlərini, minimum investisiyanı və son tarixi yazır. Ölçü, rayon və ən yaxın kənd PostGIS-də hesablanır; minatəmizləmə sertifikatı olmayan sahə elan edilə bilməz.",
      "Draws the plot on the map in the admin console and enters the purpose, lease terms, minimum investment and deadline. Size, rayon and nearest village are computed in PostGIS; a plot without a demining certificate cannot be listed."
    ],
    status: ["Dərc edilib", "Published"]
  },
  {
    lane: "SYSTEM",
    title: ["Uyğunluğu qiymətləndirir", "Scores suitability"],
    text: [
      "Hər yeni sahə dərhal çoxmeyarlı CİS təhlili ilə (AHP çəkiləri, FAO sinifləri) hər fəaliyyət üzrə qiymətləndirilir və bal izahı ilə göstərilir.",
      "Every new plot is scored at once for each activity with a multi-criteria GIS analysis (AHP weights, FAO classes), and the score is shown with its explanation."
    ]
  },
  {
    lane: "USER",
    title: ["Tərcihlərini qeyd edir", "Sets preferences"],
    text: [
      "İnvestisiya büdcəsini və maraqlandığı sahələri (əkinçilik, heyvandarlıq, bağçılıq…) yazır. Kataloq bu tərcihlərə görə avtomatik filtrlənir; filtri istədiyi vaxt dəyişə bilər.",
      "Enters an investment budget and the activities of interest (crops, livestock, orchards…). The catalogue filters itself by these preferences, and the filter can be changed at any time."
    ]
  },
  {
    lane: "USER",
    title: ["Elan seçir", "Chooses a listing"],
    text: [
      "Xəritə, kataloq, axtarış, təyinat və maliyyə filtrləri, dörd sahəyə qədər müqayisə, uyğunluq təhlili və Aqrar köməkçi ilə.",
      "With the map, the catalogue, search, purpose and cost filters, comparison of up to four plots, the suitability analysis and the Agro assistant."
    ]
  },
  {
    lane: "USER",
    title: ["Elektron müraciət göndərir", "Submits an application"],
    text: [
      "Fiziki şəxs (FİN), xarici vətəndaş (pasport) və ya hüquqi şəxs (VÖEN), biznes plan, elanın tələb etdiyi sənədlər. Göndərildikdə müraciət nömrəsi verilir.",
      "As a citizen (FİN), a foreign citizen (passport) or a company (VÖEN), with a business plan and the documents the listing requires. A number is issued on submission."
    ],
    status: ["Qəbul edilib · QIM-İİİİ-NNNNNN", "Received · QIM-YYYY-NNNNNN"]
  },
  {
    lane: "EKTIS",
    title: ["Fermer reyestri sorğusu", "Farmer registry check"],
    text: [
      "İstifadəçi öz FİN/VÖEN-inin EKTİS-də fermer kimi qeydiyyatda olub-olmadığını yoxlaya bilər (xarici vətəndaşlar üçün tətbiq olunmur). Bu məlumatlandırıcıdır, müraciəti dayandırmır.",
      "The user can check whether their FİN/VÖEN is registered as a farmer in EKTİS (not for foreign citizens). It is for information and never blocks the application."
    ]
  },
  {
    lane: "ADMIN",
    title: ["Müraciətləri izləyir", "Follows applications"],
    text: [
      "Elanlara gələn müraciətləri, investisiya həcmini, iş yerlərini və statusu idarəetmə panelində görür.",
      "Sees the applications to each listing, the planned investment, jobs and status in the admin console."
    ]
  },
  {
    lane: "COMMISSION",
    title: ["Müraciətə baxır", "Reviews the application"],
    text: [
      "FİN/VÖEN maskalanır; tam dəyər yalnız səbəb göstərilərək açılır. Hər baxış və sənəd yükləməsi audit jurnalına yazılır.",
      "FİN/VÖEN are masked; the full value opens only with a stated reason. Every view and document download is written to the audit log."
    ],
    status: ["Baxılır", "Under review"]
  },
  {
    lane: "USER",
    title: ["Əlavə məlumat təqdim edir", "Provides more information"],
    text: [
      "Komissiya səbəb və lazım olan sənədləri göstərir; müraciətçi bildiriş alır, sənədi yükləyib cavab verir və müraciət yenidən baxışa qayıdır.",
      "The commission states the reason and the documents needed; the applicant is notified, uploads the document and replies, and the application returns to review."
    ],
    status: ["Əlavə məlumat tələb olunur ⇄ Baxılır", "Information requested ⇄ Under review"]
  },
  {
    lane: "COMMISSION",
    title: ["Qərar verir", "Decides"],
    text: [
      "Qalib və ya İmtina, səbəb mütləqdir. Qərar yekundur; hər sahə üzrə yalnız bir qalib ola bilər. Qərarı insan verir, sistem yalnız dəstək göstərir.",
      "Winner or rejected, always with a reason. The decision is final and a plot can have only one winner. People decide; the system only supports them."
    ],
    status: ["Qərar verilib", "Decided"]
  },
  {
    lane: "SYSTEM",
    title: ["Qərar EKTİS-ə ötürülür", "The decision goes to EKTİS"],
    text: [
      "Qalib qərarı eyni tranzaksiyada növbəyə yazılır və arxa planda göndərilir. EKTİS cavab verməsə, avtomatik təkrar cəhd edilir; hər çağırış İnteqrasiya logunda görünür.",
      "The winning decision is queued in the same transaction and sent in the background. If EKTİS does not answer, it is retried automatically; every call appears in the integration log."
    ]
  },
  {
    lane: "USER",
    title: ["Nəticəni və tarixçəni görür", "Sees the result and history"],
    text: [
      "Hər status dəyişikliyi vaxtı, icraçının rolu və səbəbi ilə tarixçədə saxlanılır və bildirişlə çatdırılır: inzibati proses şəffafdır.",
      "Every status change is kept in the history with its time, the actor's role and the reason, and is sent as a notification, so the process is transparent."
    ]
  }
];

const STACK: { title: Tx; tech: string; text: Tx }[] = [
  {
    title: ["Veb tətbiq", "Web application"],
    tech: "Next.js 15, React 19, TypeScript, Tailwind, MapLibre GL",
    text: [
      "Xəritə, kataloq, istifadəçi kabineti və ayrıca idarəetmə paneli, Azərbaycan və ingilis dilində. API ilə OpenAPI-dən yaradılan tipli müştəri vasitəsilə danışır; biznes qaydaları serverdədir.",
      "Map, catalogue, user cabinet and a separate admin console, in Azerbaijani and English. It talks to the API through a typed client generated from OpenAPI; business rules live on the server."
    ]
  },
  {
    title: ["Portal API", "Portal API"],
    tech: "Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic",
    text: [
      "Modullar: identifikasiya, sahələr, elanlar, müsabiqələr, müraciətlər, sənədlər, bildirişlər, hesabatlar, uyğunluq, audit, inteqrasiya. Status maşını və qaydalar yalnız burada.",
      "Modules: identity, plots, listings, competitions, applications, documents, notifications, reports, suitability, audit, integration. The state machine and the rules live only here."
    ]
  },
  {
    title: ["Verilənlər bazası", "Database"],
    tech: "PostgreSQL + PostGIS",
    text: [
      "Sahə poliqonları, məsafələr, sənədlər, axtarış (diakritikadan asılı olmayan və yazı xətasına dözümlü), bütövlük məhdudiyyətləri (bir sahəyə bir qalib, dörd göz).",
      "Plot polygons, distances, documents, search that ignores diacritics and tolerates typos, integrity constraints (one winner per plot, four-eyes approval)."
    ]
  },
  {
    title: ["EKTİS (simulyasiya)", "EKTİS (simulated)"],
    tech: "Java 21, Spring Boot 3, OpenAPI",
    text: [
      "Real EKTİS-ə qoşulmur. Fermer reyestri sorğusu və torpaqdan istifadə qərarlarının qəbulu üçün müqavilə; nasazlıq simulyasiyası ilə.",
      "Never connects to the real EKTİS. A contract for farmer registry checks and land-use decisions, with an outage simulation."
    ]
  },
  {
    title: ["Şlüz", "Gateway"],
    tech: "nginx",
    text: [
      "Lokal quraşdırmada şəbəkədə yeganə açıq giriş nöqtəsi: real müştəri ünvanını ötürür, təhlükəsizlik başlıqları əlavə edir. API, EKTİS və baza yalnız daxili şəbəkədədir.",
      "In a local installation, the only entry point on the network: it passes on the real client address and adds security headers. The API, EKTİS and the database stay on the internal network."
    ]
  },
  {
    title: ["CİS emalı", "GIS pipeline"],
    tech: "Python, GeoPandas, GDAL (oflayn)",
    text: [
      "OpenStreetMap çıxarışından rayon sərhədləri, kəndlər, sahələr, yollar və su obyektləri hazırlanır; nəticələr repozitoriyada saxlanılır, demo internetsiz işləyir.",
      "Builds rayon boundaries, villages, plots, roads and water from the OpenStreetMap extract; the results are kept in the repository, so the demo works without internet."
    ]
  }
];

const SECURITY: Tx[] = [
  [
    "Şifrələr Argon2id ilə saxlanılır; sessiya httpOnly və SameSite=Strict kukidədir (60 dəqiqə).",
    "Passwords are stored with Argon2id; the session lives in an httpOnly, SameSite=Strict cookie (60 minutes)."
  ],
  [
    "5 uğursuz girişdən sonra hesab 10 dəqiqəlik bloklanır; bir ünvandan çox sayda uğursuz giriş və qeydiyyat məhdudlaşdırılır.",
    "After 5 failed sign-ins the account is locked for 10 minutes; repeated failed sign-ins and sign-ups from one address are limited."
  ],
  [
    "Rollar: İstifadəçi (Azərbaycan və ya xarici vətəndaş, müraciət edir), Komissiya (mütəxəssis və rəhbər), Administrator (torpağı təklifə çıxarır, elan yerləşdirir, işçi hesablarını və səlahiyyətləri idarə edir). Hər API çağırışında rol yoxlanılır; başqasının müraciəti “tapılmadı” kimi görünür.",
    "Roles: User (Azerbaijani or foreign citizen, applies), Commission (specialist and supervisor), Administrator (puts land on offer, places listings, manages staff accounts and permissions). Every API call checks the role; another person's application shows as “not found”."
  ],
  [
    "Qeydiyyatda fərdi məlumatların emalına razılıq alınır (“Fərdi məlumatlar haqqında” Qanun).",
    "Consent to processing personal data is collected at registration (Law on Personal Data)."
  ],
  [
    "FİN/VÖEN siyahılarda, baxış ekranında və Excel hesabatında maskalanır; tam dəyərə baxış səbəblə və audit qeydi ilə mümkündür.",
    "FİN/VÖEN are masked in lists, on the review screen and in Excel reports; the full value opens only with a reason and an audit entry."
  ],
  [
    "Audit jurnalı: müraciətə baxış, sənəd yükləmə, status dəyişikliyi, müsabiqə təsdiqi, hesabat ixracı, EKTİS əməliyyatları, rola uyğun olmayan API çağırışları. Jurnal yalnız əlavə olunur və SHA-256 heş zəncirinə bağlanır; rəhbər bütövlüyü yoxlaya bilər.",
    "Audit log: application views, document downloads, status changes, competition approvals, report exports, EKTİS operations and calls outside a role's rights. The log is append-only and linked in a SHA-256 hash chain that a supervisor can verify."
  ],
  [
    "Sənədlər məzmununa görə yoxlanılır (PDF, şəkil, ofis faylı), ölçü məhdudlaşdırılır və verilənlər bazasında saxlanılır.",
    "Documents are checked by their content (PDF, image, office file), limited in size and stored in the database."
  ],
  [
    "Gizli açarlar yalnız mühit dəyişənlərindədir; repozitoriyada sirr saxlanılmır.",
    "Secrets live only in environment variables; the repository holds none."
  ]
];

const SOURCES: { title: Tx; text: Tx; license: Tx }[] = [
  {
    title: ["OpenStreetMap", "OpenStreetMap"],
    text: [
      "Rayon sərhədləri, kənd adları (yalnız name:az), kənd təsərrüfatı poliqonları, yollar və su obyektləri. Geofabrik çıxarışı, 14.10.2026.",
      "Rayon boundaries, village names (name:az only), farmland polygons, roads and water. Geofabrik extract of 14 Oct 2026."
    ],
    license: ["© OpenStreetMap contributors, ODbL 1.0", "© OpenStreetMap contributors, ODbL 1.0"]
  },
  {
    title: ["Peyk təsviri", "Satellite imagery"],
    text: ["Esri World Imagery, yer adları olmadan.", "Esri World Imagery, without place names."],
    license: [
      "© Esri, Maxar, Earthstar Geographics. Pilotda lisenziyalı mənbə (məs. Azərkosmos) ilə əvəzlənəcək.",
      "© Esri, Maxar, Earthstar Geographics. To be replaced by a licensed source (e.g. Azərkosmos) in the pilot."
    ]
  },
  {
    title: ["Altlıq xəritə", "Basemap"],
    text: [
      "Etiketsiz vektor altlıq; sərhəd və adlar yalnız portalın öz qatlarındandır. İnternet olmadıqda sadə oflayn fon.",
      "A vector basemap without labels; boundaries and names come only from the portal's own layers. Without internet, a plain offline background."
    ],
    license: ["© CARTO, © OpenStreetMap contributors", "© CARTO, © OpenStreetMap contributors"]
  },
  {
    title: ["Uyğunluq amilləri", "Suitability factors"],
    text: [
      "Məsafələr və torpaq örtüyü OpenStreetMap üzrə PostGIS-də ölçülür. Torpaq, iqlim və relyef amilləri hazırda sintetik nümayiş məlumatıdır və “nümayiş” kimi işarələnib; SoilGrids, WorldClim/ERA5 və Copernicus DEM ilə əvəzlənəcək.",
      "Distances and land cover are measured in PostGIS from OpenStreetMap. Soil, climate and terrain factors are synthetic demo values for now, tagged “demo”; they will be replaced by SoilGrids, WorldClim/ERA5 and the Copernicus DEM."
    ],
    license: ["Nümayiş məlumatı", "Demo data"]
  },
  {
    title: ["Nümayiş məlumatları", "Demo data"],
    text: [
      "61 sahədən 46-sı real OSM poliqonu, 15-i nümayiş üçün yaradılıb. Minatəmizləmə statusu, icarə şərtləri, müsabiqələr, müraciətlər və şəxslər nümayiş məqsədlidir; real şərtləri Nazirlik müəyyən edir.",
      "46 of the 61 plots are real OSM polygons and 15 were generated for the demo. Demining status, lease terms, competitions, applications and people are illustrative; the real terms are set by the Ministry."
    ],
    license: ["Prototip", "Prototype"]
  },
  {
    title: ["Şrift", "Typeface"],
    text: ["IBM Plex Sans və Mono: Azərbaycan əlifbasının bütün hərfləri.", "IBM Plex Sans and Mono: every letter of the Azerbaijani alphabet."],
    license: ["SIL Open Font License 1.1", "SIL Open Font License 1.1"]
  }
];

const ROADMAP: { when: Tx; title: Tx; items: Tx[] }[] = [
  {
    when: ["1–2-ci həftə", "Weeks 1–2"],
    title: ["Texniki audit və tələblərin dəqiqləşdirilməsi", "Technical audit and requirements"],
    items: [
      ["Prototipin kod, təhlükəsizlik və məlumat modeli üzrə auditi", "Audit of the prototype's code, security and data model"],
      [
        "Nazirlik mütəxəssisləri ilə müsabiqə qaydaları, sənəd siyahıları, qiymətləndirmə meyarları",
        "Competition rules, document lists and evaluation criteria with the Ministry's specialists"
      ],
      ["Proses xəritəsinin real iş axını ilə tutuşdurulması", "Checking the process map against the real workflow"]
    ]
  },
  {
    when: ["3–5-ci həftə", "Weeks 3–5"],
    title: ["İnteqrasiyalar", "Integrations"],
    items: [
      [
        "Səlahiyyətli qurumun razılığı ilə EKTİS-ə EHİS üzərindən qoşulma (konfiqurasiya ilə dəyişdirilən müştəri)",
        "Connection to EKTİS through EHİS with the authority's consent (a client switched by configuration)"
      ],
      ["ASAN Login ilə giriş, ASAN İmza ilə müraciətin imzalanması", "Sign-in with ASAN Login, signing the application with ASAN İmza"],
      [
        "ANAMA məlumatları ilə real minatəmizləmə statusu; rəsmi parsel məlumatları",
        "Real demining status from ANAMA; official parcel data"
      ]
    ]
  },
  {
    when: ["6–8-ci həftə", "Weeks 6–8"],
    title: ["Pilot versiya", "Pilot"],
    items: [
      [
        "Sənədlər üçün obyekt anbarı, ehtiyat nüsxə, çoxnüsxəli API və idarə olunan PostgreSQL",
        "Object storage for documents, backups, several API replicas and managed PostgreSQL"
      ],
      ["E-poçt və SMS bildirişləri", "E-mail and SMS notifications"],
      [
        "Real torpaq, iqlim və relyef məlumatları ilə uyğunluq təhlili; çəkilərin aqronomlarla təsdiqi",
        "Suitability with real soil, climate and terrain data; weights validated with agronomists"
      ],
      ["Rus dili, əlçatanlıq auditi, yük testi", "Russian interface, accessibility audit, load test"]
    ]
  }
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-md border border-border bg-surface px-5 py-5">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-3 text-sm text-ink-2">{children}</div>
    </section>
  );
}

export function AboutContent() {
  const L = useL();
  const t = (x: Tx) => L(x[0], x[1]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl">{L("Agro Invest: haqqında və arxitektura", "Agro Invest: about and architecture")}</h1>
      <p className="mt-2 max-w-3xl text-ink-2">
        {L(
          "İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı sahələri üzrə investisiya müsabiqəsinin elektron portalının prototipi. Gələcəkdə Kənd Təsərrüfatı Nazirliyinin Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS) inteqrasiya üçün hazırlanıb.",
          "A prototype of the electronic portal for investment competitions for agricultural land in the liberated territories, built to integrate with the Ministry of Agriculture's Electronic Agriculture Information System (EKTİS)."
        )}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={L("Bölmələr", "Sections")} className="lg:sticky lg:top-20 lg:self-start">
          <ol className="space-y-1 text-sm">
            {TOC.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <span className="tabular text-ink-3">{i + 1}.</span> {t(label)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          <Section id="mesele" title={L("Problem və həll", "Problem and solution")}>
            <p>
              {L(
                "Müraciətçi üçün azad edilmiş ərazilərdə hansı sahənin, hansı şərtlərlə və nə vaxta qədər təklif edildiyini tapmaq, müraciət etmək və müraciətin taleyini izləmək çətindir; Nazirlik üçün isə müraciətlərin qəbulu, baxılması və qərarların uçotu kağız və dağınıq kanallarla aparılır.",
                "For an applicant it is hard to find which plots in the liberated territories are on offer, on what terms and until when, to apply and to follow the application; for the Ministry, receiving and reviewing applications and recording decisions runs on paper and scattered channels."
              )}
            </p>
            <p className="mt-2">
              {L(
                "Portal bu prosesi bir yerdə birləşdirir: administratorun yerləşdirdiyi elanlar, istifadəçinin tərcihlərinə görə filtrlənən xəritə və kataloq, elektron müraciət, statusun izlənməsi və bildirişlər, komissiya üçün idarəetmə paneli, statistika və hesabatlar, EKTİS ilə məlumat mübadiləsi.",
                "The portal brings the process into one place: listings placed by the administrator, a map and catalogue filtered by the user's preferences, electronic applications, status tracking and notifications, an admin console for the commission, statistics and reports, and data exchange with EKTİS."
              )}
            </p>
          </Section>

          <Section id="proses" title={L("Proses xəritəsi", "Process map")}>
            <ol className="relative space-y-3">
              {PROCESS.map((step, i) => (
                <li key={step.title[0]} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-border-strong bg-surface text-13 font-medium tabular text-ink">
                    {i + 1}
                  </span>
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-sm px-1.5 py-0.5 text-2xs font-medium ${LANE[step.lane].style}`}>
                        {t(LANE[step.lane].label)}
                      </span>
                      <span className="font-medium text-ink">{t(step.title)}</span>
                      {step.status && <span className="font-mono text-2xs text-ink-3">{t(step.status)}</span>}
                    </div>
                    <p className="mt-1">{t(step.text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="arxitektura" title={L("Arxitektura", "Architecture")}>
            <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2">
                <div className="font-medium text-ink">{L("Brauzer", "Browser")}</div>
                <div className="text-13">{L("İstifadəçi, komissiya, administrator", "User, commission, administrator")}</div>
              </div>
              <ArrowRight className="mx-auto hidden size-4 self-center text-ink-3 md:block" aria-hidden />
              <ArrowDown className="mx-auto size-4 text-ink-3 md:hidden" aria-hidden />
              <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2">
                <div className="font-medium text-ink">{L("Veb server", "Web server")}</div>
                <div className="text-13">{L("/api → API, qalanı → veb", "/api → API, the rest → web")}</div>
              </div>
              <ArrowRight className="mx-auto hidden size-4 self-center text-ink-3 md:block" aria-hidden />
              <ArrowDown className="mx-auto size-4 text-ink-3 md:hidden" aria-hidden />
              <div className="rounded-md border border-primary/30 bg-primary-50 px-3 py-2">
                <div className="font-medium text-ink">Portal API ⇄ PostGIS</div>
                <div className="text-13">Outbox → EKTİS (REST, OpenAPI)</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {STACK.map((s) => (
                <div key={s.title[0]} className="rounded-md border border-border px-3 py-2">
                  <div className="font-medium text-ink">{t(s.title)}</div>
                  <div className="font-mono text-2xs text-ink-3">{s.tech}</div>
                  <p className="mt-1 text-13">{t(s.text)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3">
              {L("Lokal olaraq hər şey bir əmrlə", "Locally, everything starts with one command")} (
              <span className="font-mono text-13">docker compose up</span>){" "}
              {L("nümayiş məlumatları ilə qalxır. API sənədləri:", "with the demo data. API documentation:")}{" "}
              <Link href="/api/v1/docs" className="text-primary hover:underline">
                OpenAPI (Swagger)
              </Link>
              .
            </p>
          </Section>

          <Section id="ektis" title={L("EKTİS inteqrasiyası", "EKTİS integration")}>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                {L(
                  "Müqavilə əvvəlcədən müəyyənləşdirilib (OpenAPI): fermer reyestri sorğusu FİN/VÖEN ilə və torpaqdan istifadə qərarının qəbulu.",
                  "The contract is defined up front (OpenAPI): farmer registry checks by FİN/VÖEN and receipt of land-use decisions."
                )}
              </li>
              <li>
                {L(
                  "Qalib qərarı ilə EKTİS mesajı eyni tranzaksiyada yazılır (transactional outbox): qərar mesajsız saxlanıla bilməz, EKTİS-in əlçatmazlığı mütəxəssisi dayandırmır.",
                  "The winning decision and its EKTİS message are written in one transaction (transactional outbox): a decision cannot be saved without its message, and an EKTİS outage never blocks the specialist."
                )}
              </li>
              <li>
                {L(
                  "Arxa plan prosesi mesajları göndərir; uğursuz cəhddən sonra 5, 10, 20, sonra hər 30 saniyədən bir təkrar edilir. Qərarın identifikatoru idempotentlik açarıdır: təkrar göndərmə ikinci qeydiyyat yaratmır.",
                  "A background worker sends the messages and retries after 5, 10, 20 and then every 30 seconds. The decision's id is the idempotency key, so a resend never creates a second record."
                )}
              </li>
              <li>
                {L(
                  "Hər çağırış izləmə identifikatoru (X-Request-ID), müddəti və nəticəsi ilə İnteqrasiya logunda görünür; identifikatorlar maskalanır. EKTİS cavabı HMAC imzası ilə təsdiqlənir.",
                  "Every call appears in the integration log with its trace id (X-Request-ID), duration and result; identifiers are masked. EKTİS confirms with an HMAC-signed callback."
                )}
              </li>
              <li>
                {L(
                  "Real sistemə qoşulma yalnız səlahiyyətli qurumun razılığı ilə, Elektron Hökumət İnformasiya Sistemi (EHİS) üzərindən nəzərdə tutulub. Müştəri konfiqurasiya ilə dəyişir; portal kodu dəyişmir. Prototip real EKTİS-ə heç vaxt müraciət etmir.",
                  "Connecting to the real system is planned only with the authority's consent, through the Electronic Government Information System (EHİS). The client is switched by configuration and the portal code stays the same. The prototype never calls the real EKTİS."
                )}
              </li>
            </ul>
          </Section>

          <Section id="uygunluq" title={L("Uyğunluq metodikası (qərar dəstəyi)", "Suitability method (decision support)")}>
            <p>
              {L(
                "Hər sahə əkinçilik, bağçılıq, heyvandarlıq və digər fəaliyyət üçün çoxmeyarlı CİS təhlili ilə qiymətləndirilir. 18 amil dörd qrupa bölünür: torpaq (münbitlik, üzvi karbon, azot, pH, mexaniki tərkib, şoranlıq, torpaq örtüyü), iqlim (yağıntı, temperatur, şaxtasız günlər, günəş radiasiyası), relyef (hündürlük, meyillik, yamacın istiqaməti), su və infrastruktur (su mənbəyinə, yola, kəndə və içməli suya məsafə).",
                "Each plot is scored for crops, orchards, livestock and other uses with a multi-criteria GIS analysis. 18 factors fall into four groups: soil (fertility, organic carbon, nitrogen, pH, texture, salinity, land cover), climate (rainfall, temperature, frost-free days, solar radiation), terrain (elevation, slope, aspect), and water and infrastructure (distance to water, a main road, a village and drinking water)."
              )}
            </p>
            <p className="mt-2">
              {L(
                "Hər amil 0–1 balına çevrilir; çəkilər iki səviyyəli AHP ilə (əvvəl qruplar, sonra qrup daxilində amillər) hesablanır, hər matrisin uyğunluq nisbəti 0,1-dən kiçikdir. Nəticə 0–100 bal və FAO sinfidir: S1, S2, S3 və ya N. Minalardan təmizlənməmiş sahə və bağçılıq üçün ağır şoran torpaq avtomatik N sinfidir. Ekspertlər matrisləri idarəetmə panelində dəyişə bilər; hər yeni versiya bütün sahələri yenidən qiymətləndirir.",
                "Each factor becomes a 0–1 membership; weights come from a two-level AHP (groups first, then factors within each group), each matrix with a consistency ratio below 0.1. The result is a 0–100 score and an FAO class: S1, S2, S3 or N. A plot not cleared of mines, or strongly saline soil for orchards, is class N whatever the score. Experts edit the matrices in the admin console, and each new version re-scores every plot."
              )}
            </p>
            <p className="mt-2">
              {L(
                "Sahə səhifəsində “Niyə?” bölməsi hər amilin dəyərini, balını, çəkisini və bala töhfəsini göstərir. Uyğunluq qərar dəstəyidir; yekun qərarı müsabiqə komissiyası verir.",
                "On the plot page, the “Why?” section shows each factor's value, membership, weight and contribution to the score. Suitability is decision support; the competition commission makes the final decision."
              )}
            </p>
          </Section>

          <Section id="komekci" title={L("Aqrar köməkçi", "Agro assistant")}>
            <p>
              {L(
                "Portalın sağ aşağı küncündəki köməkçi süni intellekt modelidir və yalnız portalın öz məlumatları ilə işləyir: kataloqda axtarır, sahənin məlumatını oxuyur, sahələri müqayisə edir, müsabiqələri və statistikanı göstərir, daxil olmuş istifadəçinin müraciətlərinə baxır. Cavabdakı sahə kodları birbaşa sahə səhifəsini açır. Sual yazmaq və ya səslə demək olar. Köməkçi qərar vermir və heç nəyi dəyişmir.",
                "The assistant at the bottom right of the portal is an AI model that works only with the portal's own data: it searches the catalogue, reads plot details, compares plots, shows competitions and statistics, and looks at a signed-in user's applications. Plot codes in its answers open the plot page directly. Questions can be typed or dictated. The assistant makes no decisions and changes nothing."
              )}
            </p>
          </Section>

          <Section id="tehlukesizlik" title={L("Təhlükəsizlik və fərdi məlumatlar", "Security and personal data")}>
            <ul className="list-disc space-y-1.5 pl-5">
              {SECURITY.map((s) => (
                <li key={s[0]}>{t(s)}</li>
              ))}
            </ul>
            <p className="mt-2">
              {L("Ətraflı:", "Details:")}{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                {L("Məxfilik siyasəti", "Privacy policy")}
              </Link>
              .
            </p>
          </Section>

          <Section id="menbeler" title={L("Məlumat mənbələri və lisenziyalar", "Data sources and licences")}>
            <dl className="divide-y divide-border">
              {SOURCES.map((s) => (
                <div key={s.title[0]} className="grid gap-1 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
                  <dt className="font-medium text-ink">{t(s.title)}</dt>
                  <dd>
                    {t(s.text)}
                    <span className="mt-0.5 block text-13 text-ink-3">{t(s.license)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="yol-xeritesi" title={L("İnkişaf yol xəritəsi (4–8 həftə)", "Roadmap (4–8 weeks)")}>
            <div className="grid gap-3 md:grid-cols-3">
              {ROADMAP.map((r) => (
                <div key={r.when[0]} className="rounded-md border border-border px-3 py-2">
                  <div className="font-mono text-2xs text-ink-3">{t(r.when)}</div>
                  <div className="font-medium text-ink">{t(r.title)}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-13">
                    {r.items.map((item) => (
                      <li key={item[0]}>{t(item)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
