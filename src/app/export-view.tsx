import { useState } from "react";
import type { ReactElement } from "react";
import { requestDatabaseExport, requestDeploymentHealth } from "../session/research-api-client.js";
import type { DatabaseExportBundle, DeploymentHealthResponse } from "../session/research-api-client.js";
import {
  exportCalibrationAttritionRows,
  exportCalibrationChatTurnRows,
  exportCalibrationItemRows,
  exportCalibrationManualEvaluationRows,
  exportCalibrationRubricCodeRows,
  exportCalibrationSessionRows,
  exportLabelingRows,
  exportResearchArtifactMeasureRows,
  exportResearchEventRows,
  stringifyCalibrationAttritionCsv,
  stringifyCalibrationChatTurnsCsv,
  stringifyCalibrationItemsCsv,
  stringifyCalibrationManualEvaluationCsv,
  stringifyCalibrationRubricCodesCsv,
  stringifyCalibrationSessionsCsv,
  stringifyDataset,
  stringifyLabelingCsv,
  stringifyResearchArtifactMeasuresCsv,
  stringifyResearchBenchmarkJsonl,
  stringifyResearchEventsCsv,
  stringifyResearchItemLongCsv,
  stringifyResearchRawEventsCsv,
  stringifyResearchSessionWideCsv
} from "../export/export.js";
import type { FileSyncStatus, PilotState } from "../shared/types.js";
import { Button } from "./ui.js";

type DatabaseExportStatus =
  | { readonly type: "idle" }
  | { readonly type: "exporting" }
  | { readonly type: "done"; readonly fileCount: number }
  | { readonly type: "failed"; readonly message: string };

type BackupStatus =
  | { readonly type: "idle" }
  | { readonly type: "exporting" }
  | { readonly type: "done"; readonly generatedAt: string }
  | { readonly type: "failed"; readonly message: string };

type HealthStatus =
  | { readonly type: "idle" }
  | { readonly type: "checking" }
  | { readonly type: "done"; readonly health: DeploymentHealthResponse }
  | { readonly type: "failed"; readonly message: string };

const databaseExportFiles: readonly (keyof DatabaseExportBundle)[] = ["session-wide.csv", "item-long.csv", "raw-events.csv", "benchmark.jsonl", "events.csv", "chat-turns.csv", "artifacts.csv", "measures.csv", "data-quality.csv", "raw-json.json"];

const downloadFile = (fileName: keyof DatabaseExportBundle, value: DatabaseExportBundle[keyof DatabaseExportBundle]): void => {
  const text = fileName === "raw-json.json" ? JSON.stringify(value, null, 2) : String(value);
  const type = fileName.endsWith(".json") ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export function ExportView(props: { readonly fileSync: FileSyncStatus; readonly state: PilotState; readonly onBack: () => void }): ReactElement {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({ type: "idle" });
  const [databaseExportStatus, setDatabaseExportStatus] = useState<DatabaseExportStatus>({ type: "idle" });
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ type: "idle" });
  const dataset = stringifyDataset(props.state, props.fileSync);
  const labelingCsv = stringifyLabelingCsv(props.state);
  const researchEventsCsv = stringifyResearchEventsCsv(props.state);
  const researchArtifactMeasuresCsv = stringifyResearchArtifactMeasuresCsv(props.state);
  const calibrationSessionsCsv = stringifyCalibrationSessionsCsv(props.state);
  const calibrationItemsCsv = stringifyCalibrationItemsCsv(props.state);
  const calibrationManualEvaluationCsv = stringifyCalibrationManualEvaluationCsv(props.state);
  const calibrationAttritionCsv = stringifyCalibrationAttritionCsv(props.state);
  const calibrationChatTurnsCsv = stringifyCalibrationChatTurnsCsv(props.state);
  const calibrationRubricCodesCsv = stringifyCalibrationRubricCodesCsv();
  const platformRawEventsCsv = stringifyResearchRawEventsCsv(props.state);
  const platformItemLongCsv = stringifyResearchItemLongCsv(props.state);
  const platformSessionWideCsv = stringifyResearchSessionWideCsv(props.state);
  const platformBenchmarkJsonl = stringifyResearchBenchmarkJsonl(props.state);
  const labelingRows = exportLabelingRows(props.state);
  const researchEventRows = exportResearchEventRows(props.state);
  const researchArtifactMeasureRows = exportResearchArtifactMeasureRows(props.state);
  const calibrationSessionRows = exportCalibrationSessionRows(props.state);
  const calibrationItemRows = exportCalibrationItemRows(props.state);
  const calibrationManualEvaluationRows = exportCalibrationManualEvaluationRows(props.state);
  const calibrationAttritionRows = exportCalibrationAttritionRows(props.state);
  const calibrationChatTurnRows = exportCalibrationChatTurnRows(props.state);
  const calibrationRubricCodeRows = exportCalibrationRubricCodeRows();
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(dataset)}`;
  const csvDownloadHref = `data:text/csv;charset=utf-8,${encodeURIComponent(labelingCsv)}`;
  const researchEventsHref = `data:text/csv;charset=utf-8,${encodeURIComponent(researchEventsCsv)}`;
  const researchArtifactMeasuresHref = `data:text/csv;charset=utf-8,${encodeURIComponent(researchArtifactMeasuresCsv)}`;
  const calibrationSessionsHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationSessionsCsv)}`;
  const calibrationItemsHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationItemsCsv)}`;
  const calibrationManualEvaluationHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationManualEvaluationCsv)}`;
  const calibrationAttritionHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationAttritionCsv)}`;
  const calibrationChatTurnsHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationChatTurnsCsv)}`;
  const calibrationRubricCodesHref = `data:text/csv;charset=utf-8,${encodeURIComponent(calibrationRubricCodesCsv)}`;
  const platformRawEventsHref = `data:text/csv;charset=utf-8,${encodeURIComponent(platformRawEventsCsv)}`;
  const platformItemLongHref = `data:text/csv;charset=utf-8,${encodeURIComponent(platformItemLongCsv)}`;
  const platformSessionWideHref = `data:text/csv;charset=utf-8,${encodeURIComponent(platformSessionWideCsv)}`;
  const platformBenchmarkHref = `data:application/x-ndjson;charset=utf-8,${encodeURIComponent(platformBenchmarkJsonl)}`;
  const previewRows = labelingRows.slice(0, 5);
  const downloadDatabaseExport = async (): Promise<void> => {
    setDatabaseExportStatus({ type: "exporting" });
    try {
      const bundle = await requestDatabaseExport();
      databaseExportFiles.forEach((fileName) => downloadFile(fileName, bundle[fileName]));
      setDatabaseExportStatus({ fileCount: databaseExportFiles.length, type: "done" });
    } catch (error) {
      if (error instanceof Error) {
        setDatabaseExportStatus({ message: error.message, type: "failed" });
        return;
      }
      throw error;
    }
  };
  const createClassroomBackup = async (): Promise<void> => {
    setBackupStatus({ type: "exporting" });
    try {
      await requestDatabaseExport({ completedOnly: false });
      setBackupStatus({ generatedAt: new Date().toISOString(), type: "done" });
    } catch (error) {
      setBackupStatus({ message: error instanceof Error ? error.message : "백업 생성에 실패했습니다.", type: "failed" });
    }
  };
  const runHealthCheck = async (): Promise<void> => {
    setHealthStatus({ type: "checking" });
    try {
      setHealthStatus({ health: await requestDeploymentHealth(), type: "done" });
    } catch (error) {
      setHealthStatus({ message: error instanceof Error ? error.message : "점검에 실패했습니다.", type: "failed" });
    }
  };
  return (
    <main className="export-page">
      <h1>연구 로그</h1>
      <p>관리자 계정에서만 원자료 로그와 export 파일을 확인합니다. 교사 화면에는 학생 결과 요약만 표시됩니다.</p>
      <p className="sync-status">파일 저장 상태: {fileSyncLabel(props.fileSync)}</p>
      <section aria-label="라벨링 데이터 요약" className="labeling-export-summary">
        <div>
          <p className="eyebrow">라벨링 데이터</p>
          <h2>라벨링 행 {labelingRows.length}개</h2>
          <p>학생 메시지, AI 응답, 과정 이벤트를 코드북 열 구조에 맞춘 CSV로 함께 내보냅니다.</p>
        </div>
        <div>
          <p className="eyebrow">연구 원자료</p>
          <h2>이벤트 {researchEventRows.length}개 · 산출물/측정값 {researchArtifactMeasureRows.length}개</h2>
          <p>events, artifacts, measures를 분석용 CSV로 분리해 JSON과 함께 내보냅니다.</p>
        </div>
        <div>
          <p className="eyebrow">이해 연구 테이블</p>
          <h2>완료 세션 {calibrationSessionRows.length}개 · 문항 {calibrationItemRows.length}개 · 채점행 {calibrationManualEvaluationRows.length}개 · 이탈 {calibrationAttritionRows.length}개</h2>
          <p>기본 분석 CSV는 완료 세션만 포함하고, 미완료 세션은 attrition 파일로 따로 내려받습니다.</p>
        </div>
      </section>
      <section aria-label="로그 다운로드" className="export-actions-panel">
        <header>
          <h2>다운로드</h2>
          <p>필요한 원자료와 코드북만 골라 내려받습니다.</p>
        </header>
        <div className="export-actions">
          <Button variant="secondary" onClick={props.onBack}>관리자 화면</Button>
          <Button disabled={healthStatus.type === "checking"} variant="secondary" onClick={() => void runHealthCheck()}>
            {healthStatus.type === "checking" ? "수업 전 점검 중" : "수업 전 점검"}
          </Button>
          <Button disabled={backupStatus.type === "exporting"} variant="secondary" onClick={() => void createClassroomBackup()}>
            {backupStatus.type === "exporting" ? "백업 생성 중" : "수업 종료 백업 생성"}
          </Button>
          <Button disabled={databaseExportStatus.type === "exporting"} variant="primary" onClick={() => void downloadDatabaseExport()}>
            {databaseExportStatus.type === "exporting" ? "DB export 준비 중" : "DB export 다운로드"}
          </Button>
          <a className="ui-button ui-button-secondary" download="reading-coach-pilot-dataset.json" href={downloadHref}>JSON 다운로드</a>
          <a className="ui-button ui-button-secondary" download="reading-coach-labeling-rows.csv" href={csvDownloadHref}>라벨링 CSV 다운로드</a>
          <a className="ui-button ui-button-secondary" download="research-events.csv" href={researchEventsHref}>이벤트 CSV 다운로드</a>
          <a className="ui-button ui-button-secondary" download="research-artifacts-measures.csv" href={researchArtifactMeasuresHref}>산출물·측정값 CSV</a>
          <a className="ui-button ui-button-secondary" download="raw-events.csv" href={platformRawEventsHref}>범용 이벤트 CSV</a>
          <a className="ui-button ui-button-secondary" download="item-long.csv" href={platformItemLongHref}>범용 item-long CSV</a>
          <a className="ui-button ui-button-secondary" download="session-wide.csv" href={platformSessionWideHref}>범용 session-wide CSV</a>
          <a className="ui-button ui-button-secondary" download="benchmark.jsonl" href={platformBenchmarkHref}>Benchmark JSONL</a>
          <a className="ui-button ui-button-secondary" download="calibration-session-wide.csv" href={calibrationSessionsHref}>완료 세션 wide CSV</a>
          <a className="ui-button ui-button-secondary" download="calibration-item-long.csv" href={calibrationItemsHref}>완료 문항 long CSV</a>
          <a className="ui-button ui-button-secondary" download="calibration-manual-evaluation.csv" href={calibrationManualEvaluationHref}>수동 채점 CSV</a>
          <a className="ui-button ui-button-secondary" download="attrition-diagnostic.csv" href={calibrationAttritionHref}>미완료 진단 CSV</a>
          <a className="ui-button ui-button-secondary" download="chat-turns.csv" href={calibrationChatTurnsHref}>대화 CSV 다운로드</a>
          <a className="ui-button ui-button-secondary" download="rubric-codes.csv" href={calibrationRubricCodesHref}>루브릭 CSV 다운로드</a>
          <a className="ui-button ui-button-secondary" download="pilot-dataset.schema.json" href="/artifacts/pilot-dataset.schema.json">JSON 스키마</a>
          <a className="ui-button ui-button-secondary" download="labeling-codebook.md" href="/artifacts/labeling-codebook.md">라벨링 코드북</a>
          <a className="ui-button ui-button-secondary" download="data-dictionary.md" href="/artifacts/data-dictionary.md">데이터 딕셔너리</a>
          <a className="ui-button ui-button-secondary" download="understanding-calibration-rubric.md" href="/artifacts/understanding-calibration-rubric.md">이해 연구 루브릭</a>
        </div>
      </section>
      {databaseExportStatus.type === "done" ? <p className="sync-status">DB export 파일 {databaseExportStatus.fileCount}개를 내려받았습니다.</p> : null}
      {databaseExportStatus.type === "failed" ? <p className="sync-status">DB export 실패 - {databaseExportStatus.message}</p> : null}
      {backupStatus.type === "done" ? <p className="sync-status">수업 종료 백업을 생성했습니다. 생성 시각: {new Date(backupStatus.generatedAt).toLocaleString("ko-KR")}</p> : null}
      {backupStatus.type === "failed" ? <p className="sync-status">수업 종료 백업 실패 - {backupStatus.message}</p> : null}
      {healthStatus.type === "failed" ? <p className="sync-status">수업 전 점검 실패 - {healthStatus.message}</p> : null}
      {healthStatus.type === "done" ? (
        <section aria-label="수업 전 점검 결과" className="labeling-preview">
          <h2>수업 전 점검 결과</h2>
          <p>{healthStatus.health.ok ? "정상입니다. 수업을 시작해도 됩니다." : "확인이 필요한 항목이 있습니다."}</p>
          <table>
            <thead>
              <tr><th>항목</th><th>상태</th><th>메시지</th></tr>
            </thead>
            <tbody>
              {healthStatus.health.checks.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.ok ? "정상" : "확인 필요"}</td>
                  <td>{item.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section aria-label="라벨링 행 미리보기" className="labeling-preview">
        <h2>라벨링 행 미리보기</h2>
        {previewRows.length === 0 ? (
          <p>학생 대화나 과정 이벤트가 생기면 이곳에 라벨링용 행이 나타납니다.</p>
        ) : (
          <table>
            <thead>
              <tr><th>화자</th><th>단계</th><th>근거 텍스트</th></tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.turnOrEventId}>
                  <td>{row.speaker}</td>
                  <td>{row.stage}</td>
                  <td>{row.evidenceText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section aria-label="전체 로그 JSON" className="export-json-panel">
        <header>
          <h2>전체 로그 JSON</h2>
          <p>화면에서는 일부 높이만 보여주고, 내부에서 스크롤해 확인합니다.</p>
        </header>
        <pre data-testid="export-json">{dataset}</pre>
      </section>
    </main>
  );
}

const fileSyncLabel = (fileSync: FileSyncStatus): string => {
  if (fileSync.status === "saved") return `${fileSync.path} 저장됨`;
  if (fileSync.status === "failed") return `저장 실패 - ${fileSync.message}`;
  if (fileSync.status === "unavailable") return "파일 저장 미사용";
  return "저장 확인 전";
};
