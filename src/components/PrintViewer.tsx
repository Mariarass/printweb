"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { categoryLabels, money, type Print } from "@/lib/types";
import Modal from "./Modal";
import Icon from "./Icon";
import SizePicker from "./SizePicker";

export default function PrintViewer({ print, initialVariantId, demo, onClose, add }: {
  print: Print;
  initialVariantId: string;
  demo: boolean;
  onClose: () => void;
  add: (print: Print, variantId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [variantId, setVariantId] = useState(initialVariantId);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const images = [...new Set([print.image, ...(print.images ?? [])].filter((src) => src.trim()))];
  const variant = print.variants.find((v) => v.id === variantId) ?? print.variants[0];
  const canBrowse = images.length > 1;

  function move(direction: number) {
    setIndex((current) => (current + direction + images.length) % images.length);
  }

  return <Modal open title={`View ${print.title}`} kind="print-viewer" onClose={onClose}
    onKeyDown={(event) => {
      // Arrow keys must retain their normal behavior inside size selectors.
      if ((event.target as HTMLElement).closest("select,input,textarea") || event.altKey || event.metaKey || event.ctrlKey) return;
      if (canBrowse && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    }}>
    <div className="viewer-layout">
      <div className="viewer-gallery">
        <div className="viewer-artwork"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) { gesture.current = null; return; }
            gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = gesture.current;
            gesture.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (canBrowse && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => { gesture.current = null; }}
          onLostPointerCapture={() => { gesture.current = null; }}>
          <img key={images[index]} src={images[index]} alt={`${print.title} — photo ${index + 1} of ${images.length}`} width={480} height={600} draggable={false} />
          <span className="viewer-art-label" aria-hidden="true">GIRL PRINTS / THE POSTER EDIT</span>
        </div>
        <div className="viewer-navigation">
          <button className="icon-button gallery-arrow" disabled={!canBrowse} aria-label="Previous photo" onClick={() => move(-1)}><Icon name="left" /></button>
          <div><span className="eyebrow" role="status">PHOTO {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span><p>{canBrowse ? "Swipe or use arrows to view photos" : "Your selected print"}</p></div>
          <button className="icon-button gallery-arrow" disabled={!canBrowse} aria-label="Next photo" onClick={() => move(1)}><Icon name="right" /></button>
        </div>
        {canBrowse && <div className="viewer-thumbnails" role="group" aria-label={`Photos of ${print.title}`}>
          {images.map((src, photoIndex) => <button key={src} aria-label={`View photo ${photoIndex + 1} of ${print.title}`} aria-pressed={index === photoIndex} onClick={() => setIndex(photoIndex)}>
            <img src={src} alt="" width={48} height={60} loading="lazy" draggable={false} />
          </button>)}
        </div>}
        {demo && <p className="viewer-demo-note">Preview images: artwork, detail & room mockup.</p>}
      </div>
      <div className="viewer-details">
        <p className="eyebrow">{categoryLabels[print.category]} / ART PRINT</p>
        <h2>{print.title}</h2>
        <p className="viewer-price">{money(variant.priceCents)}</p>
        <p className="viewer-description">{print.description}</p>
        <SizePicker variants={print.variants} value={variant.id} onChange={setVariantId} />
        <button className="primary viewer-add" onClick={() => add(print, variant.id)}>Add to bag <Icon name="plus" /></button>
        <p className="viewer-note">Unframed art print. Frame and styling aren’t included.</p>
      </div>
    </div>
  </Modal>;
}
