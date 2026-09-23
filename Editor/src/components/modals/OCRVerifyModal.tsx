import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Switch } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { ScreenshotModalBase, type CanvasRenderProps } from "./ScreenshotModalBase";
import { RecognitionCanvas, type ROI, type RecognitionBox } from "./recognition/RecognitionCanvas";
import { mfwProtocol } from "@/services/server";
import { parseROIValue } from "../panels/field/items/fieldValueUtils";
import styles from "@/styles/modals/OCRVerifyModal.module.less";

import { OCRVerificationResults, type OCRVerifyResult } from "./recognition/OCRVerificationResults";

const EMPTY_BOXES: RecognitionBox[] = [];
const ORDER_OPTIONS = ["Horizontal", "Vertical", "Area", "Length", "Random", "Expected"];

export const OCRVerifyModal = memo(({ open, onClose, initialParams, initialExpectedIndex }: {
  open: boolean;
  onClose: () => void;
  initialParams: Record<string, unknown>;
  initialExpectedIndex: number;
}) => {
  const expectedValues = Array.isArray(initialParams.expected)
    ? initialParams.expected
    : [initialParams.expected];
  const expectedOptions = [...new Set(expectedValues.filter(
    (value): value is string => typeof value === "string",
  ))].map(value => ({ value, label: value || "（空正则）" }));
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [roi, setROI] = useState<ROI>(() => parseROIValue(initialParams.roi) ?? [0, 0, 0, 0]);
  const [roiResolved, setROIResolved] = useState(() => !initialParams.roi || !!parseROIValue(initialParams.roi));
  const [expected, setExpected] = useState<string[]>(() => {
    const selected = expectedValues[initialExpectedIndex];
    return typeof selected === "string" ? [selected] : [];
  });
  const [threshold, setThreshold] = useState((initialParams.threshold as number) ?? 0.3);
  const [onlyRec, setOnlyRec] = useState((initialParams.only_rec as boolean) ?? false);
  const [orderBy, setOrderBy] = useState((initialParams.order_by as string) ?? "Horizontal");
  const [index, setIndex] = useState((initialParams.index as number) ?? 0);
  const [replace, setReplace] = useState(JSON.stringify(initialParams.replace ?? []));
  const [result, setResult] = useState<OCRVerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidate = useCallback(() => {
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBusy(false);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const unregister = mfwProtocol.onOCRResult((data: OCRVerifyResult) => {
      if (!pending.current || data.request_id !== pending.current) return;
      invalidate();
      setResult(data);
    });
    return () => {
      unregister();
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, invalidate]);

  const changeROI = useCallback((value: ROI) => {
    invalidate();
    setROI(value);
    setROIResolved(true);
  }, [invalidate]);
  const changeScreenshot = useCallback((value: string | null) => {
    invalidate();
    setScreenshot(value);
  }, [invalidate]);
  const renderCanvas = useCallback((viewport: CanvasRenderProps) => (
    <RecognitionCanvas viewport={viewport} roi={roi} boxes={result?.all ?? EMPTY_BOXES}
      roiOffset={parseROIValue(initialParams.roi_offset)}
      best={result?.best} onROIChange={changeROI} />
  ), [roi, result, changeROI, initialParams.roi_offset]);

  const verify = () => {
    if (!screenshot || busy) return;
    invalidate();
    try {
      if (!roiResolved) throw new Error("ROI 引用了其他节点，请框选验证区域或输入坐标。");
      if (initialParams.color_filter) throw new Error("color_filter 依赖其他节点，请使用节点的识别测试功能。");
      if (initialParams.model) throw new Error("自定义 OCR 模型需要项目资源，请使用节点的识别测试功能。");
      const replacements: unknown = JSON.parse(replace);
      const pair = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every(item => typeof item === "string");
      if (!pair(replacements) && !(Array.isArray(replacements) && replacements.every(pair))) {
        throw new Error('替换规则应为 ["正则", "替换文本"] 或规则数组。');
      }
      const requestId = crypto.randomUUID();
      pending.current = requestId;
      setBusy(true);
      timer.current = setTimeout(() => {
        invalidate();
        setResult({ success: false, error: "文字识别验证超时，请检查 LocalBridge 连接和日志后重试。" });
      }, 30000);
      const sent = mfwProtocol.requestOCR({
        base_image: screenshot, roi, request_id: requestId,
        params: {
          expected, threshold, only_rec: onlyRec, order_by: orderBy, index,
          replace: replacements,
          ...(initialParams.roi_offset ? { roi_offset: initialParams.roi_offset } : {}),
        },
      });
      if (!sent) throw new Error("无法发送验证请求，请先连接 LocalBridge。");
    } catch (error) {
      invalidate();
      setResult({ success: false, error: error instanceof Error ? error.message : "验证失败" });
    }
  };

  const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 6 };
  return <ScreenshotModalBase open={open} onClose={onClose} title="文字识别验证"
    boundedLayout
    previewFooter={<OCRVerificationResults result={result} busy={busy} screenshot={screenshot} />}
    extraButtons={<Button type="primary" icon={<ThunderboltOutlined />} loading={busy}
      disabled={!screenshot || !roiResolved || !!initialParams.model || !!initialParams.color_filter}
      onClick={verify}>开始验证</Button>}
    confirmText="关闭" onConfirm={onClose} renderCanvas={renderCanvas}
    onScreenshotChange={changeScreenshot} onReset={invalidate}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className={styles.hint}>使用自带 OCR 模型，调参仅用于本次验证。</p>
      {!roiResolved && <Alert type="warning" showIcon title="当前 ROI 引用了其他节点，请先框选验证区域或输入坐标。" />}
      {!!(initialParams.model || initialParams.color_filter) && <Alert type="warning" showIcon title="当前节点使用自定义模型或 color_filter，请使用节点的识别测试功能加载项目资源。" />}
      <label style={fieldStyle}>
        <span>期望文字 expected</span>
        <Select aria-label="期望文字 expected" mode="tags" value={expected} allowClear
          options={expectedOptions}
          placeholder="选择列表项或输入正则；留空匹配全部" onChange={(value) => { invalidate(); setExpected(value); }} />
      </label>
      <div>
        <div className={styles.roiHeader}>
          <span>ROI</span>
          <Button size="small" onClick={() => changeROI([0, 0, 0, 0])}>全图</Button>
        </div>
        <div className={styles.roiFields}>
          {roi.map((value, i) => <label key={i} className={styles.roiField}>
            <span>{["x", "y", "w", "h"][i]}</span>
            <InputNumber aria-label={`ROI ${["x", "y", "w", "h"][i]}`}
              style={{ width: "100%", minWidth: 0 }} value={value} precision={0} onChange={(next) => {
                const nextROI: ROI = [...roi]; nextROI[i] = next ?? 0; changeROI(nextROI);
              }} />
          </label>)}
        </div>
      </div>
      {!!initialParams.roi_offset && <div>叠加节点 ROI 偏移：{JSON.stringify(initialParams.roi_offset)}</div>}
      <div className={styles.parameterGrid}>
        <label className={styles.parameterField}>置信度阈值
          <InputNumber aria-label="置信度阈值" min={0} max={1} step={0.01} style={{ width: "100%" }}
            value={threshold} onChange={(value) => { invalidate(); setThreshold(value ?? 0.3); }} />
        </label>
        <label className={styles.parameterField}>仅识别 only_rec
          <div className={styles.switchControl}><Switch aria-label="仅识别 only_rec" checked={onlyRec}
            onChange={(value) => { invalidate(); setOnlyRec(value); }} /></div>
        </label>
        <label className={styles.parameterField}>排序
          <Select aria-label="结果排序" value={orderBy} style={{ width: "100%" }}
            options={ORDER_OPTIONS.map(value => ({ value, label: value }))}
            onChange={(value) => { invalidate(); setOrderBy(value); }} />
        </label>
        <label className={styles.parameterField}>结果索引
          <InputNumber aria-label="结果索引" precision={0} value={index} style={{ width: "100%" }}
            onChange={(value) => { invalidate(); setIndex(value ?? 0); }} />
        </label>
      </div>
      <label style={fieldStyle}>文字替换 replace（JSON）
        <Input.TextArea aria-label="文字替换规则" value={replace} autoSize={{ minRows: 1, maxRows: 4 }}
          onChange={(event) => { invalidate(); setReplace(event.target.value); }} />
      </label>
    </div>
  </ScreenshotModalBase>;
});
