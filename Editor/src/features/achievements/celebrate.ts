/**
 * 成就解锁庆祝动效库
 * 基于 canvas-confetti 实现多种效果，每次解锁随机抽取一种播放。
 * 新增效果只需向 EFFECTS 追加一项。
 */

type ConfettiFn = typeof import("canvas-confetti");

type CelebrationEffect = (confetti: ConfettiFn) => void;

/**统一画层级，保证盖过弹窗与通知 */
const Z_INDEX = 1200;
const PALETTE = ["#faad14", "#f5222d", "#fa8c16", "#13c2c2", "#ffffff"];

/**经典顶部爆发 */
const burst: CelebrationEffect = (confetti) => {
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.15 },
    colors: PALETTE,
    zIndex: Z_INDEX,
  });
};

/**双侧底部礼炮 */
const sideCannons: CelebrationEffect = (confetti) => {
  const base = {
    particleCount: 70,
    spread: 60,
    startVelocity: 55,
    colors: PALETTE,
    zIndex: Z_INDEX,
  };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.8 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.8 } });
};

/**全屏烟花：短时间内随机位置连发 */
const fireworks: CelebrationEffect = (confetti) => {
  const end = Date.now() + 1000;
  const timer = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(timer);
      return;
    }
    confetti({
      particleCount: 30,
      startVelocity: 28,
      spread: 360,
      ticks: 70,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.1 + Math.random() * 0.3 },
      colors: PALETTE,
      zIndex: Z_INDEX,
    });
  }, 220);
};

/**星星雨：多尺寸星星一次散落 */
const starShower: CelebrationEffect = (confetti) => {
  const base = {
    spread: 120,
    ticks: 200,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 24,
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
    zIndex: Z_INDEX,
  };
  confetti({ ...base, particleCount: 40, scalar: 1.2, shapes: ["star"], origin: { y: 0.2 } });
  confetti({ ...base, particleCount: 20, scalar: 0.75, shapes: ["star"], origin: { y: 0.25 } });
  confetti({ ...base, particleCount: 10, scalar: 2, shapes: ["star"], origin: { y: 0.15 } });
};

/**彩纸雨：从顶部持续飘落 */
const confettiRain: CelebrationEffect = (confetti) => {
  const end = Date.now() + 1200;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 90,
      spread: 70,
      startVelocity: 12,
      gravity: 0.7,
      origin: { x: Math.random(), y: -0.05 },
      colors: PALETTE,
      zIndex: Z_INDEX,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
};

/**奖杯表情喷发 */
const emojiBurst: CelebrationEffect = (confetti) => {
  confetti({
    particleCount: 40,
    spread: 100,
    startVelocity: 32,
    scalar: 2,
    origin: { y: 0.3 },
    shapes: [
      confetti.shapeFromText({ text: "🏆", scalar: 2 }),
      confetti.shapeFromText({ text: "✨", scalar: 2 }),
    ],
    zIndex: Z_INDEX,
  });
};

const EFFECTS: CelebrationEffect[] = [
  burst,
  sideCannons,
  fireworks,
  starShower,
  confettiRain,
  emojiBurst,
];

/**随机播放一种解锁庆祝动效 */
export function celebrateAchievementUnlock(): void {
  import("canvas-confetti")
    .then(({ default: confetti }) => {
      const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
      effect(confetti);
    })
    .catch((error) => {
      console.error("[Achievement] 加载庆祝动效失败:", error);
    });
}
