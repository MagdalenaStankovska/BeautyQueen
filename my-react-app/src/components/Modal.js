import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

// Locks page scroll while any overlay is open (supports nested overlays).
let openOverlays = 0;
export const useScrollLock = () => {
    useEffect(() => {
        openOverlays += 1;
        document.body.style.overflow = "hidden";
        return () => {
            openOverlays -= 1;
            if (openOverlays === 0) document.body.style.overflow = "";
        };
    }, []);
};

// Rendered into <body> through a portal: parents with backdrop-filter/transform would otherwise
// become the containing block for position:fixed and the dialog would be placed inside the card.
const Modal = ({ title, children, onClose, actions, wide = false }) => {
    useScrollLock();
    const dialogRef = useRef(null);

    // move keyboard focus into the dialog and give it back to the opener when closed
    useEffect(() => {
        const opener = document.activeElement;
        const first = dialogRef.current?.querySelector("textarea, input, select, button:not(.bq-modal-close)");
        (first || dialogRef.current)?.focus();
        return () => opener?.focus?.();
    }, []);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return createPortal(
        <div className="bq-modal-overlay" onClick={onClose}>
            <div
                ref={dialogRef}
                tabIndex={-1}
                className={`bq-modal ${wide ? "bq-modal-wide" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bq-modal-head">
                    {title && <h3 className="bq-modal-title">{title}</h3>}
                    <button className="bq-modal-close" onClick={onClose} aria-label="Затвори">×</button>
                </div>
                <div className="bq-modal-body">{children}</div>
                {actions && <div className="bq-modal-actions">{actions}</div>}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
