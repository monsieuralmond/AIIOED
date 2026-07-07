import { execFileSync } from "node:child_process";

const statusOutput = execFileSync("git", ["status", "--porcelain=v1"], { encoding: "utf8" }).trimEnd();
const lines = statusOutput.length === 0 ? [] : statusOutput.split("\n");

if (lines.length === 0) {
  console.log("Worktree is clean.");
  process.exit(0);
}

const grouped = {
  staged: [],
  unstaged: [],
  untracked: []
};

for (const line of lines) {
  const indexStatus = line.slice(0, 1);
  const worktreeStatus = line.slice(1, 2);
  const path = line.slice(3);
  if (indexStatus === "?" && worktreeStatus === "?") {
    grouped.untracked.push(path);
    continue;
  }
  if (indexStatus !== " ") grouped.staged.push(path);
  if (worktreeStatus !== " ") grouped.unstaged.push(path);
}

for (const [label, paths] of Object.entries(grouped)) {
  if (paths.length === 0) continue;
  console.log(`${label}:`);
  for (const path of paths) console.log(`- ${path}`);
}

if (process.env["ALLOW_DIRTY_WORKTREE"] === "1") process.exit(0);

console.error("Worktree has pending changes. Commit, stash, or run with ALLOW_DIRTY_WORKTREE=1 when this is intentional.");
process.exit(1);
