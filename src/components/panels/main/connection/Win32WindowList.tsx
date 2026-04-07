import { memo } from "react";
import { List, Typography, Alert } from "antd";
import { DesktopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { Win32Window } from "../../../../stores/mfwStore";

const { Text } = Typography;

interface Win32WindowListProps {
  windows: Win32Window[];
  selectedWindow: Win32Window | null;
  onSelect: (window: Win32Window) => void;
  loading: boolean;
}

export const Win32WindowList = memo(
  ({ windows, selectedWindow, onSelect, loading }: Win32WindowListProps) => (
    <>
      <Alert
        message="权限提示"
        description="大多数 Win32 控制需要以管理员模式启动后端(LocalBridge)或客户端(Extremer)才能正常工作,如果遇到连接失败或控制无响应的情况,请尝试以管理员身份重新启动应用。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <List
        loading={loading}
        dataSource={windows}
        locale={{ emptyText: "暂无窗口,请点击刷新" }}
        split={false}
        renderItem={(window) => {
          const isSelected = selectedWindow?.hwnd === window.hwnd;
          return (
            <div
              onClick={() => onSelect(window)}
              style={{
                cursor: "pointer",
                padding: "12px 16px",
                marginBottom: 8,
                borderRadius: 8,
                border: isSelected ? "2px solid #1890ff" : "1px solid #f0f0f0",
                backgroundColor: isSelected ? "#e6f7ff" : "#fafafa",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.backgroundColor = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.backgroundColor = "#fafafa";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <DesktopOutlined
                  style={{
                    fontSize: 24,
                    color: isSelected ? "#1890ff" : "#999",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    strong
                    ellipsis
                    style={{ display: "block", marginBottom: 4 }}
                  >
                    {window.window_name || window.class_name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    句柄: {window.hwnd}
                  </Text>
                </div>
                {isSelected && (
                  <CheckCircleOutlined
                    style={{ color: "#1890ff", fontSize: 18 }}
                  />
                )}
              </div>
            </div>
          );
        }}
      />
    </>
  ),
);
