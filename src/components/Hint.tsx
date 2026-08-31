import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HintProps = {
  text: string;
  children: ReactNode;
  delayMs?: number;
  fill?: boolean;
};

export function Hint({ text, children, delayMs = 520, fill = false }: HintProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, above: false });

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function place() {
    const node = wrapRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const estimatedWidth = 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - estimatedWidth - 8);
    const above = rect.bottom + 96 > window.innerHeight && rect.top > 96;
    setCoords({
      left,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
    setVisible(true);
  }

  function handleEnter() {
    clearTimer();
    timerRef.current = window.setTimeout(place, delayMs);
  }

  function handleLeave() {
    clearTimer();
    setVisible(false);
  }

  useEffect(() => {
    if (!visible || !balloonRef.current) {
      return;
    }

    const balloon = balloonRef.current.getBoundingClientRect();
    const overflowRight = balloon.right - (window.innerWidth - 8);
    if (overflowRight > 0) {
      setCoords((current) => ({ ...current, left: Math.max(8, current.left - overflowRight) }));
    }
  }, [visible]);

  useEffect(() => () => clearTimer(), []);

  return (
    <>
      <span
        className={fill ? "hint-wrap hint-wrap-fill" : "hint-wrap"}
        onBlurCapture={handleLeave}
        onFocusCapture={handleEnter}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        ref={wrapRef}
      >
        {children}
      </span>
      {visible
        ? createPortal(
            <div
              className={coords.above ? "hint-balloon is-above" : "hint-balloon"}
              ref={balloonRef}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
