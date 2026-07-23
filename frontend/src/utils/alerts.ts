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
    customClass: { popup: 'rounded-2xl' },
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
