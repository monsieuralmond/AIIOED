export type RosterClassRow = {
  readonly id: string;
  readonly name?: string;
  readonly teacher_id: string;
  readonly updated_at?: string;
};

export type RosterAssignmentRow = {
  readonly assignment?: Record<string, unknown>;
  readonly class_group_id: string | null;
  readonly created_by_teacher_id: string;
  readonly id: string;
  readonly research_condition?: string;
  readonly research_mode?: string;
  readonly title?: string;
  readonly updated_at?: string;
};

export type RosterStudentRow = {
  readonly class_group_id: string;
  readonly display_label?: string | null;
  readonly initial_participant_code?: string | null;
  readonly id: string;
  readonly initial_password?: string | null;
  readonly login_id?: string | null;
  readonly student_anonymous_id?: string;
  readonly student_number?: number | null;
  readonly updated_at?: string;
};

export type RosterTeacherRow = {
  readonly display_name?: string;
  readonly id: string;
  readonly initial_password?: string | null;
  readonly login_id?: string;
  readonly updated_at?: string;
};
