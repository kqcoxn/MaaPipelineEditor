import style from "../../styles/ConfigPanel.module.less";

import { memo, useMemo, useEffect, useState } from "react";
import {
  Popover,
  Switch,
  Input,
  InputNumber,
  Button,
  Select,
  message,
} from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import { checkRepeatNodeLabelList } from "../../stores/flow";
import { useConfigStore } from "../../stores/configStore";
import { useFileStore } from "../../stores/fileStore";
import { configMarkPrefix, configMark } from "../../core/parser";
import { localServer } from "../../services";
import { OpenAIChat } from "../../utils/openai";
import { BackendConfigModal } from "../modals";

const TipElem = memo(({ content }: { content: string }) => (
  <div style={{ maxWidth: 260 }}>{content}</div>
));

function ConfigPanel() {
  // 后端配置模态框状态
  const [backendConfigOpen, setBackendConfigOpen] = useState(false);

  // store
  const showConfigPanel = useConfigStore(
    (state) => state.status.showConfigPanel
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const isAutoFocus = useConfigStore((state) => state.configs.isAutoFocus);
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode
  );
  const historyLimit = useConfigStore((state) => state.configs.historyLimit);
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const nodeAttrExportStyle = useConfigStore(
    (state) => state.configs.nodeAttrExportStyle
  );
  const wsPort = useConfigStore((state) => state.configs.wsPort);
  const wsAutoConnect = useConfigStore((state) => state.configs.wsAutoConnect);
  const fileAutoReload = useConfigStore(
    (state) => state.configs.fileAutoReload
  );
  const aiApiUrl = useConfigStore((state) => state.configs.aiApiUrl);
  const aiApiKey = useConfigStore((state) => state.configs.aiApiKey);
  const aiModel = useConfigStore((state) => state.configs.aiModel);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const fileConfig = useFileStore((state) => state.currentFile.config);
  const setFileConfig = useFileStore((state) => state.setFileConfig);

  // WebSocket端口配置同步
  useEffect(() => {
    localServer.setPort(wsPort);
  }, [wsPort]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": showConfigPanel,
      }),
    [showConfigPanel]
  );
  const globalClass = useMemo(() => classNames(style.item, style.global), []);
  const aiConfigClass = useMemo(
    () => classNames(style.item, style.aiConfig),
    []
  );
  const switchStyle = useMemo(() => ({ maxWidth: 60 }), []);

  // 渲染
  return (
    <div className={panelClass}>
      <div className={classNames("header", style.header)}>
        <div className="title">设置</div>
        <div className={style.right}>
          <IconFont
            className="icon-interactive"
            name="icon-dituweizhixinxi_chahao"
            size={20}
            onClick={() => setStatus("showConfigPanel", false)}
          />
        </div>
      </div>
      <div className={style.list}>
        <div className={style.divider}>—————— 文件配置 ——————</div>
        {/* 节点前缀 */}
        <div className={style.item}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"节点前缀"}
              content={
                <TipElem
                  content={
                    "在所有节点前添加一个前缀，并使用 _ 与节点名连接，防止跨文件节点名重复"
                  }
                />
              }
            >
              <span>节点前缀</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            style={{ maxWidth: 160 }}
            value={fileConfig.prefix}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setFileConfig("prefix", e.target.value);
              checkRepeatNodeLabelList();
            }}
          />
        </div>
        {/* 文件路径 */}
        <div className={style.item}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"文件路径"}
              content={
                <TipElem
                  content={
                    "本地JSON文件的完整路径，用于与本地服务通信时标识文件。留空则无法使用本地通信功能。例如: D:/path/to/your/pipeline.json"
                  }
                />
              }
            >
              <span>文件路径</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            style={{ maxWidth: 160 }}
            value={fileConfig.filePath || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setFileConfig("filePath", e.target.value);
            }}
          />
        </div>
        <div className={style.divider}>————— Pipeline 配置 —————</div>

        {/* 节点属性导出形式 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"节点属性导出形式"}
              content={
                <TipElem
                  content={
                    "对象形式：{ name: 'C', anchor: true, jump_back: true }\n前缀形式：'[Anchor][JumpBack]C'"
                  }
                />
              }
            >
              <span>节点属性导出形式</span>
            </Popover>
          </div>
          <Select
            className={style.value}
            style={{ width: 90 }}
            value={nodeAttrExportStyle}
            onChange={(value) => setConfig("nodeAttrExportStyle", value)}
            options={[
              { value: "object", label: "对象形式" },
              { value: "prefix", label: "前缀形式" },
            ]}
          />
        </div>
        <div className={style.divider}>—————— 面板配置 ——————</div>
        {/* 节点风格 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"节点风格"}
              content="切换节点的显示风格：现代风格具有分组标题和图标，经典风格为原始平铺展示"
            >
              <span>节点风格</span>
            </Popover>
          </div>
          <Select
            className={style.value}
            style={{ width: 70 }}
            value={nodeStyle}
            onChange={(value) => setConfig("nodeStyle", value)}
            options={[
              { value: "modern", label: "现代风格" },
              { value: "classic", label: "经典风格" },
            ]}
          />
        </div>
        {/* 历史记录上限 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"历史记录上限"}
              content="设置撤销/重做功能的最大历史记录数量，设置过大可能占用较多内存并产生卡顿"
            >
              <span>历史记录上限</span>
            </Popover>
          </div>
          <InputNumber
            className={style.value}
            style={{ maxWidth: 80 }}
            min={10}
            max={10000}
            value={historyLimit}
            onChange={(value: number | null) => {
              if (value !== null) setConfig("historyLimit", value);
            }}
          />
        </div>
        {/* 实时编译 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"实时编译"}
              content={
                <TipElem
                  content={
                    "若节点或边发生变化，或选中的节点与边发生变化，则在防抖后实时编译并渲染在右侧JSON预览面板。（此功能对电脑性能要求较高，否则会造成轻微卡顿）"
                  }
                />
              }
            >
              <span>实时编译</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={isRealTimePreview}
            onChange={(value: boolean) => setConfig("isRealTimePreview", value)}
          />
        </div>
        {/* 显示边标签 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"显示边标签"}
              content={
                <TipElem
                  content={
                    "开启时边中心会显示连接次序，若影响观察可关闭此选项；显示时会稍微增加拖拽节点时性能损耗，若造成明显卡顿请关闭此选项。"
                  }
                />
              }
            >
              <span>显示边标签</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="显示"
            unCheckedChildren="隐藏"
            value={showEdgeLabel}
            onChange={(value: boolean) => setConfig("showEdgeLabel", value)}
          />
        </div>
        {/* 边拖拽手柄 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"边拖拽手柄"}
              content={
                <TipElem
                  content={
                    "开启时可以拖拽连接线中间的手柄来调整路径形状，该效果不会保存。双击手柄可重置单条连接线，排版工具中可一键重置所有连接线。"
                  }
                />
              }
            >
              <span>边拖拽手柄</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="显示"
            unCheckedChildren="隐藏"
            value={showEdgeControlPoint}
            onChange={(value: boolean) =>
              setConfig("showEdgeControlPoint", value)
            }
          />
        </div>
        {/* 自动聚焦 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"自动聚焦"}
              content={
                <TipElem content={"开启时若出现新节点则自动移动视口以聚焦"} />
              }
            >
              <span>自动聚焦</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="启用"
            unCheckedChildren="关闭"
            value={isAutoFocus}
            onChange={(value: boolean) => setConfig("isAutoFocus", value)}
          />
        </div>
        {/* 非聚焦节点不透明度 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"非聚焦节点不透明度"}
              content={
                <TipElem
                  content={
                    "选中节点或边时，非相关元素的透明度。设置为1时关闭此功能，小于1时只完全显示与选中元素直接关联的节点和边"
                  }
                />
              }
            >
              <span>非聚焦节点不透明度</span>
            </Popover>
          </div>
          <InputNumber
            className={style.value}
            style={{ maxWidth: 80 }}
            min={0}
            max={1}
            step={0.1}
            value={focusOpacity}
            onChange={(value: number | null) => {
              if (value !== null) setConfig("focusOpacity", value);
            }}
          />
        </div>
        {/* 配置处理方案 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title="配置处理方案"
              content={
                <TipElem
                  content={
                    "集成导出：配置嵌入 Pipeline 文件，适合单文件分享\n分离导出：配置存储至独立 .mpe.json 文件，便于版本管理\n不导出：不保存任何配置，导入时触发自动布局"
                  }
                />
              }
            >
              <span>配置处理方案</span>
            </Popover>
          </div>
          <Select
            className={style.value}
            style={{ width: 90 }}
            value={configHandlingMode}
            onChange={(value) => setConfig("configHandlingMode", value)}
            options={[
              { value: "integrated", label: "集成导出" },
              { value: "separated", label: "分离导出" },
              { value: "none", label: "不导出" },
            ]}
          />
        </div>
        <div className={style.divider}>—————— 本地通信 ——————</div>
        {/* 本地服务配置 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"本地服务配置"}
              content={
                <TipElem
                  content={
                    "查看和修改后端服务的配置，包括服务器、文件、日志、MaaFramework 等设置"
                  }
                />
              }
            >
              <span>本地服务配置</span>
            </Popover>
          </div>
          <div className={style.value}>
            <Button
              size="small"
              onClick={() => {
                if (!localServer.isConnected()) {
                  message.warning("请先连接本地服务");
                  return;
                }
                setBackendConfigOpen(true);
              }}
            >
              打开配置
            </Button>
          </div>
        </div>
        {/* WebSocket 端口 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"WebSocket 端口"}
              content={
                <TipElem content={"本地服务端口，修改端口后需要重新连接"} />
              }
            >
              <span>连接端口</span>
            </Popover>
          </div>
          <InputNumber
            className={style.value}
            style={{ maxWidth: 100 }}
            min={1024}
            max={65535}
            value={wsPort}
            onChange={(value: number | null) => {
              if (value !== null) setConfig("wsPort", value);
            }}
          />
        </div>
        {/* 自动连接 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"自动连接"}
              content={
                <TipElem
                  content={"开启后，进入页面时会自动尝试连接本地通信服务"}
                />
              }
            >
              <span>自动连接</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={wsAutoConnect}
            onChange={(value: boolean) => setConfig("wsAutoConnect", value)}
          />
        </div>
        {/* 自动重载 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"自动重载变更文件"}
              content={
                <TipElem
                  content={
                    "开启后，当文件被外部修改时会自动重新加载文件内容，无需手动确认"
                  }
                />
              }
            >
              <span>自动重载变更文件</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={fileAutoReload}
            onChange={(value: boolean) => setConfig("fileAutoReload", value)}
          />
        </div>
        <div className={style.divider}>—————— AI 配置 ——————</div>
        {/* AI 配置警告 */}
        <div className={style.item}>
          <div
            style={{
              fontSize: 12,
              color: "#ff7875",
              padding: "4px 8px",
              background: "#fff2f0",
              borderRadius: 4,
              lineHeight: 1.5,
            }}
          >
            ⚠️ API Key
            将以明文存储在浏览器本地（LocalStorage），请勿在公共设备上使用！
            <br />
            ⚠️ 浏览器直接调用 API 可能遇到 CORS 跨域限制，建议使用支持 CORS 的
            API 中转服务
          </div>
        </div>
        {/* API URL */}
        <div className={aiConfigClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"API URL"}
              content={
                <TipElem
                  content={
                    "OpenAI 兼容的 API 端点地址，例如: https://api.openai.com/v1/chat/completions"
                  }
                />
              }
            >
              <span>API URL</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            placeholder="输入 API 地址"
            value={aiApiUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setConfig("aiApiUrl", e.target.value);
            }}
          />
        </div>
        {/* API Key */}
        <div className={aiConfigClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"API Key"}
              content={
                <TipElem
                  content={"你的 API 密钥，将存储在浏览器本地，请注意安全"}
                />
              }
            >
              <span>API Key</span>
            </Popover>
          </div>
          <Input.Password
            className={style.value}
            placeholder="输入 API Key"
            value={aiApiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setConfig("aiApiKey", e.target.value);
            }}
          />
        </div>
        {/* 模型名称 */}
        <div className={aiConfigClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"模型名称"}
              content={
                <TipElem
                  content={
                    "使用的模型名称，例如: gpt-4o-mini, gpt-4o, deepseek-chat 等"
                  }
                />
              }
            >
              <span>模型</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            placeholder="输入模型名称"
            value={aiModel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setConfig("aiModel", e.target.value);
            }}
          />
        </div>
        {/* 测试连接 */}
        <div className={aiConfigClass}>
          <div className={style.key}>
            <span>测试</span>
          </div>
          <div className={style.value}>
            <Button
              size="small"
              type="primary"
              onClick={async () => {
                const chat = new OpenAIChat({ systemPrompt: "简短回复" });
                const result = await chat.send("直接回复：AI 服务连接成功☺️");
                if (result.success) {
                  message.success(`测试成功: ${result.content}`);
                } else {
                  message.error(`测试失败: ${result.error}`);
                }
              }}
            >
              测试连接
            </Button>
          </div>
        </div>
      </div>
      {/* 后端配置模态框 */}
      <BackendConfigModal
        open={backendConfigOpen}
        onClose={() => setBackendConfigOpen(false)}
      />
    </div>
  );
}

export default memo(ConfigPanel);
