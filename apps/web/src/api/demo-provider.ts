import snapshot from "./demo-snapshot.json";

const demoDataByPath: Record<string, unknown> = snapshot.responses;
const demoAssetsByPath: Record<string, { path: string; mime: string }> = snapshot.assets;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  const method = (init.method ?? "GET").toUpperCase();

  if (method === "POST" && normalizedPath === "auth/logout") {
    return undefined as T;
  }

  if (method !== "GET") {
    throw new Error("데모는 조회 전용입니다. 로그인하면 데이터를 직접 변경할 수 있습니다.");
  }

  const asset = demoAssetsByPath[normalizedPath];
  if (asset) {
    const response = await fetch(`${import.meta.env.BASE_URL}${asset.path}`);
    if (!response.ok) throw new Error("데모 이미지를 불러올 수 없습니다.");
    return {
      mime: asset.mime,
      dataBase64: arrayBufferToBase64(await response.arrayBuffer()),
    } as T;
  }

  if (!(normalizedPath in demoDataByPath)) {
    throw new Error("이 화면의 데모 데이터를 찾을 수 없습니다.");
  }

  return clone(demoDataByPath[normalizedPath]) as T;
}

export const demoIds = {
  groupId: snapshot.groupId,
  tripId: snapshot.tripId,
} as const;
