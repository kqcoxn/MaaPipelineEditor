/** 新手引导题目类型定义 */
interface BaseQuizQuestion {
  question: string;
  category?: string;
}

interface SingleChoiceQuestion extends BaseQuizQuestion {
  type: "choice" | "judge";
  options: string[];
  answer: number;
}

interface MultiChoiceQuestion extends BaseQuizQuestion {
  type: "multi";
  options: string[];
  answer: number[];
}

interface InputQuestion extends BaseQuizQuestion {
  type: "input";
  include: string;
}

export type QuizQuestion =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | InputQuestion;

export type QuizAnswer = number | number[] | string;

function normalizeInputAnswer(value: string): string {
  return value.trim().toLowerCase();
}

/** 判断单题是否正确 */
export function isAnswerCorrect(
  question: QuizQuestion,
  userAnswer: QuizAnswer | undefined,
): boolean {
  if (userAnswer === undefined) return false;
  if (question.type === "input") {
    return (
      typeof userAnswer === "string" &&
      normalizeInputAnswer(userAnswer).includes(
        normalizeInputAnswer(question.include),
      )
    );
  }
  if (question.type === "multi") {
    if (!Array.isArray(userAnswer) || !Array.isArray(question.answer))
      return false;
    const sorted = [...userAnswer].sort();
    const expected = [...question.answer].sort();
    return (
      sorted.length === expected.length &&
      sorted.every((v, i) => v === expected[i])
    );
  }
  return userAnswer === question.answer;
}

/** 从题库中随机抽取 n 题 */
export function pickRandom(pool: QuizQuestion[], n: number): QuizQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, pool.length));
}
