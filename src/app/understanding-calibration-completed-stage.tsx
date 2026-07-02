import type { ReactElement } from "react";
import { UnderstandingCalibrationStages } from "../shared/research";
import { Button } from "./ui";
import { StageFrame } from "./understanding-calibration-components";

type Props = {
  readonly sessionTitle: string;
  readonly title: string;
};

export function UnderstandingCalibrationCompletedStage(props: Props): ReactElement {
  return (
    <StageFrame disabled primaryLabel="완료됨" sessionTitle={props.sessionTitle} stage={UnderstandingCalibrationStages.completed} subtitle="활동이 완료되었습니다." title={props.title} onPrimary={() => {}}>
      <div className="understanding-complete"><p>활동이 완료되었습니다.</p><Button disabled variant="secondary">제출됨</Button></div>
    </StageFrame>
  );
}
