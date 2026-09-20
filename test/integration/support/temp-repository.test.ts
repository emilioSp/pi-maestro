import { execFileSync } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTemporaryRepository } from "#test/support/temp-repository.ts";

const runGit = ({ arguments: gitArguments, cwd }: { arguments: string[]; cwd: string }) =>
  execFileSync("git", gitArguments, { cwd, encoding: "utf8" }).trim();

describe("temporary repository support", () => {
  it("initializes main with a local identity, creates explicit commits, and removes the temporary repository", async () => {
    const repository = await createTemporaryRepository();

    try {
      await writeFile(join(repository.path, "README.md"), "# Test repository\n", "utf8");
      const commit = await repository.commit({ message: "Add readme" });

      expect(runGit({ arguments: ["branch", "--show-current"], cwd: repository.path })).toBe(
        "main",
      );
      expect(runGit({ arguments: ["config", "user.name"], cwd: repository.path })).toBe(
        "Pi Maestro Test",
      );
      expect(runGit({ arguments: ["config", "user.email"], cwd: repository.path })).toBe(
        "pi-maestro-test@example.com",
      );
      expect(runGit({ arguments: ["rev-parse", "HEAD"], cwd: repository.path })).toBe(commit);
    } finally {
      await repository.cleanup();
    }

    await expect(access(repository.path)).rejects.toThrow();
  });
});
