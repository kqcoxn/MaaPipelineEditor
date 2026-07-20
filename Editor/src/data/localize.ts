import type { TFunction } from "i18next";
import { termsItems, type TermsItem } from "./termsData";
import { nodeTemplates, type NodeTemplateType } from "./nodeTemplates";
import { fixedQuestions } from "./newcomerQuizFixed";
import { questionPool } from "./newcomerQuizPool";
import type { QuizQuestion } from "./newcomerQuiz";
import {
  pinnedNotice,
  longTermPreview,
  nextPreview,
  updateLogs,
  type PinnedNotice,
  type ForecastSection,
  type UpdateLogItem,
  type UpdateCategory,
} from "./updateLogs";

function localizeQuizQuestions(
  questions: QuizQuestion[],
  keyPrefix: string,
  t: TFunction,
): QuizQuestion[] {
  return questions.map((q, qi) => {
    const base = `${keyPrefix}.q${qi}`;
    const localized: QuizQuestion = {
      ...q,
      question: t(`${base}.question`, q.question),
      category: q.category
        ? t(`${base}.category`, q.category)
        : undefined,
    };

    if (q.type === "input") {
      return localized;
    }

    return {
      ...localized,
      options: q.options.map((opt, oi) =>
        t(`${base}.options.${oi}`, opt),
      ),
    };
  });
}

function localizeUpdateCategory(
  version: string,
  updates: UpdateCategory,
  t: TFunction,
): UpdateCategory {
  const result: UpdateCategory = {};

  (["features", "fixes", "perfs"] as const).forEach((key) => {
    const items = updates[key];
    if (!items?.length) return;
    result[key] = items.map((item, i) =>
      t(`data.updateLogs.${version}.${key}.${i}`, item),
    );
  });

  return result;
}

export function getLocalizedTermsItems(t: TFunction): TermsItem[] {
  return termsItems.map((item) => ({
    ...item,
    content: t(`data.terms.${item.id}`, item.content),
  }));
}

export function getLocalizedNodeTemplates(t: TFunction): NodeTemplateType[] {
  return nodeTemplates.map((item) => ({
    ...item,
    label: t(`data.nodeTemplates.${item.iconName}.label`, item.label),
  }));
}

export function getLocalizedFixedQuestions(t: TFunction): QuizQuestion[] {
  return localizeQuizQuestions(fixedQuestions, "data.newcomer.fixed", t);
}

export function getLocalizedQuestionPool(t: TFunction): QuizQuestion[] {
  return localizeQuizQuestions(questionPool, "data.newcomer.pool", t);
}

export function getLocalizedPinnedNotice(t: TFunction): PinnedNotice {
  return {
    ...pinnedNotice,
    title: pinnedNotice.title
      ? t("data.updateLogs.pinned.title", pinnedNotice.title)
      : undefined,
    content: pinnedNotice.content.map((item, i) =>
      t(`data.updateLogs.pinned.content.${i}`, item),
    ),
  };
}

export function getLocalizedLongTermPreview(t: TFunction): ForecastSection {
  return {
    title: t("data.updateLogs.longTerm.title", longTermPreview.title),
    notice: t("data.updateLogs.longTerm.notice", longTermPreview.notice),
    items: longTermPreview.items.map((item, i) => ({
      theme: item.theme
        ? t(`data.updateLogs.longTerm.items.${i}.theme`, item.theme)
        : undefined,
      title: t(`data.updateLogs.longTerm.items.${i}.title`, item.title),
      description: item.description
        ? t(
            `data.updateLogs.longTerm.items.${i}.description`,
            item.description,
          )
        : undefined,
    })),
  };
}

export function getLocalizedNextPreview(t: TFunction): ForecastSection {
  return {
    title: t("data.updateLogs.next.title", nextPreview.title),
    notice: t("data.updateLogs.next.notice", nextPreview.notice),
    items: nextPreview.items.map((item, i) => ({
      theme: item.theme
        ? t(`data.updateLogs.next.items.${i}.theme`, item.theme)
        : undefined,
      title: t(`data.updateLogs.next.items.${i}.title`, item.title),
      description: item.description
        ? t(`data.updateLogs.next.items.${i}.description`, item.description)
        : undefined,
    })),
  };
}

export function getLocalizedUpdateLogs(t: TFunction): UpdateLogItem[] {
  return updateLogs.map((log) => ({
    ...log,
    updates: localizeUpdateCategory(log.version, log.updates, t),
  }));
}
