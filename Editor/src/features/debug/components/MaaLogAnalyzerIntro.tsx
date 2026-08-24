import { Button, Space, Typography } from "antd";
import { GlobalOutlined, GithubOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function MaaLogAnalyzerIntro() {
  return (
    <Space orientation="vertical" size={8} style={{ width: "100%" }}>
      <Text>
        推荐使用 MaaLogAnalyzer（MLA）分析 MaaFramework
        日志，可查看任务流程、节点事件、耗时统计与原始日志上下文。
      </Text>
      <Space wrap>
        <Button
          type="link"
          icon={<GithubOutlined />}
          href="https://github.com/MaaXYZ/MaaLogAnalyzer"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: 0 }}
        >
          MaaLogAnalyzer 仓库
        </Button>
        <Button
          type="link"
          icon={<GlobalOutlined />}
          href="https://mla.maafw.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: 0 }}
        >
          在线使用 MLA
        </Button>
      </Space>
    </Space>
  );
}
