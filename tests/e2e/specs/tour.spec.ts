// The launch tour: one test that walks a writer and screenwriter through Escrita in about five
// minutes, from an empty vault that was never set up. It is a real end-to-end check (every step
// asserts what it shows) and, with RECORD=<folder>, the recording of the launch video.
//
//   npm run build                                       # the spec copies main.js, manifest.json and styles.css
//   TOUR_LANG=en    npx playwright test tour              # fast, no pauses
//   TOUR_LANG=pt-BR npx playwright test tour
//   RECORD=<folder> TOUR_LANG=en    npx playwright test tour   # the video: <folder>/tour-en.mp4
//   RECORD=<folder> TOUR_LANG=pt-BR npx playwright test tour   # <folder>/tour-pt-BR.mp4
//   TOUR_SHOTS=<folder> TOUR_LANG=en npx playwright test tour           # one PNG per caption, no recording
//
// Without RECORD there are no pauses and no caption is waited on (a run is about 45 s). Either way the test logs the
// time the recording would take, step by step ("planned"): the pauses it would hold plus the typing
// at a human speed. Everything the writer sees in the video is in the TEXTS table: the captions, the
// sample prose, the names and the labels of the interface in that language.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { App } from "../lib/app";
import { emptyEn, emptyPt } from "../fixtures";
import { settingsPage } from "../lib/more";
import { editorText, sleep } from "../lib/panels";
import { caption, recordDir, Recorder, removeCaption } from "../lib/record";
import { SetupModal } from "../lib/setup-modal";

type Lang = "en" | "pt-BR";

// ---------------------------------------------------------------------------------------------
// Everything the viewer reads or sees typed, by language.
// ---------------------------------------------------------------------------------------------

interface Texts {
  /** the interface labels the tour clicks */
  ui: {
    both: string; screenwriter: string; everything: string; preview: string; create: string; desk: string;
    setupDone: string; revising: string; pending: string; exported: string; exportPreview: string;
    docxTemplate: string; pdfPage: string; compare: string;
  };
  /** the captions, in the order of the storyboard */
  c: Record<
    | "title" | "setupIntro" | "setupWrites" | "setupLang" | "setupStart" | "setupEverything" | "setupReview"
    | "setupCreate" | "home" | "newStory" | "beat" | "outline" | "beatEdit" | "write" | "ticked" | "moreBeats"
    | "goal" | "sprint" | "sprintStop" | "placeholder" | "phPanel" | "dialogue" | "dialogueOff"
    | "lens" | "lensPanel" | "step" | "rhythm" | "rhythmClick" | "darling" | "darlingPanel"
    | "snap" | "snapChange" | "compare" | "stage" | "stageHome" | "read" | "export" | "exportPreview"
    | "exportWarn" | "exportDone" | "submit" | "submitHome" | "book" | "chapter2" | "readBook"
    | "screenplay" | "spHead" | "spLoc" | "spTime" | "spAction" | "spCue" | "spParen" | "spDialogue"
    | "spNext" | "spTransition" | "spPage" | "pdf" | "pdfDone" | "features" | "featuresPause"
    | "outro1" | "outro2",
    string
  >;
  story: { title: string; p1Anchor: string; p2Anchor: string; p3Anchor: string; beat1: string; beat2: string; beat3: string; p1: string; p2: string; p3: string; placeholder: string; snapName: string; oldWord: string; newWord: string };
  /** the long revision paragraph: one sentence per entry, in order */
  revision: { sentences: string[]; loved: number };
  market: string;
  book: { title: string; chapter1: string; chapter2: string; chapter2Text: string; chapter1Name: string };
  script: {
    title: string;
    seed: string;
    action: string; cueA: string; paren: string; speechA: string; cueB: string; speechB: string; transition: string;
    locationPick: string; timePick: string; typedLocation: string; typedTime: string;
    transitionOut: string;
  };
}

const TEXTS: Record<Lang, Texts> = {
  en: {
    ui: {
      both: "Both", screenwriter: "Screenwriter", everything: "Everything", preview: "See what I'll create", create: "Create",
      desk: "Writing desk", setupDone: "Done. I created", revising: "Revising", pending: "1 pending", exported: "Exported",
      exportPreview: "Preview", docxTemplate: "Shunn", pdfPage: "US Letter", compare: "Compare",
    },
    c: {
      title: "Escrita: write and revise fiction in Obsidian",
      setupIntro: "One command sets a vault up for writing",
      setupWrites: "Tell it what you write: stories, a novel, or both",
      setupLang: "Folders and statuses follow your language",
      setupStart: "Four starting points. Screenwriter is only for scripts",
      setupEverything: "Everything switches on every feature",
      setupReview: "It shows what it will create before it does",
      setupCreate: "Create, and the home note opens",
      home: "Your works by stage, a click from where you left off",
      newStory: "Start a short story from the command palette",
      beat: "A beat is a note to yourself: a ghost until you write",
      outline: "The outline lists every beat of the note",
      beatEdit: "Edit the beat right in the outline",
      write: "Write under it. Quotes and dashes come out typeset",
      ticked: "Prose under a beat ticks it off",
      moreBeats: "Add the next beats from the outline",
      goal: "The daily counter climbs as you write",
      sprint: "Need a push? Start a timed sprint",
      sprintStop: "Stop it whenever you like",
      placeholder: "Unsure of a fact? Leave a marker and keep writing",
      phPanel: "The placeholders panel gathers them all",
      dialogue: "Dialogue focus dims the narration",
      dialogueOff: "And back to normal",
      lens: "Revising? The lens marks echoes, adverbs, long sentences",
      lensPanel: "The panel counts each kind",
      step: "Step through the matches one by one",
      rhythm: "Rhythm shows the length of each sentence",
      rhythmClick: "Click a bar to select that sentence",
      darling: "Love a sentence that has to go? Send it to darlings",
      darlingPanel: "It waits here, ready to go back where it came from",
      snap: "Take a snapshot before you change things",
      snapChange: "Now change a sentence",
      compare: "Compare shows what changed, word by word",
      stage: "Move the story to revision",
      stageHome: "The home note now lists it under Revising",
      read: "Read this note, as a reader would see it",
      export: "Export a manuscript in a standard format",
      exportPreview: "Preview the pages before you export",
      exportWarn: "It flags loose ends: a marker, a beat with no prose",
      exportDone: "A DOCX, ready to send",
      submit: "Record where you sent it",
      submitHome: "The home note counts what is still pending",
      book: "A book is a folder of chapters, with its own outline",
      chapter2: "Add a chapter from the outline",
      readBook: "Read the book from the first chapter on",
      screenplay: "And screenplays, written in Fountain",
      spHead: "Tab changes the element: here, a scene heading",
      spLoc: "Places come from your own script",
      spTime: "Times of day come from the settings",
      spAction: "Enter, and the action",
      spCue: "Tab again: a character, with suggestions",
      spParen: "Tab after a name opens a parenthetical",
      spDialogue: "Enter: the dialogue",
      spNext: "Enter again: the next character",
      spTransition: "Tab cycles the element: a transition",
      spPage: "Laid out the way it sits on the page",
      pdf: "Export it as a PDF, US Letter or A4",
      pdfDone: "A script PDF, ready to read",
      features: "In Settings, the same four starting points",
      featuresPause: "Pick Screenwriter and only the script tools stay on",
      outro1: "Free in Obsidian's community plugins",
      outro2: "Escrita",
    },
    story: {
      title: "The Lighthouse Keeper",
      p1Anchor: "The lamp had", p2Anchor: "he asked", p3Anchor: "He climbed higher",
      beat1: "Elias finds the lamp dark",
      beat2: "He climbs to the lantern room",
      beat3: "The storm decides for him",
      p1: "The lamp had been dark since Tuesday, and Elias knew why.",
      p2: "\"Who put it out?\" he asked. \"Nobody did--it just stopped,\" the wind said.",
      p3: "He climbed higher, one hand on the cold rail.",
      placeholder: "%% XXX: check the tide tables %%",
      snapName: "Before the edit",
      oldWord: "Tuesday",
      newWord: "Sunday",
    },
    revision: {
      sentences: [
        "The lantern swung slowly in the lantern room.",
        "He climbed the stair, and the stair creaked loudly under his boots.",
        "Quietly he lit the wick.",
        "The storm rolled over the water.",
        "A gull cried above the rocks.",
        "The sea beat against the cliffs.",
        "The wind pulled at the door.",
        "After hours of waiting and counting the waves that broke against the foot of the tower, and listening to the radio say nothing at all about the ships out beyond the point where the channel bends toward the open sea, he finally understood that nobody was coming tonight.",
      ],
      loved: 5,
    },
    market: "Lighthouse Review",
    book: {
      title: "The Island", chapter1: "The ferry crosses twice a week, weather permitting.",
      chapter1Name: "The Ferry", chapter2: "The Crossing", chapter2Text: "Nobody on the island remembered who built the pier.",
    },
    script: {
      title: "The Keeper",
      seed: [
        "INT. LIGHTHOUSE KITCHEN - NIGHT",
        "",
        "The kettle rattles on the stove. Elias counts coins in a tin.",
        "",
        "ELIAS",
        "Eleven, twelve. Count again, Mara.",
        "",
        "MARA",
        "(from the stairs)",
        "You said you were going to sleep.",
        "",
        "EXT. CLIFF PATH - DAY",
        "",
        "The wind flattens the grass.",
        "",
        "",
      ].join("\n"),
      action: "Elias drags a crate up the last steps.",
      cueA: "el", paren: "out of breath", speechA: "Radio parts. The man at the port wanted the clock.",
      cueB: "ma", speechB: "Bring it back, or I ring the bell.", transition: "cut to:",
      locationPick: "CLIFF PATH", timePick: "LATER", typedLocation: "ext. ", typedTime: " - ",
      transitionOut: "CUT TO:",
    },
  },
  "pt-BR": {
    ui: {
      both: "Os dois", screenwriter: "Roteirista", everything: "Tudo", preview: "Ver o que vou criar", create: "Criar",
      desk: "Mesa de escrita", setupDone: "Pronto. Criei", revising: "Revisando", pending: "1 pendente", exported: "Exportado",
      exportPreview: "Prévia", docxTemplate: "pt-BR", pdfPage: "A4", compare: "Comparar",
    },
    c: {
      title: "Escrita: escreva e revise ficção no Obsidian",
      setupIntro: "Um comando prepara o cofre para escrever",
      setupWrites: "Diga o que você escreve: contos, romance ou os dois",
      setupLang: "Pastas e status seguem o seu idioma",
      setupStart: "Quatro pontos de partida. Roteirista é só para roteiros",
      setupEverything: "Tudo liga todos os recursos",
      setupReview: "Ele mostra o que vai criar antes de criar",
      setupCreate: "Criar, e a nota inicial abre",
      home: "Suas obras por estágio, a um clique de onde parou",
      newStory: "Comece um conto pela paleta de comandos",
      beat: "Um beat é um lembrete: um fantasma até você escrever",
      outline: "O esboço lista todos os beats da nota",
      beatEdit: "Edite o beat direto no esboço",
      write: "Escreva embaixo. Aspas e travessões saem tipografados",
      ticked: "Texto sob um beat marca o beat como escrito",
      moreBeats: "Adicione os próximos beats pelo esboço",
      goal: "O contador do dia sobe enquanto você escreve",
      sprint: "Precisa de ritmo? Comece um sprint",
      sprintStop: "Pare quando quiser",
      placeholder: "Sem certeza de um dado? Deixe um marcador e siga",
      phPanel: "O painel de marcadores reúne todos",
      dialogue: "O foco no diálogo escurece a narração",
      dialogueOff: "E de volta ao normal",
      lens: "Revisando? A lente marca ecos, advérbios, frases longas",
      lensPanel: "O painel conta cada tipo",
      step: "Percorra as ocorrências uma a uma",
      rhythm: "O ritmo mostra o tamanho de cada frase",
      rhythmClick: "Clique numa barra para selecionar a frase",
      darling: "Uma frase amada que precisa sair? Mande para os darlings",
      darlingPanel: "Ela espera aqui, pronta para voltar de onde veio",
      snap: "Tire uma versão antes de mudar o texto",
      snapChange: "Agora mude uma frase",
      compare: "Comparar mostra o que mudou, palavra por palavra",
      stage: "Passe o conto para revisão",
      stageHome: "A nota inicial agora o lista em Revisando",
      read: "Ler esta nota, como o leitor a veria",
      export: "Exporte o manuscrito em formato padrão",
      exportPreview: "Veja as páginas antes de exportar",
      exportWarn: "Ele avisa das pontas soltas: um marcador, um beat vazio",
      exportDone: "Um DOCX, pronto para enviar",
      submit: "Registre para onde você enviou",
      submitHome: "A nota inicial conta o que ainda está pendente",
      book: "Um livro é uma pasta de capítulos, com esboço próprio",
      chapter2: "Crie um capítulo pelo esboço",
      readBook: "Leia o livro desde o primeiro capítulo",
      screenplay: "E roteiros, escritos em Fountain",
      spHead: "Tab muda o elemento: aqui, um cabeçalho de cena",
      spLoc: "Os lugares vêm do seu próprio roteiro",
      spTime: "As horas do dia vêm das configurações",
      spAction: "Enter, e a ação",
      spCue: "Tab de novo: um personagem, com sugestões",
      spParen: "Tab depois do nome abre a rubrica",
      spDialogue: "Enter: a fala",
      spNext: "Enter de novo: o próximo personagem",
      spTransition: "Tab troca o elemento: uma transição",
      spPage: "Diagramado como fica na página",
      pdf: "Exporte em PDF, US Letter ou A4",
      pdfDone: "Um PDF de roteiro, pronto para ler",
      features: "Nas configurações, os mesmos quatro pontos de partida",
      featuresPause: "Escolha Roteirista e só as ferramentas de roteiro ficam",
      outro1: "Grátis nos plugins da comunidade do Obsidian",
      outro2: "Escrita",
    },
    story: {
      title: "O faroleiro",
      p1Anchor: "A lanterna estava", p2Anchor: "perguntou Elias", p3Anchor: "Ele subiu mais",
      beat1: "Elias encontra a lanterna apagada",
      beat2: "Ele sobe até a sala da lanterna",
      beat3: "A tempestade decide por ele",
      p1: "A lanterna estava apagada desde terça, e na parede alguém riscara \"volte logo\".",
      p2: "-- Quem apagou? -- perguntou Elias ao quarto vazio.",
      p3: "Ele subiu mais, com a mão no corrimão frio.",
      placeholder: "%% XXX: conferir a tábua das marés %%",
      snapName: "Antes da mudança",
      oldWord: "terça",
      newWord: "domingo",
    },
    revision: {
      sentences: [
        "A lanterna girava lentamente dentro da sala da lanterna.",
        "Ele subiu a escada, e a escada rangeu pesadamente sob as botas.",
        "Calmamente ele acendeu o pavio.",
        "A tempestade rolou sobre a água.",
        "Uma gaivota gritou sobre as pedras.",
        "O mar batia contra os penhascos.",
        "O vento puxava a porta velha.",
        "Depois de horas esperando e contando as ondas que quebravam no pé da torre, e ouvindo o rádio não dizer nada sobre os navios lá longe, depois da ponta onde o canal faz a curva em direção ao mar aberto, ele finalmente entendeu que ninguém viria naquela noite.",
      ],
      loved: 5,
    },
    market: "Revista Farol",
    book: {
      title: "A ilha", chapter1: "A balsa cruza duas vezes por semana, se o tempo deixar.",
      chapter1Name: "A balsa", chapter2: "A travessia", chapter2Text: "Ninguém na ilha lembrava quem construiu o cais.",
    },
    script: {
      title: "O guardião",
      seed: [
        "INT. COZINHA DO FAROL - NOITE",
        "",
        "A chaleira chacoalha no fogão. Elias conta moedas numa lata.",
        "",
        "ELIAS",
        "Onze, doze. Conte de novo, Mara.",
        "",
        "MARA",
        "(da escada)",
        "Você disse que ia dormir.",
        "",
        "EXT. TRILHA DO PENHASCO - DIA",
        "",
        "O vento achata o capim.",
        "",
        "",
      ].join("\n"),
      action: "Elias arrasta uma caixa pelos últimos degraus.",
      cueA: "el", paren: "ofegante", speechA: "Peças de rádio. O homem do porto queria o relógio.",
      cueB: "ma", speechB: "Traga de volta, ou eu toco o sino.", transition: "corta para:",
      locationPick: "TRILHA DO PENHASCO", timePick: "MAIS TARDE", typedLocation: "ext. ", typedTime: " - ",
      transitionOut: "CORTA PARA:",
    },
  },
};

// ---------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------

const requested = process.env.TOUR_LANG ?? "en";
if (requested !== "en" && requested !== "pt-BR") throw new Error(`TOUR_LANG must be en or pt-BR, not "${requested}"`);
const LANG: Lang = requested;
const W = TEXTS[LANG];
const RECORDING = recordDir() !== null;
/** TOUR_SHOTS=<folder>: one PNG of the window per caption, to review the tour without recording it */
const SHOTS = process.env.TOUR_SHOTS || null;
let shots = 0;

/** Human typing speed while recording (ms per key), and what the fast run uses. */
const KEY_MS = 70;
/** One knob for the whole tour's tempo: every pause below is multiplied by it (typing is KEY_MS). */
const TEMPO = 1.4;
const FAST_KEY_MS = 25;
/** the shortest a caption stays up, in the planned time */
const MIN_CAPTION_MS = 2600;

test.describe.configure({ mode: "serial" });

test("tour", async () => {
  test.setTimeout(1_200_000);
  const ob = await App.launch({ vault: LANG === "pt-BR" ? emptyPt({ seeded: true }) : emptyEn({ seeded: true }) });
  const page = ob.page;
  const kb = () => ob.page.keyboard;

  // ---- the planned clock: what a recording would spend, whether or not this run waits for it ----
  let planned = 0;
  let typing = 0; // the part of `planned` that is typing
  let captionAt = -Infinity;
  const perStep: { name: string; ms: number }[] = [];
  let stepStart = 0;
  let stepName = "";
  const section = (name: string) => {
    if (stepName) perStep.push({ name: stepName, ms: planned - stepStart });
    stepName = name;
    stepStart = planned;
  };
  /** A pause: held when recording, only counted otherwise. */
  const pace = async (ms: number) => {
    const held = Math.round(ms * TEMPO);
    planned += held;
    if (RECORDING) await sleep(held);
  };
  /** With TOUR_SHOTS: the window as the last caption left it (taken just before the next caption replaces it). */
  let lastOn: typeof page | null = null;
  const flushShot = async () => {
    if (!SHOTS || !lastOn) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await lastOn.screenshot({ path: path.join(SHOTS, `${LANG}-${String(++shots).padStart(2, "0")}.png`) }).catch(() => { /* a closing window */ });
    lastOn = null;
  };
  /** With TOUR_SHOTS: a shot now, at a moment a caption will not be showing at the end. */
  const shotNow = async (on: typeof page = page) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await on.screenshot({ path: path.join(SHOTS, `${LANG}-${String(++shots).padStart(2, "0")}-now.png`) }).catch(() => { /* a closing window */ });
  };
  /** A caption, held at least `hold` ms and never replacing the last one before MIN_CAPTION_MS have passed. */
  const say = async (words: string, hold = 1200, opts: { where?: "top" | "bottom" | "center"; size?: number; on?: typeof page } = {}) => {
    const shown = planned - captionAt;
    if (shown < MIN_CAPTION_MS) await pace(MIN_CAPTION_MS - shown);
    await flushShot();
    await caption(opts.on ?? page, words, opts);
    captionAt = planned;
    lastOn = opts.on ?? page;
    await pace(hold);
  };
  /** Types keys at a human speed when recording; the planned time counts it either way. */
  const typeKeys = async (s: string) => {
    planned += s.length * KEY_MS + 200;
    typing += s.length * KEY_MS + 200;
    await kb().type(s, { delay: RECORDING ? KEY_MS : FAST_KEY_MS });
    await sleep(RECORDING ? 200 : 120);
  };
  const key = async (k: string, after = 400) => { await kb().press(k); await pace(after); };

  // ---- the editor, read and placed by script (the way the other specs do) ----
  const ED = `(() => {
    const path = app.workspace.getActiveFile()?.path;
    const view = app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.file?.path === path);
    return view?.editor;
  })()`;
  const focusAt = async (line?: number, ch?: number) => {
    await page.evaluate(`((l, c) => {
      const ed = ${ED};
      const ln = l ?? ed.lastLine();
      ed.setCursor({ line: ln, ch: c ?? ed.getLine(ln).length });
      ed.focus();
    })(${line ?? "undefined"}, ${ch ?? "undefined"})`);
    await sleep(80);
  };
  /** Adds text at the end of the open note without typing it (the long, seeded parts). */
  const insertAtEnd = async (s: string) => {
    await page.evaluate(`((s) => {
      const ed = ${ED};
      ed.replaceRange(s, { line: ed.lastLine(), ch: ed.getLine(ed.lastLine()).length });
    })(${JSON.stringify(s)})`);
    await sleep(150);
  };
  const lineOf = async (part: string): Promise<number> => {
    const n = (await editorText(ob)).split("\n").findIndex((l) => l.includes(part));
    expect(n, `a line with "${part}"`).toBeGreaterThanOrEqual(0);
    return n;
  };
  const openNote = async (file: string) => {
    await ob.openFile(file);
    await ob.waitFor(`${file} to be active`, async () => (await ob.activeFile()) === file);
    await page.locator(".workspace-leaf.mod-active .cm-content").first().waitFor();
  };
  /** Selects `old` in the open note and types `next` over it, the way a writer fixes a word. */
  const retype = async (old: string, next: string) => {
    const found = await page.evaluate(`((old) => {
      const ed = ${ED};
      const text = ed.getValue();
      const at = text.indexOf(old);
      if (at < 0) return false;
      ed.setSelection(ed.offsetToPos(at), ed.offsetToPos(at + old.length));
      ed.focus();
      return true;
    })(${JSON.stringify(old)})`);
    expect(found, `"${old}" in the note`).toBe(true);
    await pace(900);
    await typeKeys(next);
  };
  const walk = (rel: string): string[] => {
    const root = path.join(ob.vaultDir, rel);
    const out: string[] = [];
    const go = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) go(p); else out.push(path.relative(ob.vaultDir, p));
      }
    };
    go(root);
    return out;
  };
  const suggestions = () => page.locator(".suggestion-container .suggestion-item");
  const pick = async (label: string) => {
    const item = suggestions().filter({ hasText: label }).first();
    await item.waitFor();
    await pace(1200);
    await item.click();
    await expect(suggestions()).toHaveCount(0);
    await pace(500);
  };
  const clearNotices = () => ob.dismissNotices();
  /** The first number in the daily counter of the status bar. */
  const today = async () => {
    const text = await page.locator(".escrita-status-today").first().innerText();
    return Number((/[\d.,]+/.exec(text)?.[0] ?? "0").replace(/[.,]/g, ""));
  };
  const closeLeaves = (type: string) => page.evaluate((ty) => app.workspace.getLeavesOfType(ty).forEach((l: any) => l.detach()), type);

  await ob.setTheme("light");
  // Smart typography is for books by default; the tour types it into a short story, so the writer's setting says "all notes"
  await ob.setSettings({ typographyScope: "all" });
  // Obsidian's own spellcheck underlines the prose in red in the video; off while recording only
  if (RECORDING) await page.evaluate(() => (app.vault as unknown as { setConfig(k: string, v: unknown): void }).setConfig("spellcheck", false));
  await ob.dismissNotices();
  let rec: Recorder | null = null;

  try {
    rec = await Recorder.start(page);

    // ============================================================ 1. the title
    section("1 title");
    await say(W.c.title, 2600, { where: "center", size: 34 });

    // ============================================================ 2. the setup
    section("2 setup");
    await say(W.c.setupIntro, 1500);
    expect(await ob.command("setup")).toBe(true);
    const setup = new SetupModal(ob);
    await expect(setup.root).toBeVisible();
    expect((await setup.steps()).current).toMatch(/^1/);
    expect(await ob.setting("homeNote")).toBe(""); // never set up
    await pace(800);

    await say(W.c.setupWrites, 600);
    await setup.chip(W.ui.both).hover();
    await pace(1200);
    await setup.chip(W.ui.both).click();
    expect(await setup.pressed(setup.root.locator(".escrita-setup-field").first())).toEqual([W.ui.both]);
    await pace(1200);

    await say(W.c.setupLang, 600);
    await expect(setup.root.locator("select.escrita-setup-select")).toHaveValue(LANG);
    await setup.root.locator("select.escrita-setup-select").hover();
    await pace(1800);

    await say(W.c.setupStart, 600);
    await setup.card(W.ui.screenwriter).scrollIntoViewIfNeeded();
    await expect(setup.root.locator(".escrita-setup-card")).toHaveCount(4);
    await setup.card(W.ui.screenwriter).hover();
    await pace(2600);

    await say(W.c.setupEverything, 600);
    await setup.card(W.ui.everything).click();
    expect(await setup.pressed(setup.field(LANG === "en" ? "Starting point" : "Ponto de partida"))).toEqual([W.ui.everything]);
    await pace(1500);

    await say(W.c.setupReview, 600);
    await setup.button(W.ui.preview).click();
    expect((await setup.steps()).current).toMatch(/^2/);
    const groups = await setup.preview();
    expect(groups.length).toBeGreaterThanOrEqual(4);
    expect(groups.flatMap((g) => g.rows).length).toBeGreaterThan(10);
    await pace(1800);
    const scroller = setup.root.locator(".escrita-setup-scroll");
    for (let i = 0; i < 6; i++) {
      await scroller.evaluate((el) => el.scrollBy({ top: 200, behavior: "smooth" }));
      await pace(700);
    }
    await setup.card(W.ui.desk).scrollIntoViewIfNeeded();
    await setup.card(W.ui.desk).click();
    expect(await setup.pressed(setup.root.locator(".escrita-setup-screens"))).toEqual([W.ui.desk]);
    await pace(1200);

    await say(W.c.setupCreate, 600);
    await setup.button(W.ui.create).click();
    await ob.notice(W.ui.setupDone);
    await expect(setup.root).toHaveCount(0);
    const home = await ob.setting<string>("homeNote");
    expect(home).toBe(LANG === "en" ? "Home.md" : "Início.md");
    await ob.waitFor("the home note", async () => (await ob.activeFile()) === home, 15_000);
    await clearNotices();
    await ob.waitFor("the works block", async () => (await page.locator(".escrita-desk-row").count()) >= 2, 15_000);
    expect(Object.values(await ob.setting<Record<string, boolean>>("features")).every((v) => v === true)).toBe(true);
    // The setup leaves "track the whole vault" on an empty vault, so Darlings.md would count as a work;
    // the writer's usual choice is the two folders the setup made (Settings, Goals, tracked folders)
    await ob.setSettings({ trackFolders: `${await ob.setting("storiesFolder")}\n${await ob.setting("booksFolder")}` });
    await say(W.c.home, 2200);

    // ============================================================ 3. a short story and its beat
    section("3 new story");
    await say(W.c.newStory, 500);
    expect(await ob.command("new-short-story")).toBe(true);
    const title = page.locator(".modal input").first();
    await title.waitFor();
    await title.click();
    await typeKeys(W.story.title);
    await pace(600);
    await key("Enter", 300);
    const storiesFolder = await ob.setting<string>("storiesFolder");
    const storyPath = `${storiesFolder}/${W.story.title}.md`;
    const created = await ob.waitForFile(storyPath);
    expect(created).toMatch(/^%% beat: .+ %%$/m);
    await ob.waitFor("the story to be active", async () => (await ob.activeFile()) === storyPath);
    await page.locator(".workspace-leaf.mod-active .cm-content").first().waitFor();
    await clearNotices();

    await say(W.c.beat, 800);
    await expect(page.locator(".workspace-leaf.mod-active .escrita-ghost-label")).toHaveCount(1); // the ghost beat
    await pace(1200);

    await say(W.c.outline, 600);
    expect(await ob.command("open-outline")).toBe(true);
    const beats = page.locator(".escrita-outline-beat");
    await expect(beats).toHaveCount(1);
    await expect(beats.first()).not.toHaveClass(/is-written/);
    await pace(1500);

    await say(W.c.beatEdit, 400);
    const beatField = beats.first().locator(".escrita-outline-beat-text");
    await beatField.click();
    await kb().press("Control+a");
    await typeKeys(W.story.beat1);
    await pace(500);
    await focusAt();
    await page.mouse.move(660, 650); // off the outline, so no tooltip hangs over the video
    await expect.poll(async () => (await editorText(ob)).includes(`%% beat: ${W.story.beat1} %%`)).toBe(true);
    await pace(700);

    // ============================================================ 4. prose under the beat
    section("4 write");
    await say(W.c.write, 500);
    await typeKeys(W.story.p1);
    await key("Enter", 200);
    await key("Enter", 300);
    const p2typed = W.story.p2;
    await typeKeys(p2typed);
    const text4 = await editorText(ob);
    if (LANG === "en") {
      expect(text4).toContain("The lamp had been dark since Tuesday, and Elias knew why.");
      expect(text4).toContain("“Who put it out?” he asked. “Nobody did—it just stopped,” the wind said.");
    } else {
      expect(text4).toContain("riscara “volte logo”.");
      expect(text4).toContain("— Quem apagou? — perguntou Elias ao quarto vazio.");
    }
    await pace(800);
    await say(W.c.ticked, 300);
    await expect(beats.first()).toHaveClass(/is-written/, { timeout: 10_000 });
    await pace(1500);

    await say(W.c.moreBeats, 400);
    await beatField.click();
    await kb().press("End");
    await key("Enter", 300);
    await expect(beats).toHaveCount(2);
    await beats.nth(1).locator(".escrita-outline-beat-text").click();
    await typeKeys(W.story.beat2);
    await key("Enter", 300);
    await expect(beats).toHaveCount(3);
    await beats.nth(2).locator(".escrita-outline-beat-text").click();
    await typeKeys(W.story.beat3);
    await focusAt(0, 0); // leaves the field: it is saved on blur
    await page.mouse.move(660, 650);
    await expect.poll(async () => {
      const t = await editorText(ob);
      return t.includes(`%% beat: ${W.story.beat2} %%`) && t.includes(`%% beat: ${W.story.beat3} %%`);
    }, { timeout: 10_000 }).toBe(true);
    await expect(beats).toHaveCount(3);
    await expect(beats.nth(0)).toHaveClass(/is-written/);
    await expect(beats.nth(1)).not.toHaveClass(/is-written/);
    await pace(1800);

    // ============================================================ 5. goals: the counter and a sprint
    section("5 goals");
    await say(W.c.goal, 1500, { where: "top" });
    const before = await today();
    await ob.waitFor("the sprint to be offered", async () => ob.commandListed("start-sprint"));
    // the writer carries on under the first beat's prose, before the next beats
    await focusAt(await lineOf(W.story.p2Anchor));
    await key("End", 200);
    await key("Enter", 200);
    await key("Enter", 200);
    await typeKeys(W.story.p3);
    await expect.poll(today, { timeout: 10_000 }).toBeGreaterThan(before);
    await pace(1000);

    await say(W.c.sprint, 400, { where: "top" });
    expect(await ob.command("start-sprint")).toBe(true);
    await expect(page.locator(".escrita-status-sprint")).toBeVisible();
    await clearNotices();
    await pace(1500);
    await focusAt(await lineOf(W.story.p3Anchor));
    await key("End", 100);
    await typeKeys(LANG === "en" ? " The rail was wet." : " O corrimão estava molhado.");
    await pace(1500);
    await shotNow();
    await say(W.c.sprintStop, 400, { where: "top" });
    expect(await ob.command("stop-sprint")).toBe(true);
    await expect(page.locator(".escrita-status-sprint")).toBeHidden();
    await clearNotices();
    await pace(800);

    // ============================================================ 6. a placeholder
    section("6 placeholder");
    await say(W.c.placeholder, 400);
    await focusAt();
    await key("Enter", 200);
    await key("Enter", 200);
    await typeKeys(W.story.placeholder);
    await key("Enter", 300);
    await key("Enter", 300);
    expect(await editorText(ob)).toContain(W.story.placeholder);
    await focusAt(await lineOf(W.story.p1Anchor), 0); // the cursor leaves the marker, so it draws as a marker
    await pace(600);
    await say(W.c.phPanel, 300);
    expect(await ob.command("open-placeholders")).toBe(true);
    await page.evaluate(() => app.workspace.rightSplit.expand());
    const phItem = page.locator(".escrita-ph-item").filter({ hasText: LANG === "en" ? "check the tide tables" : "conferir a tábua das marés" });
    await expect(phItem).toBeVisible();
    await pace(1800);

    // ============================================================ 7. dialogue focus
    section("7 dialogue focus");
    await say(W.c.dialogue, 300);
    await focusAt(await lineOf(W.story.p1Anchor), 0);
    expect(await ob.command("toggle-dialogue-focus")).toBe(true);
    await expect(page.locator(".escrita-dialogue-dim").first()).toBeVisible();
    await pace(2800);
    await clearNotices();
    await say(W.c.dialogueOff, 200);
    expect(await ob.command("toggle-dialogue-focus")).toBe(true);
    await expect(page.locator(".escrita-dialogue-dim")).toHaveCount(0);
    await clearNotices();
    await pace(900);

    // ============================================================ 8. the revision lens
    section("8 lens");
    await focusAt();
    await insertAtEnd("\n\n" + W.revision.sentences.join(" ") + "\n");
    const sentences = W.revision.sentences;
    const revLine = await lineOf(sentences[0]);
    await say(W.c.lens, 400);
    await focusAt(revLine, 4);
    expect(await ob.command("toggle-revision-lens")).toBe(true);
    await expect(page.locator(".escrita-lens-head")).toBeVisible();
    await page.evaluate(() => app.workspace.rightSplit.expand());
    const rule = (id: string) => page.locator(".escrita-lens-row").filter({ has: page.locator(`.escrita-lens-key-${id}`) });
    await expect(page.locator(".cm-content .escrita-lens-echo").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".cm-content .escrita-lens-adverb").first()).toBeVisible();
    await pace(2200);

    await say(W.c.lensPanel, 400);
    await rule("echo").scrollIntoViewIfNeeded();
    for (const id of ["echo", "adverb", "long"]) {
      const n = Number((await rule(id).locator(".escrita-lens-count").innerText()).replace(/\D/g, ""));
      expect(n, `${id} matches`).toBeGreaterThan(0);
    }
    await rule("echo").hover();
    await pace(1800);

    await say(W.c.step, 400);
    const next = rule("echo").locator(".escrita-lens-step").nth(1);
    const counter = rule("echo").locator(".escrita-lens-counter");
    await next.click();
    await expect(page.locator(".cm-content .escrita-lens-echo.escrita-lens-current").first()).toBeVisible({ timeout: 5000 });
    await expect(counter).toHaveText(/^\d+ \/ \d+$/);
    const first = await counter.innerText();
    await pace(1600);
    await next.click();
    await expect(counter).not.toHaveText(first);
    await pace(1600);

    await say(W.c.rhythm, 400);
    await focusAt(revLine, 12); // the cursor in the paragraph of same-length sentences
    const bars = page.locator(".escrita-lens-rhythm-row");
    await expect(bars).toHaveCount(sentences.length, { timeout: 10_000 });
    await sleep(700); // the panel redraws after the cursor moves and drops its scroll
    await bars.last().scrollIntoViewIfNeeded();
    await expect(page.locator(".escrita-lens-rhythm-row.is-run").first()).toBeVisible();
    await expect(page.locator(".escrita-lens-rhythm-row.is-long")).toHaveCount(1);
    await expect(page.locator(".escrita-lens-rhythm-note").first()).toBeVisible();
    await pace(2500);

    await say(W.c.rhythmClick, 400);
    const loved = sentences[W.revision.loved];
    await bars.nth(W.revision.loved).click();
    await ob.waitFor("the sentence to be selected", async () => (await page.evaluate(`${ED}?.getSelection()`)) === loved);
    await page.evaluate(`${ED}.focus()`); // the editor takes the keyboard back, so the selection shows
    await pace(2200);

    // ============================================================ 9. darlings
    section("9 darlings");
    await say(W.c.darling, 400);
    const textBefore = await editorText(ob);
    await page.evaluate(`${ED}.focus()`); // back in the note, the sentence still selected
    await sleep(200);
    expect(await ob.command("move-selection-to-darlings")).toBe(true);
    await ob.notice(/darlings/i);
    await clearNotices();
    expect(await editorText(ob)).not.toContain(loved);
    expect(textBefore).toContain(loved);
    await pace(1200);
    await say(W.c.darlingPanel, 300);
    expect(await ob.command("open-darlings")).toBe(true);
    await page.evaluate(() => app.workspace.rightSplit.expand());
    const card = page.locator(".escrita-darling").filter({ hasText: loved });
    await expect(card).toBeVisible();
    await expect(card.locator(".escrita-darling-source")).toContainText(W.story.title);
    expect(await ob.waitForFile(await ob.setting<string>("globalDarlingsNote"))).toContain(loved);
    await pace(2400);
    await shotNow();

    // ============================================================ 10. snapshots
    section("10 snapshots");
    await focusAt();
    await say(W.c.snap, 400);
    const snapshotsFolder = await ob.setting<string>("snapshotsFolder");
    expect(await ob.command("take-snapshot")).toBe(true);
    const nameInput = page.locator(".modal input").first();
    await nameInput.waitFor();
    await nameInput.click();
    await typeKeys(W.story.snapName);
    await pace(400);
    await key("Enter", 300);
    await ob.waitFor("the snapshot", () => walk(snapshotsFolder).length > 0, 10_000);
    await clearNotices();
    await pace(800);
    await say(W.c.snapChange, 300);
    await retype(W.story.oldWord, W.story.newWord);
    await pace(800);
    await say(W.c.compare, 400);
    expect(await ob.command("compare-last-snapshot")).toBe(true);
    await expect(page.locator(".escrita-compare-body del.escrita-diff-del").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".escrita-compare-body del.escrita-diff-del").filter({ hasText: W.story.oldWord })).not.toHaveCount(0);
    await expect(page.locator(".escrita-compare-body ins.escrita-diff-ins").filter({ hasText: W.story.newWord })).not.toHaveCount(0);
    await pace(3500);
    await shotNow();
    await closeLeaves("escrita-snapshot-compare");
    await ob.waitFor("the story to be back in front", async () => (await ob.activeFile()) === storyPath);

    // ============================================================ 11. the stage
    section("11 stage");
    await say(W.c.stage, 400);
    const revisionWord = (await ob.setting<Record<string, { words: string }>>("stages")).revision.words.split(",")[0].trim();
    await page.evaluate(async ([p, w]) => {
      await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { fm.status = w; });
    }, [storyPath, revisionWord] as const);
    await ob.waitFor("the status", () => new RegExp(`^status: ${revisionWord}$`, "m").test(ob.readVaultFile(storyPath)), 8000);
    await pace(1200);
    await say(W.c.stageHome, 300);
    expect(await ob.command("open-home-note")).toBe(true);
    await ob.waitFor("the home note", async () => (await ob.activeFile()) === home);
    const revisingRow = page.locator(".escrita-desk-section").filter({ hasText: W.ui.revising }).locator(".escrita-desk-row").filter({ hasText: W.story.title });
    await expect(revisingRow).toBeVisible({ timeout: 15_000 });
    await pace(2200);
    await shotNow();

    // ============================================================ 12. read this note
    section("12 read");
    await revisingRow.click(); // a work's row opens it where you left off
    await ob.waitFor("the story", async () => (await ob.activeFile()) === storyPath);
    await say(W.c.read, 300);
    expect(await ob.command("read-note")).toBe(true);
    await page.locator(".escrita-reader-chapter").first().waitFor({ state: "attached" });
    await expect(page.locator(".escrita-reader-body.is-pending")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".escrita-reader-chip")).toBeVisible();
    expect(await page.locator(".escrita-reader-chapter").first().innerText()).toContain(W.story.p1.slice(0, 20));
    await expect(page.locator(".escrita-reader [contenteditable='true']")).toHaveCount(0); // read-only
    await pace(3600);
    await shotNow();
    await closeLeaves("escrita-reader");
    await ob.waitFor("the story to be back", async () => (await ob.activeFile()) === storyPath);

    // ============================================================ 13. export
    section("13 export");
    await say(W.c.export, 400);
    expect(await ob.command("export")).toBe(true);
    const modal = page.locator(".modal.escrita-export-modal");
    await modal.waitFor();
    const primary = modal.locator(".escrita-export-footer button.mod-cta");
    await expect(primary).toBeEnabled({ timeout: 30_000 });
    await say(W.c.exportWarn, 600);
    await expect(modal.locator(".escrita-export-warn")).toContainText("XXX");
    await shotNow();
    await pace(1400);
    const chipOf = (label: string) => modal.locator(".escrita-export-chip").filter({ has: page.locator("span:first-child", { hasText: new RegExp(`^${label}$`) }) });
    await chipOf("DOCX").click();
    await pace(900);
    await chipOf(W.ui.docxTemplate).click();
    await expect(chipOf(W.ui.docxTemplate)).toHaveAttribute("aria-checked", "true");
    await pace(1800);
    await say(W.c.exportPreview, 300);
    await modal.getByRole("button", { name: W.ui.exportPreview }).click();
    const preview = modal.locator(".escrita-export-scroll");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(W.story.title);
    await pace(3200);
    await shotNow();
    await say(W.c.exportDone, 300);
    const exportFolder = await ob.setting<string>("exportFolder");
    await modal.locator(".escrita-export-pgo").click();
    await ob.notice(W.ui.exported);
    await expect(modal).toHaveCount(0);
    const docx = walk(exportFolder).filter((f) => f.endsWith(".docx"));
    expect(docx.length).toBe(1);
    expect(fs.readFileSync(path.join(ob.vaultDir, docx[0])).subarray(0, 2).toString("latin1")).toBe("PK"); // a zip: a real DOCX
    await pace(2200);
    await clearNotices();

    // ============================================================ 14. submissions
    section("14 submissions");
    await say(W.c.submit, 400);
    expect(await ob.command("record-submission")).toBe(true);
    const market = page.locator(".escrita-submission-input").first();
    await market.waitFor();
    await market.click();
    await typeKeys(W.market);
    await pace(700);
    await key("Enter", 300);
    await ob.notice(/→/);
    await clearNotices();
    expect(walk(await ob.setting<string>("submissionsFolder")).filter((f) => f.endsWith(".md")).length).toBe(1);
    await say(W.c.submitHome, 300);
    expect(await ob.command("open-home-note")).toBe(true);
    await ob.waitFor("the home note", async () => (await ob.activeFile()) === home);
    await expect(page.locator(".escrita-desk")).toContainText(W.ui.pending, { timeout: 15_000 });
    await pace(2400);
    await shotNow();

    // ============================================================ 15. a book
    section("15 book");
    await say(W.c.book, 400);
    expect(await ob.command("create-book")).toBe(true);
    const bookTitle = page.locator(".modal input").first();
    await bookTitle.waitFor();
    await bookTitle.click();
    await typeKeys(W.book.title);
    await pace(500);
    await key("Enter", 300);
    const bookPath = `${await ob.setting<string>("booksFolder")}/${W.book.title}.md`;
    await ob.waitForFile(bookPath);
    const chaptersDir = `${bookPath.replace(/\.md$/, "")}/${await ob.setting<string>("chaptersFolder")}`;
    await ob.waitFor("the first chapter", () => ob.listVaultFolder(chaptersDir).length === 1);
    const ch1First = `${chaptersDir}/${ob.listVaultFolder(chaptersDir)[0]}`;
    await ob.waitFor("the chapter to be active", async () => (await ob.activeFile()) === ch1First);
    await clearNotices();
    await expect(page.locator(".escrita-outline-chapter:not(.escrita-outline-note)")).toHaveCount(1);
    const chapterTitle = page.locator(".escrita-outline-title").first();
    await chapterTitle.click();
    await kb().press("Control+a");
    await typeKeys(W.book.chapter1Name);
    await page.mouse.move(660, 650);
    await focusAt(); // leaving the field renames the chapter
    await ob.waitFor("the chapter's new name", () => ob.listVaultFolder(chaptersDir).some((f) => f.includes(W.book.chapter1Name)), 10_000);
    const ch1 = `${chaptersDir}/${ob.listVaultFolder(chaptersDir).find((f) => f.includes(W.book.chapter1Name))!}`;
    await ob.waitFor("the renamed chapter to be active", async () => (await ob.activeFile()) === ch1);
    await focusAt();
    await typeKeys(W.book.chapter1);
    await pace(900);

    await say(W.c.chapter2, 400);
    const newChapter = page.locator(".escrita-outline-new-text").last();
    await newChapter.click();
    await typeKeys(W.book.chapter2);
    await pace(400);
    await key("Enter", 300);
    await ob.waitFor("the second chapter", () => ob.listVaultFolder(chaptersDir).length === 2, 10_000);
    await expect(page.locator(".escrita-outline-chapter:not(.escrita-outline-note)")).toHaveCount(2);
    const ch2 = `${chaptersDir}/${ob.listVaultFolder(chaptersDir).find((f) => `${chaptersDir}/${f}` !== ch1)!}`;
    await page.evaluate(async ([p, s]) => {
      await app.vault.process(app.vault.getFileByPath(p)!, (d: string) => d.replace(/\n*$/, "\n") + s + "\n");
    }, [ch2, W.book.chapter2Text] as const);
    await pace(2000);
    await shotNow();

    await say(W.c.readBook, 300);
    await openNote(ch1);
    expect(await ob.command("read-book")).toBe(true);
    await page.locator(".escrita-reader-chapter").first().waitFor({ state: "attached" });
    await expect(page.locator(".escrita-reader-body.is-pending")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".escrita-reader-chapter")).toHaveCount(2);
    expect(await page.locator(".escrita-reader").innerText()).toContain(W.book.chapter1.slice(0, 20));
    await pace(3600);
    await shotNow();
    await closeLeaves("escrita-reader");
    await clearNotices();

    // ============================================================ 16. a screenplay
    section("16 screenplay");
    await openNote(storyPath); // a new screenplay goes beside the note that is open
    await say(W.c.screenplay, 400);
    expect(await ob.command("new-screenplay")).toBe(true);
    const spTitle = page.locator(".modal input").first();
    await spTitle.waitFor();
    await spTitle.click();
    await typeKeys(W.script.title);
    await pace(500);
    await key("Enter", 300);
    const scriptPath = `${storiesFolder}/${W.script.title}.md`;
    const scriptText = await ob.waitForFile(scriptPath);
    expect(scriptText).toMatch(/^form: \S+$/m);
    await ob.waitFor("the script to be active", async () => (await ob.activeFile()) === scriptPath);
    await expect(page.locator(".workspace-leaf.mod-active .cm-editor.escrita-screenplay")).toHaveCount(1);
    await clearNotices();
    await insertAtEnd("\n" + W.script.seed); // the first scenes, already written
    await focusAt();
    await pace(1200);

    await say(W.c.spHead, 600);
    await key("Tab", 600);
    await key("Tab", 600);
    await key("Tab", 900);
    await typeKeys(W.script.typedLocation);
    await say(W.c.spLoc, 300);
    await pick(W.script.locationPick);
    await typeKeys(W.script.typedTime);
    await say(W.c.spTime, 300);
    await pick(W.script.timePick);

    await say(W.c.spAction, 300);
    await key("Enter", 600);
    await typeKeys(W.script.action);
    await key("Enter", 600);

    await say(W.c.spCue, 300);
    await key("Tab", 700);
    await typeKeys(W.script.cueA);
    await pick("ELIAS");
    await say(W.c.spParen, 300);
    await key("Tab", 500);
    await typeKeys(W.script.paren);
    await kb().press("End");
    await key("Enter", 300);
    await say(W.c.spDialogue, 300);
    await typeKeys(W.script.speechA);
    await key("Enter", 900);

    await say(W.c.spNext, 300);
    await typeKeys(W.script.cueB);
    await pick("MARA");
    await key("Enter", 300);
    await typeKeys(W.script.speechB);
    await key("Enter", 900);

    await say(W.c.spTransition, 300);
    await key("Tab", 700);
    await typeKeys(W.script.transition);
    await pace(1000);
    const typed = await editorText(ob);
    const scene = typed.slice(typed.indexOf(W.script.seed.trimEnd()) + W.script.seed.trimEnd().length);
    expect(scene).toContain(`${W.script.typedLocation.toUpperCase()}${W.script.locationPick} - ${W.script.timePick}\n\n`);
    expect(scene).toContain(`${W.script.action}\n\nELIAS\n(${W.script.paren})\n${W.script.speechA}\n\nMARA\n${W.script.speechB}\n\n${W.script.transitionOut}`);
    await focusAt(0, 0);
    await say(W.c.spPage, 300);
    await expect(page.locator(".workspace-leaf.mod-active .cm-line.escrita-sp-character").nth(2)).toBeVisible();
    await expect(page.locator(".workspace-leaf.mod-active .cm-line.escrita-sp-dialogue").first()).toBeVisible();
    await pace(1500);
    await page.evaluate(`(() => { const ed = ${ED}; ed.scrollIntoView({ from: { line: ed.lastLine(), ch: 0 }, to: { line: ed.lastLine(), ch: 0 } }, true); })()`);
    await pace(2200);
    await shotNow();

    // ============================================================ 17. the PDF
    section("17 pdf");
    await say(W.c.pdf, 400);
    expect(await ob.command("export")).toBe(true);
    await modal.waitFor();
    await expect(primary).toBeEnabled({ timeout: 30_000 });
    await expect(modal.locator(".escrita-export-chip > span:first-child")).toHaveText(["PDF", "Fountain", "US Letter", "A4"]); // the formats, then the page sizes
    await chipOf("PDF").click();
    await pace(900);
    await chipOf(W.ui.pdfPage).click();
    await expect(chipOf(W.ui.pdfPage)).toHaveAttribute("aria-checked", "true");
    await pace(1500);
    await say(W.c.exportPreview, 300);
    await modal.getByRole("button", { name: W.ui.exportPreview }).click();
    await expect(modal.locator(".escrita-sp-pages")).toBeVisible();
    await expect(modal.locator(".escrita-sp-pages")).toContainText(W.script.transitionOut);
    await pace(3200);
    await shotNow();
    await say(W.c.pdfDone, 300);
    await modal.locator(".escrita-export-pgo").click();
    await ob.notice(W.ui.exported);
    await expect(modal).toHaveCount(0);
    const pdf = walk(exportFolder).filter((f) => f.endsWith(".pdf"));
    expect(pdf.length).toBe(1);
    expect(fs.readFileSync(path.join(ob.vaultDir, pdf[0])).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await pace(2200);
    await clearNotices();

    // ============================================================ 18. the Features page
    section("18 features");
    const settings = await settingsPage(ob);
    await settings.setViewportSize({ width: 1280, height: 800 }).catch(() => { /* keeps its size */ });
    await rec?.follow(settings);
    await say(W.c.features, 300, { on: settings });
    const presets = settings.locator(".escrita-presets");
    await presets.waitFor();
    await presets.scrollIntoViewIfNeeded();
    expect(await settings.locator(".escrita-preset-btn").count()).toBe(4);
    await expect(settings.locator(".escrita-presets-state")).toHaveText(W.ui.everything);
    await pace(2400);
    await say(W.c.featuresPause, 300, { on: settings });
    await settings.locator(".escrita-preset-btn", { hasText: new RegExp(`^${W.ui.screenwriter}$`) }).hover();
    await pace(3600);
    await shotNow(settings);
    await ob.closeModals();
    await rec?.follow(page);
    await ob.waitFor("the settings to close", async () => !(await ob.settingsWindow()).open);

    // ============================================================ 19. the outro
    section("19 outro");
    await removeCaption(page);
    await say(W.c.outro1, 2600, { where: "center", size: 34 });
    await say(W.c.outro2, 1600, { where: "center", size: 44 });
    await pace(1200);
    await flushShot();
    await removeCaption(page);
    section("end");
  } finally {
    if (rec) {
      await rec.stop();
      try { rec.encode(`tour-${LANG}`); } catch (e) { console.log(`tour: could not encode the video: ${String(e)}`); }
    }
    if (stepName) perStep.push({ name: stepName, ms: planned - stepStart });
    const total = perStep.reduce((n, s) => n + s.ms, 0);
    const lines = perStep.filter((s) => s.name !== "end").map((s) => `  ${s.name.padEnd(20)} ${(s.ms / 1000).toFixed(1).padStart(6)} s`);
    const mm = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;
    console.log(`tour (${LANG}) planned recording time, pauses and typing only:\n${lines.join("\n")}\n  total ${(total / 1000).toFixed(0)} s = ${mm(total)} (typing ${(typing / 1000).toFixed(0)} s, pauses ${((total - typing) / 1000).toFixed(0)} s)`);
    await ob.close();
  }
});
