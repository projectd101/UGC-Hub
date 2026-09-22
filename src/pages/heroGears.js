const BASE = 40;

function meshOffset(rA, rB, angleDeg) {
  const depth = 0.18 * ((rA + rB) / 2);
  const dist = rA + rB - depth;
  const rad = (angleDeg * Math.PI) / 180;
  return { dx: Math.cos(rad) * dist, dy: Math.sin(rad) * dist };
}

const g1 = { x: 88, y: 8, size: 7, teeth: 18, direction: 1, color: "#f1d9dc", opacity: 0.55, phase: 0 };
const g1b = meshOffset(g1.size, 4.2, 205);
const g2 = { x: 50, y: 32, size: 9, teeth: 24, direction: 1, color: "#ece6f7", opacity: 0.6, phase: 0 };
const g2b = meshOffset(g2.size, 5, -35);
const g2c = meshOffset(g2.size, 5, 35);
const g3 = { x: 22, y: 88, size: 8, teeth: 20, direction: -1, color: "#f3ded9", opacity: 0.5, phase: 5 };
const g3b = meshOffset(g3.size, 4.5, -20);

export const heroGears = [
  g1,
  { x: g1.x + g1b.dx, y: g1.y + g1b.dy, size: 4.2, teeth: 11, direction: -1, color: "#e9ccd1", opacity: 0.5, phase: 12 },
  g2,
  { x: g2.x + g2b.dx, y: g2.y + g2b.dy, size: 5, teeth: 13, direction: -1, color: "#e2d8f2", opacity: 0.55, phase: 20 },
  { x: g2.x + g2c.dx, y: g2.y + g2c.dy, size: 5, teeth: 13, direction: -1, color: "#e2d8f2", opacity: 0.55, phase: 40 },
  g3,
  { x: g3.x + g3b.dx, y: g3.y + g3b.dy, size: 4.5, teeth: 12, direction: 1, color: "#ecd0c8", opacity: 0.5, phase: 30 },
  { x: 82, y: 90, size: 6, teeth: 16, direction: 1, color: "#e6e0f5", opacity: 0.5, phase: 8 },
].map((g) => ({ ...g, speedFactor: BASE / g.teeth }));