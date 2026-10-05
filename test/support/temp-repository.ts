import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TemporaryRepository = {
  path: string;
  commit: (message: string) => Promise<string>;
  cleanup: () => Promise<void>;
};

const runGit = async ({
  arguments: gitArguments,
  cwd,
}: {
  arguments: string[];
  cwd: string;
}): Promise<string> => {
  const { stdout } = await execFileAsync('git', gitArguments, { cwd });

  return stdout.trim();
};

export const createTemporaryRepository =
  async (): Promise<TemporaryRepository> => {
    const path = await mkdtemp(join(tmpdir(), 'pi-maestro-'));

    await runGit({
      arguments: ['init', '--initial-branch', 'main'],
      cwd: path,
    });
    await runGit({
      arguments: ['config', 'user.name', 'Pi Maestro Test'],
      cwd: path,
    });
    await runGit({
      arguments: ['config', 'user.email', 'pi-maestro-test@example.com'],
      cwd: path,
    });

    return {
      path: await realpath(path), // On macOS, /var is a symlink to /private/var.
      commit: async (message: string) => {
        await runGit({ arguments: ['add', '--all'], cwd: path });
        await runGit({
          arguments: ['commit', '--message', message],
          cwd: path,
        });

        return runGit({ arguments: ['rev-parse', 'HEAD'], cwd: path });
      },
      cleanup: async () => {
        try {
          await rm(path, { force: true, recursive: true });
        } catch {
          // Best effort: macOS CI intermittently failed teardown with ENOTEMPTY
          // while removing .git/objects from this temporary repository.
          // See Actions run 36433253055. The repository is under os.tmpdir(),
          // so leaving it behind cannot modify the project checkout.
        }
      },
    };
  };
