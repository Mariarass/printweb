"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { money, type PrintVariant } from "@/lib/types";
import Icon from "./Icon";

export default function SizePicker({ variants, value, onChange }: {
  variants: PrintVariant[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ side: "top" | "bottom"; top: number; maxHeight: number } | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selectedIndex = Math.max(0, variants.findIndex((variant) => variant.id === value));
  const selected = variants[selectedIndex];

  useLayoutEffect(() => {
    if (!open || !root.current || !trigger.current || !menu.current) return;
    const container = root.current;
    const button = trigger.current;
    const list = menu.current;
    const dialog = container.closest("dialog");
    const header = dialog?.querySelector<HTMLElement>(".modal-top");
    const viewport = window.visualViewport;
    let frame = 0;

    function position() {
      const rect = button.getBoundingClientRect();
      const parent = container.getBoundingClientRect();
      const boundary = dialog?.getBoundingClientRect();
      const screenTop = viewport?.offsetTop ?? 0;
      const screenBottom = screenTop + (viewport?.height ?? window.innerHeight);
      // Stay inside both the visible viewport and the scrollable dialog.
      let upper = Math.max(screenTop, boundary?.top ?? screenTop) + 8;
      const lower = Math.min(screenBottom, boundary?.bottom ?? screenBottom) - 8;
      if (header && getComputedStyle(header).position === "sticky") {
        upper = Math.max(upper, header.getBoundingClientRect().bottom + 8);
      }
      const above = Math.max(0, rect.top - upper - 8);
      const below = Math.max(0, lower - rect.bottom - 8);
      const desired = Math.min(240, list.scrollHeight + list.offsetHeight - list.clientHeight);
      const side = below >= desired || below >= above ? "bottom" : "top";
      const maxHeight = Math.min(desired, side === "bottom" ? below : above);
      const top = side === "bottom" ? rect.bottom - parent.top + 8 : rect.top - parent.top - 8 - maxHeight;
      setPlacement((previous) => previous?.side === side && previous.top === top && previous.maxHeight === maxHeight
        ? previous : { side, top, maxHeight });
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    position();
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    observer.observe(list);
    if (dialog) observer.observe(dialog);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => options.current[selectedIndex]?.focus({ preventScroll: true }));
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, selectedIndex]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return <div className="viewer-size size-picker" ref={root}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={(event) => {
      // Keep size navigation separate from the print gallery.
      if (event.key.startsWith("Arrow")) event.stopPropagation();
      if (event.key === "Escape" && open) {
        event.preventDefault(); event.stopPropagation(); close();
      }
    }}>
    <span className="eyebrow" id={`${id}-label`}>Choose your size</span>
    <button type="button" ref={trigger} className="size-trigger" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-options` : undefined} aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
      <span id={`${id}-value`}>{selected.size}</span>
      <span className="size-trigger-end"><span>{money(selected.priceCents)}</span><Icon name="down" /></span>
    </button>
    {open && <div ref={menu} className="size-options" id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}
      data-side={placement?.side}
      style={{ top: placement?.top, maxHeight: placement?.maxHeight, visibility: placement ? "visible" : "hidden" }}
      onKeyDown={(event) => {
        const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
        let next = current;
        if (event.key === "ArrowDown") next = (current + 1) % variants.length;
        else if (event.key === "ArrowUp") next = (current - 1 + variants.length) % variants.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = variants.length - 1;
        else return;
        event.preventDefault(); event.stopPropagation(); options.current[next]?.focus();
      }}>
      {variants.map((variant, index) => <button type="button" role="option" key={variant.id}
        ref={(element) => { options.current[index] = element; }}
        aria-selected={variant.id === value} tabIndex={variant.id === value ? 0 : -1}
        onClick={() => { onChange(variant.id); close(); }}>
        <span className="size-option-copy"><strong>{variant.size}</strong><span>Unframed print</span></span>
        <span className="size-option-price">{money(variant.priceCents)}</span>
        <span className="size-check">{variant.id === value && <Icon name="check" />}</span>
      </button>)}
    </div>}
  </div>;
}
