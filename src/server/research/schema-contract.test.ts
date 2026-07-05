import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = (fileName: string): string =>
  readFileSync(join(process.cwd(), "supabase", "migrations", fileName), "utf8").replaceAll(/\s+/g, " ").toLowerCase();

describe("Supabase research schema contract", () => {
  it("keeps the required research tables and row ownership columns", () => {
    const sql = migrationSql("001_research_platform.sql");
    const requiredTables = ["classes", "assignments", "students", "sessions", "chat_turns", "events", "artifacts", "measures", "exports", "deletion_logs"] as const;
    const childTables = ["chat_turns", "events", "artifacts", "measures"] as const;

    for (const table of requiredTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    for (const table of childTables) {
      const tableStart = sql.indexOf(`create table if not exists public.${table}`);
      const nextTableStart = sql.indexOf("create table if not exists public.", tableStart + 1);
      const tableSql = sql.slice(tableStart, nextTableStart === -1 ? undefined : nextTableStart);
      expect(tableSql).toContain("session_id text not null");
      expect(tableSql).toContain("class_group_id text not null");
      expect(tableSql).toContain("assignment_id text not null");
      expect(tableSql).toContain("student_anonymous_id text not null");
      expect(tableSql).toContain("created_at timestamptz not null");
      expect(tableSql).toContain("stage text not null");
    }
  });

  it("keeps session locking and chat request idempotency constraints", () => {
    const sql = migrationSql("001_research_platform.sql");

    expect(sql).toContain("research_locked boolean not null default false");
    expect(sql).toContain("create unique index if not exists chat_turns_request_role_unique");
    expect(sql).toContain("on public.chat_turns(session_id, request_id, role)");
  });

  it("keeps teacher and student credential columns out of the initial anonymous export tables", () => {
    const authSql = migrationSql("003_auth_and_safe_roster.sql");

    expect(authSql).toContain("create table if not exists public.teachers");
    expect(authSql).toContain("password_hash text not null");
    expect(authSql).toContain("add column if not exists login_id text");
    expect(authSql).toContain("add column if not exists password_hash text");
    expect(authSql).toContain("add column if not exists student_number integer");
  });
});
