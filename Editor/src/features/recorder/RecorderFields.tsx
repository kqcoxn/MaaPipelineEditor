import { Button, Input, InputNumber, Select, Alert } from "antd";
import { useRecorderStore } from "./store";
import { escapeOCRText, type Rect } from "./types";
import styles from "./Recorder.module.less";

function RectFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Rect;
  onChange: (v: Rect) => void;
}) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.rectFields}>
        {["X", "Y", "W", "H"].map((axis, index) => (
          <InputNumber
            key={axis}
            aria-label={`${label} ${axis}`}
            prefix={axis}
            precision={0}
            value={value[index]}
            onChange={(v) => {
              if (v !== null) {
                const next: Rect = [...value];
                next[index] = v;
                onChange(next);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
export function RecorderFields({
  extract,
  candidates,
}: {
  extract: () => void;
  candidates: string[];
}) {
  const current = useRecorderStore((s) => s.current);
  const edit = useRecorderStore((s) => s.edit);
  const busy = useRecorderStore((s) => s.busy);
  const { config: c, result } = current;
  return (
    <aside className={styles.fields} aria-label="当前步骤配置">
      <h3>当前步骤</h3>
      <fieldset disabled={busy} className={styles.fieldset}>
        <label>
          步骤名称
          <Input
            value={c.name}
            placeholder="保存时自动命名"
            onChange={(e) => edit({ name: e.target.value })}
          />
        </label>
        <label>
          识别类型
          <Select
            value={c.recognition}
            disabled={busy}
            options={["OCR", "TemplateMatch", "DirectHit"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(recognition) =>
              edit({
                recognition,
                threshold: recognition === "TemplateMatch" ? 0.7 : 0.3,
                ...(recognition === "DirectHit"
                  ? { targetMode: "fixed" as const }
                  : {}),
              })
            }
          />
        </label>
        {c.recognition !== "DirectHit" && (
          <>
            <RectFields
              label="识别 ROI"
              value={c.roi}
              onChange={(roi) => edit({ roi })}
            />
            <Button
              size="small"
              disabled={busy}
              onClick={() => edit({ roi: [0, 0, 0, 0] })}
            >
              恢复全屏 ROI
            </Button>
            <label>
              识别阈值
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                value={c.threshold}
                onChange={(v) => v !== null && edit({ threshold: v })}
              />
            </label>
          </>
        )}
        {c.recognition === "OCR" && (
          <>
            <label>
              期望文字（支持正则）
              <Input.TextArea
                value={c.expected}
                rows={2}
                onChange={(e) => edit({ expected: e.target.value })}
              />
            </label>
            <Button disabled={busy || !current.frame} onClick={extract}>
              从 ROI 提取文字
            </Button>
            {candidates.length > 0 && (
              <label>
                选择文字候选
                <Select<string>
                  placeholder="选中后填入期望文字"
                  value={undefined}
                  disabled={busy}
                  options={candidates.map((value) => ({ value, label: value }))}
                  onChange={(value) => edit({ expected: escapeOCRText(value) })}
                />
              </label>
            )}
          </>
        )}
        {c.recognition === "TemplateMatch" && (
          <div>
            <div className={styles.fieldLabel}>模板图片</div>
            {current.templateCandidates && (
              <div className={styles.templateCandidates} aria-label="模板候选">
                {current.templateCandidates.map((candidate, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={busy}
                    aria-pressed={c.templateImage === candidate.image}
                    onClick={() => {
                      edit({
                        templateRect: candidate.rect,
                        templateImage: candidate.image,
                      });
                    }}
                  >
                    <img src={candidate.image} alt={candidate.label} />
                    <span>{candidate.label}</span>
                  </button>
                ))}
              </div>
            )}
            {c.templateImage ? (
              <img
                className={styles.templatePreview}
                src={c.templateImage}
                alt="当前识别模板"
              />
            ) : (
              <p className={styles.hint}>
                在画面工具中选择“裁剪模板”并框选。搜索 ROI 独立配置。
              </p>
            )}
          </div>
        )}
        <label>
          动作
          <Select
            value={c.action}
            disabled={busy}
            options={[
              { value: "Click", label: "点击" },
              { value: "DoNothing", label: "仅识别（DoNothing）" },
            ]}
            onChange={(action) => edit({ action })}
          />
        </label>
        {c.action === "Click" && (
          <>
            <label>
              点击目标
              <Select
                value={c.targetMode}
                disabled={busy}
                options={[
                  {
                    value: "recognition",
                    label: "识别结果",
                    disabled: c.recognition === "DirectHit",
                  },
                  { value: "fixed", label: "固定位置" },
                ]}
                onChange={(targetMode) => edit({ targetMode })}
              />
            </label>
            {c.targetMode === "fixed" && (
              <>
                <p className={styles.hint}>
                  {c.target
                    ? "可在画面重新选点，也可输入目标区域。"
                    : "请先在画面工具中选择固定点击位置。"}
                </p>
                <RectFields
                  label="固定目标"
                  value={c.target ?? [0, 0, 1, 1]}
                  onChange={(target) => edit({ target })}
                />
              </>
            )}
            <RectFields
              label="目标偏移"
              value={c.offset}
              onChange={(offset) => edit({ offset })}
            />
          </>
        )}
      </fieldset>
      {result && (
        <Alert
          showIcon
          type={!result.success ? "error" : result.hit ? "success" : "warning"}
          title={
            !result.success
              ? "验证或执行失败"
              : result.action_success
                ? "点击执行成功"
                : result.hit
                  ? "识别命中"
                  : "未命中，未执行动作"
          }
          description={
            result.error || "结果不代表步骤已保存；请使用“保存步骤”记录配置。"
          }
        />
      )}
      <p className={styles.hint}>
        延迟、分支及其他高级字段请在生成后的画布字段面板中编辑。
      </p>
    </aside>
  );
}
