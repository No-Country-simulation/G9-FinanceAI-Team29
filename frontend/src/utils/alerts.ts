import Swal from "sweetalert2"

const themedSwal = Swal.mixin({
  background: "#1e293b",
  color: "#f1f5f9",
  confirmButtonColor: "#2563eb",
  customClass: { popup: "rounded-2xl" },
})

export function mostrarError(titulo: string, texto?: string) {
  return themedSwal.fire({
    icon: "error",
    title: titulo,
    text: texto,
    confirmButtonText: "Entendido",
  })
}

export function mostrarExito(titulo: string, texto?: string) {
  return themedSwal.fire({
    icon: "success",
    title: titulo,
    text: texto,
    timer: 2500,
    showConfirmButton: false,
  })
}
