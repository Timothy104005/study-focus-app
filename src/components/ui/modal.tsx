"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="section-header">
          <div className="stack-xs">
            <h2 id="modal-title" className="section-title">
              {title}
            </h2>
            {description ? (
              <p className="section-description">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="small" onClick={onClose}>
            關閉
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
