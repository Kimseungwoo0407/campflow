import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(repositoryRoot, ".env");
const outputPath = resolve(repositoryRoot, "apps/web/src/api/demo-snapshot.json");
const publicAssetRoot = resolve(repositoryRoot, "apps/web/public/demo-assets/characters");
const apiBaseUrl = process.env.CAMPFLOW_SNAPSHOT_API ?? "http://127.0.0.1:4000/v1";

function readEnvValue(text, key) {
  const prefix = `${key}=`;
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
  if (!line) throw new Error(`${key} is missing from .env`);
  let value = line.slice(prefix.length).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function optionalEnvValue(text, key, fallback) {
  try {
    return readEnvValue(text, key);
  } catch {
    return fallback;
  }
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createAccessToken(payload, secret) {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const body = base64Url(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function existingSessionAuth(envText, username) {
  const databaseUser = optionalEnvValue(envText, "POSTGRES_USER", "campflow");
  const databaseName = optionalEnvValue(envText, "POSTGRES_DB", "campflow");
  const container = process.env.CAMPFLOW_SNAPSHOT_DB_CONTAINER ?? "campflow-dev-postgres-1";
  const escapedUsername = username.replaceAll("'", "''");
  const sql = `
    SELECT json_build_object(
      'sessionId', session.id,
      'id', account.id,
      'email', account.email,
      'nickname', account.nickname,
      'locale', account.locale,
      'timezone', account.timezone
    )
    FROM "Session" session
    JOIN "User" account ON account.id = session."userId"
    WHERE account.username = '${escapedUsername}'
      AND account.status = 'ACTIVE'
      AND session."revokedAt" IS NULL
      AND session."expiresAt" > now()
    ORDER BY session."lastUsedAt" DESC
    LIMIT 1;
  `;
  const output = execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", databaseUser, "-d", databaseName, "-At"],
    { input: sql, encoding: "utf8" },
  ).trim();
  if (!output) throw new Error("No active owner session is available for the snapshot export.");
  const session = JSON.parse(output);
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    accessToken: createAccessToken(
      {
        sub: session.id,
        sid: session.sessionId,
        email: session.email,
        typ: "access",
        iat: issuedAt,
        exp: issuedAt + 15 * 60,
        aud: "campflow-web",
        iss: "campflow-api",
      },
      readEnvValue(envText, "JWT_ACCESS_SECRET"),
    ),
    user: {
      id: session.id,
      username,
      email: session.email,
      nickname: session.nickname,
      locale: session.locale,
      timezone: session.timezone,
    },
  };
}

async function request(path, accessToken) {
  const response = await globalThis.fetch(`${apiBaseUrl}/${path}`, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || !payload || !("data" in payload)) {
    const message = payload?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`GET ${path}: ${message}`);
  }
  return payload.data;
}

async function optionalRequest(path, accessToken) {
  try {
    return await request(path, accessToken);
  } catch {
    return undefined;
  }
}

async function main() {
  const envText = await readFile(envPath, "utf8");
  const accounts = JSON.parse(readEnvValue(envText, "SEED_FRIEND_ACCOUNTS_JSON"));
  const owner = accounts[0];
  if (!owner?.username || !owner?.password) {
    throw new Error("The first seed account must contain username and password.");
  }

  const loginResponse = await globalThis.fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: owner.username, password: owner.password }),
  });
  const loginPayload = await loginResponse.json().catch(() => undefined);
  const auth =
    loginResponse.ok && loginPayload && "data" in loginPayload
      ? loginPayload.data
      : existingSessionAuth(envText, owner.username);
  const responses = {
    "health/live": { status: "ok" },
  };
  const assets = {};

  const [me, groups, trips] = await Promise.all([
    request("me", auth.accessToken),
    request("groups", auth.accessToken),
    request("trips", auth.accessToken),
  ]);
  responses.me = {
    ...me,
    email: "demo@campflow.local",
    profile: me.profile ? { ...me.profile, phone: null } : null,
  };
  responses.groups = groups;
  responses.trips = trips;

  for (const group of groups) {
    const [detail, groupTrips] = await Promise.all([
      request(`groups/${group.id}`, auth.accessToken),
      request(`groups/${group.id}/trips`, auth.accessToken),
    ]);
    responses[`groups/${group.id}`] = detail;
    responses[`groups/${group.id}/trips`] = groupTrips;
  }

  const tripPaths = [
    "characters",
    "candidates",
    "polls",
    "itinerary/days",
    "tasks",
    "meals",
    "shopping-list",
    "vehicles",
    "transport/validation",
    "expenses",
    "points",
    "achievements",
    "games/penalty-matches",
    "games/odd-even/rounds",
    "posts",
    "messages",
    "files",
  ];

  for (const trip of trips) {
    const tripId = trip.id;
    responses[`trips/${tripId}`] = await request(`trips/${tripId}`, auth.accessToken);
    const values = await Promise.all(
      tripPaths.map((suffix) => request(`trips/${tripId}/${suffix}`, auth.accessToken)),
    );
    tripPaths.forEach((suffix, index) => {
      responses[`trips/${tripId}/${suffix}`] = values[index];
    });

    const detail = responses[`trips/${tripId}`];
    for (const member of detail.members ?? []) {
      const contentPath = `trips/${tripId}/characters/${member.user.id}/content`;
      const content = await optionalRequest(contentPath, auth.accessToken);
      if (content?.dataBase64 && content.mime) {
        await mkdir(publicAssetRoot, { recursive: true });
        const extension = content.mime === "image/png" ? "png" : "bin";
        const fileName = `${tripId}-${member.user.id}.${extension}`;
        await writeFile(resolve(publicAssetRoot, fileName), Buffer.from(content.dataBase64, "base64"));
        assets[contentPath] = {
          path: `demo-assets/characters/${fileName}`,
          mime: content.mime,
        };
      }
    }
  }

  const snapshot = {
    exportedAt: new Date().toISOString(),
    sessionUser: {
      id: auth.user.id,
      username: "demo",
      email: "demo@campflow.local",
      nickname: auth.user.nickname,
      locale: auth.user.locale,
      timezone: auth.user.timezone,
    },
    groupId: groups[0]?.id ?? "",
    tripId: trips[0]?.id ?? "",
    assets,
    responses,
  };

  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Demo snapshot exported: ${groups.length} group(s), ${trips.length} trip(s), ${Object.keys(responses).length} response(s).\n`,
  );
}

await main();
