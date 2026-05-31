import { create } from "zustand";
import { globalConfig } from "./configStore";
import { pickRandom, isAnswerCorrect, type QuizQuestion } from "../data/newcomerQuiz";
import { fixedQuestions } from "../data/newcomerQuizFixed";
import { questionPool } from "../data/newcomerQuizPool";

const STORAGE_KEY = "mpe_newcomer_passed";
const RANDOM_PICK_COUNT = 10;
const RANDOM_PASS_RATE = 0.6;

type AnswerValue = number | number[];

interface NewcomerStore {
  modalOpen: boolean;
  step: number; // 0=介绍, 1=固定题, 2=随机题, 3=证书
  fixedQuiz: QuizQuestion[];
  randomQuiz: QuizQuestion[];
  fixedAnswers: Record<number, AnswerValue>;
  randomAnswers: Record<number, AnswerValue>;
  passed: boolean;
  openModal: () => void;
  closeModal: () => void;
  setStep: (step: number) => void;
  setFixedAnswer: (qi: number, val: AnswerValue) => void;
  setRandomAnswer: (qi: number, val: AnswerValue) => void;
  markPassed: () => void;
}

export const useNewcomerStore = create<NewcomerStore>((set) => ({
  modalOpen: false,
  step: 0,
  fixedQuiz: [],
  randomQuiz: [],
  fixedAnswers: {},
  randomAnswers: {},
  passed: localStorage.getItem(STORAGE_KEY) === "true",

  openModal: () =>
    set({
      modalOpen: true,
      step: 0,
      fixedAnswers: {},
      randomAnswers: {},
      fixedQuiz: fixedQuestions,
      randomQuiz: pickRandom(questionPool, RANDOM_PICK_COUNT),
    }),
  closeModal: () => set({ modalOpen: false }),
  setStep: (step) => set({ step }),
  setFixedAnswer: (qi, val) =>
    set((state) => ({
      fixedAnswers: { ...state.fixedAnswers, [qi]: val },
    })),
  setRandomAnswer: (qi, val) =>
    set((state) => ({
      randomAnswers: { ...state.randomAnswers, [qi]: val },
    })),
  markPassed: () => {
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem("mpe_last_version", globalConfig.version);
    set({ passed: true });
  },
}));

export function isNewcomerPassed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function checkFixedPass(
  quiz: QuizQuestion[],
  answers: Record<number, AnswerValue>,
): boolean {
  return quiz.every((q, i) => isAnswerCorrect(q, answers[i]));
}

export function checkRandomPass(
  quiz: QuizQuestion[],
  answers: Record<number, AnswerValue>,
): boolean {
  const correct = quiz.filter((q, i) => isAnswerCorrect(q, answers[i])).length;
  return correct >= Math.ceil(quiz.length * RANDOM_PASS_RATE);
}
