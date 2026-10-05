import { describe, expect, it, vi } from "vitest";
import { TFolder } from "./support/obsidian";
import { fakePlugin } from "./support/fake-plugin";
import { SubmissionsModule } from "../src/submissions";

describe("the submissions folder follows a rename", () => {
  it("rewrites the setting and saves it, also for a folder holding it", () => {
    const p = fakePlugin();
    p.settings.submissionsFolder = "Submissions";
    const dest = Object.assign(new TFolder(), { path: "Submissões" });
    p.app.vault.files.set("Submissões", dest as never);
    const save = vi.spyOn(p, "saveSettings");
    const [f] = new SubmissionsModule(p.asPlugin).dataFollowers();
    f.moved?.("Submissions", "Submissões");
    expect(p.settings.submissionsFolder).toBe("Submissões");
    expect(save).toHaveBeenCalledTimes(1);

    p.settings.submissionsFolder = "Work/Submissions";
    p.app.vault.files.set("Trabalho", Object.assign(new TFolder(), { path: "Trabalho" }) as never);
    f.moved?.("Work", "Trabalho");
    expect(p.settings.submissionsFolder).toBe("Trabalho/Submissions");
    f.moved?.("Elsewhere", "Trabalho");
    expect(p.settings.submissionsFolder).toBe("Trabalho/Submissions");
  });
});
