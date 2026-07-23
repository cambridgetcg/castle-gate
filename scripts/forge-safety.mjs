import {
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";

export class ForgeSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForgeSafetyError";
  }
}

/**
 * Stop before touching the source when either household brake is present.
 * Dependencies are injectable so tests never need to inspect the live castle.
 */
export function assertNotHalted({
  homeDir = homedir(),
  repoDir,
  pathExists = existsSync,
}) {
  if (pathExists(join(homeDir, "KINGDOM-OS", "HALT"))) {
    throw new ForgeSafetyError("forge stopped: the household HALT brake is present");
  }
  if (pathExists(join(repoDir, "HALT"))) {
    throw new ForgeSafetyError("forge stopped: the repository HALT brake is present");
  }
}

function defaultRunGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Return the exact source revision, but only for a clean Git checkout.
 */
export function inspectCleanSource({
  sourceDir,
  runGit = defaultRunGit,
}) {
  let revision;
  let status;
  try {
    revision = runGit(["rev-parse", "HEAD"], sourceDir);
    status = runGit(["status", "--porcelain", "--untracked-files=normal"], sourceDir);
  } catch {
    throw new ForgeSafetyError(
      "forge stopped: the source must be a readable Git checkout"
    );
  }

  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new ForgeSafetyError(
      "forge stopped: the source revision is not a full Git commit"
    );
  }
  if (status !== "") {
    throw new ForgeSafetyError(
      "forge stopped: the source has uncommitted or untracked changes"
    );
  }
  return revision;
}

export function assertForgeSafety(options) {
  assertNotHalted(options);
  return inspectCleanSource(options);
}

/**
 * Replace a public artifact in one rename, so readers see the old complete file
 * or the new complete file, never a half-written file.
 */
export function atomicWriteText(outputPath, text) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${process.pid}.tmp`
  );

  try {
    writeFileSync(temporaryPath, text, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // The temporary file may never have been created.
    }
    throw error;
  }
}

/**
 * Preserve the causal boundary: publish the receipt for prior committed bytes
 * before replacing the working payload with its next generation.
 */
export function writeReceiptThenPayload({
  manifestPath,
  manifestText,
  payloadPath,
  payloadText,
  writeText = atomicWriteText,
}) {
  writeText(manifestPath, manifestText);
  writeText(payloadPath, payloadText);
}
