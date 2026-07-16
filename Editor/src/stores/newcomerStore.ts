import { create } from "zustand";
import { globalConfig } from "./configStore";
import { pickRandom, isAnswerCorrect, type QuizAnswer, type QuizQuestion } from "../data/newcomerQuiz";
import { fixedQuestions } from "../data/newcomerQuizFixed";
import { questionPool } from "../data/newcomerQuizPool";

const STORAGE_KEY = "mpe_newcomer_passed";
const STAGE_KEY = "mpe_newcomer_stage";
const RANDOM_PICK_COUNT = 10;
const RANDOM_PASS_RATE = 0.6;

interface NewcomerStore {
  modalOpen: boolean;
  step: number; // 0=介绍, 1=固定题, 2=随机题, 3=证书
  fixedQuiz: QuizQuestion[];
  randomQuiz: QuizQuestion[];
  fixedAnswers: Record<number, QuizAnswer>;
  randomAnswers: Record<number, QuizAnswer>;
  passed: boolean;
  openModal: () => void;
  closeModal: () => void;
  setStep: (step: number) => void;
  setFixedAnswer: (qi: number, val: QuizAnswer) => void;
  setRandomAnswer: (qi: number, val: QuizAnswer) => void;
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

  openModal: () => {
    const savedStage = parseInt(localStorage.getItem(STAGE_KEY) || "0", 10);
    const startStep = savedStage >= 3 ? 0 : savedStage;
    set({
      modalOpen: true,
      step: startStep,
      fixedAnswers: {},
      randomAnswers: {},
      fixedQuiz: fixedQuestions,
      randomQuiz: pickRandom(questionPool, RANDOM_PICK_COUNT),
    });
  },
  closeModal: () => set({ modalOpen: false }),
  setStep: (step) => {
    const saved = parseInt(localStorage.getItem(STAGE_KEY) || "0", 10);
    if (step > saved) {
      localStorage.setItem(STAGE_KEY, String(step));
    }
    set({ step });
  },
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
    localStorage.removeItem(STAGE_KEY);
    set({ passed: true });
  },
}));

export function isNewcomerPassed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function checkFixedPass(
  quiz: QuizQuestion[],
  answers: Record<number, QuizAnswer>,
): boolean {
  return quiz.every((q, i) => isAnswerCorrect(q, answers[i]));
}

export function checkRandomPass(
  quiz: QuizQuestion[],
  answers: Record<number, QuizAnswer>,
): boolean {
  const correct = quiz.filter((q, i) => isAnswerCorrect(q, answers[i])).length;
  return correct >= Math.ceil(quiz.length * RANDOM_PASS_RATE);
}
