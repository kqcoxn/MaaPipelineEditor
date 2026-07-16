import { useState, type CSSProperties, type ReactNode } from "react";
import { Button, Typography } from "antd";
import { DownOutlined, RightOutlined } from "@ant-design/icons";

const { Title } = Typography;

const debugSectionStyle: CSSProperties = {
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 6,
  padding: 14,
  background: "#fff",
};

export function DebugSection({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section style={debugSectionStyle}>
      {collapsible ? (
        <Button
          block
          icon={collapsed ? <RightOutlined /> : <DownOutlined />}
          size="small"
          type="text"
          style={{ justifyContent: "flex-start", padding: 0 }}
          onClick={() => setCollapsed((value) => !value)}
        >
          {title}
        </Button>
      ) : (
        <Title level={5} style={{ marginTop: 0 }}>
          {title}
        </Title>
      )}
      {!collapsed && (
        <div style={collapsible ? { marginTop: 8 } : undefined}>{children}</div>
      )}
    </section>
  );
}
