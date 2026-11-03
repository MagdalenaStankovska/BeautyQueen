import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "./Modal";
import "./Lightbox.css";

// Fullscreen photo viewer: arrows, keyboard, swipe, counter. Portaled to <body> so it always covers the screen.
const Lightbox = ({ images, index, onIndexChange, onClose, caption }) => {
    useScrollLock();
    const touchX = useRef(null);
    const count = images.length;

    const go = useCallback((delta) => onIndexChange((index + delta + count) % count), [index, count, onIndexChange]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go, onClose]);

    return createPortal(
        <div
            className="lightbox"
            onClick={onClose}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
                touchX.current = null;
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
                <span className="lightbox-counter">{index + 1} / {count}{caption ? ` · ${caption}` : ""}</span>
                <button className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Затвори">×</button>
            </div>

            <img
                key={images[index]}
                className="lightbox-img"
                src={images[index]}
                alt={caption || ""}
                onClick={(e) => e.stopPropagation()}
            />

            {count > 1 && (
                <>
                    <button
                        className="lightbox-btn lightbox-prev"
                        onClick={(e) => { e.stopPropagation(); go(-1); }}
                        aria-label="Претходна"
                    >
                        ‹
                    </button>
                    <button
                        className="lightbox-btn lightbox-next"
                        onClick={(e) => { e.stopPropagation(); go(1); }}
                        aria-label="Следна"
                    >
                        ›
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};

export default Lightbox;
