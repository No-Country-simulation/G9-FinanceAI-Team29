import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import TeamModalContent from "./TeamModalContent";
import TeamAuroraBackdrop from "./TeamAuroraBackdrop";

export default function TeamCredit({ className = "" }: { className?: string }) {
  const { isOpen, openModal, closeModal } = useModal();

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`font-medium underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-500 dark:hover:text-brand-400 ${className}`}
      >
        TwentyNineDevs
      </button>
      {isOpen && <TeamAuroraBackdrop />}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="m-4 max-w-[92vw] sm:max-w-[640px] lg:max-w-[880px] xl:max-w-[1040px]"
      >
        <TeamModalContent />
      </Modal>
    </>
  );
}
