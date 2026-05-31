/** 新手引导题目类型定义 */
export interface QuizQuestion {
  type: "choice" | "judge" | "multi";
  question: string;
  options: string[];
  answer: number | number[];
}

/** 判断单题是否正确 */
export function isAnswerCorrect(
  question: QuizQuestion,
  userAnswer: number | number[] | undefined,
): boolean {
  if (userAnswer === undefined) return false;
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
