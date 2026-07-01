import type { ReactElement } from "react";
import { exportLabelingRows, stringifyDataset, stringifyLabelingCsv } from "../export/export";
import type { FileSyncStatus, PilotState } from "../shared/types";
import { Button } from "./ui";

export function ExportView(props: { readonly fileSync: FileSyncStatus; readonly state: PilotState; readonly onStudent: () => void }): ReactElement {
  const dataset = stringifyDataset(props.state, props.fileSync);
  const labelingCsv = stringifyLabelingCsv(props.state);
  const labelingRows = exportLabelingRows(props.state);
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(dataset)}`;
  const csvDownloadHref = `data:text/csv;charset=utf-8,${encodeURIComponent(labelingCsv)}`;
  const previewRows = labelingRows.slice(0, 5);
  return (
    <main className="export-page">
      <h1>연구 로그</h1>
      <p>교사, 학생, 과제, 대화, 생각 정리, 초안, 붙여넣기, 최종 제출을 JSON으로 고정합니다.</p>
      <p className="sync-status">파일 저장 상태: {fileSyncLabel(props.fileSync)}</p>
      <section aria-label="라벨링 데이터 요약" className="labeling-export-summary">
        <div>
          <p className="eyebrow">라벨링 데이터</p>
          <h2>라벨링 행 {labelingRows.length}개</h2>
          <p>학생 메시지, AI 응답, 과정 이벤트를 코드북 열 구조에 맞춘 CSV로 함께 내보냅니다.</p>
        </div>
      </section>
      <div className="export-actions">
        <Button variant="primary" onClick={props.onStudent}>학생 화면 보기</Button>
        <a className="ui-button ui-button-secondary" download="reading-coach-pilot-dataset.json" href={downloadHref}>JSON 다운로드</a>
        <a className="ui-button ui-button-secondary" download="reading-coach-labeling-rows.csv" href={csvDownloadHref}>라벨링 CSV 다운로드</a>
        <a className="ui-button ui-button-secondary" download="pilot-dataset.schema.json" href="/artifacts/pilot-dataset.schema.json">JSON 스키마 다운로드</a>
        <a className="ui-button ui-button-secondary" download="labeling-codebook.md" href="/artifacts/labeling-codebook.md">라벨링 코드북 다운로드</a>
        <a className="ui-button ui-button-secondary" download="data-dictionary.md" href="/artifacts/data-dictionary.md">데이터 딕셔너리 다운로드</a>
      </div>
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
      <pre data-testid="export-json">{dataset}</pre>
    </main>
  );
}

const fileSyncLabel = (fileSync: FileSyncStatus): string => {
  if (fileSync.status === "saved") return `${fileSync.path} 저장됨`;
  if (fileSync.status === "failed") return `저장 실패 - ${fileSync.message}`;
  if (fileSync.status === "unavailable") return "파일 저장 미사용";
  return "저장 확인 전";
};
