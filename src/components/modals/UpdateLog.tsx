import { Modal, Timeline, Typography, Tag, Divider } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { updateLogs } from "../../data/updateLogs";

const { Title, Paragraph, Text } = Typography;

interface UpdateLogProps {
  open: boolean;
  onClose: () => void;
}

const UpdateLog = ({ open, onClose }: UpdateLogProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "major":
        return "red";
      case "feature":
        return "blue";
      case "fix":
        return "orange";
      default:
        return "default";
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "major":
        return "重大更新";
      case "feature":
        return "新功能";
      case "fix":
        return "修复";
      default:
        return "更新";
    }
  };

  // 分类标题配置
  const categoryConfig = [
    { key: "features", label: "新功能", icon: "✨" },
    { key: "fixes", label: "问题修复", icon: "🐞" },
    { key: "optimizations", label: "体验优化", icon: "🚀" },
    { key: "refactors", label: "代码重构", icon: "🛠️" },
    { key: "docs", label: "文档更新", icon: "📝" },
    { key: "others", label: "其他更新", icon: "📦" },
  ];

  // 渲染分类内容
  const renderCategoryItems = (updates: (typeof updateLogs)[0]["updates"]) => {
    return categoryConfig.map(({ key, label, icon }) => {
      const items = updates[key as keyof typeof updates];
      if (!items || items.length === 0) return null;

      return (
        <div key={key} style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              color: "#1890ff",
            }}
          >
            {icon} {label}
          </div>
          {items.map((item, idx) => (
            <Paragraph
              key={idx}
              style={{
                margin: "6px 0",
                paddingLeft: 20,
                position: "relative",
                fontSize: 14,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 4,
                  color: "#8c8c8c",
                }}
              >
                •
              </span>
              {item}
            </Paragraph>
          ))}
        </div>
      );
    });
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClockCircleOutlined style={{ fontSize: 20 }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>更新日志</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      styles={{
        body: {
          maxHeight: "70vh",
          overflowY: "auto",
          padding: "24px",
        },
      }}
    >
      <Timeline
        items={updateLogs.map((log, index) => ({
          color: getTypeColor(log.type),
          dot:
            index === 0 ? (
              <ClockCircleOutlined style={{ fontSize: 16 }} />
            ) : undefined,
          children: (
            <div key={log.version}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Title level={4} style={{ margin: 0 }}>
                  v{log.version}
                </Title>
                <Tag color={getTypeColor(log.type)}>
                  {getTypeText(log.type)}
                </Tag>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {log.date}
                </Text>
              </div>
              <div style={{ marginBottom: 16 }}>
                {renderCategoryItems(log.updates)}
              </div>
              {index < updateLogs.length - 1 && (
                <Divider style={{ margin: "16px 0" }} />
              )}
            </div>
          ),
        }))}
      />
    </Modal>
  );
};

export default UpdateLog;
