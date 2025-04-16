var vueFlowInstance = null;

export default class Page {
  // 跳转页面
  static go(url, blank = true) {
    window.open(url, blank ? "_blank" : "_self");
  }

  // 刷新页面
  static refresh() {
    window.location.reload();
  }

  // 聚焦
  static updateVueFlow(instance) {
    vueFlowInstance = instance;
  }
  static focus(
    { position, padding, timeout } = {
      position: { x: 0, y: 0 },
      padding: 0,
      timeout: 0,
    }
  ) {
    if (!padding || !vueFlowInstance) return;
    setTimeout(() => {
      const container = document.querySelector(".vue-flow__transformationpane");
      container.classList.add("vue-flow-transition");
      if (padding) {
        vueFlowInstance.fitView({ padding });
      } else {
        const attr = vueFlowInstance.getViewport();
        vueFlowInstance.setViewport({
          x: -position.x,
          y: -position.y,
          zoom: attr.zoom,
        });
      }
      setTimeout(() => {
        container.classList.remove("vue-flow-transition");
      }, 500);
    }, timeout);
  }
}
