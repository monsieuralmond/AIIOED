import type { FileSyncStatus, PilotState } from "../shared/types";

type SavedFileResponse = {
  readonly ok: true;
  readonly path: string;
  readonly syncedAt: string;
};

export class FileSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileSyncError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

const isSavedFileResponse = (value: unknown): value is SavedFileResponse =>
  isRecord(value) && value["ok"] === true && isString(value["path"]) && isString(value["syncedAt"]);

export const unavailableFileSync = (): FileSyncStatus => ({
  status: "unavailable",
  message: "파일 저장 엔드포인트를 사용할 수 없습니다."
});

export const failedFileSync = (error: unknown): FileSyncStatus => ({
  status: "failed",
  message: error instanceof Error ? error.message : "파일 저장에 실패했습니다."
});

export const syncPilotStateToFile = async (state: PilotState): Promise<FileSyncStatus> => {
  if (typeof window.fetch !== "function") return unavailableFileSync();
  const response = await window.fetch("/api/pilot-state", {
    body: JSON.stringify(state),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) throw new FileSyncError(`파일 저장 실패: ${response.status}`);
  const parsed: unknown = await response.json();
  if (!isSavedFileResponse(parsed)) throw new FileSyncError("파일 저장 응답 형식이 올바르지 않습니다.");
  return {
    path: parsed.path,
    status: "saved",
    syncedAt: parsed.syncedAt
  };
};
