export interface AgentFailureGuidance {
  title: string;
  checks: string[];
}

export function buildAgentFailureGuidance(
  message: string,
  failureStage?: string,
): AgentFailureGuidance {
  const normalized = `${failureStage ?? ""} ${message}`.toLowerCase();
  if (/agent_context_conflict|identifier.+占用|conflict/.test(normalized)) {
    return {
      title: "Agent 标识符发生冲突",
      checks: [
        "停止仍占用该 identifier 的调试会话或 Agent 进程后重试。",
        "开发期间可移除 interface.json 中的固定 identifier，让 MPE 为并行上下文动态生成。",
      ],
    };
  }
  if (
    failureStage === "start" ||
    /createprocess|executable file not found|no such file|cannot find|系统找不到|启动 pi agent 失败/.test(
      normalized,
    )
  ) {
    return {
      title: "Agent 进程未能启动",
      checks: [
        "确认“启动程序覆盖”是在当前开发环境中可直接执行的程序；未打包项目可改用解释器或开发启动器。",
        "确认启动参数包含正确的入口脚本，并能在卡片所示工作目录中执行。",
        "可在终端中以相同工作目录运行这条命令，先排除路径、权限和运行时依赖问题。",
      ],
    };
  }
  if (
    failureStage === "connect" ||
    /connect|timeout|timed out|连接|超时|未响应/.test(normalized)
  ) {
    return {
      title: "Agent 进程未建立连接",
      checks: [
        "检查 Agent 使用的 MaaFramework Binding 与 LocalBridge 加载的 MaaFramework 版本是否匹配。",
        "查看卡片中的 stdout/stderr，确认进程没有在连接前退出或卡在依赖初始化阶段。",
      ],
    };
  }
  if (failureStage === "resource" || /资源|resource/.test(normalized)) {
    return {
      title: "Agent 资源绑定失败",
      checks: [
        "先确认当前 PI Resource 的所有路径均能通过资源预检。",
        "检查自定义识别和动作依赖的 Pipeline、模型与图片是否位于当前资源组合中。",
      ],
    };
  }
  if (/exit|exited|退出/.test(normalized)) {
    return {
      title: "Agent 进程提前退出",
      checks: [
        "查看卡片中的 stderr 和退出码，定位 Agent 自身的启动异常。",
        "使用相同命令和工作目录在终端运行，确认依赖、配置文件和环境变量可用。",
      ],
    };
  }
  return {
    title: "Agent 启动或连接失败",
    checks: [
      "核对启动程序、参数和工作目录，并查看卡片中的近期 stdout/stderr。",
      "检查 Agent 使用的 MaaFramework Binding 与 LocalBridge 加载的 MaaFramework 版本是否匹配。",
    ],
  };
}
