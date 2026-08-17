import { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Modal } from '../ui/modal';
import Button from '../ui/button/Button';
import { recortarImagen } from '../../utils/cropImage';

interface AvatarCropModalProps {
  imagenSrc: string;
  onConfirmar: (imagen: Blob) => void;
  onCancelar: () => void;
  procesando?: boolean;
}

export default function AvatarCropModal({
  imagenSrc,
  onConfirmar,
  onCancelar,
  procesando = false,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixeles, setAreaPixeles] = useState<Area | null>(null);

  const onCropComplete = useCallback((_areaPorcentaje: Area, areaEnPixeles: Area) => {
    setAreaPixeles(areaEnPixeles);
  }, []);

  const confirmar = async () => {
    if (!areaPixeles) return;
    const blob = await recortarImagen(imagenSrc, areaPixeles);
    onConfirmar(blob);
  };

  return (
    <Modal isOpen onClose={onCancelar} className="m-4 max-w-[420px]" showCloseButton={!procesando}>
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-5 dark:bg-gray-900">
        <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Ajustar foto</h4>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Arrastrá para mover y usá el control para acercar o alejar.
        </p>

        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
          <Cropper
            image={imagenSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-4 w-full accent-brand-500"
          aria-label="Zoom"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void confirmar()} disabled={procesando || !areaPixeles}>
            {procesando ? 'Subiendo...' : 'Usar esta foto'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
