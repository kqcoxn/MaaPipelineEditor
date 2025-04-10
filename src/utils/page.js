export default class Page {
  // 跳转页面
  static go(url, blank = true) {
    window.open(url, blank ? "_blank" : "_self");
  }

  // 刷新页面
  static refresh() {
    window.location.reload();
  }

  static focus(
    viewer,
    { viewport, position, padding } = {
      viewport: false,
      position: { x: 0, y: 0 },
      padding: 0,
    }
  ) {
    if (!viewport) return;
    const container = document.querySelector(".vue-flow__transformationpane");
    container.classList.add("vue-flow-transition");
    if (viewport) {
      viewer.fitView({ padding });
    } else {
      const attr = viewer.getViewport();
      viewer.setViewport({
        x: -position.x,
        y: -position.y,
        zoom: attr.zoom,
      });
    }
    setTimeout(() => {
      container.classList.remove("vue-flow-transition");
    }, 500);
  }
}
