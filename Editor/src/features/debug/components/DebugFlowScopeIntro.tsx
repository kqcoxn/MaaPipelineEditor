import { Button, Space, Typography } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function DebugFlowScopeIntro() {
  return (
    <Space orientation="vertical" size={8} style={{ width: "100%" }}>
      <Text>本调试模块定位为临时调试，适合在编辑流程时快速验证节点行为。</Text>
      <Text>
        使用 MPE FlowScope
        调试时，识别、执行的耗时可能会因特殊设计有部分延长，此问题不影响节点效果。
      </Text>
      <Text>
        由于 MPE 的主功能为 Pipeline
        编辑，调试并非主要维护功能，因此在体验（如项目引入、错误检测、自动化等）上无法媲美专职工具。如需进行更加正式、拟真、流畅、系统化的调试，推荐使用以下工具：
      </Text>
      <Space wrap>
        <Button
          type="link"
          icon={<InfoCircleOutlined />}
          href="https://github.com/neko-para/maa-support-extension"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: 0 }}
        >
          maa-support-extension
        </Button>
        <Button
          type="link"
          icon={<InfoCircleOutlined />}
          href="https://github.com/MaaXYZ/MaaDebugger"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: 0 }}
        >
          MaaDebugger
        </Button>
      </Space>
    </Space>
  );
}
