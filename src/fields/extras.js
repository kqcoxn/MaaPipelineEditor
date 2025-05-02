export const extraFields = {
  rate_limit: {
    type: "number",
    description: `识别速率限制，单位毫秒。可选，默认 1000 。
      每轮识别 next + interrupt 最低消耗 rate_limit 毫秒，不足的时间将会 sleep 等待。
      `,
    default: 2000,
  },
  timeout: {
    type: "number",
    description: `识别超时时间，毫秒。可选，默认 20 * 1000 。
        具体逻辑为 while(!timeout) { foreach(next + interrupt); sleep_until(rate_limit); } 。
      `,
    default: 3 * 1000,
  },
  pre_delay: {
    type: "number",
    description: `识别到 到 执行动作前 的延迟，毫秒。可选，默认 200 。
        推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。
        `,
    default: 400,
  },
  post_delay: {
    type: "number",
    description: `执行动作后 到 识别 next 的延迟，毫秒。可选，默认 200 。
          推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。
          `,
    default: 1000,
  },
  inverse: {
    type: "boolean",
    description: `反转识别结果，识别到了当做没识别到，没识别到的当做识别到了。可选，默认 false 。
        请注意由此识别出的节点，Click 等动作的点击自身将失效（因为实际并没有识别到东西），若有需求可单独设置 target 。
        `,
    default: true,
  },
  enabled: {
    type: "boolean",
    description: `是否启用该 node。可选，默认 true 。
        若为 false，其他 node 的 next 列表中的该 node 会被跳过，既不会被识别也不会被执行。
        `,
    default: false,
  },
  pre_wait_freezes: {
    type: "number",
    description: `识别到 到 执行动作前，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。
        连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。
        若为 object，可设置更多参数，详见 等待画面静止。
        具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。
        `,
    default: 0,
  },
  post_wait_freezes: {
    type: "number",
    description: `行动动作后 到 识别 next，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。
        其余逻辑同 pre_wait_freezes。
        `,
    default: 0,
  },
};
