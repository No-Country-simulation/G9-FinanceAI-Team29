import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Modal } from "../ui/modal";
import { SUPPORT_SUCCESS_EVENT } from "../../utils/supportSuccess";

export default function SupportSuccessModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openModal = () => setIsOpen(true);
    window.addEventListener(SUPPORT_SUCCESS_EVENT, openModal);

    return () => {
      window.removeEventListener(SUPPORT_SUCCESS_EVENT, openModal);
    };
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} className="m-4 max-w-[472px] p-6 sm:p-8">
      <div className="mx-auto text-center">
        <div className="relative mx-auto h-64 w-full max-w-[360px] sm:h-72" aria-hidden="true">
          <img
            src="/images/mascot/finsight-bird-success-like-dark.png"
            alt=""
            className="absolute inset-y-0 left-[65%] z-10 h-full w-auto max-w-none -translate-x-1/2 object-contain drop-shadow-xl dark:hidden"
          />
          <img
            src="/images/mascot/finsight-bird-success-like-light.png"
            alt=""
            className="absolute inset-y-0 left-[65%] z-10 hidden h-full w-auto max-w-none -translate-x-1/2 object-contain drop-shadow-xl dark:block"
          />
          <img
            src="/images/error/success.svg"
            alt=""
            className="absolute left-[12%] top-[36%] h-40 w-40 dark:hidden"
          />
          <img
            src="/images/error/success-dark.svg"
            alt=""
            className="absolute left-[12%] top-[36%] hidden h-40 w-40 dark:block"
          />
        </div>
        <h2 className="mb-3 mt-6 text-title-sm font-bold text-gray-800 dark:text-white/90">
          Correo de soporte listo
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
          Se abrió tu cliente de correo para contactar al equipo. Cuando lo envíes, soporte recibirá tu solicitud.
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
          >
            Entendido
          </button>
          <Link
            to="/soporte"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.04]"
          >
            Ver soporte
          </Link>
        </div>
      </div>
    </Modal>
  );
}
