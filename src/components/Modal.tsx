"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";

export default function Modal({ open, title, onClose, children, kind = "", onKeyDown }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; kind?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDialogElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const active = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      active?.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog ref={ref} className={`modal ${kind}`} aria-label={title} onKeyDown={onKeyDown}
    onCancel={(e) => { e.preventDefault(); onClose(); }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-panel">
      <div className="modal-top"><span className="eyebrow">GIRL PRINTS / DIRECT</span><button autoFocus className="icon-button modal-close" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></button></div>
      {children}
    </div>
  </dialog>;
}
