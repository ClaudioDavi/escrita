// A fake Obsidian vault for the file-writing surface (NoteService.create and
// ensureFolder): text and binary files, folders, a case-insensitive disk option,
// and a hook to make a file appear between a check and a create (a race).

import { TFile, TFolder } from "obsidian";

export class FileVault {
  entries = new Map<string, TFile | TFolder>();
  bytes = new Map<string, ArrayBuffer>();
  text = new Map<string, string>();
  /** like a Windows or macOS disk: create fails when a name differs only in case */
  caseInsensitiveDisk = true;
  /** runs once at the start of the next create/createBinary, before it checks the disk */
  beforeNextCreate: (() => void) | null = null;
  calls: string[] = [];

  private make(path: string, folder: boolean): TFile | TFolder {
    const f = folder ? new TFolder() : new TFile();
    f.path = path;
    f.name = path.slice(path.lastIndexOf("/") + 1);
    if (f instanceof TFile) {
      const dot = f.name.lastIndexOf(".");
      f.extension = dot < 0 ? "" : f.name.slice(dot + 1);
      f.basename = dot < 0 ? f.name : f.name.slice(0, dot);
    }
    this.entries.set(path, f);
    return f;
  }

  /** test setup: a file or folder that is already there */
  seedFile(path: string, content: string | ArrayBuffer): TFile {
    const f = this.make(path, false) as TFile;
    if (typeof content === "string") this.text.set(path, content);
    else this.bytes.set(path, content);
    return f;
  }
  seedFolder(path: string): void { this.make(path, true); }

  getAbstractFileByPath(path: string): TFile | TFolder | null { return this.entries.get(path) ?? null; }
  getAllLoadedFiles(): (TFile | TFolder)[] { return [...this.entries.values()]; }

  private clash(path: string): boolean {
    if (this.entries.has(path)) return true;
    if (!this.caseInsensitiveDisk) return false;
    const l = path.toLowerCase();
    return [...this.entries.keys()].some((k) => k.toLowerCase() === l);
  }

  async createFolder(path: string): Promise<TFolder> {
    this.calls.push(`createFolder ${path}`);
    if (this.clash(path)) throw new Error("Folder already exists.");
    return this.make(path, true) as TFolder;
  }
  private async add(kind: string, path: string): Promise<TFile> {
    this.calls.push(`${kind} ${path}`);
    const hook = this.beforeNextCreate;
    this.beforeNextCreate = null;
    hook?.();
    if (this.clash(path)) throw new Error("File already exists.");
    return this.make(path, false) as TFile;
  }
  async create(path: string, content: string): Promise<TFile> {
    const f = await this.add("create", path);
    this.text.set(path, content);
    return f;
  }
  async createBinary(path: string, content: ArrayBuffer): Promise<TFile> {
    const f = await this.add("createBinary", path);
    this.bytes.set(path, content);
    return f;
  }
  async modify(file: TFile, content: string): Promise<void> {
    this.calls.push(`modify ${file.path}`);
    this.text.set(file.path, content);
  }
  async modifyBinary(file: TFile, content: ArrayBuffer): Promise<void> {
    this.calls.push(`modifyBinary ${file.path}`);
    this.bytes.set(file.path, content);
  }
  async readBinary(file: TFile): Promise<ArrayBuffer> {
    const b = this.bytes.get(file.path);
    if (!b) throw new Error(`no bytes at ${file.path}`);
    return b;
  }
  async read(file: TFile): Promise<string> { return this.text.get(file.path) ?? ""; }
}
