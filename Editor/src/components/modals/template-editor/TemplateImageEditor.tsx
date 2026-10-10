import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button, InputNumber, Modal, Radio, theme } from "antd";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { resourceProtocol } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { useLocalFileStore, type ImageCacheItem } from "@/stores/project/localFileStore";
import { message, modal } from "@/utils/ui/antdAppApi";
import { cropBetween, exportTemplate, renderTemplate, type Point, type Stroke, type TemplateEdit } from "./imageEditing";
import styles from "./templateImageEditor.module.less";

export function TemplateImageEditor({ path, image, root, onClose }: {
  path: string; image: ImageCacheItem; root: string; onClose: () => void;
}) {
  const { token } = theme.useToken();
  const connected = useWSStore((state) => state.connected);
  const currentRoot = useLocalFileStore((state) => state.rootPath);
  const [loaded, setLoaded] = useState<HTMLImageElement>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<"pan" | "crop" | "brush" | "eraser">("pan");
  const [brushSize, setBrushSize] = useState(8);
  const [history, setHistory] = useState<TemplateEdit[]>([]);
  const [future, setFuture] = useState<TemplateEdit[]>([]);
  const [draft, setDraft] = useState<TemplateEdit>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<{ start: Point; edit: TemplateEdit; stroke?: Stroke; pan: boolean } | null>(null);
  const original = image.dataUrl;
  const viewport = useCanvasViewport({ open: true, screenshot: original || image.url });
  function fit(img: HTMLImageElement) {
    viewport.initializeImage(img);
    const container = viewport.containerRef.current;
    if (!container) return;
    const scale = Math.min(5, (container.clientWidth - 32) / img.naturalWidth, (container.clientHeight - 32) / img.naturalHeight);
    viewport.setScale(scale);
    viewport.setPanOffset({ x: (container.clientWidth - img.naturalWidth * scale) / 2, y: (container.clientHeight - img.naturalHeight * scale) / 2 });
  }
  const initialize = useRef(fit);
  initialize.current = fit;
  const edit = draft ?? history[history.length - 1];
  const dirty = history.length > 1;

  useEffect(() => {
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (!active) return;
      if (img.naturalWidth * img.naturalHeight > 32 * 1024 * 1024) {
        setError("图片过大，无法在模板编辑器中编辑"); return;
      }
      setLoaded(img);
      setHistory([{ crop: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }, strokes: [] }]);
      initialize.current(img);
    };
    img.onerror = () => active && setError("模板图片加载失败，请关闭后重试");
    img.src = original || image.url;
    return () => { active = false; };
  }, [original, image.url]);

  useEffect(() => {
    if (!loaded || !edit || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = loaded.naturalWidth;
    canvas.height = loaded.naturalHeight;
    canvas.getContext("2d")!.drawImage(renderTemplate(loaded, edit.strokes), 0, 0);
  }, [loaded, edit]);

  function commit(next: TemplateEdit) {
    setHistory((items) => [...items, next]);
    setFuture([]);
    setDraft(undefined);
  }
  function close() {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    modal.confirm({ title: "放弃未保存的模板修改？", content: "原文件尚未更改。", okText: "放弃修改", cancelText: "继续编辑", onOk: onClose });
  }
  function point(event: PointerEvent<HTMLDivElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(loaded!.naturalWidth, (event.clientX - rect.left) / rect.width * loaded!.naturalWidth)),
      y: Math.max(0, Math.min(loaded!.naturalHeight, (event.clientY - rect.top) / rect.height * loaded!.naturalHeight)) };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (!edit || !loaded || saving || (event.button !== 0 && event.button !== 1)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    const pan = tool === "pan" || viewport.isSpacePressed || event.button === 1;
    const stroke: Stroke | undefined = !pan && (tool === "brush" || tool === "eraser") ? { tool, size: brushSize, points: [start] } : undefined;
    gesture.current = { start, edit, stroke, pan };
    if (pan) viewport.startPan(event.clientX, event.clientY, event.button === 1);
    else if (stroke) setDraft({ ...edit, strokes: [...edit.strokes, stroke] });
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || !loaded) return;
    if (drag.pan) { viewport.updatePan(event.clientX, event.clientY); return; }
    if (drag.stroke) {
      drag.stroke = { ...drag.stroke, points: [...drag.stroke.points, point(event)] };
      setDraft({ ...drag.edit, strokes: [...drag.edit.strokes, drag.stroke] });
    } else setDraft({ ...drag.edit, crop: cropBetween(drag.start, point(event), loaded.naturalWidth, loaded.naturalHeight) });
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.pan) viewport.endPan();
    else if (event.type === "pointercancel") setDraft(undefined);
    else if (drag.stroke) commit({ ...drag.edit, strokes: [...drag.edit.strokes, drag.stroke] });
    else if (loaded && (Math.abs(point(event).x - drag.start.x) > 0 || Math.abs(point(event).y - drag.start.y) > 0))
      commit({ ...drag.edit, crop: cropBetween(drag.start, point(event), loaded.naturalWidth, loaded.naturalHeight) });
    else setDraft(undefined);
  }
  async function save() {
    if (!loaded || !edit || saving || !original) return;
    setSaving(true); setError("");
    try {
      await resourceProtocol.saveTemplateImage(path, image.absPath, original, exportTemplate(loaded, edit));
      message.success("模板已保存，引用该图片的节点会使用更新后的模板");
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }
  function download() {
    if (!loaded || !edit) return;
    const anchor = document.createElement("a");
    anchor.href = exportTemplate(loaded, edit);
    anchor.download = (path.split(/[\\/]/).pop() || "template").replace(/\.[^.]+$/, "") + "_edited.png";
    anchor.click();
  }

  return <Modal open title="模板图片编辑" width="min(1120px, calc(100vw - 32px))" style={{ top: 24 }}
    onCancel={close} mask={{ closable: false }} keyboard={!saving} closable={!saving}
    styles={{ body: { maxHeight: "calc(100vh - 190px)", overflow: "auto" } }}
    footer={<div className={styles.footer}>
      <span style={{ color: token.colorTextSecondary }}>{dirty ? "有未保存的修改" : "原图"} · 保存将影响所有引用此图片的节点</span>
      <Button onClick={close} disabled={saving}>关闭</Button>
      <Button onClick={download} disabled={!loaded || saving}>导出 PNG</Button>
      <Button type="primary" loading={saving} onClick={save}
        disabled={!dirty || !connected || currentRoot !== root || !original || !/\.png$/i.test(image.absPath)}>保存到原文件</Button>
    </div>}>
    <div className={styles.meta} style={{ color: token.colorTextSecondary }} title={image.absPath}>{path} · {image.width} × {image.height}</div>
    <div className={styles.toolbar}>
      <Radio.Group value={tool} onChange={(event) => setTool(event.target.value)} disabled={!loaded || saving}
        options={[{ label: "移动", value: "pan" }, { label: "裁剪", value: "crop" }, { label: "绿色遮罩", value: "brush" }, { label: "擦除遮罩", value: "eraser" }]} optionType="button" />
      {(tool === "brush" || tool === "eraser") && <label>笔刷 <InputNumber aria-label="笔刷大小" min={1} max={200} value={brushSize} onChange={(value) => setBrushSize(value ?? 1)} /> px</label>}
      <Button disabled={!dirty || saving} onClick={() => { setFuture((items) => [...items, history[history.length - 1]]); setHistory((items) => items.slice(0, -1)); }}>撤销</Button>
      <Button disabled={!future.length || saving} onClick={() => { setHistory((items) => [...items, future[future.length - 1]]); setFuture((items) => items.slice(0, -1)); }}>重做</Button>
      <Button disabled={!dirty || saving} onClick={() => commit(history[0])}>恢复原图</Button>
    </div>
    <div className={styles.toolbar}>
      <Button onClick={viewport.handleZoomOut} disabled={!loaded}>缩小</Button>
      <span>{Math.round(viewport.scale * 100)}%</span>
      <Button onClick={viewport.handleZoomIn} disabled={!loaded}>放大</Button>
      <Button onClick={() => loaded && fit(loaded)} disabled={!loaded}>适配窗口</Button>
      <Button disabled={!loaded} onClick={() => {
        viewport.setScale(1);
        const container = viewport.containerRef.current;
        if (container && loaded) viewport.setPanOffset({ x: (container.clientWidth - loaded.naturalWidth) / 2, y: (container.clientHeight - loaded.naturalHeight) / 2 });
      }}>原始尺寸</Button>
      {edit && loaded && <>
        {(["x", "y", "width", "height"] as const).map((key) => <label key={key}>
          {{ x: "X", y: "Y", width: "宽", height: "高" }[key]} <InputNumber aria-label={`裁剪${key}`} size="small" precision={0}
            min={key === "x" || key === "y" ? 0 : 1} disabled={saving} value={edit.crop[key]} style={{ width: 75 }}
            max={key === "x" ? loaded.naturalWidth - edit.crop.width : key === "y" ? loaded.naturalHeight - edit.crop.height : key === "width" ? loaded.naturalWidth - edit.crop.x : loaded.naturalHeight - edit.crop.y}
            onChange={(value) => {
              if (value == null || !Number.isFinite(value)) return;
              const min = key === "x" || key === "y" ? 0 : 1;
              const max = key === "x" ? loaded.naturalWidth - edit.crop.width
                : key === "y" ? loaded.naturalHeight - edit.crop.height
                : key === "width" ? loaded.naturalWidth - edit.crop.x : loaded.naturalHeight - edit.crop.y;
              commit({ ...edit, crop: { ...edit.crop, [key]: Math.max(min, Math.min(max, Math.round(value))) } });
            }} />
        </label>)}
        <Button disabled={saving} onClick={() => commit({ ...edit, crop: history[0].crop })}>全图</Button>
      </>}
    </div>
    {error && <div role="alert" style={{ color: token.colorError, marginBottom: 8 }}>{error}</div>}
    {(!connected || currentRoot !== root) && <p role="alert">本地服务已断开或项目已切换，可先导出编辑结果。</p>}
    <div ref={viewport.containerRef} className={styles.viewport} style={{ background: token.colorFillSecondary, borderColor: token.colorBorder }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {!loaded && <span>{error ? "无法载入模板" : "正在加载模板…"}</span>}
      {loaded && edit && <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "top left", width: loaded.naturalWidth, height: loaded.naturalHeight,
        transform: `translate(${viewport.panOffset.x}px, ${viewport.panOffset.y}px) scale(${viewport.scale})`,
        cursor: viewport.getBaseCursorStyle() || (tool === "pan" ? "grab" : "crosshair") }}>
        <canvas ref={canvasRef} aria-label={`编辑模板 ${path}`} style={{ display: "block", imageRendering: "pixelated" }} />
        <div style={{ position: "absolute", pointerEvents: "none", left: edit.crop.x, top: edit.crop.y, width: edit.crop.width, height: edit.crop.height,
          outline: `${1 / viewport.scale}px solid ${token.colorPrimary}`, boxShadow: "0 0 0 100000px #0005" }} />
      </div>}
    </div>
    <p style={{ color: token.colorTextSecondary, marginBottom: 0 }}>滚轮缩放，空格或中键拖动。裁剪框内的内容将被保存。橡皮擦仅移除本次新增的遮罩；使用绿色遮罩时，请在节点中启用 green_mask。</p>
    {!/\.png$/i.test(image.absPath) && <p>当前格式仅支持导出 PNG，覆盖保存支持 PNG 模板。</p>}
  </Modal>;
}
