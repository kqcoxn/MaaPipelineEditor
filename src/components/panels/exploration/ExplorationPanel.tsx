/**
 * 探索模式中控面板组件
 * 状态切换：idle -> predicting -> reviewing -> executing -> completed
 */

import { memo, useState, useCallback } from "react";
import { Input, Button, Select, Spin, Typography, Modal } from "antd";
import {
  StopOutlined,
  RobotOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useMFWStore } from "../../../stores/mfwStore";
import { useConfigStore } from "../../../stores/configStore";
import { NodeTypeEnum } from "../../flow/nodes/constants";
import style from "../../../styles/panels/ExplorationPanel.module.less";

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ExplorationPanelProps {
  visible: boolean;
  onClose: () => void;
}

function ExplorationPanelBase({ visible, onClose }: ExplorationPanelProps) {
  // Store 状态
  const status = useFlowStore((s) => s.status);
  const goal = useFlowStore((s) => s.goal);
  const stepCount = useFlowStore((s) => s.stepCount);
  const error = useFlowStore((s) => s.error);
  const progressStage = useFlowStore((s) => s.progressStage);
  const progressDetail = useFlowStore((s) => s.progressDetail);
  const ghostNodeId = useFlowStore((s) => s.ghostNodeId);
  const nodes = useFlowStore((s) => s.nodes);

  // Store 操作
  const start = useFlowStore((s) => s.start);
  const nextStep = useFlowStore((s) => s.nextStep);
  const complete = useFlowStore((s) => s.complete);
  const abort = useFlowStore((s) => s.abort);

  // 本地状态
  const [inputGoal, setInputGoal] = useState("");
  const [startNodeId, setStartNodeId] = useState<string | undefined>();
  const [abortModalVisible, setAbortModalVisible] = useState(false);

  // Pipeline 节点列表
  const pipelineNodes = nodes.filter(
    (n) => n.type === NodeTypeEnum.Pipeline && n.id !== ghostNodeId,
  );

  // 检查前置条件
  const connectionStatus = useMFWStore((s) => s.connectionStatus);
  const aiApiUrl = useConfigStore((s) => s.configs.aiApiUrl);
  const aiApiKey = useConfigStore((s) => s.configs.aiApiKey);

  const canStart =
    connectionStatus === "connected" &&
    aiApiUrl &&
    aiApiKey &&
    inputGoal.trim().length > 0;

  // 开始探索
  const handleStart = useCallback(() => {
    if (!canStart) return;
    start(inputGoal.trim(), startNodeId);
  }, [canStart, inputGoal, startNodeId, start]);

  // 下一步
  const handleNextStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  // 完成探索
  const handleComplete = useCallback(() => {
    complete();
    setInputGoal("");
    setStartNodeId(undefined);
  }, [complete]);

  // 退出探索
  const handleAbort = useCallback(
    (saveConfirmed: boolean) => {
      abort(saveConfirmed);
      setAbortModalVisible(false);
      setInputGoal("");
      setStartNodeId(undefined);
    },
    [abort],
  );

  // 关闭面板
  const handleClose = useCallback(() => {
    if (status === "idle" || status === "completed") {
      onClose();
    } else {
      setAbortModalVisible(true);
    }
  }, [status, onClose]);

  // 渲染不同状态的内容
  const renderContent = () => {
    switch (status) {
      case "idle":
        return (
          <div className={style.idleContent}>
            <div className={style.inputRow}>
              <TextArea
                placeholder="输入探索目标，例如：完成每日签到任务"
                value={inputGoal}
                onChange={(e) => setInputGoal(e.target.value)}
                maxLength={200}
                rows={2}
                className={style.goalInput}
              />
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={handleStart}
                disabled={!canStart}
                className={style.startBtn}
              >
                开始
              </Button>
            </div>
            <div className={style.startNodeRow}>
              <Text type="secondary" className={style.label}>
                起始节点：
              </Text>
              <Select
                placeholder="（可选）选择起始节点"
                value={startNodeId}
                onChange={setStartNodeId}
                allowClear
                className={style.startNodeSelect}
                options={pipelineNodes.map((n) => ({
                  label: n.data.label,
                  value: n.id,
                }))}
              />
            </div>
            {error && <Text type="danger">{error}</Text>}
          </div>
        );

      case "predicting":
        return (
          <div className={style.predictingContent}>
            <Spin size="small" />
            <div className={style.progressInfo}>
              <Text strong>{progressStage}</Text>
              {progressDetail && <Text type="secondary">{progressDetail}</Text>}
            </div>
            <Button
              type="default"
              icon={<StopOutlined />}
              onClick={() => setAbortModalVisible(true)}
              danger
            >
              取消
            </Button>
          </div>
        );

      case "reviewing":
        return (
          <div className={style.reviewingContent}>
            <div className={style.goalDisplay}>
              <IconFont name="icon-mubiao" size={16} />
              <Text strong>{goal}</Text>
            </div>
            <div className={style.stepInfo}>
              <Text type="secondary">已完成 {stepCount} 步</Text>
            </div>
            <div className={style.hintText}>
              <Text type="secondary">
                请在节点旁边操作：执行、重新生成或确认
              </Text>
            </div>
            {error && (
              <Paragraph type="danger" className={style.errorText}>
                {error}
              </Paragraph>
            )}
            <div className={style.footerButtons}>
              <Button onClick={() => setAbortModalVisible(true)} danger>
                退出
              </Button>
              <Button type="primary" onClick={handleComplete}>
                完成
              </Button>
            </div>
          </div>
        );

      case "executing":
        return (
          <div className={style.executingContent}>
            <Spin size="small" />
            <Text>正在执行动作...</Text>
          </div>
        );

      case "confirmed":
        return (
          <div className={style.confirmedContent}>
            <div className={style.goalDisplay}>
              <IconFont name="icon-mubiao" size={16} />
              <Text strong>{goal}</Text>
            </div>
            <div className={style.stepInfo}>
              <Text type="success">已确认 {stepCount} 步</Text>
            </div>
            <div className={style.actionButtons}>
              <Button
                type="primary"
                icon={<StepForwardOutlined />}
                onClick={handleNextStep}
              >
                下一步
              </Button>
              <Button onClick={handleComplete}>完成探索</Button>
            </div>
            <div className={style.footerButtons}>
              <Button onClick={() => setAbortModalVisible(true)} danger>
                退出
              </Button>
            </div>
          </div>
        );

      case "completed":
        return (
          <div className={style.completedContent}>
            <IconFont name="icon-chenggong" size={32} color="#52c41a" />
            <Text strong>探索完成</Text>
            <Text type="secondary">共 {stepCount} 步</Text>
            <Button type="primary" onClick={handleComplete}>
              关闭
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        className={classNames(style.panel, {
          [style.panelVisible]: visible,
        })}
      >
        <div className={style.header}>
          <div className={style.title}>
            <IconFont name="icon-jiqiren" size={22} />
            <Text strong className={style.text}>
              流程探索模式
            </Text>
          </div>
          <IconFont
            name="icon-dituweizhixinxi_chahao"
            className={style.closeIcon}
            size={18}
            onClick={handleClose}
          />
        </div>
        <div className={style.content}>{renderContent()}</div>
      </div>

      {/* 退出确认弹窗 */}
      <Modal
        title="确认退出"
        open={abortModalVisible}
        onCancel={() => setAbortModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAbortModalVisible(false)}>
            取消
          </Button>,
          <Button key="discard" danger onClick={() => handleAbort(false)}>
            不保存退出
          </Button>,
          <Button key="save" type="primary" onClick={() => handleAbort(true)}>
            保存并退出
          </Button>,
        ]}
      >
        <Paragraph>
          当前探索未完成，是否保留已确认的 {stepCount} 个节点？
        </Paragraph>
      </Modal>
    </>
  );
}

export const ExplorationPanel = memo(ExplorationPanelBase);
