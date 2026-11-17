// @vitest-environment node
import { File as NodeFile } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectPdfUpload } from "./validateUpload";

const engine = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("../pdf-reader/pdfEngine", () => ({ pdfjs: engine }));
const pdfFile = (body = "%PDF-1.7 sample", name = "notes.pdf") =>
  new NodeFile([body], name, { type: "application/pdf" }) as unknown as File;

beforeEach(() => engine.getDocument.mockReset());

describe("PDF upload inspection", () => {
  it("checks the actual file signature before loading the PDF engine", async () => {
    await expect(inspectPdfUpload(pdfFile("not a PDF"))).rejects.toThrow(
      "valid PDF",
    );
    expect(engine.getDocument).not.toHaveBeenCalled();
  });

  it("parses the first page and returns the real page count, then frees the worker", async () => {
    const getPage = vi.fn().mockResolvedValue({});
    const destroy = vi.fn().mockResolvedValue(undefined);
    engine.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 20, getPage }),
      destroy,
    });
    expect(await inspectPdfUpload(pdfFile())).toBe(20);
    expect(getPage).toHaveBeenCalledWith(1);
    expect(engine.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Uint8Array),
        isEvalSupported: false,
      }),
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("rejects a document over the page limit and frees its worker", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    engine.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 201 }),
      destroy,
    });
    await expect(inspectPdfUpload(pdfFile())).rejects.toThrow(
      "1000 pages or fewer",
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("reports password protection explicitly without uploading", async () => {
    const error = Object.assign(new Error("Password needed"), {
      name: "PasswordException",
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    engine.getDocument.mockReturnValue({
      promise: Promise.reject(error),
      destroy,
    });
    await expect(inspectPdfUpload(pdfFile())).rejects.toThrow(
      "Password-protected",
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("rejects a broken page tree even if PDF metadata loads", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    engine.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockRejectedValue(new Error("Invalid page tree")),
      }),
      destroy,
    });
    await expect(inspectPdfUpload(pdfFile())).rejects.toThrow(
      "damaged or unsupported",
    );
    expect(destroy).toHaveBeenCalledOnce();
  });
});
