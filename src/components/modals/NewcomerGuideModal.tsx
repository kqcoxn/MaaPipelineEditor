import { useState } from "react";
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
import type { QuizQuestion } from "../../data/newcomerQuiz";

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
  const [randomError, setRandomError] = useState(false);

  if (!modalOpen) return null;

  const handleSubmitFixed = () => {
    if (checkFixedPass(fixedQuiz, fixedAnswers)) {
      setFixedError(false);
      setStep(2);
    } else {
      setFixedError(true);
    }
  };

  const handleSubmitRandom = () => {
    if (checkRandomPass(randomQuiz, randomAnswers)) {
      setRandomError(false);
      setStep(3);
    } else {
      setRandomError(true);
    }
  };

  const handleFinish = () => {
    markPassed();
    closeModal();
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
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: "了解", icon: <BookOutlined /> },
          { title: "基础", icon: <FormOutlined /> },
          { title: "技巧", icon: <ExperimentOutlined /> },
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
          errorMessage="存在错误答案，请全部答对后再提交。"
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
          errorMessage="正确率不足 60%，请重新检查后再提交。"
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
  onSubmit: () => void;
  onBack: () => void;
}) {
  const allAnswered = quiz.every((q, i) => {
    const a = answers[i];
    if (a === undefined) return false;
    if (q.type === "multi") return Array.isArray(a) && a.length > 0;
    return true;
  });

  return (
    <div>
      <Title level={4}>{title}</Title>
      <Paragraph type="secondary">{description}</Paragraph>

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
}: {
  index: number;
  question: QuizQuestion;
  value: number | number[] | undefined;
  onChange: (val: number | number[]) => void;
}) {
  const prefixMap = { choice: "单选题", judge: "判断题", multi: "多选题" };
  const prefix = prefixMap[question.type];

  if (question.type === "multi") {
    return (
      <div>
        <Text strong>
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
    <div>
      <Text strong>
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