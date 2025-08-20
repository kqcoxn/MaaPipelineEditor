import { CSS } from "@dnd-kit/utilities";
import style from "../../styles/FilePanel.module.less";

import React, { useState, memo, useMemo } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { Tabs, Input, type TabsProps } from "antd";

import { useFileStore } from "../../stores/fileStore";

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = memo(
  ({ className, ...props }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: props["data-node-key"],
      });

    const style: React.CSSProperties = {
      ...props.style,
      transform: CSS.Translate.toString(transform),
      transition,
      cursor: "move",
    };

    return React.cloneElement(props.children as React.ReactElement<any>, {
      ref: setNodeRef,
      style,
      ...attributes,
      ...listeners,
    });
  }
);

function FilePanel() {
  // 当前文件名
  const fileName = useFileStore((state) => state.currentFile.fileName);
  const setFileName = useFileStore((state) => state.setFileName);
  const switchFile = useFileStore((state) => state.switchFile);

  // 文件名状态
  const [fileNameState, setFileNameState] = useState<
    "" | "warning" | "error" | undefined
  >("");

  // 文件列表
  const files = useFileStore((state) => state.files);
  const tabs = useMemo(() => {
    return files.map((file) => ({
      key: file.fileName,
      label: file.fileName,
    }));
  }, [files, fileName]);

  // 拖动监测
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });
  const onDragEnd = useFileStore((state) => state.onDragEnd);

  // 渲染
  return (
    <div className={style.panel}>
      <Input
        className={style.filename}
        placeholder="文件名"
        value={fileName}
        status={fileNameState}
        onChange={(e) => {
          const isValid = setFileName(e.target.value);
          setFileNameState(isValid ? "" : "error");
        }}
      />
      <Tabs
        className={style.tabs}
        items={tabs}
        onChange={(key) => switchFile(key)}
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <DndContext
            sensors={[sensor]}
            onDragEnd={onDragEnd}
            collisionDetection={closestCenter}
          >
            <SortableContext
              items={tabs.map((i) => i.key)}
              strategy={horizontalListSortingStrategy}
            >
              <DefaultTabBar {...tabBarProps}>
                {(node) => (
                  <DraggableTabNode
                    {...(node as React.ReactElement<DraggableTabPaneProps>)
                      .props}
                    key={node.key}
                  >
                    {node}
                  </DraggableTabNode>
                )}
              </DefaultTabBar>
            </SortableContext>
          </DndContext>
        )}
      />
    </div>
  );
}

export default memo(FilePanel);
