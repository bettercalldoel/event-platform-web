"use client";

import React, { useRef } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  trigger,
}: {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        className="rounded-2xl p-0 w-[92vw] max-w-md bg-[var(--surface)] text-white border border-white/10"
      >
        <div className="p-5">
          <div className="text-lg font-semibold">{title}</div>
          {description && <div className="mt-2 text-sm text-[var(--subtext)]">{description}</div>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={close}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10"
            >
              {cancelText}
            </button>
            <button
              onClick={async () => {
                await onConfirm();
                close();
              }}
              className="px-4 py-2 rounded-lg bg-[var(--primary)]/25 hover:bg-[var(--primary)]/35 border border-[var(--primary)]/40"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
