import { Modal } from "antd";
import uiT from "../../i18n/translate";

export function showActionRunConfirm(onConfirm: () => void) {
  Modal.confirm({
    title: uiT("ui.debug.confirmActionRun.title", "确认执行动作"),
    content: uiT(
      "ui.debug.confirmActionRun.content",
      "仅动作模式会跳过识别，直接执行目标节点动作（Action）。",
    ),
    okText: uiT("ui.debug.confirmActionRun.ok", "确认执行"),
    okButtonProps: { danger: true },
    cancelText: uiT("ui.debug.confirmActionRun.cancel", "取消"),
    onOk: onConfirm,
  });
}
