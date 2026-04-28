import type { CSSProperties, ReactNode } from "react";
import { Typography } from "antd";

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
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={debugSectionStyle}>
      <Title level={5} style={{ marginTop: 0 }}>
        {title}
      </Title>
      {children}
    </section>
  );
}
