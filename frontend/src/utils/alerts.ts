import Swal from 'sweetalert2';

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

function themedSwal() {
  const dark = isDarkMode();
  return Swal.mixin({
    background: dark ? '#1e2635' : '#ffffff',
    color: dark ? '#e5e7eb' : '#1f2937',
    confirmButtonColor: '#465fff',
    cancelButtonColor: dark ? '#364153' : '#6b7280',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-lg px-5 py-2.5',
      cancelButton: 'rounded-lg px-5 py-2.5',
      input: 'rounded-lg',
    },
    buttonsStyling: true,
  });
}

export function mostrarError(titulo: string, texto?: string) {
  return themedSwal().fire({
    icon: 'error',
    title: titulo,
    text: texto,
    confirmButtonText: 'Entendido',
  });
}

export function mostrarExito(titulo: string, texto?: string) {
  return themedSwal().fire({
    icon: 'success',
    title: titulo,
    text: texto,
    timer: 2500,
    showConfirmButton: false,
  });
}

export async function solicitarMonto(
  titulo: string,
  texto?: string,
): Promise<number | null> {
  const result = await themedSwal().fire({
    icon: 'info',
    title: titulo,
    text: texto,
    input: 'number',
    inputPlaceholder: 'Ingresá el monto en USD',
    inputAttributes: {
      min: '0.01',
      step: '0.01',
      inputmode: 'decimal',
    },
    showCancelButton: true,
    confirmButtonText: 'Agregar ahorro',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusConfirm: false,
    preConfirm: (value: string) => {
      const amount = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) {
        Swal.showValidationMessage('Ingresá un monto mayor que cero.');
        return false;
      }
      return amount;
    },
  });

  return result.isConfirmed ? Number(result.value) : null;
}

export function mostrarInfo(titulo: string, texto?: string) {
  return themedSwal().fire({
    icon: 'info',
    title: titulo,
    text: texto,
    confirmButtonText: 'Entendido',
  });
}

export async function confirmarAccion(
  titulo: string,
  texto?: string,
  confirmButtonText = 'Confirmar',
): Promise<boolean> {
  const result = await themedSwal().fire({
    icon: 'warning',
    title: titulo,
    text: texto,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Volver',
    confirmButtonColor: '#d92d20',
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
}

export async function confirmarCierreSesion(): Promise<boolean> {
  const result = await themedSwal().fire({
    imageUrl: '/images/mascot/finsight-bird-goodbye.png',
    imageAlt: 'Finsi se despide',
    imageHeight: 190,
    title: '¿Nos despedimos por ahora?',
    text: 'Tu información quedará guardada para cuando regreses.',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Seguir aquí',
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
}
