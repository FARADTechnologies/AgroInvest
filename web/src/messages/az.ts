// Azerbaijani UI copy. Status and purpose terms are taken verbatim from the
// technical task. An English catalogue with the same shape can be added later.

export const az = {
  app: {
    name: "Aqrar İnvestisiya Portalı",
    prototype: "Prototip",
    description:
      "İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı təyinatlı sahələr üzrə investisiya müsabiqəsi portalı"
  },
  nav: {
    map: "Xəritə",
    catalogue: "Kataloq",
    competitions: "Müsabiqələr",
    about: "Haqqında",
    transparency: "Şəffaflıq",
    signIn: "Daxil ol",
    signOut: "Çıxış",
    cabinet: "Şəxsi kabinet",
    admin: "İdarəetmə paneli",
    language: "Dil"
  },
  status: {
    DRAFT: "Qaralama",
    RECEIVED: "Qəbul edilib",
    UNDER_REVIEW: "Baxılır",
    INFO_REQUESTED: "Əlavə məlumat tələb olunur",
    DECIDED: "Qərar verilib"
  },
  statusHint: {
    DRAFT: "Müraciət hələ göndərilməyib",
    RECEIVED: "Müraciət qeydə alınıb və növbəyə daxil olub",
    UNDER_REVIEW: "Mütəxəssis müraciətə baxır",
    INFO_REQUESTED: "Mütəxəssis əlavə məlumat və ya sənəd istəyib",
    DECIDED: "Müraciət üzrə qərar verilib"
  },
  outcome: {
    WON: "Qalib",
    REJECTED: "İmtina"
  },
  purpose: {
    CROP: "Əkinçilik",
    LIVESTOCK: "Heyvandarlıq",
    ORCHARD: "Bağçılıq",
    OTHER: "Digər"
  },
  suitability: {
    title: "Uyğunluq",
    decisionSupport: "Qərar dəstəyi",
    finalDecision: "Yekun qərar komissiya tərəfindən verilir",
    S1: "Yüksək uyğun",
    S2: "Orta uyğun",
    S3: "Az uyğun",
    N: "Uyğun deyil"
  },
  common: {
    demoData: "Demo məlumatı",
    loading: "Yüklənir…",
    error: "Xəta baş verdi",
    retry: "Yenidən cəhd et",
    details: "Ətraflı",
    back: "Geri",
    continue: "Davam et",
    save: "Yadda saxla",
    cancel: "Ləğv et",
    confirm: "Təsdiq et",
    search: "Axtar",
    hectares: "ha",
    daysLeft: "gün qalıb",
    deadlinePassed: "Müddət bitib"
  }
};

export type Messages = typeof az;
