// Adapted from the Golden Thread UI skill's purchased V14 liquid theme helper.
// Framework state stays in React; only the View Transition snapshot is animated.
function path(points: number[][]) {
  const n = points.length,
    f = (v: number) => v.toFixed(1);
  let d = `M ${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n],
      b = points[i],
      c = points[(i + 1) % n],
      e = points[(i + 2) % n];
    d += ` C ${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d + " Z";
}
export function blobFrames(x: number, y: number, w: number, h: number) {
  const radius =
    Math.max(
      Math.hypot(x, y),
      Math.hypot(w - x, y),
      Math.hypot(x, h - y),
      Math.hypot(w - x, h - y),
    ) /
      0.76 +
    60;
  const phase = Array.from({ length: 10 }, () => Math.random() * Math.PI * 2),
    spin = Math.random() * Math.PI * 2;
  return Array.from({ length: 31 }, (_, s) => {
    const p = s / 30,
      ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
      r = Math.max(2, radius * ease),
      t = p * Math.PI * 2.2;
    const points = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + spin + p * 0.9,
        k =
          1 +
          0.24 *
            (0.55 * Math.sin(2 * a + phase[i] + t) +
              0.3 * Math.sin(3 * a - t * 1.4 + phase[(i + 3) % 10]) +
              0.15 * Math.sin(5 * a + t * 0.7));
      return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k];
    });
    return { clipPath: `path("${path(points)}")` };
  });
}
export async function liquidSwitch(x: number, y: number, apply: () => void) {
  const root = document.documentElement;
  if (
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    root.dataset.motion === "reduced"
  ) {
    apply();
    return;
  }
  root.classList.add("liquid-switching");
  const transition = document.startViewTransition(apply);
  try {
    await transition.ready;
    root.animate(blobFrames(x, y, innerWidth, innerHeight), {
      duration: 1150,
      easing: "linear",
      pseudoElement: "::view-transition-new(root)",
    });
    await transition.finished;
  } catch {
    /* Theme was already applied; unsupported animation remains usable. */
  } finally {
    root.classList.remove("liquid-switching");
  }
}
