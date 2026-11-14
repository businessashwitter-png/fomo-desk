// Hand-drawn canvas line chart (STEP 10): DPR aware, #00d35a line, gradient under, dashed start line,
// marks stacked so labels never overlap. No libraries.
window.drawChart = function (canvas, points, opts) {
  opts = opts || {};
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (!points || points.length < 2) {
    g.fillStyle = "rgba(235,235,245,0.3)"; g.font = "15px -apple-system,system-ui"; g.textAlign = "center";
    g.fillText(opts.empty || "Waiting for the first trade", w / 2, h / 2); return;
  }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys, opts.start ?? Infinity), y1 = Math.max(...ys, opts.start ?? -Infinity);
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  const padT = 34, padB = 10, X = t => (x1 === x0 ? w / 2 : (t - x0) / (x1 - x0) * (w - 4) + 2), Y = v => padT + (1 - (v - y0) / (y1 - y0)) * (h - padT - padB);
  const color = opts.color || "#00d35a";
  if (opts.start != null) {
    g.setLineDash([4, 4]); g.strokeStyle = "rgba(235,235,245,0.3)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, Y(opts.start)); g.lineTo(w, Y(opts.start)); g.stroke(); g.setLineDash([]);
  }
  const grad = g.createLinearGradient(0, padT, 0, h);
  grad.addColorStop(0, color + "40"); grad.addColorStop(1, color + "00");
  g.beginPath(); points.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
  g.lineTo(X(x1), h); g.lineTo(X(x0), h); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); points.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
  g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
  if (opts.exitLine != null) {
    g.setLineDash([6, 4]); g.strokeStyle = "#ff9f0a"; g.beginPath(); g.moveTo(0, Y(opts.exitLine)); g.lineTo(w, Y(opts.exitLine)); g.stroke(); g.setLineDash([]);
  }
  const placed = [];
  g.font = "600 11px ui-monospace,Menlo,monospace";
  (opts.marks || []).filter(m => m.t >= x0 && m.t <= x1).forEach(m => {
    const tw = g.measureText(m.label).width + 10; let x = Math.min(Math.max(X(m.t) - tw / 2, 0), w - tw), row = 0;
    while (placed.some(p => p.row === row && x < p.x + p.w + 4 && x + tw + 4 > p.x)) row++;
    placed.push({x, w: tw, row});
    const y = 4 + row * 18; g.fillStyle = m.color; g.globalAlpha = 0.18; g.fillRect(x, y, tw, 16); g.globalAlpha = 1;
    g.fillText(m.label, x + 5, y + 12);
  });
};
