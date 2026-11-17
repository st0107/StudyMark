import { useEffect, useRef, useState, type RefObject } from "react";
import { captureSelection, type PdfSelection } from "../pdfAnchorAdapter";
import {
  adjacentWord,
  boundaryWord,
  captureTouchRange,
  joinWordRanges,
  wordAtPoint,
  type SelectionEnd,
} from "./touchTextRange";

interface Options {
  pageRef: RefObject<HTMLDivElement | null>;
  pageNumber: number;
  contentVersion: number;
  loading: boolean;
  layoutKey: string;
  selection?: PdfSelection | null;
  onSelection: (selection: PdfSelection | null) => void;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  active: boolean;
  anchor: Range | null;
  offsetX: number;
  offsetY: number;
}

export function useTouchSelection({
  pageRef,
  pageNumber,
  contentVersion,
  loading,
  layoutKey,
  selection,
  onSelection,
}: Options) {
  const [touchSelection, setTouchSelection] = useState<PdfSelection | null>(
    null,
  );
  const rangeRef = useRef<Range | null>(null);
  const nativeOwnedRef = useRef(false);
  const latest = useRef({ onSelection, selection });
  latest.current = { onSelection, selection };
  const cancelGestureRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (selection === undefined || selection?.source === "touch") return;
    rangeRef.current = null;
    setTouchSelection(null);
    cancelGestureRef.current();
  }, [selection]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || loading) return;
    const layer = page.querySelector<HTMLElement>(".textLayer");
    if (!layer) return;
    let timer: number | undefined;
    let gesture: Gesture | null = null;
    let suppressClickUntil = 0;

    const cancelGesture = () => {
      window.clearTimeout(timer);
      timer = undefined;
      gesture = null;
    };
    cancelGestureRef.current = cancelGesture;

    const publish = (range: Range) => {
      const next = captureTouchRange(range, page, pageNumber, contentVersion);
      if (!next) return;
      rangeRef.current = range;
      nativeOwnedRef.current = false;
      setTouchSelection(next);
      latest.current.onSelection(next);
    };
    const clear = () => {
      if (rangeRef.current || nativeOwnedRef.current)
        latest.current.onSelection(null);
      rangeRef.current = null;
      nativeOwnedRef.current = false;
      setTouchSelection(null);
    };
    const selectTouchMode = () => {
      page.classList.add("custom-touch-selection");
      // A prior mouse selection must not leave an OS selection menu behind.
      if (nativeOwnedRef.current) window.getSelection()?.removeAllRanges();
    };

    if (window.matchMedia?.("(pointer: coarse)").matches) selectTouchMode();

    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") selectTouchMode();
      else if (!(event.target as Element).closest(".pdf-selection-handle")) {
        page.classList.remove("custom-touch-selection");
        cancelGesture();
        clear();
      }
    };

    const touchStart = (event: TouchEvent) => {
      cancelGesture();
      if (event.touches.length !== 1) return;
      selectTouchMode();
      const touch = event.touches[0];
      const handle = (event.target as Element).closest<HTMLElement>(
        "[data-selection-end]",
      );
      if (handle && rangeRef.current) {
        const end = handle.dataset.selectionEnd as SelectionEnd;
        const word = boundaryWord(rangeRef.current, end);
        const anchor = boundaryWord(
          rangeRef.current,
          end === "start" ? "end" : "start",
        );
        if (!word || !anchor) return;
        const bounds = word.getBoundingClientRect();
        const x = end === "start" ? bounds.left + 1 : bounds.right - 1;
        gesture = {
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
          active: true,
          anchor,
          offsetX: touch.clientX - x,
          offsetY: touch.clientY - (bounds.top + bounds.height / 2),
        };
        event.preventDefault();
        return;
      }
      gesture = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        active: false,
        anchor: null,
        offsetX: 0,
        offsetY: 0,
      };
      timer = window.setTimeout(() => {
        if (!gesture) return;
        const word = wordAtPoint(layer, gesture.x, gesture.y, true);
        if (!word) return;
        gesture.active = true;
        gesture.anchor = word;
        suppressClickUntil = Date.now() + 750;
        publish(word);
      }, 450);
    };

    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelGesture();
        return;
      }
      if (!gesture) return;
      const touch = Array.from(event.touches).find(
        (item) => item.identifier === gesture?.id,
      );
      if (!touch) return;
      if (!gesture.active) {
        if (
          Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > 10
        )
          cancelGesture();
        return;
      }
      // This listener is deliberately non-passive: ordinary swipes scroll, but
      // dragging after the hold must extend the selection rather than pan.
      if (event.cancelable) event.preventDefault();
      const word = wordAtPoint(
        layer,
        touch.clientX - gesture.offsetX,
        touch.clientY - gesture.offsetY,
      );
      if (word && gesture.anchor) publish(joinWordRanges(gesture.anchor, word));
      suppressClickUntil = Date.now() + 750;
    };

    const touchEnd = (event: TouchEvent) => {
      if (gesture?.active) {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil = Date.now() + 750;
      } else if (gesture && rangeRef.current) {
        clear();
      }
      cancelGesture();
    };
    const contextMenu = (event: MouseEvent) => {
      if (page.classList.contains("custom-touch-selection"))
        event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const nativeSelection = () => {
      if (rangeRef.current || gesture?.active) return;
      const next = captureSelection(page, pageNumber, contentVersion);
      if (next) {
        nativeOwnedRef.current = true;
        latest.current.onSelection(next);
      } else if (
        nativeOwnedRef.current &&
        !document.activeElement?.closest(".selection-toolbar")
      ) {
        nativeOwnedRef.current = false;
        latest.current.onSelection(null);
      }
    };
    const keyDown = (event: KeyboardEvent) => {
      const handle = (event.target as Element).closest<HTMLElement>(
        "[data-selection-end]",
      );
      if (
        !handle ||
        !rangeRef.current ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      const end = handle.dataset.selectionEnd as SelectionEnd;
      const next = adjacentWord(
        layer,
        rangeRef.current,
        end,
        event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1,
      );
      const anchor = boundaryWord(
        rangeRef.current,
        end === "start" ? "end" : "start",
      );
      if (next && anchor) publish(joinWordRanges(anchor, next));
    };

    page.addEventListener("pointerdown", pointerDown);
    page.addEventListener("touchstart", touchStart, { passive: false });
    page.addEventListener("touchmove", touchMove, { passive: false });
    page.addEventListener("touchend", touchEnd, { passive: false });
    page.addEventListener("touchcancel", cancelGesture);
    page.addEventListener("contextmenu", contextMenu);
    page.addEventListener("click", click, true);
    page.addEventListener("keydown", keyDown);
    page.addEventListener("pointerup", nativeSelection);
    page.addEventListener("keyup", nativeSelection);
    document.addEventListener("selectionchange", nativeSelection);
    return () => {
      cancelGesture();
      clear();
      page.removeEventListener("pointerdown", pointerDown);
      page.removeEventListener("touchstart", touchStart);
      page.removeEventListener("touchmove", touchMove);
      page.removeEventListener("touchend", touchEnd);
      page.removeEventListener("touchcancel", cancelGesture);
      page.removeEventListener("contextmenu", contextMenu);
      page.removeEventListener("click", click, true);
      page.removeEventListener("keydown", keyDown);
      page.removeEventListener("pointerup", nativeSelection);
      page.removeEventListener("keyup", nativeSelection);
      document.removeEventListener("selectionchange", nativeSelection);
    };
  }, [pageRef, pageNumber, contentVersion, loading, layoutKey]);

  return touchSelection;
}
