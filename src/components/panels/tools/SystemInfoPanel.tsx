import { memo, useEffect, useState } from "react";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  FolderOpenOutlined,
  CloudDownloadOutlined,
} from "@ant-design/icons";
import { useWSStore } from "../../../stores/wsStore";
import { localServer } from "../../../services/server";

const { Text } = Typography;

interface VersionInfo {
  extremer?: string;
  frontend?: string;
  localbridge?: string;
  mfw?: string;
  ocr?: string;
}

interface SystemStatus {
  localbridge_running: boolean;
  localbridge_port: number;
  connections?: number;
}

interface UpdateInfo {
  hasUpdate: boolean;
  message: string;
  updates?: Array<{
    componentName: string;
    currentVersion: string;
    newVersion: string;
    changelog: string;
  }>;
}

// 检测是否在 Wails 环境中运行
const isWailsEnv = (): boolean => {
  return typeof (window as any).go !== "undefined";
};

// Wails 绑定调用
const wailsCall = async <T,>(method: string): Promise<T | null> => {
  if (!isWailsEnv()) return null;
  try {
    const go = (window as any).go;
    if (go?.main?.App?.[method]) {
      return await go.main.App[method]();
    }
  } catch (e) {
    console.error(`Wails call ${method} failed:`, e);
  }
  return null;
};

function SystemInfoPanel() {
  const wsConnected = useWSStore((state) => state.connected);
  const [loading, setLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({});
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isExtremer, setIsExtremer] = useState(false);

  // 加载系统信息
  const loadSystemInfo = async () => {
    setLoading(true);
    try {
      // 检测 Wails 环境
      const inWails = isWailsEnv();
      setIsExtremer(inWails);

      if (inWails) {
        // 从 Wails 后端获取信息
        const version = await wailsCall<VersionInfo>("GetVersion");
        const status = await wailsCall<SystemStatus>("GetStatus");
        if (version) setVersionInfo(version);
        if (status) setSystemStatus(status);
      } else {
        // 从 LocalBridge 获取基本信息
        if (wsConnected) {
          // 可以通过 WebSocket 获取 LocalBridge 版本
          setVersionInfo({
            frontend: import.meta.env.VITE_APP_VERSION || "dev",
          });
        }
      }
    } catch (e) {
      console.error("Failed to load system info:", e);
    } finally {
      setLoading(false);
    }
  };

  // 检查更新
  const checkUpdate = async () => {
    if (!isExtremer) {
      message.info("更新检查仅在 Extremer 桌面版中可用");
      return;
    }

    setLoading(true);
    try {
      const result = await wailsCall<UpdateInfo>("CheckUpdate");
      if (result) {
        setUpdateInfo(result);
        if (result.hasUpdate) {
          message.success(`发现 ${result.updates?.length || 0} 个可用更新`);
        } else {
          message.info(result.message);
        }
      }
    } catch (e) {
      message.error("检查更新失败");
    } finally {
      setLoading(false);
    }
  };

  // 重启 LocalBridge
  const restartLocalBridge = async () => {
    if (!isExtremer) {
      message.info("此功能仅在 Extremer 桌面版中可用");
      return;
    }

    setLoading(true);
    try {
      await wailsCall<void>("RestartLocalBridge");
      message.success("LocalBridge 已重启");
      // 重新加载状态
      setTimeout(loadSystemInfo, 2000);
    } catch (e) {
      message.error("重启 LocalBridge 失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemInfo();
  }, [wsConnected]);

  return (
    <Card
      title="系统信息"
      size="small"
      extra={
        <Button
          type="text"
          icon={<ReloadOutlined />}
          onClick={loadSystemInfo}
          loading={loading}
        />
      }
    >
      <Spin spinning={loading}>
        {/* 运行环境 */}
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="运行环境">
            <Tag color={isExtremer ? "blue" : "green"}>
              {isExtremer ? "Extremer 桌面版" : "浏览器版"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="LocalBridge">
            <Tag color={wsConnected ? "success" : "default"}>
              {wsConnected ? "已连接" : "未连接"}
            </Tag>
            {systemStatus?.localbridge_port && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                端口 {systemStatus.localbridge_port}
              </Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* 版本信息 */}
        {Object.keys(versionInfo).length > 0 && (
          <Descriptions
            column={1}
            size="small"
            title="版本信息"
            style={{ marginBottom: 16 }}
          >
            {versionInfo.extremer && (
              <Descriptions.Item label="Extremer">
                v{versionInfo.extremer}
              </Descriptions.Item>
            )}
            {versionInfo.frontend && (
              <Descriptions.Item label="前端">
                v{versionInfo.frontend}
              </Descriptions.Item>
            )}
            {versionInfo.localbridge && (
              <Descriptions.Item label="LocalBridge">
                v{versionInfo.localbridge}
              </Descriptions.Item>
            )}
            {versionInfo.mfw && (
              <Descriptions.Item label="MaaFramework">
                v{versionInfo.mfw}
              </Descriptions.Item>
            )}
            {versionInfo.ocr && (
              <Descriptions.Item label="OCR">
                v{versionInfo.ocr}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}

        {/* 更新信息 */}
        {updateInfo?.hasUpdate && updateInfo.updates && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>可用更新:</Text>
            {updateInfo.updates.map((item) => (
              <div key={item.componentName} style={{ marginTop: 8 }}>
                <Tag color="orange">{item.componentName}</Tag>
                <Text type="secondary">
                  {item.currentVersion} → {item.newVersion}
                </Text>
              </div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <Space wrap>
          {isExtremer && (
            <>
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={checkUpdate}
                loading={loading}
              >
                检查更新
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={restartLocalBridge}
                loading={loading}
              >
                重启 LocalBridge
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  // 打开日志目录 - 需要 Wails 支持
                  message.info("功能开发中");
                }}
              >
                打开日志目录
              </Button>
            </>
          )}
          {!isExtremer && !wsConnected && (
            <Button type="primary" onClick={() => localServer.connect()}>
              连接 LocalBridge
            </Button>
          )}
        </Space>
      </Spin>
    </Card>
  );
}

export default memo(SystemInfoPanel);
