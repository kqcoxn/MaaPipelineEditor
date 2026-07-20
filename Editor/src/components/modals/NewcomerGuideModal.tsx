import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Button,
  Steps,
  ConfigProvider,
  Radio,
  Checkbox,
  Input,
  Space,
  Typography,
  Alert,
  Result,
  Divider,
  Tag,
  theme,
} from "antd";
import { BookOutlined, FormOutlined, TrophyOutlined } from "@ant-design/icons";
import {
  useNewcomerStore,
  checkFixedPass,
  checkRandomPass,
} from "../../stores/newcomerStore";
import {
  isAnswerCorrect,
  type QuizAnswer,
  type QuizQuestion,
} from "../../data/newcomerQuiz";
import {
  getLocalizedFixedQuestions,
  getLocalizedQuestionPool,
} from "../../data/localize";
import { getDevFlag } from "../../utils/devConsole";

function useDevFlag(key: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("mpedev:flag-changed", cb);
      return () => window.removeEventListener("mpedev:flag-changed", cb);
    },
    () => getDevFlag(key),
  );
}

const { Title, Paragraph, Text, Link } = Typography;

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

export function NewcomerGuideModal() {
  const { t } = useTranslation();
  const {
    modalOpen,
    step,
    randomQuizIndices,
    fixedAnswers,
    randomAnswers,
    setStep,
    setFixedAnswer,
    setRandomAnswer,
    markPassed,
    closeModal,
  } = useNewcomerStore();

  const fixedQuiz = useMemo(
    () => getLocalizedFixedQuestions(t),
    [t],
  );
  const randomQuiz = useMemo(
    () => {
      const pool = getLocalizedQuestionPool(t);
      return randomQuizIndices.map((i) => pool[i]);
    },
    [t, randomQuizIndices],
  );

  const [fixedError, setFixedError] = useState(false);
  const [fixedWrongIndices, setFixedWrongIndices] = useState<Set<number>>(
    new Set(),
  );
  const [fixedScore, setFixedScore] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [randomError, setRandomError] = useState(false);
  const [randomWrongIndices, setRandomWrongIndices] = useState<Set<number>>(
    new Set(),
  );
  const [randomScore, setRandomScore] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finishedSeconds, setFinishedSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!modalOpen) {
      setQuizStartedAt(null);
      setElapsedSeconds(0);
      setFinishedSeconds(null);
      return;
    }

    if (step > 0 && step < 3 && quizStartedAt === null) {
      setQuizStartedAt(Date.now());
      setElapsedSeconds(0);
      setFinishedSeconds(null);
    }
  }, [modalOpen, quizStartedAt, step]);

  useEffect(() => {
    if (!modalOpen || quizStartedAt === null || step <= 0 || step >= 3) return;

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - quizStartedAt) / 1000));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [modalOpen, quizStartedAt, step]);

  if (!modalOpen) return null;

  const startQuiz = () => {
    setQuizStartedAt(Date.now());
    setElapsedSeconds(0);
    setFinishedSeconds(null);
    setStep(1);
  };

  const finishQuiz = () => {
    const seconds =
      quizStartedAt === null
        ? elapsedSeconds
        : Math.floor((Date.now() - quizStartedAt) / 1000);
    setElapsedSeconds(seconds);
    setFinishedSeconds(seconds);
    setStep(3);
  };

  const handleSubmitFixed = () => {
    if (checkFixedPass(fixedQuiz, fixedAnswers)) {
      setFixedError(false);
      setFixedWrongIndices(new Set());
      setFixedScore(null);
      finishQuiz();
    } else {
      const wrong = new Set<number>();
      let correctCount = 0;
      fixedQuiz.forEach((q, i) => {
        if (isAnswerCorrect(q, fixedAnswers[i])) {
          correctCount++;
        } else {
          wrong.add(i);
        }
      });
      setFixedWrongIndices(wrong);
      setFixedScore({ correct: correctCount, total: fixedQuiz.length });
      setFixedError(true);
    }
  };

  const handleSubmitRandom = () => {
    if (checkRandomPass(randomQuiz, randomAnswers)) {
      setRandomError(false);
      setRandomWrongIndices(new Set());
      setRandomScore(null);
      finishQuiz();
    } else {
      const wrong = new Set<number>();
      let correctCount = 0;
      randomQuiz.forEach((q, i) => {
        if (isAnswerCorrect(q, randomAnswers[i])) {
          correctCount++;
        } else {
          wrong.add(i);
        }
      });
      setRandomWrongIndices(wrong);
      setRandomScore({ correct: correctCount, total: randomQuiz.length });
      setRandomError(true);
    }
  };

  const handleFinish = () => {
    markPassed();
    closeModal();
    window.dispatchEvent(new CustomEvent("mpe:newcomer-passed"));
  };

  return (
    <Modal
      open={modalOpen}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      width={760}
      centered
      destroyOnHidden
    >
      <Steps
        current={step >= 3 ? 2 : step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          {
            title: t("newcomerGuide.steps.learn", "了解"),
            icon: <BookOutlined />,
          },
          {
            title: t("newcomerGuide.steps.basics", "基础"),
            icon: <FormOutlined />,
          },
          {
            title: t("newcomerGuide.steps.complete", "通关"),
            icon: <TrophyOutlined />,
          },
        ]}
      />

      {step === 0 && <IntroPage onNext={startQuiz} />}
      {step === 1 && (
        <QuizPage
          title={t("newcomerGuide.fixed.title", "基础知识测试")}
          elapsedSeconds={elapsedSeconds}
          description={t(
            "newcomerGuide.fixed.description",
            "以下为 MaaFW 基本常识，必须全部答对才能进入下一步。如果您首次接触 MaaFW 项目，可配合文档或 AI 作答，这将对您后续项目维护有很大帮助；如果您了解过这些内容，将非常快速通过！",
          )}
          quiz={fixedQuiz}
          answers={fixedAnswers}
          setAnswer={setFixedAnswer}
          error={fixedError}
          errorMessage={
            fixedScore
              ? t(
                  "newcomerGuide.fixed.errorWithScore",
                  "得分 {{correct}}/{{total}}，请修正标红题目后重新提交。",
                  {
                    correct: fixedScore.correct,
                    total: fixedScore.total,
                  },
                )
              : t(
                  "newcomerGuide.fixed.errorAllWrong",
                  "存在错误答案，请全部答对后再提交。",
                )
          }
          wrongIndices={fixedWrongIndices}
          onSubmit={handleSubmitFixed}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <QuizPage
          title={t("newcomerGuide.random.title", "常用技巧测试")}
          elapsedSeconds={elapsedSeconds}
          description={t(
            "newcomerGuide.random.description",
            "以下为常用小知识，答对 60% 即可通过。",
          )}
          quiz={randomQuiz}
          answers={randomAnswers}
          setAnswer={setRandomAnswer}
          error={randomError}
          errorMessage={
            randomScore
              ? t(
                  "newcomerGuide.random.errorWithScore",
                  "得分 {{correct}}/{{total}}，正确率不足 60%，请修正标红题目后重新提交。",
                  {
                    correct: randomScore.correct,
                    total: randomScore.total,
                  },
                )
              : t(
                  "newcomerGuide.random.errorInsufficient",
                  "正确率不足 60%，请重新检查后再提交。",
                )
          }
          wrongIndices={randomWrongIndices}
          onSubmit={handleSubmitRandom}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <CertificatePage
          elapsedSeconds={finishedSeconds ?? elapsedSeconds}
          onFinish={handleFinish}
        />
      )}
    </Modal>
  );
}

function IntroPage({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();

  return (
    <div>
      <Title level={4}>
        {t("newcomerGuide.intro.title", "欢迎使用 MaaPipelineEditor")}
      </Title>
      <Paragraph>
        {t(
          "newcomerGuide.intro.description",
          "MaaPipelineEditor (MPE) 是 MaaFramework (MaaFW) 的可视化 Pipeline 编辑器，帮助您以图形化方式编辑任务流程。",
        )}
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        title={t("newcomerGuide.intro.warningTitle", "重要提示")}
        description={t(
          "newcomerGuide.intro.warningDescription",
          "MPE 是 MaaFW 的辅助工具，不能替代对 MaaFW 本身的学习。请确保您已经了解 MaaFW 的基本概念（如 Node、Task、Pipeline 等）后再使用本编辑器。",
        )}
        style={{ marginBottom: 16 }}
      />

      <Paragraph>
        {t(
          "newcomerGuide.intro.docsHint",
          "如果您还不熟悉 MaaFramework，请先阅读官方文档：",
        )}
      </Paragraph>

      <Space orientation="vertical" style={{ marginBottom: 24 }}>
        <Link href="https://maafw.com/docs/1.1-QuickStarted" target="_blank">
          {t("newcomerGuide.intro.docsLink", "MaaFramework 官方文档")}
        </Link>
      </Space>

      <Divider />

      <div style={{ textAlign: "right" }}>
        <Button type="primary" onClick={onNext}>
          {t("newcomerGuide.intro.startButton", "我已了解，开始答题")}
        </Button>
      </div>
    </div>
  );
}

interface QuizGroup {
  title: string;
  items: Array<{
    question: QuizQuestion;
    index: number;
  }>;
}

function groupQuizByCategory(
  quiz: QuizQuestion[],
  defaultCategory: string,
): QuizGroup[] {
  return quiz.reduce<QuizGroup[]>((groups, question, index) => {
    const title = question.category ?? defaultCategory;
    const existingGroup = groups.find((group) => group.title === title);
    const item = { question, index };

    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ title, items: [item] });
    }

    return groups;
  }, []);
}

function QuizPage({
  title,
  elapsedSeconds,
  description,
  quiz,
  answers,
  setAnswer,
  error,
  errorMessage,
  wrongIndices,
  onSubmit,
  onBack,
}: {
  title: string;
  elapsedSeconds: number;
  description: string;
  quiz: QuizQuestion[];
  answers: Record<number, QuizAnswer>;
  setAnswer: (qi: number, val: QuizAnswer) => void;
  error: boolean;
  errorMessage: string;
  wrongIndices?: Set<number>;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const cheatEnabled = useDevFlag("quizCheat");
  const quizGroups = groupQuizByCategory(
    quiz,
    t("newcomerGuide.quiz.defaultCategory", "综合题目"),
  );
  const allAnswered = quiz.every((q, i) => {
    const a = answers[i];
    if (a === undefined) return false;
    if (q.type === "multi") return Array.isArray(a) && a.length > 0;
    if (q.type === "input") return typeof a === "string" && a.trim().length > 0;
    return true;
  });

  const handleFillAll = () => {
    quiz.forEach((q, i) => {
      setAnswer(i, q.type === "input" ? q.include : q.answer);
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <Title level={4} style={{ margin: 0, minWidth: 0 }}>
          {title}
        </Title>
        <Tag
          color="processing"
          style={{
            flex: "0 0 auto",
            marginInlineEnd: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {t("newcomerGuide.quiz.elapsed", "用时 {{time}}", {
            time: formatElapsedTime(elapsedSeconds),
          })}
        </Tag>
      </div>
      <Paragraph type="secondary">{description}</Paragraph>

      {cheatEnabled && (
        <Button
          size="small"
          type="dashed"
          danger
          onClick={handleFillAll}
          style={{ marginBottom: 12 }}
        >
          [DEV] Fill All Answers
        </Button>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          {quizGroups.map((group) => (
            <section
              key={group.title}
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderLeft: `4px solid ${token.colorPrimary}`,
                borderRadius: 8,
                background: token.colorFillAlter,
                padding: "12px 14px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Text strong style={{ color: token.colorTextHeading }}>
                  {group.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("newcomerGuide.quiz.questionCount", "{{count}} 题", {
                    count: group.items.length,
                  })}
                </Text>
              </div>
              <Space
                orientation="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                {group.items.map(({ question, index }) => (
                  <QuizItem
                    key={index}
                    index={index}
                    question={question}
                    value={answers[index]}
                    onChange={(val) => setAnswer(index, val)}
                    isWrong={wrongIndices?.has(index)}
                  />
                ))}
              </Space>
            </section>
          ))}
        </Space>
      </div>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack}>
          {t("newcomerGuide.quiz.back", "上一步")}
        </Button>
        <Button type="primary" disabled={!allAnswered} onClick={onSubmit}>
          {t("newcomerGuide.quiz.submit", "提交答案")}
        </Button>
      </div>
    </div>
  );
}

function renderLinkedText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <Link key={i} href={match[2]} target="_blank">
          {match[1]}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function QuizItem({
  index,
  question,
  value,
  onChange,
  isWrong,
}: {
  index: number;
  question: QuizQuestion;
  value: QuizAnswer | undefined;
  onChange: (val: QuizAnswer) => void;
  isWrong?: boolean;
}) {
  const { t } = useTranslation();
  const typeMeta = {
    choice: {
      label: t("newcomerGuide.quiz.types.choice", "单选"),
      color: "blue",
    },
    judge: {
      label: t("newcomerGuide.quiz.types.judge", "判断"),
      color: "cyan",
    },
    multi: {
      label: t("newcomerGuide.quiz.types.multi", "多选"),
      color: "purple",
    },
    input: {
      label: t("newcomerGuide.quiz.types.input", "填空"),
      color: "gold",
    },
  };
  const meta = typeMeta[question.type];

  const wrapStyle: React.CSSProperties | undefined = isWrong
    ? {
        border: "1px solid #ff4d4f",
        borderRadius: 6,
        padding: "8px 12px",
        background: "#fff2f0",
      }
    : undefined;
  const questionTitle = (
    <div style={{ lineHeight: 1.6 }}>
      <Text
        strong
        type={isWrong ? "danger" : undefined}
        style={{ marginRight: 8 }}
      >
        {index + 1}.
      </Text>
      <Tag color={meta.color} style={{ marginInlineEnd: 8, verticalAlign: "middle" }}>
        {meta.label}
      </Tag>
      <Text
        strong
        type={isWrong ? "danger" : undefined}
      >
        {renderLinkedText(question.question)}
      </Text>
    </div>
  );

  if (question.type === "multi") {
    return (
      <div style={wrapStyle}>
        {questionTitle}
        <Checkbox.Group
          value={Array.isArray(value) ? value : []}
          onChange={(checked) => onChange(checked as number[])}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          {question.options.map((opt, oi) => (
            <Checkbox key={oi} value={oi}>
              {String.fromCharCode(65 + oi)}. {opt}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </div>
    );
  }

  if (question.type === "input") {
    return (
      <div style={wrapStyle}>
        {questionTitle}
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(
            "newcomerGuide.quiz.inputPlaceholder",
            "请输入答案",
          )}
          style={{ marginTop: 8 }}
        />
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      {questionTitle}
      <Radio.Group
        value={typeof value === "number" ? value : undefined}
        onChange={(e) => onChange(e.target.value)}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 8,
        }}
      >
        {question.options.map((opt, oi) => (
          <Radio key={oi} value={oi}>
            {question.type === "choice"
              ? `${String.fromCharCode(65 + oi)}. ${opt}`
              : opt}
          </Radio>
        ))}
      </Radio.Group>
    </div>
  );
}

function CertificatePage({
  elapsedSeconds,
  onFinish,
}: {
  elapsedSeconds: number;
  onFinish: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      const canvas = document.createElement("canvas");
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "9999";
      document.body.appendChild(canvas);

      const myConfetti = confetti.create(canvas, { resize: true });
      const end = Date.now() + 1500;
      const frame = () => {
        myConfetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
        });
        myConfetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        } else {
          setTimeout(() => canvas.remove(), 2000);
        }
      };
      frame();
    });
  }, []);

  return (
    <ConfigProvider
      theme={{
        components: {
          Result: {
            iconFontSize: 96,
          },
        },
      }}
    >
      <Result
        status="success"
        icon={<TrophyOutlined style={{ color: "#faad14" }} />}
        title={t("newcomerGuide.certificate.title", "恭喜通过测试！")}
        subTitle={t(
          "newcomerGuide.certificate.subTitle",
          "您已具备 MaaFW 的基础知识，本次用时 {{time}}，欢迎开始使用 MaaPipelineEditor！",
          { time: formatElapsedTime(elapsedSeconds) },
        )}
        extra={
          <Space orientation="vertical" align="center">
            <Link
              href="https://mpe.codax.site/docs/guide/start/quick-start.html"
              target="_blank"
            >
              {t(
                "newcomerGuide.certificate.docsLink",
                "查看 MaaPipelineEditor 使用文档",
              )}
            </Link>
            <Button type="primary" size="large" onClick={onFinish}>
              {t("newcomerGuide.certificate.startButton", "开始使用 MPE")}
            </Button>
          </Space>
        }
      />
    </ConfigProvider>
  );
}
