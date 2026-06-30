import { Button, Space, Typography } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function DebugFlowScopeIntro() {
  return (
    <Space orientation="vertical" size={8} style={{ width: "100%" }}>
      <Text>
        本调试模块定位为临时调试，适合在编辑流程时快速验证节点行为。
      </Text>
      <Text>
        使用 MPE FlowScope
        调试时，识别、执行的耗时会因特殊设计有明显延长，此问题不影响节点效果。
      </Text>
      <Text>
        由于 MPE 前后端分离设计，MPE
        无法媲美本地工具的自动化程度（项目引入、错误检测等）与调试体验。如需进行正式、完整、更加流畅、系统化的调试，推荐使用以下工具：
      </Text>
      <Space wrap>
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
      </Space>
    </Space>
  );
}
