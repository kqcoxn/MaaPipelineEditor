// 预设颜色池（排除 next/#5ec697、error/#ec4899、jumpback/#f97316、norm/#2563eb）
// [background, text, border]
const PALETTE: [string, string, string][] = [
  ["#f3e5f5", "#6a1b9a", "#e1bee7"], // 紫
  ["#e0f7fa", "#00695c", "#b2ebf2"], // 青
  ["#fff8e1", "#f57f17", "#ffecb3"], // 琥珀
  ["#fbe9e7", "#bf360c", "#ffccbc"], // 深橙
  ["#e8eaf6", "#283593", "#c5cae9"], // 靛
  ["#f1f8e9", "#33691e", "#dcedc8"], // 浅绿
  ["#fce4ec", "#880e4f", "#f8bbd0"], // 深粉
  ["#e8f5e9", "#1b5e20", "#c8e6c9"], // 深绿
  ["#ede7f6", "#4527a0", "#d1c4e9"], // 深紫
  ["#e3f2fd", "#0d47a1", "#bbdefb"], // 深蓝
  ["#fff3e0", "#bf360c", "#ffe0b2"], // 橙褐
  ["#fafafa", "#212121", "#e0e0e0"], // 炭灰
];

function hashLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getFlowTagColor(label: string): { background: string; color: string; border: string } {
  const [background, color, border] = PALETTE[hashLabel(label) % PALETTE.length];
  return { background, color, border };
}
