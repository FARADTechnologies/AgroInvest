# Demo script

There is no pitch deck: the running portal is the presentation. One laptop runs the whole stack;
a second screen (second laptop on the same hotspot, or an incognito window) plays the second role.

## Before the demo

1. `./scripts/reset-demo.ps1` (fresh database, deadlines relative to now, empty EKTIS inbox).
2. Open the tabs below and sign in where noted. Check `http://localhost:3000/api/v1/health`.
3. Second laptop: `http://<server IPv4>:3000` over the phone hotspot (firewall rule in the README).
4. Have the backup video ready. If the internet fails, nothing changes except the basemap;
   `/map?offline=1` shows the offline map deliberately.

| Screen | Account (password `Demo2026!`) | Start page |
|---|---|---|
| A (main) | visitor, then a new entrepreneur | `/map` |
| B (second) | `mutexessis@agro-demo.test` (specialist) | `/admin/applications` |
| B (later) | `rehber@agro-demo.test` (supervisor), incognito | `/admin/competitions` |

## Core path (about 3 minutes)

| # | Screen | Do | Say |
|---|---|---|---|
| 1 | A | `/map`: chip **Heyvandarlıq**, click a plot, **Ətraflı** | "Every plot with its size, purpose, terms and competition deadline. Demo data is labelled." |
| 1a | A | Scroll to **Uyğunluq**: "Niyə 78?" | "A transparent GIS score per activity: distances, land cover, relief, AHP weights. Decision support only." |
| 1b | A | Map: **Peyk**; search `fizuli`; **Maliyyə şərtləri** | "Satellite without foreign labels; search ignores diacritics and typos; filter by cost." |
| 1c | A | Add two to four plots to compare → **Müqayisə et** → **Qərar dəstəyi** | "Side by side, then a TOPSIS ranking with your own priorities and a stability check. No fake AI." |
| 2 | A | **Daxil ol → Qeydiyyatdan keçin** (consent), company profile with a VÖEN, **EKTİS-də yoxla** | "Consent per the personal data law. The applicant can check their EKTIS farmer registration." |
| 2a | A | Plot → **Müraciət et** → wizard → **Göndər** → number `QIM-…` → **Arayış** | "The number is issued on submission; the receipt prints or saves as PDF." |
| 3 | B | Queue → open it (VÖEN masked) → **Baxılmağa götür** → **Əlavə məlumat tələb et** with a reason and a document | "Staff see masked identifiers; every view is in the audit log." |
| 4 | A | Bell → upload the document → **Cavabı göndər** | "The applicant answers inside the system; the history shows every reason." |
| 5 | B | **Qərar ver → Qalib** → menu **İnteqrasiya logu** | "The decision goes to EKTIS through an outbox: here is the call, its status and correlation id." |

## Extras (pick by remaining time)

* **EKTIS outage** (B): **Nasazlığı simulyasiya et** → decide another winner → message stays
  *Növbədə*, failed attempts in the log → **EKTİS-i bərpa et** → *Çatdırılıb* with its reference.
* **Maker-checker** (B, specialist then supervisor): create a competition → **Təsdiqə göndər**;
  as supervisor **Düzəlişə qaytar** with a comment or **Təsdiq et və dərc et**. The creator cannot
  approve their own competition.
* **Security**: as the entrepreneur open `/admin/applications` → *Giriş qadağandır*; open another
  person's application id → *tapılmadı*. As the specialist **Göstər** the VÖEN with a reason.
* **Statistics**: `/admin/stats`, **Excel hesabatı** (identifiers masked, Baku time).
* **New plot** (B): `/admin/areas/new`, load a `.geojson` file; code, size, rayon and suitability
  are computed at once.
* **Architecture**: `/about` (process map, architecture, EKTIS flow, roadmap) and `/api/v1/docs`.

## If something goes wrong

* Map is blank: reload; if the internet is down use `/map?offline=1`.
* Dev page stuck on a skeleton: reload (only in development mode).
* EKTIS mock not answering: it is the outage scenario; show the queue and the retries.
* Second laptop cannot connect: use an incognito window on the main laptop.
