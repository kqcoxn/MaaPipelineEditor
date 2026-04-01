import style from "../../../styles/panels/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Input, Button, message, Slider } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import { OpenAIChat } from "../../../utils/ai/openai";
import { SYSTEM_PROMPTS } from "../../../utils/ai/aiPrompts";
import TipElem from "./TipElem";

const AIConfigSection = memo(() => {
  const aiApiUrl = useConfigStore((state) => state.configs.aiApiUrl);
  const aiApiKey = useConfigStore((state) => state.configs.aiApiKey);
  const aiModel = useConfigStore((state) => state.configs.aiModel);
  const aiTemperature = useConfigStore((state) => state.configs.aiTemperature);
  const setConfig = useConfigStore((state) => state.setConfig);

  const aiConfigClass = useMemo(
    () => classNames(style.item, style.aiConfig),
    [],
  );

  return (
    <>
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
          ⚠️ 浏览器直接调用 API 可能遇到 CORS 跨域限制，建议使用支持 CORS 的 API
          中转服务
          <br />
          💡 节点预测功能需要支持视觉的模型（如
          GPT-4o、Claude-3.5-Sonnet、Qwen-VL 等）
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
                  "使用的模型名称，例如: gpt-4o, gpt-4o-mini, claude-3-5-sonnet-latest, qwen-vl-plus 等"
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
      {/* 温度参数 */}
      <div className={aiConfigClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"温度参数"}
            content={
              <TipElem
                content={
                  "控制 AI 输出的随机性。较低的值（0.3）更稳定保守，较高的值（0.8）更有创造性。节点预测建议 0.5-0.7"
                }
              />
            }
          >
            <span>温度</span>
          </Popover>
        </div>
        <div
          className={style.value}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={aiTemperature}
            onChange={(v) => setConfig("aiTemperature", v)}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <span style={{ minWidth: 32, textAlign: "right" }}>
            {aiTemperature.toFixed(1)}
          </span>
        </div>
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
              const chat = new OpenAIChat({
                systemPrompt: SYSTEM_PROMPTS.TEST_CONNECTION,
              });
              const result = await chat.send("直接回复：AI 服务连接成功");
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
    </>
  );
});

export default AIConfigSection;
