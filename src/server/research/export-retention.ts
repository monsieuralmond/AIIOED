import { encode } from "./supabase-session-rows.js";
import type { SupabaseRestClient } from "./supabase-rest.js";

const defaultRetentionDays = 30;
const msPerDay = 24 * 60 * 60 * 1000;

const exportRetentionDays = (): number | null => {
  const raw = process.env["EXPORT_RETENTION_DAYS"]?.trim();
  if (raw === undefined || raw.length === 0) return defaultRetentionDays;
  if (raw === "0" || raw.toLowerCase() === "off") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultRetentionDays;
};

export const pruneOldExports = async (db: SupabaseRestClient): Promise<void> => {
  const retentionDays = exportRetentionDays();
  if (retentionDays === null) return;
  const cutoff = new Date(Date.now() - retentionDays * msPerDay).toISOString();
  await db.delete<readonly unknown[]>("exports", `created_at=lt.${encode(cutoff)}`);
};
