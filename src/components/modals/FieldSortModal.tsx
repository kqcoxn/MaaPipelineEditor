import { CSS } from "@dnd-kit/utilities";
import style from "../../styles/panels/FieldSortModal.module.less";

import React, { useState, memo, useCallback } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Modal, Collapse, Button, message } from "antd";
import { HolderOutlined, ReloadOutlined } from "@ant-design/icons";

import { useConfigStore } from "../../stores/configStore";
import type { FieldSortConfig } from "../../core/sorting/types";
import {
  getDefaultSortConfig,
  DEFAULT_MAIN_TASK_FIELD_ORDER,
  DEFAULT_RECO_PARAM_FIELD_ORDER,
  DEFAULT_ACTION_PARAM_FIELD_ORDER,
  DEFAULT_FREEZE_PARAM_FIELD_ORDER,
} from "../../core/sorting";
import { swipeFieldSchemaKeyList } from "../../core/fields";

interface SortableItemProps {
  id: string;
}

const SortableItem: React.FC<SortableItemProps> = memo(({ id }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const itemStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "move",
  };

  return (
    <div ref={setNodeRef} style={itemStyle} className={style.sortableItem}>
      <span {...attributes} {...listeners} className={style.dragHandle}>
        <HolderOutlined />
      </span>
      <span className={style.fieldName}>{id}</span>
    </div>
  );
});

SortableItem.displayName = "SortableItem";

interface SortableListProps {
  items: string[];
  onChange: (items: string[]) => void;
}

const SortableList: React.FC<SortableListProps> = memo(
  ({ items, onChange }) => {
    const sensor = useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    });

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
          const oldIndex = items.indexOf(active.id as string);
          const newIndex = items.indexOf(over.id as string);
          onChange(arrayMove(items, oldIndex, newIndex));
        }
      },
      [items, onChange],
    );

    return (
      <DndContext
        sensors={[sensor]}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className={style.sortableList}>
            {items.map((id) => (
              <SortableItem key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  },
);

SortableList.displayName = "SortableList";

const FieldSortModal: React.FC = () => {
  const showFieldSortModal = useConfigStore(
    (state) => state.status.showFieldSortModal,
  );
  const fieldSortConfig = useConfigStore(
    (state) => state.configs.fieldSortConfig,
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const setStatus = useConfigStore((state) => state.setStatus);

  // 初始化状态
  const getDefaultState = useCallback((): FieldSortConfig => {
    return fieldSortConfig ?? getDefaultSortConfig();
  }, [fieldSortConfig]);

  const [mainTaskFields, setMainTaskFields] = useState<string[]>(
    () => getDefaultState().mainTaskFields,
  );
  const [recognitionParamFields, setRecognitionParamFields] = useState<
    string[]
  >(() => getDefaultState().recognitionParamFields);
  const [actionParamFields, setActionParamFields] = useState<string[]>(
    () => getDefaultState().actionParamFields,
  );
  const [swipeFields, setSwipeFields] = useState<string[]>(
    () => getDefaultState().swipeFields,
  );
  const [freezeParamFields, setFreezeParamFields] = useState<string[]>(
    () => getDefaultState().freezeParamFields,
  );

  // 当前展开的面板
  const [activePanel, setActivePanel] = useState<string | string[]>(["main"]);

  // 重置为默认值
  const handleReset = useCallback(() => {
    Modal.confirm({
      title: "确认重置",
      content: "确定要恢复默认排序吗？",
      onOk: () => {
        const defaultConfig = getDefaultSortConfig();
        setMainTaskFields(defaultConfig.mainTaskFields);
        setRecognitionParamFields(defaultConfig.recognitionParamFields);
        setActionParamFields(defaultConfig.actionParamFields);
        setSwipeFields(defaultConfig.swipeFields);
        setFreezeParamFields(defaultConfig.freezeParamFields);
        message.success("已恢复默认排序");
      },
    });
  }, []);

  // 保存配置
  const handleOk = useCallback(() => {
    const newConfig: FieldSortConfig = {
      mainTaskFields,
      recognitionParamFields,
      actionParamFields,
      swipeFields,
      freezeParamFields,
    };

    // 检查是否与默认值相同
    const defaultConfig = getDefaultSortConfig();
    const isDefault =
      JSON.stringify(newConfig) === JSON.stringify(defaultConfig);

    // 如果与默认值相同，则设为 undefined
    setConfig("fieldSortConfig", isDefault ? undefined : newConfig);
    setStatus("showFieldSortModal", false);
    message.success("排序配置已保存");
  }, [
    mainTaskFields,
    recognitionParamFields,
    actionParamFields,
    swipeFields,
    freezeParamFields,
    setConfig,
    setStatus,
  ]);

  // 取消
  const handleCancel = useCallback(() => {
    setStatus("showFieldSortModal", false);
  }, [setStatus]);

  // 重置单个面板
  const resetPanel = useCallback(
    (panel: "main" | "reco" | "action" | "swipe" | "freeze") => {
      switch (panel) {
        case "main":
          setMainTaskFields([...DEFAULT_MAIN_TASK_FIELD_ORDER]);
          break;
        case "reco":
          setRecognitionParamFields([...DEFAULT_RECO_PARAM_FIELD_ORDER]);
          break;
        case "action":
          setActionParamFields([...DEFAULT_ACTION_PARAM_FIELD_ORDER]);
          break;
        case "swipe":
          setSwipeFields([...swipeFieldSchemaKeyList]);
          break;
        case "freeze":
          setFreezeParamFields([...DEFAULT_FREEZE_PARAM_FIELD_ORDER]);
          break;
      }
    },
    [],
  );

  const collapseItems = [
    {
      key: "main",
      label: (
        <div className={style.panelHeader}>
          <span>主任务字段排序</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              resetPanel("main");
            }}
          />
        </div>
      ),
      children: (
        <SortableList items={mainTaskFields} onChange={setMainTaskFields} />
      ),
    },
    {
      key: "reco",
      label: (
        <div className={style.panelHeader}>
          <span>Recognition 参数排序</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              resetPanel("reco");
            }}
          />
        </div>
      ),
      children: (
        <SortableList
          items={recognitionParamFields}
          onChange={setRecognitionParamFields}
        />
      ),
    },
    {
      key: "action",
      label: (
        <div className={style.panelHeader}>
          <span>Action 参数排序</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              resetPanel("action");
            }}
          />
        </div>
      ),
      children: (
        <SortableList
          items={actionParamFields}
          onChange={setActionParamFields}
        />
      ),
    },
    {
      key: "swipe",
      label: (
        <div className={style.panelHeader}>
          <span>Swipes 参数排序</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              resetPanel("swipe");
            }}
          />
        </div>
      ),
      children: <SortableList items={swipeFields} onChange={setSwipeFields} />,
    },
    {
      key: "freeze",
      label: (
        <div className={style.panelHeader}>
          <span>Freeze 参数排序</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              resetPanel("freeze");
            }}
          />
        </div>
      ),
      children: (
        <SortableList
          items={freezeParamFields}
          onChange={setFreezeParamFields}
        />
      ),
    },
  ];

  return (
    <Modal
      title="字段排序配置"
      open={showFieldSortModal}
      onOk={handleOk}
      onCancel={handleCancel}
      width={500}
      okText="保存"
      cancelText="取消"
      footer={[
        <Button key="reset" onClick={handleReset}>
          重置为默认
        </Button>,
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="ok" type="primary" onClick={handleOk}>
          保存
        </Button>,
      ]}
    >
      <p className={style.hint}>拖拽字段调整顺序，导出时将按此顺序排列字段。</p>
      <Collapse
        items={collapseItems}
        activeKey={activePanel}
        onChange={(key) => setActivePanel(key)}
        accordion
      />
    </Modal>
  );
};

export default memo(FieldSortModal);
