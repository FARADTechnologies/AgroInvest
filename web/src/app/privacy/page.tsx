export const metadata = { title: "Məxfilik siyasəti" };

const SECTIONS = [
  {
    title: "Hansı məlumatlar toplanır",
    text: "Ad, soyad, e-poçt, telefon, FİN (fiziki şəxslər üçün) və ya VÖEN (hüquqi şəxslər üçün), müraciətə əlavə edilən sənədlər və investisiya layihəsinin məlumatları."
  },
  {
    title: "Nə məqsədlə istifadə olunur",
    text: "Məlumatlar yalnız investisiya müsabiqəsində iştirak, müraciətə baxılması və qərarın icrası üçün emal olunur. Qalib müəyyən edildikdə qərar Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS) ötürülür."
  },
  {
    title: "Kim baxa bilər",
    text: "Müraciətinizi yalnız siz və səlahiyyətli Nazirlik mütəxəssisləri görə bilər. Siyahılarda FİN və VÖEN maskalanır; tam məlumata baxış qeydə alınır."
  },
  {
    title: "Necə qorunur",
    text: "Şifrələr bərpa edilməyən formada saxlanılır, sessiya qorunan kuki ilə idarə olunur, sənədlər veb serverdən kənarda təsadüfi adlarla saxlanılır və hər inzibati əməliyyat audit jurnalına yazılır."
  }
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl">Məxfilik siyasəti</h1>
      <p className="mt-2 text-ink-2">
        Fərdi məlumatlar “Fərdi məlumatlar haqqında” Azərbaycan Respublikasının Qanununa uyğun olaraq emal olunur.
        Bu səhifə prototip üçün hazırlanıb.
      </p>
      <div className="mt-8 divide-y divide-border rounded-md border border-border bg-surface">
        {SECTIONS.map((s) => (
          <section key={s.title} className="px-5 py-4">
            <h2 className="text-15">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{s.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
