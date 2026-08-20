import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import style from "../../../styles/panels/AIHistoryPanel.module.less";

interface AIHarnessErrorBoundaryProps {
  children: ReactNode;
}

interface AIHarnessErrorBoundaryState {
  error?: Error;
}

export class AIHarnessErrorBoundary extends Component<
  AIHarnessErrorBoundaryProps,
  AIHarnessErrorBoundaryState
> {
  state: AIHarnessErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AIHarnessErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MPE Harness 对话渲染失败:", error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={style.renderError}>
        <Alert
          type="error"
          showIcon
          title="对话内容渲染失败"
          description="画布未受影响。可以重新加载对话区域，或关闭面板后继续编辑。"
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => this.setState({ error: undefined })}
            >
              重新加载
            </Button>
          }
        />
      </div>
    );
  }
}
