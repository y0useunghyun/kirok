// 화면과 상관없는 계산만 모아 둔다. 브라우저와 node 테스트가 같이 쓴다.
(function (root) {
  function fitWithin(w, h, max) {
    const scale = Math.min(1, max / Math.max(w, h));
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  // 그림을 그린 범위(최소·최대 좌표)를 넓혀 간다
  function grow(b, x, y) {
    if (!b) return { x0: x, y0: y, x1: x, y1: y };
    return { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) };
  }

  // 그린 범위 + 여백을 판 안으로 잘라낸 사각형
  function crop(b, pad, w, h) {
    const x = Math.max(0, b.x0 - pad);
    const y = Math.max(0, b.y0 - pad);
    return { x, y, w: Math.min(w, b.x1 + pad) - x, h: Math.min(h, b.y1 + pad) - y };
  }

  const api = { fitWithin, clamp01, grow, crop };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RecordCore = api;
})(globalThis);
