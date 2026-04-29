import { Modal } from "antd";

export function showActionRunConfirm(onConfirm: () => void) {
  Modal.confirm({
    title: "确认执行动作",
    content: "仅动作模式会跳过识别，直接执行目标节点动作（Action）。",
    okText: "确认执行",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk: onConfirm,
  });
}
