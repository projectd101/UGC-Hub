import { useEffect, useRef } from "react";

function gearPath({ teeth, outerR, innerR, holeR, cx = 0, cy = 0 }) {
  const toothAngle = (Math.PI * 2) / teeth;
  const points = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = i * toothAngle;
    const a1 = a0 + toothAngle * 0.28;
    const a2 = a0 + toothAngle * 0.5;
    const a3 = a0 + toothAngle * 0.78;
    points.push([a0, innerR]);
    points.push([a1, outerR]);
    points.push([a2, outerR]);
    points.push([a3, innerR]);
  }
  let d = "";
  points.forEach(([a, r], i) => {
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `;
  });
  d += "Z ";
  const holeSteps = 24;
  for (let i = 0; i <= holeSteps; i++) {
    const a = (i / holeSteps) * Math.PI * 2;
    const x = cx + Math.cos(a) * holeR;
    const y = cy + Math.sin(a) * holeR;
    d += i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `;
  }
  d += "Z";
  return d;
}

function Gear({ def, angleRef }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const tick = () => {
      if (ref.current) {
        const angle = angleRef.current * def.direction * def.speedFactor + def.phase;
        ref.current.setAttribute("transform", `translate(${def.x} ${def.y}) rotate(${angle})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [def, angleRef]);

  const d = gearPath({
    teeth: def.teeth,
    outerR: def.size,
    innerR: def.size * 0.82,
    holeR: def.size * 0.32,
  });

  return (
    <g ref={ref} opacity={def.opacity ?? 1}>
      <path d={d} fill={def.color} fillRule="evenodd" />
    </g>
  );
}

export default function GearField({ gears, className, style, viewBox = "0 0 100 100" }) {
  const angleRef = useRef(0);

  useEffect(() => {
    let raf;
    const update = () => {
      const DEG_PER_PX = 0.12;
      angleRef.current = window.scrollY * DEG_PER_PX;
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <svg
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {gears.map((def, i) => (
        <Gear key={i} def={def} angleRef={angleRef} />
      ))}
    </svg>
  );
}