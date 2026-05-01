import { useMemo, type CSSProperties } from "react";
import { Button, Checkbox, Input, List, Space, Tag, Typography } from "antd";
import { CheckSquareOutlined } from "@ant-design/icons";
import type { DebugImageOverlay } from "./DebugImageViewer";
import type { DebugImageOverlayGroup } from "./DebugImageViewer";

const { Text } = Typography;

export function DebugImageRoiPanel({
  focusedOverlayId,
  hoveredOverlayId,
  onFocus,
  onHover,
  onSearchChange,
  onVisibleChange,
  overlayGroups,
  overlays,
  searchText,
  visibleOverlayIds,
}: {
  focusedOverlayId?: string;
  hoveredOverlayId?: string;
  onFocus: (overlayId?: string) => void;
  onHover: (overlayId?: string) => void;
  onSearchChange: (text: string) => void;
  onVisibleChange: (ids: Set<string>) => void;
  overlays: DebugImageOverlay[];
  overlayGroups: DebugImageOverlayGroup[];
  searchText: string;
  visibleOverlayIds: Set<string>;
}) {
  const filteredOverlays = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase();
    if (!search) return overlays;
    return overlays.filter((overlay, index) =>
      overlaySearchCorpus(overlay, index).toLocaleLowerCase().includes(search),
    );
  }, [overlays, searchText]);

  const allFilteredVisible =
    filteredOverlays.length > 0 &&
    filteredOverlays.every((overlay) => visibleOverlayIds.has(overlay.id));

  const toggleFiltered = () => {
    const next = new Set(visibleOverlayIds);
    for (const overlay of filteredOverlays) {
      if (allFilteredVisible) next.delete(overlay.id);
      else next.add(overlay.id);
    }
    onVisibleChange(next);
  };

  return (
    <aside style={roiPanelStyle}>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space wrap>
          <Tag>ROI {overlays.length}</Tag>
          <Tag>显示 {visibleOverlayIds.size}</Tag>
        </Space>
        {overlayGroups.length > 0 && (
          <Space wrap size={4}>
            {overlayGroups.map((group) => (
              <Button
                key={group.key}
                size="small"
                onClick={() => {
                  const ids = overlays
                    .filter((overlay) => overlay.groupKey === group.key)
                    .map((overlay) => overlay.id);
                  onVisibleChange(new Set(ids));
                }}
              >
                {group.label}
              </Button>
            ))}
            <Button
              size="small"
              onClick={() =>
                onVisibleChange(new Set(overlays.map((overlay) => overlay.id)))
              }
            >
              全部
            </Button>
          </Space>
        )}
        <Input.Search
          allowClear
          placeholder="筛选 ROI / box / score"
          size="small"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Button
          block
          icon={<CheckSquareOutlined />}
          size="small"
          onClick={toggleFiltered}
        >
          {allFilteredVisible ? "隐藏当前结果" : "显示当前结果"}
        </Button>
        <List
          size="small"
          dataSource={filteredOverlays}
          locale={{ emptyText: "暂无 ROI" }}
          renderItem={(overlay, index) => {
            const active =
              overlay.id === focusedOverlayId || overlay.id === hoveredOverlayId;
            return (
              <List.Item
                style={{
                  background: active ? "rgba(22, 119, 255, 0.08)" : undefined,
                  borderRadius: 6,
                  paddingInline: 6,
                }}
                onMouseEnter={() => onHover(overlay.id)}
                onMouseLeave={() => onHover(undefined)}
              >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space wrap size={4}>
                    <Checkbox
                      checked={visibleOverlayIds.has(overlay.id)}
                      onChange={(event) => {
                        const next = new Set(visibleOverlayIds);
                        if (event.target.checked) next.add(overlay.id);
                        else next.delete(overlay.id);
                        onVisibleChange(next);
                      }}
                    />
                    <button
                      type="button"
                      style={roiFocusButtonStyle}
                      onClick={() => onFocus(overlay.id)}
                    >
                      <Text strong>{overlay.label ?? `ROI ${index + 1}`}</Text>
                    </button>
                    <Tag>{overlay.kind}</Tag>
                    {overlay.status && <Tag>{overlay.status}</Tag>}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatOverlayGeometry(overlay)}
                  </Text>
                </Space>
              </List.Item>
            );
          }}
        />
      </Space>
    </aside>
  );
}

function overlaySearchCorpus(overlay: DebugImageOverlay, index: number): string {
  return [
    overlay.label,
    overlay.kind,
    overlay.status,
    `ROI ${index + 1}`,
    formatOverlayGeometry(overlay),
  ]
    .filter(Boolean)
    .join(" ");
}

function formatOverlayGeometry(overlay: DebugImageOverlay): string {
  if (overlay.box) {
    return `[${overlay.box.x}, ${overlay.box.y}, ${overlay.box.width}, ${overlay.box.height}]`;
  }
  if (overlay.point) return `(${overlay.point.x}, ${overlay.point.y})`;
  if (overlay.points?.length) {
    return overlay.points
      .map((point) => `(${point.x}, ${point.y})`)
      .join(" -> ");
  }
  return "-";
}

const roiPanelStyle: CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  maxHeight: "calc(100vh - 140px)",
  minWidth: 0,
  overflow: "auto",
  paddingRight: 12,
};

const roiFocusButtonStyle: CSSProperties = {
  background: "transparent",
  border: 0,
  cursor: "pointer",
  minWidth: 0,
  padding: 0,
  textAlign: "left",
};
