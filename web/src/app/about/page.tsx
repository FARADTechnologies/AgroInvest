import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Haqqında və arxitektura" };

const TOC = [
  ["mesele", "Problem və həll"],
  ["proses", "Proses xəritəsi"],
  ["arxitektura", "Arxitektura"],
  ["ektis", "EKTİS inteqrasiyası"],
  ["uygunluq", "Uyğunluq metodikası"],
  ["tehlukesizlik", "Təhlükəsizlik və fərdi məlumatlar"],
  ["menbeler", "Məlumat mənbələri"],
  ["yol-xeritesi", "İnkişaf yol xəritəsi"]
] as const;

type Lane = "Administrator" | "İstifadəçi" | "Komissiya" | "EKTİS" | "Sistem";

const LANE_STYLE: Record<Lane, string> = {
  Administrator: "bg-accent-50 text-accent-text",
  İstifadəçi: "bg-status-received-bg text-status-received-fg",
  Komissiya: "bg-primary-50 text-primary",
  EKTİS: "bg-status-info-bg text-status-info-fg",
  Sistem: "bg-surface-2 text-ink-2"
};

const PROCESS: { lane: Lane; title: string; text: string; status?: string }[] = [
  {
    lane: "Administrator",
    title: "Elan yerləşdirir",
    text: "İdarəetmə panelində sahəni xəritədə künc nöqtələri ilə qeyd edir, təyinatı, icarə şərtlərini, minimum investisiyanı və son tarixi yazır. Ölçü, rayon və ən yaxın kənd PostGIS-də hesablanır; minatəmizləmə sertifikatı olmayan sahə elan edilə bilməz.",
    status: "Dərc edilib"
  },
  {
    lane: "Sistem",
    title: "Uyğunluğu qiymətləndirir",
    text: "Hər yeni sahə dərhal çoxmeyarlı CİS təhlili ilə (AHP çəkiləri, FAO sinifləri) hər fəaliyyət üzrə qiymətləndirilir və bal izahı ilə göstərilir."
  },
  {
    lane: "İstifadəçi",
    title: "Tərcihlərini qeyd edir",
    text: "İnvestisiya büdcəsini və maraqlandığı sahələri (əkinçilik, heyvandarlıq, bağçılıq…) yazır. Kataloq bu tərcihlərə görə avtomatik filtrlənir; filtri istədiyi vaxt dəyişə bilər."
  },
  {
    lane: "İstifadəçi",
    title: "Elan seçir",
    text: "Xəritə, kataloq, axtarış, təyinat və maliyyə filtrləri, sahələrin müqayisəsi və uyğunluq təhlili ilə."
  },
  {
    lane: "İstifadəçi",
    title: "Elektron müraciət göndərir",
    text: "Fiziki şəxs (FİN) və ya hüquqi şəxs (VÖEN), biznes plan, elanın tələb etdiyi sənədlər. Göndərildikdə müraciət nömrəsi verilir.",
    status: "Qəbul edilib · QIM-İİİİ-NNNNNN"
  },
  {
    lane: "EKTİS",
    title: "Fermer reyestri sorğusu",
    text: "İstifadəçi öz FİN/VÖEN-inin EKTİS-də fermer kimi qeydiyyatda olub-olmadığını yoxlaya bilər (xarici vətəndaşlar üçün tətbiq olunmur). Bu məlumatlandırıcıdır, müraciəti dayandırmır."
  },
  {
    lane: "Administrator",
    title: "Müraciətləri izləyir",
    text: "Elanlara gələn müraciətləri, investisiya həcmini, iş yerlərini və statusu idarəetmə panelində görür."
  },
  {
    lane: "Komissiya",
    title: "Müraciətə baxır",
    text: "FİN/VÖEN maskalanır; tam dəyər yalnız səbəb göstərilərək açılır. Hər baxış və sənəd yükləməsi audit jurnalına yazılır.",
    status: "Baxılır"
  },
  {
    lane: "İstifadəçi",
    title: "Əlavə məlumat təqdim edir",
    text: "Komissiya səbəb və lazım olan sənədləri göstərir; müraciətçi bildiriş alır, sənədi yükləyib cavab verir və müraciət yenidən baxışa qayıdır.",
    status: "Əlavə məlumat tələb olunur ⇄ Baxılır"
  },
  {
    lane: "Komissiya",
    title: "Qərar verir",
    text: "Qalib və ya İmtina, səbəb mütləqdir. Qərar yekundur; hər sahə üzrə yalnız bir qalib ola bilər. Qərarı insan verir, sistem yalnız dəstək göstərir.",
    status: "Qərar verilib"
  },
  {
    lane: "Sistem",
    title: "Qərar EKTİS-ə ötürülür",
    text: "Qalib qərarı eyni tranzaksiyada növbəyə yazılır və arxa planda göndərilir. EKTİS cavab verməsə, avtomatik təkrar cəhd edilir; hər çağırış İnteqrasiya logunda görünür."
  },
  {
    lane: "İstifadəçi",
    title: "Nəticəni və tarixçəni görür",
    text: "Hər status dəyişikliyi vaxtı, icraçının rolu və səbəbi ilə tarixçədə saxlanılır və bildirişlə çatdırılır: inzibati proses şəffafdır."
  }
];

const STACK = [
  {
    title: "Veb tətbiq",
    tech: "Next.js 15, React 19, TypeScript, Tailwind, MapLibre GL",
    text: "Xəritə, kataloq, istifadəçi kabineti və ayrıca idarəetmə paneli. API ilə yalnız OpenAPI-dən yaradılan tipli müştəri vasitəsilə danışır; biznes qaydaları serverdədir."
  },
  {
    title: "Portal API",
    tech: "Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic",
    text: "Modullar: identifikasiya, sahələr, müsabiqələr, müraciətlər, sənədlər, bildirişlər, hesabatlar, audit, inteqrasiya. Status maşını və qaydalar yalnız burada."
  },
  {
    title: "Verilənlər bazası",
    tech: "PostgreSQL 16 + PostGIS 3.4",
    text: "Sahə poliqonları, məsafələr, axtarış (diakritikadan asılı olmayan və yazı xətasına dözümlü), bütövlük məhdudiyyətləri (bir sahəyə bir qalib, dörd göz)."
  },
  {
    title: "EKTİS (simulyasiya)",
    tech: "Java 21, Spring Boot 3, OpenAPI",
    text: "Real EKTİS-ə qoşulmur. Fermer reyestri sorğusu və torpaqdan istifadə qərarlarının qəbulu üçün müqavilə; nasazlıq simulyasiyası ilə."
  },
  {
    title: "Şlüz",
    tech: "nginx",
    text: "Şəbəkədə yeganə açıq giriş nöqtəsi: real müştəri ünvanını ötürür, API-yə təhlükəsizlik başlıqları əlavə edir. API, EKTİS və baza yalnız daxili şəbəkədədir."
  },
  {
    title: "CİS emalı",
    tech: "Python, GeoPandas, GDAL (oflayn)",
    text: "OpenStreetMap çıxarışından rayon sərhədləri, kəndlər, sahələr, yollar və su obyektləri hazırlanır; nəticələr repozitoriyada saxlanılır, demo internetsiz işləyir."
  }
];

const SECURITY = [
  "Şifrələr Argon2id ilə saxlanılır; sessiya httpOnly və SameSite=Strict kukidədir (60 dəqiqə).",
  "5 uğursuz girişdən sonra hesab 10 dəqiqəlik bloklanır; bir ünvandan çox sayda uğursuz giriş və qeydiyyat məhdudlaşdırılır.",
  "Rollar: İstifadəçi (Azərbaycan və ya xarici vətəndaş, müraciət edir), Komissiya (mütəxəssis və rəhbər), Administrator (torpağı təklifə çıxarır, elan yerləşdirir, sənədləri təsdiqləyir). Hər API çağırışında rol yoxlanılır; başqasının müraciəti “tapılmadı” kimi görünür.",
  "Qeydiyyatda fərdi məlumatların emalına razılıq alınır (“Fərdi məlumatlar haqqında” Qanun).",
  "FİN/VÖEN siyahılarda, baxış ekranında və Excel hesabatında maskalanır; tam dəyərə baxış səbəblə və audit qeydi ilə mümkündür.",
  "Audit jurnalı: müraciətə baxış, sənəd yükləmə, status dəyişikliyi, müsabiqə təsdiqi, hesabat ixracı, EKTİS əməliyyatları, rola uyğun olmayan API çağırışları. Jurnal yalnız əlavə olunur və SHA-256 heş zəncirinə bağlanır; rəhbər bütövlüyü yoxlaya bilər.",
  "Sənədlər məzmununa görə yoxlanılır (PDF, şəkil, ofis faylı), ölçü məhdudlaşdırılır, veb kökündən kənarda təsadüfi adla saxlanılır.",
  "Gizli açarlar yalnız mühit dəyişənlərindədir; repozitoriyada sirr saxlanılmır."
];

const SOURCES = [
  {
    title: "OpenStreetMap",
    text: "Rayon sərhədləri, kənd adları (yalnız name:az), kənd təsərrüfatı poliqonları, yollar və su obyektləri. Geofabrik çıxarışı, 14.10.2026.",
    license: "© OpenStreetMap contributors, ODbL 1.0"
  },
  {
    title: "Peyk təsviri",
    text: "Sentinel-2 əsasında buludsuz mozaika (10 m), yer adları olmadan.",
    license: "EOxCloudless 2025, EOX IT Services GmbH, Copernicus Sentinel məlumatları, CC BY-NC-SA 4.0"
  },
  {
    title: "Altlıq xəritə",
    text: "Etiketsiz vektor altlıq; sərhəd və adlar yalnız portalın öz qatlarındandır. İnternet olmadıqda sadə oflayn fon.",
    license: "© CARTO, © OpenStreetMap contributors"
  },
  {
    title: "Nümayiş məlumatları",
    text: "61 sahədən 46-sı real OSM poliqonu, 15-i nümayiş üçün yaradılıb. Minatəmizləmə statusu, icarə şərtləri, müsabiqələr, müraciətlər və şəxslər nümayiş məqsədlidir; real şərtləri Nazirlik müəyyən edir.",
    license: "Prototip"
  },
  {
    title: "Şrift",
    text: "IBM Plex Sans və Mono: Azərbaycan əlifbasının bütün hərfləri.",
    license: "SIL Open Font License 1.1"
  }
];

const ROADMAP = [
  {
    when: "1–2-ci həftə",
    title: "Texniki audit və tələblərin dəqiqləşdirilməsi",
    items: [
      "Prototipin kod, təhlükəsizlik və məlumat modeli üzrə auditi",
      "Nazirlik mütəxəssisləri ilə müsabiqə qaydaları, sənəd siyahıları, qiymətləndirmə meyarları",
      "Proses xəritəsinin real iş axını ilə tutuşdurulması"
    ]
  },
  {
    when: "3–5-ci həftə",
    title: "İnteqrasiyalar",
    items: [
      "Səlahiyyətli qurumun razılığı ilə EKTİS-ə EHİS üzərindən qoşulma (konfiqurasiya ilə dəyişdirilən müştəri)",
      "ASAN Login ilə giriş, ASAN İmza ilə müraciətin imzalanması",
      "ANAMA məlumatları ilə real minatəmizləmə statusu; rəsmi parsel məlumatları"
    ]
  },
  {
    when: "6–8-ci həftə",
    title: "Pilot versiya",
    items: [
      "Sənədlər üçün obyekt anbarı, ehtiyat nüsxə, çoxnüsxəli API və idarə olunan PostgreSQL",
      "Audit jurnalının zəncirvari heşlə qorunması, e-poçt və SMS bildirişləri",
      "Relyef (DEM) və torpaq məlumatları ilə uyğunluq təhlilinin dəqiqləşdirilməsi; komissiya üçün qiymətləndirmə matrisi",
      "İngilis və rus dilləri, əlçatanlıq auditi, yük testi"
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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl">Agro Invest: haqqında və arxitektura</h1>
      <p className="mt-2 max-w-3xl text-ink-2">
        İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı sahələri üzrə investisiya müsabiqəsinin elektron portalının
        prototipi. Gələcəkdə Kənd Təsərrüfatı Nazirliyinin Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS)
        inteqrasiya üçün hazırlanıb.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Bölmələr" className="lg:sticky lg:top-20 lg:self-start">
          <ol className="space-y-1 text-sm">
            {TOC.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <span className="tabular text-ink-3">{i + 1}.</span> {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          <Section id="mesele" title="Problem və həll">
            <p>
              Müraciətçi üçün azad edilmiş ərazilərdə hansı sahənin, hansı şərtlərlə və nə vaxta qədər təklif edildiyini
              tapmaq, müraciət etmək və müraciətin taleyini izləmək çətindir; Nazirlik üçün isə müraciətlərin qəbulu,
              baxılması və qərarların uçotu kağız və dağınıq kanallarla aparılır.
            </p>
            <p className="mt-2">
              Portal bu prosesi bir yerdə birləşdirir: administratorun yerləşdirdiyi elanlar, istifadəçinin tərcihlərinə görə
              filtrlənən xəritə və kataloq, elektron müraciət, statusun izlənməsi və bildirişlər, komissiya üçün idarəetmə
              paneli, statistika və hesabatlar, EKTİS ilə məlumat mübadiləsi.
            </p>
          </Section>

          <Section id="proses" title="Proses xəritəsi">
            <ol className="relative space-y-3">
              {PROCESS.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-border-strong bg-surface text-13 font-medium tabular text-ink">
                    {i + 1}
                  </span>
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-sm px-1.5 py-0.5 text-2xs font-medium ${LANE_STYLE[step.lane]}`}>{step.lane}</span>
                      <span className="font-medium text-ink">{step.title}</span>
                      {step.status && <span className="font-mono text-2xs text-ink-3">{step.status}</span>}
                    </div>
                    <p className="mt-1">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="arxitektura" title="Arxitektura">
            <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2">
                <div className="font-medium text-ink">Brauzer</div>
                <div className="text-13">İstifadəçi, komissiya, administrator</div>
              </div>
              <ArrowRight className="mx-auto hidden size-4 self-center text-ink-3 md:block" aria-hidden />
              <ArrowDown className="mx-auto size-4 text-ink-3 md:hidden" aria-hidden />
              <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2">
                <div className="font-medium text-ink">nginx şlüzü</div>
                <div className="text-13">/api → API, qalanı → veb</div>
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
                <div key={s.title} className="rounded-md border border-border px-3 py-2">
                  <div className="font-medium text-ink">{s.title}</div>
                  <div className="font-mono text-2xs text-ink-3">{s.tech}</div>
                  <p className="mt-1 text-13">{s.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Hər şey bir əmrlə (<span className="font-mono text-13">docker compose up</span>) nümayiş məlumatları ilə qalxır.
              API sənədləri: <Link href="/api/v1/docs" className="text-primary hover:underline">OpenAPI (Swagger)</Link>.
            </p>
          </Section>

          <Section id="ektis" title="EKTİS inteqrasiyası">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Müqavilə əvvəlcədən müəyyənləşdirilib (OpenAPI): fermer reyestri sorğusu FİN/VÖEN ilə və torpaqdan istifadə
                qərarının qəbulu.
              </li>
              <li>
                Qalib qərarı ilə EKTİS mesajı eyni tranzaksiyada yazılır (transactional outbox): qərar mesajsız saxlanıla
                bilməz, EKTİS-in əlçatmazlığı mütəxəssisi dayandırmır.
              </li>
              <li>
                Arxa plan prosesi mesajları göndərir; uğursuz cəhddən sonra 5, 10, 20, sonra hər 30 saniyədən bir təkrar
                edilir. Qərarın identifikatoru idempotentlik açarıdır: təkrar göndərmə ikinci qeydiyyat yaratmır.
              </li>
              <li>
                Hər çağırış izləmə identifikatoru (X-Request-ID), müddəti və nəticəsi ilə İnteqrasiya logunda görünür;
                identifikatorlar maskalanır. Sorğular API açarı ilə imzalanır.
              </li>
              <li>
                Real sistemə qoşulma yalnız səlahiyyətli qurumun razılığı ilə, Elektron Hökumət İnformasiya Sistemi (EHİS)
                üzərindən nəzərdə tutulub. Müştəri konfiqurasiya ilə dəyişir; portal kodu dəyişmir. Prototip real EKTİS-ə
                heç vaxt müraciət etmir.
              </li>
            </ul>
          </Section>

          <Section id="uygunluq" title="Uyğunluq metodikası (qərar dəstəyi)">
            <p>
              Hər sahə əkinçilik, bağçılıq və heyvandarlıq üçün çoxmeyarlı CİS təhlili ilə qiymətləndirilir. Amillər: su
              mənbəyinə məsafə, əsas yola məsafə, yaşayış məntəqəsinə məsafə, torpaq örtüyü (OSM) və relyef. Məsafələr
              PostGIS-də ölçülür, hər amil 0–1 balına çevrilir, çəkilər hər fəaliyyət üçün AHP cüt müqayisə matrisindən
              alınır (uyğunluq nisbəti 0,1-dən kiçik). Nəticə 0–100 bal və FAO sinfidir: S1, S2, S3 və ya N.
              Minalardan təmizlənməmiş sahə avtomatik N sinfidir.
            </p>
            <p className="mt-2">
              Hər sahənin səhifəsində “Niyə?” cədvəli hər amilin dəyərini, balını və çəkisini göstərir. Uyğunluq qərar
              dəstəyidir; yekun qərarı müsabiqə komissiyası verir. Relyef hazırda rayon səviyyəsində təxminidir; pilotda
              rəqəmsal relyef modeli (DEM) ilə əvəzlənəcək.
            </p>
          </Section>

          <Section id="tehlukesizlik" title="Təhlükəsizlik və fərdi məlumatlar">
            <ul className="list-disc space-y-1.5 pl-5">
              {SECURITY.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2">
              Ətraflı: <Link href="/privacy" className="text-primary hover:underline">Məxfilik siyasəti</Link>.
            </p>
          </Section>

          <Section id="menbeler" title="Məlumat mənbələri və lisenziyalar">
            <dl className="divide-y divide-border">
              {SOURCES.map((s) => (
                <div key={s.title} className="grid gap-1 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
                  <dt className="font-medium text-ink">{s.title}</dt>
                  <dd>
                    {s.text}
                    <span className="mt-0.5 block text-13 text-ink-3">{s.license}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="yol-xeritesi" title="İnkişaf yol xəritəsi (4–8 həftə)">
            <div className="grid gap-3 md:grid-cols-3">
              {ROADMAP.map((r) => (
                <div key={r.when} className="rounded-md border border-border px-3 py-2">
                  <div className="font-mono text-2xs text-ink-3">{r.when}</div>
                  <div className="font-medium text-ink">{r.title}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-13">
                    {r.items.map((item) => (
                      <li key={item}>{item}</li>
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
