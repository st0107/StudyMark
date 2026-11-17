import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../shared/api";
import type { AnnotationWithDocument } from "../../shared/types";
import HighlightsPage from "./HighlightsPage";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("../../shared/api", async () => ({
  ...(await import("../../shared/api/errors")),
  api: { getAllAnnotations: vi.fn(), updateAnnotation: vi.fn() },
}));

describe("My highlights conflict recovery", () => {
  it("retains the draft and retries with the refreshed annotation version", async () => {
    const annotation: AnnotationWithDocument = {
      id: "note",
      userId: "reader",
      documentId: "material",
      type: "PAGE_NOTE",
      pageNumber: 1,
      selectedText: null,
      anchor: null,
      color: null,
      noteText: "Original note",
      rowVersion: 1,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      document: {
        id: "material",
        title: "Study material",
        description: "",
        subject: "Computing",
        scope: "SHARED",
        status: "PUBLISHED",
        uploadedBy: "admin",
        pageCount: 20,
        sizeBytes: 100,
        contentVersion: 1,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        lastPage: 1,
        annotationCount: 1,
      },
    };
    const current = {
      ...annotation,
      noteText: "Changed in another tab",
      rowVersion: 2,
    };
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
        mutations: { retry: false },
      },
    });
    client.setQueryData(["all-annotations", "reader"], [annotation]);
    vi.mocked(api.getAllAnnotations).mockResolvedValue([current]);
    vi.mocked(api.updateAnnotation)
      .mockRejectedValueOnce(
        new ApiError(
          "This note was changed elsewhere.",
          "VERSION_CONFLICT",
          409,
        ),
      )
      .mockResolvedValueOnce({
        ...current,
        noteText: "Keep my new draft",
        rowVersion: 3,
      });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HighlightsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Edit annotation" }),
    );
    await userEvent.clear(screen.getByRole("textbox", { name: "Your note" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your note" }),
      "Keep my new draft",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your draft is kept",
    );
    expect(screen.getByRole("textbox", { name: "Your note" })).toHaveValue(
      "Keep my new draft",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() =>
      expect(api.updateAnnotation).toHaveBeenNthCalledWith(2, "note", {
        rowVersion: 2,
        noteText: "Keep my new draft",
      }),
    );
    client.clear();
  });
});
