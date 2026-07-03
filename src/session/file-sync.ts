import type { FileSyncStatus } from "../shared/types.js";

export class FileSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileSyncError";
  }
}

export const unavailableFileSync = (): FileSyncStatus => ({
  status: "unavailable",
  message: "연구 데이터는 중앙 DB에 저장됩니다."
});

export const failedFileSync = (error: unknown): FileSyncStatus => ({
  status: "failed",
  message: error instanceof Error ? error.message : "파일 저장에 실패했습니다."
});
