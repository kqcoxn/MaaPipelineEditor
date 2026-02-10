import style from "../styles/FloatingJsonPanel.module.less";

import React, {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Input, Tooltip } from "antd";
import {
  CloseOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";

import { useToolbarStore } from "../stores/toolbarStore";
import {
  flowToPipeline,
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
} from "../core/parser";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 高亮文本视图
const HighlightTextView = memo(
  ({
    obj,
    keyword,
    currentIndex,
  }: {
    obj: any;
    keyword: string;
    currentIndex: number;
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const highlighted = useMemo(() => {
      const jsonText = JSON.stringify(obj, null, 2);
      if (!keyword) return { elements: jsonText, matchCount: 0 };

      const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
      const parts = jsonText.split(regex);

      let matchIdx = 0;
      const elements = parts.map((part, i) => {
        if (regex.test(part)) {
          const idx = matchIdx++;
          return (
            <mark
              key={i}
              data-match-index={idx}
              className={idx === currentIndex ? style.currentMatch : undefined}
            >
              {part}
            </mark>
          );
        }
        return part;
      });

      return { elements, matchCount: matchIdx };
    }, [obj, keyword, currentIndex]);

    // 滚动到当前匹配项
    useEffect(() => {
      if (currentIndex < 0 || !containerRef.current) return;
      const el = containerRef.current.querySelector(
        `[data-match-index="${currentIndex}"]`
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [currentIndex]);

    return (
      <div ref={containerRef} className={style.highlightTextView}>
        {highlighted.elements}
      </div>
    );
  }
);

// viewer
const ViewerElem = memo(({ obj }: { obj: any }) => {
  // 过滤器
  const shouldCollapse = useCallback((field: ReactJsonViewProps) => {
    return (
      field.name === configMark ||
      (field.name as string).startsWith(configMarkPrefix) ||
      (field.name as string).startsWith(externalMarkPrefix)
    );
  }, []);

  return (
    <ReactJsonView
      src={obj}
      enableClipboard={false}
      iconStyle="square"
      shouldCollapse={shouldCollapse}
    />
  );
});

function JsonViewer() {
  const jsonPanelVisible = useToolbarStore((state) => state.jsonPanelVisible);
  const currentRightPanel = useToolbarStore((state) => state.currentRightPanel);
  const setJsonPanelVisible = useToolbarStore(
    (state) => state.setJsonPanelVisible
  );

  // 存储编译后的 Pipeline 对象
  const [pipelineObj, setPipelineObj] = React.useState<any>({});
  const prevVisibleRef = useRef(jsonPanelVisible);

  // 搜索状态
  const [searchText, setSearchText] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 计算匹配总数
  const matchCount = useMemo(() => {
    if (!searchKeyword) return 0;
    const jsonText = JSON.stringify(pipelineObj, null, 2);
    const regex = new RegExp(escapeRegex(searchKeyword), "gi");
    return (jsonText.match(regex) || []).length;
  }, [pipelineObj, searchKeyword]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchText(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchKeyword(value.trim());
        setCurrentMatchIndex(0);
      }, 300);
    },
    []
  );

  const handlePrev = useCallback(() => {
    setCurrentMatchIndex((prev) => (prev <= 0 ? matchCount - 1 : prev - 1));
  }, [matchCount]);

  const handleNext = useCallback(() => {
    setCurrentMatchIndex((prev) => (prev >= matchCount - 1 ? 0 : prev + 1));
  }, [matchCount]);

  // 面板关闭时清除搜索状态
  useEffect(() => {
    if (!jsonPanelVisible) {
      setSearchText("");
      setSearchKeyword("");
      setCurrentMatchIndex(0);
      clearTimeout(debounceRef.current);
    }
  }, [jsonPanelVisible]);

  // 面板打开时编译
  useEffect(() => {
    if (jsonPanelVisible && !prevVisibleRef.current) {
      setPipelineObj(flowToPipeline());
    }
    prevVisibleRef.current = jsonPanelVisible;
  }, [jsonPanelVisible]);

  // 手动刷新
  const handleRefresh = () => {
    setPipelineObj(flowToPipeline());
  };

  // 当其他面板打开时自动关闭 JSON 面板
  useEffect(() => {
    if (currentRightPanel !== "json" && currentRightPanel !== null) {
      setJsonPanelVisible(false);
    }
  }, [currentRightPanel, setJsonPanelVisible]);

  // 关闭面板
  const handleClose = () => {
    setJsonPanelVisible(false);
  };

  // 面板类名
  const panelClassName = `${style.floatingJsonPanel} ${
    jsonPanelVisible ? style.visible : style.hidden
  }`;

  // 渲染
  return (
    <div className={panelClassName}>
      <div className={style.header}>
        <div className={style.headerRow}>
          <div className={style.title}>Pipeline JSON</div>
          <div className={style.actions}>
            <Tooltip title="刷新">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              />
            </Tooltip>
            <Tooltip title="关闭">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClose}
              />
            </Tooltip>
          </div>
        </div>
        <div className={style.searchWrapper}>
          <Input
            size="small"
            allowClear
            placeholder="搜索键名或值..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={handleSearchChange}
            suffix={
              searchKeyword ? (
                <span className={style.matchInfo}>
                  {matchCount > 0
                    ? `${currentMatchIndex + 1}/${matchCount}`
                    : "0/0"}
                </span>
              ) : null
            }
          />
          {searchKeyword && matchCount > 0 && (
            <div className={style.searchNav}>
              <Tooltip title="上一个">
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  onClick={handlePrev}
                />
              </Tooltip>
              <Tooltip title="下一个">
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  onClick={handleNext}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      <div className={style.viewerContainer}>
        {searchKeyword ? (
          <HighlightTextView
            obj={pipelineObj}
            keyword={searchKeyword}
            currentIndex={currentMatchIndex}
          />
        ) : (
          <ViewerElem obj={pipelineObj as any} />
        )}
      </div>
    </div>
  );
}

export default memo(JsonViewer);
