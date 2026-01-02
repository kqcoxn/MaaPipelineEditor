import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Switch, InputNumber, Select } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import TipElem from "./TipElem";

const PanelConfigSection = memo(() => {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const historyLimit = useConfigStore((state) => state.configs.historyLimit);

  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint
  );
  const isAutoFocus = useConfigStore((state) => state.configs.isAutoFocus);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode
  );
  const canvasBackgroundMode = useConfigStore(
    (state) => state.configs.canvasBackgroundMode
  );
  const fieldPanelMode = useConfigStore(
    (state) => state.configs.fieldPanelMode
  );
  const inlinePanelScale = useConfigStore(
    (state) => state.configs.inlinePanelScale
  );
  const setConfig = useConfigStore((state) => state.setConfig);

  const globalClass = useMemo(() => classNames(style.item, style.global), []);
  const switchStyle = useMemo(() => ({ maxWidth: 60 }), []);

  return (
    <>
      <div className={style.divider}>—————— 面板配置 ——————</div>
      {/* 节点风格 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"节点风格"}
            content="切换节点的显示风格：现代风格具有分组标题和图标，经典风格为原始平铺展示，极简风格仅显示图标和名称"
          >
            <span>节点风格</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 90 }}
          value={nodeStyle}
          onChange={(value) => setConfig("nodeStyle", value)}
          options={[
            { value: "modern", label: "现代风格" },
            { value: "classic", label: "经典风格" },
            { value: "minimal", label: "极简风格" },
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
      {/* 画布背景 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="画布背景"
            content={
              <TipElem
                content={
                  "纯白：纯白色背景，适合喜欢明亮界面的用户\n护眼：淡蓝灰色背景(#f9fafd)，柔和不刺眼"
                }
              />
            }
          >
            <span>画布背景</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 70 }}
          value={canvasBackgroundMode}
          onChange={(value) => setConfig("canvasBackgroundMode", value)}
          options={[
            { value: "eyecare", label: "护眼" },
            { value: "pure", label: "纯白" },
          ]}
        />
      </div>
      {/* 字段/连接面板模式 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="字段/连接面板模式"
            content={
              <TipElem
                content={
                  "固定模式：面板固定在右上角\n拖动模式：面板可拖动，切换选中时保持位置\n内嵌模式：字段面板嵌入在节点旁边，直接在画布中编辑"
                }
              />
            }
          >
            <span>字段/连接面板模式</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 70 }}
          value={fieldPanelMode}
          onChange={(value) => setConfig("fieldPanelMode", value)}
          options={[
            { value: "fixed", label: "固定" },
            { value: "draggable", label: "拖动" },
            { value: "inline", label: "内嵌" },
          ]}
        />
      </div>
      {/* 内嵌面板缩放比例 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"内嵌面板缩放比例"}
            content={
              <TipElem
                content={
                  "设置内嵌模式下字段面板的整体缩放大小，范围 0.5-1.0。可根据个人视图查阅缩放比例偏好调试，其他模式不起作用。"
                }
              />
            }
          >
            <span>内嵌面板缩放比例</span>
          </Popover>
        </div>
        <InputNumber
          className={style.value}
          style={{ maxWidth: 80 }}
          min={0.5}
          max={1.0}
          step={0.05}
          value={inlinePanelScale}
          onChange={(value: number | null) => {
            if (value !== null) setConfig("inlinePanelScale", value);
          }}
        />
      </div>
    </>
  );
});

export default PanelConfigSection;
