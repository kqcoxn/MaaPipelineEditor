import { useState, useEffect, useSyncExternalStore } from "react";
import {
  Modal,
  Button,
  Steps,
  Radio,
  Checkbox,
  Space,
  Typography,
  Alert,
  Result,
  Divider,
} from "antd";
import {
  BookOutlined,
  FormOutlined,
  ExperimentOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  useNewcomerStore,
  checkFixedPass,
  checkRandomPass,
} from "../../stores/newcomerStore";
import { isAnswerCorrect, type QuizQuestion } from "../../data/newcomerQuiz";
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

export function NewcomerGuideModal() {
  const {
    modalOpen,
    step,
    fixedQuiz,
    randomQuiz,
    fixedAnswers,
    randomAnswers,
    setStep,
    setFixedAnswer,
    setRandomAnswer,
    markPassed,
    closeModal,
  } = useNewcomerStore();

  const [fixedError, setFixedError] = useState(false);
  const [fixedWrongIndices, setFixedWrongIndices] = useState<Set<number>>(new Set());
  const [fixedScore, setFixedScore] = useState<{ correct: number; total: number } | null>(null);
  const [randomError, setRandomError] = useState(false);
  const [randomWrongIndices, setRandomWrongIndices] = useState<Set<number>>(new Set());
  const [randomScore, setRandomScore] = useState<{ correct: number; total: number } | null>(null);

  if (!modalOpen) return null;

  const handleSubmitFixed = () => {
    if (checkFixedPass(fixedQuiz, fixedAnswers)) {
      setFixedError(false);
      setFixedWrongIndices(new Set());
      setFixedScore(null);
      setStep(3);
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
      setStep(3);
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
      maskClosable={false}
      keyboard={false}
      footer={null}
      width={640}
      centered
      destroyOnHidden
    >
      <Steps
        current={step >= 3 ? 2 : step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: "了解", icon: <BookOutlined /> },
          { title: "基础", icon: <FormOutlined /> },
          { title: "通关", icon: <TrophyOutlined /> },
        ]}
      />

      {step === 0 && <IntroPage onNext={() => setStep(1)} />}
      {step === 1 && (
        <QuizPage
          title="基础知识测试"
          description="以下为 MaaFW 基本常识，必须全部答对才能进入下一步。"
          quiz={fixedQuiz}
          answers={fixedAnswers}
          setAnswer={setFixedAnswer}
          error={fixedError}
          errorMessage={
            fixedScore
              ? `得分 ${fixedScore.correct}/${fixedScore.total}，请修正标红题目后重新提交。`
              : "存在错误答案，请全部答对后再提交。"
          }
          wrongIndices={fixedWrongIndices}
          onSubmit={handleSubmitFixed}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <QuizPage
          title="常用技巧测试"
          description="以下为常用小知识，答对 60% 即可通过。"
          quiz={randomQuiz}
          answers={randomAnswers}
          setAnswer={setRandomAnswer}
          error={randomError}
          errorMessage={
            randomScore
              ? `得分 ${randomScore.correct}/${randomScore.total}，正确率不足 60%，请修正标红题目后重新提交。`
              : "正确率不足 60%，请重新检查后再提交。"
          }
          wrongIndices={randomWrongIndices}
          onSubmit={handleSubmitRandom}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && <CertificatePage onFinish={handleFinish} />}
    </Modal>
  );
}

function IntroPage({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <Title level={4}>欢迎使用 MaaPipelineEditor</Title>
      <Paragraph>
        <Text strong>MaaPipelineEditor (MPE)</Text> 是{" "}
        <Text strong>MaaFramework (MaaFW)</Text> 的可视化 Pipeline
        编辑器，帮助你以图形化方式编辑任务流程。
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        message="重要提示"
        description="MPE 是 MaaFW 的辅助工具，不能替代对 MaaFW 本身的学习。请确保你已经了解 MaaFW 的基本概念（如 Node、Task、Pipeline 等）后再使用本编辑器。"
        style={{ marginBottom: 16 }}
      />

      <Paragraph>如果你还不熟悉 MaaFramework，请先阅读官方文档：</Paragraph>

      <Space direction="vertical" style={{ marginBottom: 24 }}>
        <Link href="https://maafw.com/docs/1.1-QuickStarted" target="_blank">
          MaaFramework 官方文档
        </Link>
      </Space>

      <Divider />

      <div style={{ textAlign: "right" }}>
        <Button type="primary" onClick={onNext}>
          我已了解，开始答题
        </Button>
      </div>
    </div>
  );
}

function QuizPage({
  title,
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
  description: string;
  quiz: QuizQuestion[];
  answers: Record<number, number | number[]>;
  setAnswer: (qi: number, val: number | number[]) => void;
  error: boolean;
  errorMessage: string;
  wrongIndices?: Set<number>;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const cheatEnabled = useDevFlag("quizCheat");
  const allAnswered = quiz.every((q, i) => {
    const a = answers[i];
    if (a === undefined) return false;
    if (q.type === "multi") return Array.isArray(a) && a.length > 0;
    return true;
  });

  const handleFillAll = () => {
    quiz.forEach((q, i) => {
      setAnswer(i, q.answer);
    });
  };

  return (
    <div>
      <Title level={4}>{title}</Title>
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
          message={errorMessage}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {quiz.map((q, qi) => (
            <QuizItem
              key={qi}
              index={qi}
              question={q}
              value={answers[qi]}
              onChange={(val) => setAnswer(qi, val)}
              isWrong={wrongIndices?.has(qi)}
            />
          ))}
        </Space>
      </div>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack}>上一步</Button>
        <Button type="primary" disabled={!allAnswered} onClick={onSubmit}>
          提交答案
        </Button>
      </div>
    </div>
  );
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
  value: number | number[] | undefined;
  onChange: (val: number | number[]) => void;
  isWrong?: boolean;
}) {
  const prefixMap = { choice: "单选题", judge: "判断题", multi: "多选题" };
  const prefix = prefixMap[question.type];

  const wrapStyle: React.CSSProperties | undefined = isWrong
    ? { border: "1px solid #ff4d4f", borderRadius: 6, padding: "8px 12px", background: "#fff2f0" }
    : undefined;

  if (question.type === "multi") {
    return (
      <div style={wrapStyle}>
        <Text strong type={isWrong ? "danger" : undefined}>
          {index + 1}. [{prefix}] {question.question}
        </Text>
        <Checkbox.Group
          value={Array.isArray(value) ? value : []}
          onChange={(checked) => onChange(checked as number[])}
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
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

  return (
    <div style={wrapStyle}>
      <Text strong type={isWrong ? "danger" : undefined}>
        {index + 1}. [{prefix}] {question.question}
      </Text>
      <Radio.Group
        value={typeof value === "number" ? value : undefined}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
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

function CertificatePage({ onFinish }: { onFinish: () => void }) {
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
    <Result
      status="success"
      icon={<TrophyOutlined style={{ color: "#faad14" }} />}
      title="恭喜通过测试！"
      subTitle="你已具备使用 MaaPipelineEditor 的基础知识，欢迎开始使用。"
      extra={
        <Space direction="vertical" align="center">
          <Link href="https://mpe.maa.plus/" target="_blank">
            查看 MaaPipelineEditor 使用文档
          </Link>
          <Button type="primary" size="large" onClick={onFinish}>
            开始使用 MPE
          </Button>
        </Space>
      }
    />
  );
}