export const actionFields = {
  DoNothing: {
    description: `什么都不做。`,
  },
  Click: {
    description: `点击。`,
    extras: {
      target: {
        type: "number[4]",
        description: `点击的位置。可选，默认 true 。
                true: 点击本节点中刚刚识别到的目标（即点击自身）。
                string: 填写节点名，点击之前执行过的某节点识别到的目标。
                array<int, 4>: 点击固定坐标区域内随机一点，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。
            `,
        default: [0, 0, 0, 0],
      },
      target_offset: {
        type: "number[4]",
        description: `在 target 的基础上额外移动再点击，四个值分别相加。可选，默认 [0, 0, 0, 0] 。`,
        default: [0, 0, 0, 0],
      },
    },
  },
  Swipe: {
    description: `线性滑动。`,
    extras: {
      begin: {
        type: "number[4]",
        description: `滑动起点。可选，默认 true 。值同上述 Click.target 。
                true: 点击本节点中刚刚识别到的目标（即点击自身）。
                string: 填写节点名，点击之前执行过的某节点识别到的目标。
                array<int, 4>: 点击固定坐标区域内随机一点，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。
            `,
        default: [0, 0, 0, 0],
      },
      begin_offset: {
        type: "number[4]",
        description: `在 begin 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。`,
        default: [0, 0, 0, 0],
      },
      end: {
        type: "number[4]",
        description: `滑动终点。可选，默认 true 。值同上述 Click.target 。
                true: 点击本节点中刚刚识别到的目标（即点击自身）。
                string: 填写节点名，点击之前执行过的某节点识别到的目标。
                array<int, 4>: 点击固定坐标区域内随机一点，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0]
                `,
        default: [0, 0, 0, 0],
      },
      end_offset: {
        required: true,
        type: "number[4]",
        description: `在 end 的基础上额外移动再作为终点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。`,
        default: [0, 0, 0, 0],
      },
      duration: {
        type: "number",
        description: `滑动持续时间，单位毫秒。可选，默认 200 。`,
        default: 200,
      },
    },
  },
  Key: {
    description: `按键。`,
    extras: {
      key: {
        required: true,
        type: "number[]",
        description: `要按的键，仅支持对应控制器的虚拟按键码。`,
        default: [],
      },
    },
  },
  InputText: {
    description: `输入文本。`,
    extras: {
      input_text: {
        required: true,
        type: "string",
        description: `要输入的文本，部分控制器仅支持 ascii 。`,
        default: "",
      },
    },
  },
  StartApp: {
    description: `启动 App 。`,
    extras: {
      package: {
        required: true,
        type: "string",
        description: `启动入口。必选。
                需要填入 package name 或 activity ，例如 com.hypergryph.arknights 或 com.hypergryph.arknights/com.u8.sdk.U8UnityContext 。`,
        default: "",
      },
    },
  },
  StopApp: {
    description: `关闭 App 。`,
    extras: {
      package: {
        required: true,
        type: "string",
        description: `要关闭的程序。必选。
                需要填入 package name ，例如 com.hypergryph.arknights 。`,
        default: "",
      },
    },
  },
  StopTask: {
    description: `停止当前任务链（MaaTaskerPostTask 传入的单个任务链）。`,
  },
  Custom: {
    description: `执行通过 MaaResourceRegisterCustomAction 接口传入的动作句柄。`,
    extras: {
      custom_action: {
        required: true,
        type: "string",
        description: `动作名，同注册接口传入的识别器名。同时会通过 MaaCustomActionCallback.custom_action_name 传出。必选。`,
        default: "",
      },
      custom_action_param: {
        type: "object",
        description: `动作参数，任意类型，会通过 MaaCustomActionCallback.custom_action_param 传出。可选，默认空 json，即 {} 。`,
        default: {},
      },
      target: {
        type: "number[4]",
        description: `同 Click.target，会通过 MaaCustomActionCallback.box 传出。可选，默认 true 。
                true: 点击本节点中刚刚识别到的目标（即点击自身）。
                string: 填写节点名，点击之前执行过的某节点识别到的目标。
                array<int, 4>: 点击固定坐标区域内随机一点，[x, y, w, h]，若希望全屏
                可设为 [0, 0, 0, 0] 。
                `,
        default: [0, 0, 0, 0],
      },
      target_offset: {
        type: "number[4]",
        description: `同 Click.target_offset 。
        `,
        default: [0, 0, 0, 0],
      },
    },
  },
};
