import { Modal, Notice, Setting, TFile, normalizePath, type App, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { lang, t } from "../i18n";
import { HOME_TEMPLATE, homeAction, homePath, resolveCaseless, settingToSave } from "./home";

/** Name offered for a new home note: no accent, so it is safe on every file system. */
export function offerName(): string {
  return lang() === "pt-BR" ? "Inicio.md" : "Home.md";
}

class ConfirmCreateModal extends Modal {
  private answered = false;

  constructor(
    app: App,
    private path: string,
    private unset: boolean,
    private done: (ok: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("desk.confirm.title"));
    this.contentEl.createEl("p", { text: t(this.unset ? "desk.confirm.bodyUnset" : "desk.confirm.body", { path: this.path }) });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("desk.confirm.cancel")).onClick(() => this.close()))
      .addButton((b) =>
        b.setButtonText(t("desk.confirm.create")).setCta().onClick(() => {
          this.answered = true;
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.answered);
  }
}

function confirmCreate(app: App, path: string, unset: boolean): Promise<boolean> {
  return new Promise((resolve) => new ConfirmCreateModal(app, path, unset, resolve).open());
}

/** Show a note: reuse an open tab (deferred ones included) or open a new one. */
async function show(plugin: EscritaPlugin, file: TFile): Promise<void> {
  const { workspace } = plugin.app;
  if (workspace.getActiveFile()?.path === file.path) return;
  let found: WorkspaceLeaf | null = null;
  workspace.iterateAllLeaves((leaf) => {
    if (found) return;
    const state = leaf.getViewState().state as { file?: string } | undefined;
    if (state?.file === file.path) found = leaf;
  });
  if (found) {
    const leaf: WorkspaceLeaf = found;
    await workspace.revealLeaf(leaf);
    workspace.setActiveLeaf(leaf, { focus: true });
    return;
  }
  await workspace.getLeaf(false).openFile(file);
}

async function create(plugin: EscritaPlugin, path: string): Promise<TFile | null> {
  const norm = normalizePath(path);
  // "fail": the caller offered to create a missing note, so one that appeared since is not overwritten or reused
  const { file } = await plugin.notes.create(norm, HOME_TEMPLATE, { exists: "fail" });
  if (!homePath(plugin.settings.homeNote)) {
    plugin.settings.homeNote = norm;
    await plugin.saveSettings();
  }
  return file;
}

/** Open the home note. With `create`, a missing note is offered (after a confirm). */
export async function openHome(plugin: EscritaPlugin, opts: { create: boolean }): Promise<void> {
  const { vault } = plugin.app;
  // case-insensitive, like creating a note: a "Home.md" answers the setting "home.md"
  const paths = vault.getFiles().map((f) => f.path);
  const resolve = (p: string) => resolveCaseless(paths, normalizePath(p));
  const found = homeAction(plugin.settings.homeNote, (p) => resolve(p) !== null, offerName());
  const action = found.kind === "offer" ? found : { ...found, path: resolve(found.path) ?? found.path };
  if (action.kind === "offer") {
    if (!opts.create) return;
    if (!(await confirmCreate(plugin.app, action.path, !homePath(plugin.settings.homeNote)))) return;
    try {
      const file = await create(plugin, action.path);
      if (file) await show(plugin, file);
    } catch (e) {
      console.error("Escrita: could not create the home note", e);
      new Notice(t("desk.notice.createFailed", { path: action.path }));
    }
    return;
  }
  const file = vault.getAbstractFileByPath(normalizePath(action.path));
  const adopted = settingToSave(plugin.settings.homeNote, action);
  if (adopted && file instanceof TFile) {
    plugin.settings.homeNote = adopted;
    await plugin.saveSettings();
  }
  if (file instanceof TFile) await show(plugin, file);
  else new Notice(t("desk.notice.missing", { path: action.path }));
}

/** On startup: open the home note only when the setting is on and the file exists. */
export async function startupOpen(plugin: EscritaPlugin): Promise<void> {
  if (!plugin.settings.openHomeOnStartup) return;
  const paths = plugin.app.vault.getFiles().map((f) => f.path);
  let path = homePath(plugin.settings.homeNote);
  if (!path) {
    // an empty setting adopts an existing Home.md / Inicio.md (openHome saves it)
    const action = homeAction("", (p) => resolveCaseless(paths, normalizePath(p)) !== null, offerName());
    if (action.kind !== "adopt") return;
    path = action.path;
  }
  if (resolveCaseless(paths, normalizePath(path)) === null) return;
  await openHome(plugin, { create: false });
}
