"use client";

import { useL } from "@/lib/i18n";

const SECTIONS: { title: [string, string]; text: [string, string] }[] = [
  {
    title: ["Hansı məlumatlar toplanır", "What is collected"],
    text: [
      "Ad, soyad, e-poçt, telefon, FİN (Azərbaycan vətəndaşları üçün), pasport (xarici vətəndaşlar üçün) və ya VÖEN (hüquqi şəxslər üçün), investisiya büdcəsi və maraqlar, müraciətə əlavə edilən sənədlər və investisiya layihəsinin məlumatları.",
      "Name, e-mail, phone, FİN (Azerbaijani citizens), passport (foreign citizens) or VÖEN (companies), investment budget and interests, the documents attached to an application and the details of the investment project."
    ]
  },
  {
    title: ["Nə məqsədlə istifadə olunur", "Why it is used"],
    text: [
      "Məlumatlar yalnız investisiya müsabiqəsində iştirak, müraciətə baxılması və qərarın icrası üçün emal olunur. Qalib müəyyən edildikdə qərar Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS) ötürülür.",
      "The data is processed only to take part in an investment competition, review the application and carry out the decision. When a winner is chosen, the decision is sent to the Electronic Agriculture Information System (EKTİS)."
    ]
  },
  {
    title: ["Kim baxa bilər", "Who can see it"],
    text: [
      "Müraciətinizi yalnız siz və səlahiyyətli Nazirlik mütəxəssisləri görə bilər. Siyahılarda FİN və VÖEN maskalanır; tam məlumata baxış qeydə alınır.",
      "Only you and authorised Ministry specialists can see your application. FİN and VÖEN are masked in lists, and every view of the full value is recorded."
    ]
  },
  {
    title: ["Necə qorunur", "How it is protected"],
    text: [
      "Şifrələr bərpa edilməyən formada saxlanılır, sessiya qorunan kuki ilə idarə olunur, sənədlər yoxlanılaraq verilənlər bazasında saxlanılır və hər inzibati əməliyyat audit jurnalına yazılır.",
      "Passwords are stored in a form that cannot be reversed, the session uses a protected cookie, documents are checked and stored in the database, and every administrative action is written to the audit log."
    ]
  },
  {
    title: ["Aqrar köməkçi", "Agro assistant"],
    text: [
      "Köməkçiyə yazdığınız suallar cavab hazırlamaq üçün süni intellekt xidmətinə göndərilir. Suala fərdi məlumat (FİN, VÖEN, telefon) yazmayın. Səslə yazma brauzerin nitq tanıma xidmətindən istifadə edir.",
      "Questions you write to the assistant are sent to an AI service to prepare the answer. Do not put personal data (FİN, VÖEN, phone) in a question. Dictation uses the browser's speech recognition service."
    ]
  }
];

export function PrivacyContent() {
  const L = useL();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl">{L("Məxfilik siyasəti", "Privacy policy")}</h1>
      <p className="mt-2 text-ink-2">
        {L(
          "Fərdi məlumatlar “Fərdi məlumatlar haqqında” Azərbaycan Respublikasının Qanununa uyğun olaraq emal olunur. Bu səhifə prototip üçün hazırlanıb.",
          "Personal data is processed under the Law of the Republic of Azerbaijan on Personal Data. This page was written for the prototype."
        )}
      </p>
      <div className="mt-8 divide-y divide-border rounded-3xl border border-border/70 bg-surface shadow-card">
        {SECTIONS.map((s) => (
          <section key={s.title[0]} className="px-5 py-4">
            <h2 className="text-15">{L(...s.title)}</h2>
            <p className="mt-1 text-sm text-ink-2">{L(...s.text)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
