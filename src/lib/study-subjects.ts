import type { SubjectTag } from "@/contracts/study-focus";

export const studySubjectLabels: Record<string, string> = {
  chinese: "國文",
  coding: "程式",
  english: "英文",
  mathematics: "數學",
  other: "其他",
  science: "自然",
  social_studies: "社會",
};

export function resolveStudySubjectLabel(subjectId: string, fallback?: string) {
  return studySubjectLabels[subjectId] ?? fallback ?? subjectId;
}

export function localizeSubjectTags(subjects: SubjectTag[]) {
  return subjects.map((subject) => ({
    ...subject,
    label: resolveStudySubjectLabel(subject.id, subject.label),
  }));
}
