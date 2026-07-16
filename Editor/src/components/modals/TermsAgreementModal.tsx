import { useState, useEffect } from "react";
import { Modal, Button, Checkbox, Typography, Divider, Space, Tag, theme } from "antd";
import { useTermsStore, isAllChecked } from "../../stores/termsStore";
import { TERMS_VERSION, termsItems } from "../../data/termsData";

const { Title, Paragraph, Text } = Typography;

const COUNTDOWN_SECONDS = 10;

export function TermsAgreementModal() {
  const { modalOpen, checkedItems, toggleItem, acceptTerms } = useTermsStore();
  const { token } = theme.useToken();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!modalOpen) {
      setCountdown(COUNTDOWN_SECONDS);
      return;
    }
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [modalOpen, countdown]);

  if (!modalOpen) return null;

  const allChecked = isAllChecked(checkedItems);
  const canSubmit = allChecked && countdown <= 0;

  return (
    <Modal
      open={modalOpen}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      width={600}
      centered
      destroyOnHidden
    >
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          使用协议
        </Title>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          在使用 MaaPipelineEditor 之前，请阅读并同意以下条款。
        </Paragraph>
      </div>

      <Divider style={{ margin: "16px 0" }} />

      <Space orientation="vertical" size={0} style={{ width: "100%" }}>
        {termsItems.map((item, index) => (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => toggleItem(item.id)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background:
                hoveredId === item.id ? token.colorFillSecondary : "transparent",
              transition: "background 0.2s",
            }}
          >
            <Checkbox
              checked={checkedItems.has(item.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleItem(item.id)}
              style={{ flex: "0 0 auto", marginTop: 3 }}
            />
            <Text style={{ lineHeight: 1.6 }}>
              {index + 1}. {item.content}
            </Text>
          </div>
        ))}
      </Space>

      <Divider style={{ margin: "16px 0" }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Tag color="default">协议版本: v{TERMS_VERSION}</Tag>
        <Button
          type="primary"
          disabled={!canSubmit}
          onClick={acceptTerms}
          size="large"
        >
          {countdown > 0 ? `请阅读条款 (${countdown}s)` : "同意并继续"}
        </Button>
      </div>
    </Modal>
  );
}
