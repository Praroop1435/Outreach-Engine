"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const EXIT_MS = 220;

/** Keeps an element mounted long enough to play its exit animation. */
export function usePresence(open: boolean, exitMs = EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames so the browser paints the "from" state before transitioning
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible };
}

/** Remembers the last non-null value so closing panels keep their content while animating out. */
export function useLastDefined<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(value ?? null);
  if (value != null) ref.current = value;
  return value ?? ref.current;
}

function useOverlayBehaviour(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, description, icon, headerActions, footer, size = 'lg', bodyClassName, children }: ModalProps) {
  const { mounted, visible } = usePresence(open);
  useOverlayBehaviour(open, onClose);
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[3px] transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`relative w-full ${SIZES[size]} bg-white sm:rounded-2xl rounded-t-2xl border border-slate-200/80 flex flex-col max-h-[92vh] sm:max-h-[88vh]
          transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${visible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-6 sm:translate-y-2 sm:scale-[0.97]'}`}
        style={{ boxShadow: 'var(--shadow-float)' }}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h3>
              {description && <div className="mt-0.5 text-[13px] text-slate-500 truncate">{description}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto px-5 sm:px-6 py-5 ${bodyClassName || ''}`}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' }: ConfirmDialogProps) {
  const { mounted, visible } = usePresence(open, 180);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useOverlayBehaviour(open, onCancel);

  const danger = tone === 'danger';

  // Destructive actions start on Cancel so a stray Enter can't delete anything
  useEffect(() => {
    if (open) (danger ? cancelRef : confirmRef).current?.focus();
  }, [open, mounted, danger]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div
        onClick={onCancel}
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[3px] transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`relative w-full max-w-sm bg-white rounded-2xl border border-slate-200/80 p-5
          transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]'}`}
        style={{ boxShadow: 'var(--shadow-float)' }}
      >
        <div className="flex items-start gap-3.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4
            ${danger ? 'bg-rose-50 text-rose-600 ring-rose-50/60' : 'bg-brand-50 text-brand-600 ring-brand-50/60'}`}>
            <AlertTriangle className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 id="confirm-title" className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h3>
            {description && <div className="mt-1 text-[13px] leading-relaxed text-slate-500 break-words">{description}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn-secondary">{cancelLabel}</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className={`btn ${danger ? 'btn-destructive' : 'btn-primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Promise-based replacement for window.confirm: `if (!(await askConfirm({...}))) return;` and render `confirmDialog`. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const shown = useLastDefined(options);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>(resolve => { resolver.current = resolve; });
  }, []);

  const onCancel = useCallback(() => settle(false), [settle]);
  const onConfirm = useCallback(() => settle(true), [settle]);

  const confirmDialog = shown ? (
    <ConfirmDialog open={!!options} onConfirm={onConfirm} onCancel={onCancel} {...shown} />
  ) : null;

  return { askConfirm, confirmDialog };
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  widthClassName?: string;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, side = 'right', widthClassName = 'max-w-xl', children }: DrawerProps) {
  const { mounted, visible } = usePresence(open, 300);
  useOverlayBehaviour(open, onClose);
  if (!mounted) return null;

  const hidden = side === 'right' ? 'translate-x-full' : '-translate-x-full';
  return (
    <div className={`fixed inset-0 z-50 flex ${side === 'right' ? 'justify-end' : 'justify-start'}`} role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`relative h-full w-full ${widthClassName} bg-white flex flex-col
          ${side === 'right' ? 'border-l' : 'border-r'} border-slate-200/80
          transition-transform duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? 'translate-x-0' : hidden}`}
        style={{ boxShadow: 'var(--shadow-float)' }}
      >
        {children}
      </div>
    </div>
  );
}
