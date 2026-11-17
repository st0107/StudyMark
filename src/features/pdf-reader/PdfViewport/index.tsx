import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileWarning, LoaderCircle } from "lucide-react";
import { pdfjs } from "../pdfEngine";
import type { PdfSelection } from "../pdfAnchorAdapter";
import { useTouchSelection } from "./useTouchSelection";
import { AnnotationLayer } from "../AnnotationLayer";
import type { Annotation } from "../../../shared/types";
import "pdfjs-dist/web/pdf_viewer.css";

interface Props {
  blob: Blob;
  pageNumber: number;
  zoom: number;
  contentVersion: number;
  annotations: Annotation[];
  activeId?: string;
  onPageCount: (count: number) => void;
  onSelection: (selection: PdfSelection | null) => void;
  selection?: PdfSelection | null;
}

export function PdfViewport({
  blob,
  pageNumber,
  zoom,
  contentVersion,
  annotations,
  activeId,
  onPageCount,
  onSelection,
  selection,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(650);
  const [dimensions, setDimensions] = useState({ width: 650, height: 850 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasText, setHasText] = useState(true);
  const [retry, setRetry] = useState(0);
  const touchSelection = useTouchSelection({
    pageRef,
    pageNumber,
    contentVersion,
    loading,
    layoutKey: `${zoom}:${width}:${retry}`,
    selection,
    onSelection,
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, entry.contentRect.width - 48)),
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    setPdf(null);
    setLoading(true);
    setError("");
    void blob
      .arrayBuffer()
      .then(async (data) => {
        if (disposed) return;
        task = pdfjs.getDocument({
          data: new Uint8Array(data),
          isEvalSupported: false,
        });
        task.onPassword = () => {
          setError(
            "This PDF is password-protected. Upload an unprotected copy.",
          );
          setLoading(false);
          void task?.destroy();
        };
        const document = await task.promise;
        if (!disposed) {
          setPdf(document);
          onPageCount(document.numPages);
        }
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(
            reason instanceof Error
              ? reason.message
              : "This PDF could not be opened.",
          );
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      void task?.destroy();
    };
  }, [blob, onPageCount, retry]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !textRef.current) return;
    let disposed = false;
    let renderTask:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | undefined;
    const canvas = canvasRef.current;
    const container = textRef.current;
    setLoading(true);
    setError("");
    container.replaceChildren();
    void pdf
      .getPage(Math.min(pageNumber, pdf.numPages))
      .then(async (page) => {
        if (disposed) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(width / base.width, 1.3) * zoom;
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        container.style.setProperty("--scale-factor", String(scale));
        container.style.setProperty("--total-scale-factor", String(scale));
        setDimensions({ width: viewport.width, height: viewport.height });
        renderTask = page.render({
          canvas,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        // Attach a rejection handler immediately: changing pages can cancel canvas
        // rendering before the text-content request has finished.
        await Promise.all([
          renderTask.promise,
          page.getTextContent().then(async (content) => {
            if (disposed) return;
            setHasText(
              content.items.some(
                (item) => "str" in item && item.str.trim().length > 0,
              ),
            );
            textLayer = new pdfjs.TextLayer({
              textContentSource: content,
              container,
              viewport,
            });
            await textLayer.render();
          }),
        ]);
        if (!disposed) setLoading(false);
      })
      .catch((reason: unknown) => {
        if (
          !disposed &&
          !(
            reason instanceof Error &&
            reason.name === "RenderingCancelledException"
          )
        ) {
          renderTask?.cancel();
          textLayer?.cancel();
          setError("The page could not be rendered. Please retry.");
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, zoom, width, retry]);

  useEffect(() => {
    const firstRect = annotations.find(
      (item) => item.id === activeId && item.pageNumber === pageNumber,
    )?.anchor?.rects[0];
    if (!loading && firstRect && hostRef.current) {
      hostRef.current.scrollTo({
        top: Math.max(
          0,
          firstRect.y * dimensions.height - hostRef.current.clientHeight / 3,
        ),
        left: Math.max(
          0,
          firstRect.x * dimensions.width - hostRef.current.clientWidth / 3,
        ),
      });
    }
  }, [activeId, annotations, pageNumber, loading, dimensions]);

  return (
    <div className="pdf-viewport" ref={hostRef}>
      {error ? (
        <div role="alert" className="reader-error">
          <FileWarning size={32} />
          <h3>Unable to open this page</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {!hasText && !loading && (
            <p className="reader-notice">
              This page has no selectable text. You can still add a page note.
            </p>
          )}
          {loading && (
            <div className="pdf-loading" role="status">
              <LoaderCircle className="spin" size={20} /> Rendering page…
            </div>
          )}
          <div
            ref={pageRef}
            className={`pdf-page ${loading ? "is-loading" : ""}`}
            style={dimensions}
            aria-label={`PDF page ${pageNumber}`}
            tabIndex={0}
          >
            <canvas ref={canvasRef} aria-hidden="true" />
            <AnnotationLayer
              annotations={annotations.filter(
                (item) =>
                  item.pageNumber === pageNumber &&
                  item.anchor?.documentContentVersion === contentVersion,
              )}
              activeId={activeId}
            />
            <div className="textLayer" ref={textRef} />
            {touchSelection && (
              <div className="pdf-touch-selection">
                {touchSelection.anchor.rects.map((rect, index) => (
                  <span
                    key={index}
                    className="pdf-touch-selection-rect"
                    aria-hidden="true"
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.width * 100}%`,
                      height: `${rect.height * 100}%`,
                    }}
                  />
                ))}
                {(["start", "end"] as const).map((end) => {
                  const rect =
                    end === "start"
                      ? touchSelection.anchor.rects[0]
                      : touchSelection.anchor.rects.at(-1)!;
                  return (
                    <button
                      key={end}
                      type="button"
                      className={`pdf-selection-handle is-${end}`}
                      data-selection-end={end}
                      aria-label={`Adjust selection ${end}`}
                      title="Drag to adjust, or use the arrow keys"
                      style={{
                        left: `${(rect.x + (end === "end" ? rect.width : 0)) * 100}%`,
                        top: `${(rect.y + rect.height) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="pdf-page-caption">
            Page {pageNumber}
            {pdf ? ` of ${pdf.numPages}` : ""}
          </div>
        </>
      )}
    </div>
  );
}
