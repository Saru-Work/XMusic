import { X } from "lucide-react";
import { type ReactNode } from "react";
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}
const Modal = ({ open, onClose, children }: ModalProps) => {
  return (
    <div
      onClick={onClose}
      className={`w-screen h-screen fixed inset-0 flex justify-center items-center ${open ? " visible bg-black/40" : " invisible"}`}
    >
      <div
        className="bg-white"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {children}
        <X onClick={onClose} className="absolute top-2 right-2 p-2" />
      </div>
    </div>
  );
};

export default Modal;
