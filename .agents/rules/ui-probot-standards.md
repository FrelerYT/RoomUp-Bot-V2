---
description: ProBot & Dyno Human-Grade UI/UX Standards for RoomUp! V2
always_on: true
---

# ProBot & Dyno Human-Grade UI/UX Standards for RoomUp! V2

## 1. Principio Anti-Blue-Tint & Pure Neutral Dark Theme
- **Zero Dominante Bluastra / Navy Slop**: Lo sfondo e le card NON devono mai essere blu, navy o indaco (`#121626`, `rgba(18, 23, 41)`).
- **Palette Neutra Antracite/Carbone (Stile ProBot & Discord Reale)**:
  - Sfondo Base: `#0e0e11` (nero antracite profondo neutro)
  - Barra Server Rail: `#08080a`
  - Barra Laterale (Sidebar): `#121317`
  - Superfici & Card: `#18191f` (grafite scuro solido e pulito)
  - Hover Card: `#1f2028`
  - Input & Campi: `#101115`
  - Bordi: `rgba(255, 255, 255, 0.06)`
- **Zero Gradienti Radiali a Tutto Schermo**: Vietati `radial-gradient` invadenti che inondano il contenuto di luce blu/viola. Lo sfondo deve essere opaco, calmo e uniforme.
- **Accenti Mirati**: Il Discord Blurple (`#5865F2`) e il gradiente brand (`#5865F2` -> `#8b5cf6` -> `#ec4899`) vanno usati esclusivamente per elementi interattivi specifici (bottone primario di salvataggio, switch attivi, pillola di selezione).

## 2. Precisione del Layout e della Barra Server
- **Indicatore Server Attivo (Pillola Discord)**: La pillola bianca verticale deve essere posizionata a sinistra nel margine della barra (`left: 0` della rail), MAI sovrapposta all'icona o avatar del server (`overflow: hidden` sull'avatar non deve tagliare l'indicatore).
- **Posizione Tasto Aggiungi Server (+)**: Il pulsante verde "+" per aggiungere il bot a nuovi server deve trovarsi immediatamente sotto l'ultimo server della lista nel rail (nel normale flusso verticale, con divisore orizzontale sotto il tasto home), MAI forzato in fondo alla finestra tramite `margin-top: auto`.
- **Header Uniforme**: Altezze coerenti (38px/40px) per tutti i bottoni d'azione (`Server`, `Esci`, `Salva`), breadcrumb pulite e integrate senza capsule fluttuanti staccate.
- **Bottoni di Configurazione Espliciti**: I tasti *"Configura"* nelle card devono essere bottoni definiti e visibili con affordance chiara (`.btn-module-config`), non testo semplice buttato nell'angolo.
