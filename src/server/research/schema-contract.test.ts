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

  it("keeps the latest session atomicity and lock migrations in the deployable schema", () => {
    const syncSql = migrationSql("008_atomic_session_sync.sql");
    const uniquenessSql = migrationSql("009_session_uniqueness_and_lock.sql");
    const lockSql = migrationSql("010_lock_research_child_writes.sql");
    const quotaSql = migrationSql("011_ai_request_quota.sql");
    const securitySql = migrationSql("012_secure_privileged_research_rpcs.sql");
    const resetSql = migrationSql("013_archive_before_teacher_session_reset.sql");
    const quotaFixSql = migrationSql("014_fix_ai_request_quota_ambiguity.sql");
    const writingUnlockSql = migrationSql("015_unlock_submitted_writing_sessions.sql");

    expect(syncSql).toContain("create or replace function public.sync_research_session(payload jsonb)");
    expect(syncSql).toContain("for update");
    expect(uniquenessSql).toContain("lock table public.sessions");
    expect(uniquenessSql).toContain("create temporary table duplicate_session_repairs");
    expect(uniquenessSql).toContain("locked_research_session_count > 1");
    expect(uniquenessSql).toContain("keep_session_locked");
    expect(uniquenessSql).toContain("child rows that would have to be merged into a locked/submitted session");
    expect(uniquenessSql).toContain("create temporary table duplicate_session_raw_snapshots");
    expect(uniquenessSql).toContain("'chatturns'");
    expect(uniquenessSql).toContain("'events'");
    expect(uniquenessSql).toContain("'artifacts'");
    expect(uniquenessSql).toContain("'measures'");
    expect(uniquenessSql).toContain("duplicate_sessions_pre_uniqueness_repair");
    expect(uniquenessSql).toContain("create temporary table duplicate_session_request_id_rewrites");
    expect(uniquenessSql).toContain("duplicate_session_merge");
    expect(uniquenessSql).toContain("':merged-from:'");
    expect(uniquenessSql).toContain("'requestidrewrites'");
    expect(uniquenessSql).toContain("'rawsnapshot'");
    for (const table of ["chat_turns", "events", "artifacts", "measures"] as const) {
      expect(uniquenessSql).toContain(`update public.${table}`);
      expect(uniquenessSql).toContain("session_id = repair.keep_session_id");
      expect(uniquenessSql).toContain("class_group_id = repair.keep_class_group_id");
    }
    expect(uniquenessSql).toContain("sessions_assignment_student_unique");
    expect(uniquenessSql).toContain("duplicate research sessions still exist after migration 009 repair");
    expect(lockSql).toContain("research session is locked");
    expect(lockSql).toContain("sync_research_session_available");
    expect(lockSql).toContain("session_uniqueness_available");
    expect(quotaSql).toContain("create table if not exists public.ai_request_buckets");
    expect(quotaSql).toContain("reserve_ai_request");
    expect(quotaSql).toContain("on conflict on constraint ai_request_buckets_pkey");
    expect(quotaSql).toContain("ai_request_quota_available");
    expect(securitySql).toContain("revoke all on function public.apply_roster_mutation(jsonb)");
    expect(securitySql).toContain("revoke all on function public.delete_research_test_data(jsonb)");
    expect(securitySql).toContain("create or replace function public.reset_research_session");
    expect(securitySql).toContain("reset_research_session_available");
    expect(resetSql).toContain("create or replace function public.reset_research_session");
    expect(resetSql).toContain("session_reset_pre_delete");
    expect(resetSql).toContain("teacher_session_reset");
    expect(resetSql).toContain("rawsnapshot");
    expect(resetSql).toContain("reset_research_session_archives_before_delete");
    expect(quotaFixSql).toContain("create or replace function public.reserve_ai_request");
    expect(quotaFixSql).toContain("on conflict on constraint ai_request_buckets_pkey");
    expect(quotaFixSql).toContain("ai_request_quota_ambiguity_fixed");
    expect(writingUnlockSql).toContain("015_unlock_submitted_writing_sessions");
    expect(writingUnlockSql).toContain("where research_mode in ('writing_coach', 'guided_writing')");
    expect(writingUnlockSql).toContain("target.research_mode = 'understanding_calibration'");
    expect(writingUnlockSql).toContain("reset_research_session_archives_before_delete");
    expect(writingUnlockSql).toContain("submitted_writing_sessions_unlocked");
  });
});
