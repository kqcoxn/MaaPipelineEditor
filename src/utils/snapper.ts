import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { message } from "antd";

/**
 * 下载图片到本地
 */
function downloadImage(dataUrl: string, filename: string = "pipeline.png") {
  const a = document.createElement("a");
  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

/**
 * 将节点保存为图片
 * @param selectedNodes 选中的节点列表
 * @param allNodes 所有节点列表
 * @param fileName 当前文件名
 */
export async function saveNodesToImage(
  selectedNodes: Node[],
  allNodes: Node[],
  fileName: string = "pipeline"
) {
  try {
    // 确定节点
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : allNodes;
    if (targetNodes.length === 0) {
      message.warning("没有可保存的节点");
      return;
    }

    // 获取视口
    const viewportElement = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement;
    if (!viewportElement) {
      message.error("无法找到画布元素");
      return;
    }

    // 计算边界
    const nodesBounds = getNodesBounds(targetNodes);
    const padding = 50; // 边距
    const imageWidth = Math.ceil(nodesBounds.width + padding * 2);
    const imageHeight = Math.ceil(nodesBounds.height + padding * 2);

    // 计算视口变换
    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2,
      0.1
    );

    // 转换
    const dataUrl = await toPng(viewportElement, {
      backgroundColor: "#ffffff",
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });

    // 下载
    const suffix = selectedNodes.length > 0 ? "-selected" : "";
    const exportFileName = `${fileName}${suffix}.png`;
    downloadImage(dataUrl, exportFileName);

    message.success(
      selectedNodes.length > 0
        ? `已保存 ${selectedNodes.length} 个选中节点为图片`
        : `已保存全部 ${allNodes.length} 个节点为图片`
    );
  } catch (error) {
    console.error("保存图片失败:", error);
    message.error("保存图片失败");
  }
}
