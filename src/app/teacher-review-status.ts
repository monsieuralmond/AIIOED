import type { TeacherReviewStatus } from "../shared/types";

export type ReviewFilter = "all_reviews" | TeacherReviewStatus;

export const reviewFilters: readonly ReviewFilter[] = ["all_reviews", "not_reviewed", "needs_follow_up", "reviewed"];

export const teacherReviewLabels: Readonly<Record<TeacherReviewStatus, string>> = {
  needs_follow_up: "추가 확인 필요",
  not_reviewed: "검토 전",
  reviewed: "검토 완료"
};

export const reviewFilterLabels: Readonly<Record<ReviewFilter, string>> = {
  all_reviews: "검토 전체",
  ...teacherReviewLabels
};
