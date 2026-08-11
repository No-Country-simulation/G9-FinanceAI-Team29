interface StreakIconProps {
  streak: number;
  className?: string;
  /** Cuenta a partir de la cual se muestra el fuego en capas (rojo/naranja/amarillo). */
  fireAt?: number;
  /** Cuenta a partir de la cual el fuego en capas se vuelve morado. */
  purpleAt?: number;
}

const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

// Bottom-anchor point of the flame silhouette, used to nest layered copies.
const ANCHOR = { x: 12, y: 19.5 };

function LayeredFlame({ colors }: { colors: [string, string, string] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {colors.map((color, i) => {
        const scale = 1 - i * 0.28;
        return (
          <g
            key={i}
            transform={`translate(${ANCHOR.x} ${ANCHOR.y}) scale(${scale}) translate(${-ANCHOR.x} ${-ANCHOR.y})`}
          >
            <path d={FLAME_PATH} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

function ColdIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {[0, 60, 120].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 12 12)`}>
          <line x1="12" y1="2.5" x2="12" y2="21.5" />
          <path d="M12 6.5 L9 4.5 M12 6.5 L15 4.5" />
          <path d="M12 17.5 L9 19.5 M12 17.5 L15 19.5" />
        </g>
      ))}
    </svg>
  );
}

export default function StreakIcon({ streak, className, fireAt = 10, purpleAt = 100 }: StreakIconProps) {
  if (streak <= 0) {
    return (
      <span className={`text-sky-400 dark:text-sky-300 ${className ?? ''}`}>
        <ColdIcon />
      </span>
    );
  }

  if (streak < fireAt) {
    return (
      <span className={`flex items-center justify-center text-3xl leading-none ${className ?? ''}`}>
        🔥
      </span>
    );
  }

  if (streak < purpleAt) {
    return (
      <span className={className}>
        <LayeredFlame colors={['#ef4444', '#f97316', '#facc15']} />
      </span>
    );
  }

  return (
    <span className={className}>
      <LayeredFlame colors={['#6d28d9', '#a855f7', '#e9d5ff']} />
    </span>
  );
}
