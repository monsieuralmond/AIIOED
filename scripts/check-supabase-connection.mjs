import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");

const parseEnvFile = (text) => {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, "");
    values.set(key, value);
  }
  return values;
};

const envValues = fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, "utf8")) : new Map();
const supabaseUrl = process.env.SUPABASE_URL ?? envValues.get("SUPABASE_URL") ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envValues.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (supabaseUrl.trim().length === 0) {
  console.error("SUPABASE_URL is missing.");
  process.exit(1);
}

if (serviceRoleKey.trim().length === 0) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  process.exit(1);
}

let url;
try {
  url = new URL(supabaseUrl);
} catch {
  console.error("SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

console.log(`Supabase host: ${url.hostname}`);
console.log(`Service role key: configured (${serviceRoleKey.length} chars)`);

try {
  const address = await dns.lookup(url.hostname);
  console.log(`DNS: ok (${address.address})`);
} catch (error) {
  console.error(`DNS: failed (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8_000);

try {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, "")}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    },
    signal: controller.signal
  });
  console.log(`REST: HTTP ${response.status}`);
  if (!response.ok) process.exit(1);
  console.log("Supabase connection: ok");
} catch (error) {
  console.error(`REST: failed (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
