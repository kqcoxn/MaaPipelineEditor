import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { AutoComplete, Image, Spin, Empty } from "antd";
import {
  useLocalFileStore,
  type ImageFileInfo,
} from "../../../../stores/localFileStore";
import { resourceProtocol } from "../../../../services/server";
import { useWSStore } from "../../../../stores/wsStore";
import { useFileStore } from "../../../../stores/fileStore";
import style from "../../../../styles/FieldPanel.module.less";

interface ImageSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 是否在列表中，列表中不需要额外 margin */
  inList?: boolean;
}

// 缩略图尺寸
const THUMBNAIL_SIZE = 28;

/**
 * 图片选择组件
 * 支持下拉选择 + 手动输入的组合模式
 * 在连接 LocalBridge 时显示图片列表供选择
 */
export const ImageSelect = memo(
  ({ value, onChange, placeholder, inList = false }: ImageSelectProps) => {
    const connected = useWSStore((state) => state.connected);
    const currentFile = useFileStore((state) => state.currentFile);
    const currentFilePath = currentFile?.config?.filePath;
    const imageList = useLocalFileStore((state) => state.imageList);
    const imageListLoading = useLocalFileStore(
      (state) => state.imageListLoading
    );
    const imageListIsFiltered = useLocalFileStore(
      (state) => state.imageListIsFiltered
    );
    const imageCache = useLocalFileStore((state) => state.imageCache);
    const pendingImageRequests = useLocalFileStore(
      (state) => state.pendingImageRequests
    );

    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState(value || "");

    // 同步外部 value 变化
    useEffect(() => {
      setSearchValue(value || "");
    }, [value]);

    // 打开下拉框时请求图片列表
    const handleDropdownOpen = useCallback(
      (visible: boolean) => {
        setOpen(visible);
        if (visible && connected) {
          resourceProtocol.requestImageList(currentFilePath || undefined);
        }
      },
      [connected, currentFilePath]
    );

    // 过滤图片列表
    const filteredOptions = useMemo(() => {
      if (!searchValue) {
        return imageList;
      }
      const lowerSearch = searchValue.toLowerCase();
      return imageList.filter((img) =>
        img.relativePath.toLowerCase().includes(lowerSearch)
      );
    }, [imageList, searchValue]);

    // 请求过滤后选项的缩略图
    useEffect(() => {
      if (!connected || !open) return;

      // 只请求前50个可见项的缩略图，避免一次性加载过多
      const MAX_PRELOAD = 50;
      const pathsToLoad = filteredOptions
        .slice(0, MAX_PRELOAD)
        .map((img) => img.relativePath);

      // 确保当前值的图片也被加载
      if (value && !pathsToLoad.includes(value)) {
        pathsToLoad.push(value);
      }

      pathsToLoad.forEach((path) => {
        if (!imageCache.has(path) && !pendingImageRequests.has(path)) {
          resourceProtocol.requestImage(path);
        }
      });
    }, [
      connected,
      open,
      filteredOptions,
      value,
      imageCache,
      pendingImageRequests,
    ]);

    // 生成下拉选项
    const options = useMemo(() => {
      if (!connected) {
        return [];
      }

      if (imageListLoading) {
        return [
          {
            value: "__loading__",
            label: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 0",
                }}
              >
                <Spin size="small" />
                <span style={{ marginLeft: 8, color: "#999" }}>
                  加载图片列表...
                </span>
              </div>
            ),
            disabled: true,
          },
        ];
      }

      if (filteredOptions.length === 0) {
        return [
          {
            value: "__empty__",
            label: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchValue ? "无匹配图片" : "无可用图片"}
                style={{ margin: "12px 0" }}
              />
            ),
            disabled: true,
          },
        ];
      }

      return filteredOptions.map((img) => {
        const cache = imageCache.get(img.relativePath);
        const isPending = pendingImageRequests.has(img.relativePath);

        return {
          value: img.relativePath,
          label: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              {/* 内联渲染缩略图，避免额外的函数调用 */}
              {isPending ? (
                <div
                  style={{
                    width: THUMBNAIL_SIZE,
                    height: THUMBNAIL_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f5f5f5",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  <Spin size="small" />
                </div>
              ) : !cache ? (
                <div
                  style={{
                    width: THUMBNAIL_SIZE,
                    height: THUMBNAIL_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f5f5f5",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "#999",
                    flexShrink: 0,
                  }}
                >
                  ?
                </div>
              ) : (
                <Image
                  src={`data:${cache.mimeType};base64,${cache.base64}`}
                  alt={img.relativePath}
                  width={THUMBNAIL_SIZE}
                  height={THUMBNAIL_SIZE}
                  style={{
                    objectFit: "cover",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                  preview={false}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={img.relativePath}
                >
                  {img.relativePath}
                </div>
                {!imageListIsFiltered && img.bundleName && (
                  <div style={{ fontSize: 10, color: "#999" }}>
                    {img.bundleName}
                  </div>
                )}
              </div>
            </div>
          ),
        };
      });
    }, [
      connected,
      imageListLoading,
      filteredOptions,
      imageListIsFiltered,
      imageCache,
      pendingImageRequests,
      searchValue,
    ]);

    // 处理选择
    const handleSelect = useCallback(
      (selectedValue: string) => {
        if (selectedValue === "__loading__" || selectedValue === "__empty__") {
          return;
        }
        setSearchValue(selectedValue);
        onChange(selectedValue);
      },
      [onChange]
    );

    // 处理搜索输入变化
    const handleSearch = useCallback((inputValue: string) => {
      setSearchValue(inputValue);
    }, []);

    // 处理失焦时保存值
    const handleBlur = useCallback(() => {
      if (searchValue !== value) {
        onChange(searchValue);
      }
    }, [searchValue, value, onChange]);

    return (
      <AutoComplete
        className={`${style.imageSelect} ${inList ? "" : style.value}`}
        style={inList ? { flex: 1 } : undefined}
        value={searchValue}
        options={options}
        onSelect={handleSelect}
        onSearch={handleSearch}
        onBlur={handleBlur}
        onDropdownVisibleChange={handleDropdownOpen}
        open={open}
        placeholder={placeholder || "输入或选择图片路径"}
        allowClear
        backfill
        dropdownMatchSelectWidth={300}
        listHeight={280}
        notFoundContent={null}
      />
    );
  }
);

ImageSelect.displayName = "ImageSelect";
