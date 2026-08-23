import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

const SM = "Motion";

type Props = {
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
};

// El .riv trae la state machine "Motion" con 5 booleanos (zonas del cursor).
// Prendemos el de la zona donde está el mouse para que la patita salga hacia ese lado.
export default function RiveButton({ type = "button", onClick, className = "" }: Props) {
  const { rive, RiveComponent } = useRive({
    src: "/rive/boton-gato.riv",
    stateMachines: SM,
    autoplay: true,
  });

  // de izquierda a derecha
  const zonas = [
    useStateMachineInput(rive, SM, "isHoverLeft2"),
    useStateMachineInput(rive, SM, "isHoverLeft"),
    useStateMachineInput(rive, SM, "isHovercenter"),
    useStateMachineInput(rive, SM, "isHoverRight"),
    useStateMachineInput(rive, SM, "isHoverRight2"),
  ];

  const activarZona = (idx: number | null) => {
    zonas.forEach((z, i) => {
      if (z) z.value = i === idx;
    });
  };

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width; // 0..1
    const idx = Math.min(4, Math.max(0, Math.floor(ratio * 5)));
    activarZona(idx);
  };

  return (
    <button
      type={type}
      onClick={onClick}
      aria-label="Get started"
      onMouseMove={handleMove}
      onMouseLeave={() => activarZona(null)}
      className={`relative h-[110px] w-full ${className}`}
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </button>
  );
}
