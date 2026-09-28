# Piotr Kansy Software Solutions – strona główna

One-page bez scrolla. W tle działa animowana, interaktywna fabryka w stylu Factorio
(białe linie jak na schemacie technicznym, akcent `#ff9a1f`), na niej treść strony.
Po kilku sekundach przyjeżdża pociąg, dźwig stawia na peronie kontener „Skontaktuj się”,
a jego drzwi odsłaniają linki kontaktowe.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck (tsc) + build do dist/
npm run preview
npm run build:single   # cały serwis w jednym pliku: dist-single/index.html
```

`build:single` wbudowuje JS i CSS w `index.html` (ok. 560 KB, gzip ok. 165 KB), więc stronę można
wrzucić na dowolny hosting statyczny razem z `favicon.svg` i `og-image.png`.

Adres strony (canonical, Open Graph, JSON-LD) ustawia `VITE_SITE_URL` w `.env`
(domyślnie `https://kansy.dev`). Build używa ścieżek względnych (`base: './'`),
więc działa też z podkatalogu, np. na GitHub Pages.

## Stack

- Vite + TypeScript (vanilla, bez frameworka UI)
- PixiJS v8 – cała fabryka rysowana proceduralnie przez `Graphics`/`GraphicsContext`
- treść, kontener i tooltip to zwykły HTML/CSS nałożony na canvas

## Struktura

```
index.html                treść, meta SEO/OG, JSON-LD, kontener z linkami (od początku w HTML)
public/                   favicon.svg (zębatka), og-image.png
src/
  main.ts                 start: Pixi, pomiar DOM -> layout -> fabryka, ticker, resize, visibility
  config.ts               kolory, grubości linii, parametry symulacji i pociągu
  style.css               treść, kontener (drzwi w CSS 3D), tooltip, podpowiedź, --tile
  ui/Cargo.ts             kontener „Skontaktuj się”: aria-expanded, Esc, transport pociągiem
  ui/Tooltip.ts           tooltip w stylu Factorio („Piec – WŁ”)
  ui/Crane.ts             belka dźwigu (HTML, żeby przejeżdżała nad kontenerem)
  factory/
    blueprints.ts         linie produkcyjne jako dane (ASCII)
    blueprint.ts          parser blueprintów + odbicia lustrzane
    layout.ts             strefa treści, tory, stacja, pakowanie linii w wolne obszary
    types.ts              LayoutData – czyste dane (bez obiektów Pixi)
    geometry.ts           kierunki, ścieżka po kaflach parametryzowana długością łuku
    Factory.ts            buduje encje z danych, łączy porty, jedna pętla update/render
    Belt.ts  Inserter.ts  Assembler.ts  Furnace.ts  Drill.ts  Chest.ts  Pipe.ts
    Machine.ts            baza maszyn: WŁ/WYŁ, dioda, podświetlenie
    Train.ts              pociąg, sterowanie dźwigiem, dostawa kontenera, składy towarowe
    Agv.ts                wózki AGV: wymiana pełnych skrzyń na puste
    Track.ts  Grid.ts     statyczne tory, peron, szyny dźwigu, siatka (rysowane raz)
    Item.ts               przedmioty (ruda, płytka, zębatka) ze wspólnym GraphicsContext
```

## Model danych

**Layout** (`LayoutData`) to czyste dane w jednostkach kafli: listy maszyn
(`{type, x, y, w, h}`), taśm (łańcuch kafli z kierunkiem), inserterów (`{x, y, dir}`),
rur (od zbiornika do odbiorcy), słupów, prostokąt strefy treści i geometria stacji.
Generator nie ma zahardkodowanych współrzędnych: mierzy w DOM blok tekstu i slot stacji,
ustawia siatkę tak, żeby tor i kontener leżały na kaflach, a potem pakuje blueprinty
w cztery obszary wokół treści (nad, pod, po bokach). Linie najbliżej tekstu są zawsze
kompletne, zewnętrzne mogą wystawać poza ekran. Przy zmianie rozmiaru wszystko liczy się od nowa.

Legenda blueprintów: `> < ^ v` taśma, `e s w n` inserter (kierunek odkładania),
`M` wiertło 2x2 (źródło), `F` piec 2x2, `A` maszyna montażowa 3x3, `C` skrzynia (ujście),
`T` zbiornik 2x2, `=` rura.

```
MM>>>>v...........AAA........      ruda -> piec -> płytka -> maszyna -> zębatka -> skrzynia
MM....v....FF.....AAA......C.      (druga skrzynia nad ostatnim robotem)
......>>>>eFFe>>>eAAAe>>>>>eC
```

**Symulacja** (`Factory.update`, krok maks. 1/30 s):

- taśma – kolejka przedmiotów z pozycją `s` wzdłuż ścieżki; minimalny odstęp 0,5 kafla,
  czoło staje na końcu taśmy albo gdy następna taśma nie ma miejsca; taśma zapchana aż do
  początku i bez ruchu uznawana jest za stojącą (szewrony płynnie się zatrzymują),
- inserter – stany `pick → toDrop → drop → toPick`; bierze tylko to, czego chce cel,
  i czeka z przedmiotem, aż cel ma miejsce,
- piec/maszyna – `on/off`, bufor wejścia i wyjścia, postęp; wiertło czeka, gdy taśma jest pełna,
- przedmioty nie znikają ani nie pojawiają się poza wiertłem (źródło) i skrzynią (ujście);
  piec zamienia rudę 1:1 na płytkę, maszyna 2 płytki na zębatkę,
- przepustowość każdego etapu jest większa niż etapu przed nim, więc zdrowa linia płynie,
  a zatory powoduje tylko wyłączona maszyna.

**Wózki AGV.** Ostatni robot każdej linii ma dwie skrzynie (z przodu i z boku). Napełnia
jedną, a gdy jest pełna (24 zębatki albo 40 płytek), przechodzi do drugiej. Po pełną skrzynię
przyjeżdża zza ekranu AGV, wjeżdża pod nią, podnosi ją i wywozi. Po chwili wraca z pustą
i odstawia ją na to samo miejsce. Trasy liczy generator układu (`planAgvRoutes` w
`layout.ts`): Dijkstra po wolnych kaflach z karą za zakręty, więc tory jazdy są proste
i omijają maszyny, tekst i tor kolejowy. Na posadzce widać je jako delikatną przerywaną
linię, a miejsca skrzyń mają narożniki postojowe. Wózek na zakrętach staje i obraca się
w miejscu, a na ostatnich ~1,6 kafla przed skrzynią zwalnia do połowy prędkości. Spod
skrzyni wycofuje się tyłem i trzyma odstęp od wózka jadącego przed nim. Parametry są
w `AGV` i `SIM.chestCapacity` w `config.ts`.

Wyłączenie pieca, maszyny, insertera lub wiertła (klik/tap) zatrzymuje je; przed nimi
taśma się zapycha, za nimi pustoszeje. Po włączeniu wszystko rusza.

## Szkic układu (wygenerowany dla 1366×768)

Spacje – strefa treści (bez maszyn), `=` na całej szerokości – tor, `_`/`#` – peron i kontener,
`:` – trasy wózków AGV (od skrzyni do krawędzi ekranu).

```
.............::.::.........................
v.......AAA..::.::......AAA...........v<<<<
v.FF....AAA..C:.:C......AAA.....FF....v....
>eFFe>>eAAAe>eC.Cw<<<<<wAAAw<<<wFFw<<<<....
:::::::::::......................::::::::::
....FF....:                     .C.......v<
.>>eFFe>>eC                     Cw<<wFFw<<.
>^.......C.        TEKST        :....FF....
::::::::::.                     :.....=....
e>>eAAAe>eC                     :.....==TT.
....AAA..C:                     :.......TT.
:::.AAA..::                     :::::::::::
:::::::::::                     Cw<wAAAw<<w
>v:::::::C:                     .C..AAA....
.>>eFFe>>eC                     ....AAA....
....FF.....      _KONTAKT_      ...........
...........      _#######_      ...........
===========================================
===========================================
...........................................
>v.......AAA.....MM>>v.......C:::.....FF...
.v.FF....AAA..C::MM..>>eFFe>>eC.:Cw<<wFFw<<
.>eFFe>>eAAAe>eC::::::::FF....:.::C:::::..^
................:::::::::::::::.:::::::::::
>>>eFFe>>>eAAAe>>>>>eC:::C.......v<<MM::...
```

## Dostępność i wydajność

- kontener to prawdziwy `<button aria-expanded>`; Tab/Enter/Spacja/Esc, a otwarte drzwi
  zamyka się kliknięciem w skrzydło; napis wraca dopiero po domknięciu drzwi;
  linki są w HTML od początku (zewnętrzne z `target="_blank" rel="noopener"`);
  fokus na kontenerze przed przyjazdem pociągu od razu go dostarcza,
- `prefers-reduced-motion`: bardzo wolna animacja, bez pociągu, kontener od razu na stacji,
- tooltip nad maszyną podpowiada tylko akcję („kliknij, żeby wyłączyć/włączyć”),
- warstwa HTML ma `pointer-events: none`, kliknięcia odbiera canvas (EventSystem,
  `eventMode = 'static'` tylko na maszynach),
- statyczne elementy (siatka, tory, obrysy taśm i rur) rysowane raz; przedmioty, szewrony
  i przerywane linie w rurach to współdzielone `GraphicsContext` przesuwane transformacją,
- pauza tickera przy `visibilitychange`, `resolution` = devicePixelRatio (maks. 2).

Ikony kontaktu: [Feather Icons](https://feathericons.com) (MIT).
