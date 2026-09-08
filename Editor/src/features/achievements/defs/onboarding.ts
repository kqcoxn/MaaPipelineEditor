import type { AchievementDef } from "../types";

export const onboardingAchievements: AchievementDef[] = [
  {
    id: "terms_accepted",
    title: "发现新大陆",
    subtitle: "新的探索，从这里开始。",
    description: "首次使用 MPE 并同意使用协议",
    category: "onboarding",
    trigger: { kind: "counter", counter: "terms_accepted", target: 1 },
  },
  {
    id: "quiz_first",
    title: "胸有成竹",
    subtitle: "“读书破万卷，下笔如有神。”",
    description: "一轮基础测试中，首次提交即全部答对并领取证书",
    category: "onboarding",
    trigger: {
      kind: "counter",
      counter: "quiz_first",
      target: 1,
    },
  },
  {
    id: "quiz_failure",
    title: "小有偏差",
    subtitle: "没关系，答案还可以再想想。",
    description: "基础测试中，首次提交错误答案时立即解锁",
    category: "onboarding",
    trigger: { kind: "counter", counter: "quiz_failure", target: 1 },
  },
  {
    id: "quiz_retry",
    title: "原来如此",
    subtitle: "查缺补漏，补齐短板，抓好整改",
    description: "一轮基础测试中，提交错误 2～3 次后全部答对并领取证书",
    category: "onboarding",
    trigger: {
      kind: "counter",
      counter: "quiz_retry",
      target: 1,
    },
  },
  {
    id: "quiz_persistent",
    title: "再接再厉",
    subtitle: "还没答对，也还没放弃。",
    description: "一轮基础测试中，累积 4 次提交错误",
    category: "onboarding",
    trigger: {
      kind: "counter",
      counter: "quiz_persistent",
      target: 1,
    },
  },
  {
    id: "quiz_shortcut",
    title: "上帝给出的答卷",
    subtitle: "上上下下左右左右BABA！",
    description: "使用 mpedev 开启的一键填写，或执行跳过答题命令",
    category: "onboarding",
    hidden: true,
    trigger: {
      kind: "counter",
      counter: "quiz_shortcut",
      target: 1,
    },
  },
  {
    id: "quiz_pass",
    title: "入场券",
    subtitle: "准备好了？欢迎来到 MPE！",
    description: "以任意方式通过基础测试",
    category: "onboarding",
    trigger: {
      kind: "counter",
      counter: "quiz_pass",
      target: 1,
    },
  },
];
