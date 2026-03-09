"use client";

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** Max width of the tooltip card (default: 20rem / 320px) */
  maxWidth?: string;
};

/**
 * Tooltip tipo tarjeta flotante al pasar el mouse.
 * Se renderiza en portal para no ser recortado por overflow en contenedores padres.
 */
export function Tooltip({ content, children, maxWidth = "20rem" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const el = wrapperRef.current;
    if (!el || typeof document === "undefined") return;
    const rect = el.getBoundingClientRect();
    const padding = 8;
    setPosition({
      top: rect.top - padding,
      left: rect.left + rect.width / 2,
    });
  };

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
  }, [visible]);

  const handleEnter = () => {
    const el = wrapperRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    setVisible(true);
  };

  const handleLeave = () => {
    setVisible(false);
  };

  const tooltipContent =
    typeof document !== "undefined" &&
    visible &&
    createPortal(
      <div
        className="fixed z-[9999] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-xl whitespace-normal"
        style={{
          maxWidth,
          left: position.left,
          top: position.top,
          transform: "translate(-50%, -100%)",
          pointerEvents: "none",
          marginTop: "-4px",
        }}
        role="tooltip"
      >
        {typeof content === "string" ? content : content}
      </div>,
      document.body
    );

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {tooltipContent}
    </div>
  );
}
