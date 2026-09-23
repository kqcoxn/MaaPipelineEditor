import { useState } from "react";
import { Alert, Select, Tag, theme } from "antd";
import type { RecognitionBox } from "./RecognitionCanvas";
import styles from "@/styles/modals/OCRVerifyModal.module.less";
import { OCROverlayPreview } from "./OCROverlayPreview";

export interface OCRVerifyResult {
  request_id?: string;
  success: boolean;
  hit?: boolean;
  all?: RecognitionBox[];
  filtered?: RecognitionBox[];
  best?: RecognitionBox | null;
  detail_json?: string;
  error?: string;
}

export function OCRVerificationResults({ result, busy, screenshot }: {
  result: OCRVerifyResult | null;
  busy: boolean;
  screenshot: string | null;
}) {
  const { token } = theme.useToken();
  const [view, setView] = useState<"all" | "filtered" | "json">("all");
  const boxes = (view === "filtered" ? result?.filtered : result?.all) ?? [];
  return <section className={styles.results} aria-label="文字识别验证结果"
    style={{ borderColor: token.colorBorderSecondary }}>
    <div className={styles.resultsHeader}>
      <strong>识别结果</strong>
      <span role="status">
        {busy ? "验证中…" : result?.success && <>
          <Tag color={result.hit ? "success" : "warning"}>{result.hit ? "命中" : "未命中"}</Tag>
          原始 {result.all?.length ?? 0} 项 · 过滤后 {result.filtered?.length ?? 0} 项
        </>}
      </span>
      {result?.success && screenshot && <OCROverlayPreview screenshot={screenshot} result={result} />}
      <Select aria-label="识别结果视图" size="small" value={view}
        style={{ width: 136 }} onChange={setView}
        options={[
          { value: "all", label: "原始结果" },
          { value: "filtered", label: "过滤后结果" },
          { value: "json", label: "完整 JSON" },
        ]} />
    </div>
    <div className={styles.resultsSummary} style={{ color: token.colorTextSecondary }}>
      {result?.success
        ? result.best ? `最终命中：${result.best.text}（${result.best.score.toFixed(3)}）；绿色框标出命中位置。`
          : "没有符合当前条件与索引的结果。"
        : "选择验证条件后点击“开始验证”，在这里查看文字、置信度和位置。"}
    </div>
    <div className={styles.resultsScroll} tabIndex={0} aria-label="识别结果内容" aria-busy={busy}>
      {result && !result.success && <Alert type="error" showIcon title={result.error || "验证失败"} />}
      {result?.success && (view === "json"
        ? <pre className={styles.resultJson}>{result.detail_json ? JSON.stringify(JSON.parse(result.detail_json), null, 2) : "无识别详情"}</pre>
        : boxes.length ? <table className={styles.resultsTable}>
          <thead style={{ background: token.colorBgContainer }}><tr>
            <th scope="col">编号</th><th scope="col">文字</th><th scope="col">置信度</th><th scope="col">位置 [x, y, w, h]</th>
          </tr></thead>
          <tbody>{boxes.map((box, i) => <tr key={i}>
            <td>{i + 1}</td><td>{box.text || "（空文本）"}</td><td>{box.score.toFixed(3)}</td>
            <td>[{box.x}, {box.y}, {box.width}, {box.height}]</td>
          </tr>)}</tbody>
        </table> : <span>没有结果</span>)}
    </div>
  </section>;
}
