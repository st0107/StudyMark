import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteEditor } from "./index";

describe("private note editing", () => {
  it("rejects an empty page note without sending a mutation", async () => {
    const save = vi.fn();
    render(<NoteEditor onSave={save} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Write a note before saving",
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the draft after a rejected save and retries the same content", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage unavailable"))
      .mockResolvedValueOnce(undefined);
    render(<NoteEditor onSave={save} onCancel={() => {}} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your note" }),
      "Review the key idea.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your draft is kept",
    );
    expect(screen.getByRole("textbox")).toHaveValue("Review the key idea.");
    await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(save).toHaveBeenNthCalledWith(2, "Review the key idea.", "#FFE066");
  });

  it("can remove a highlight note while retaining its color and anchor", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <NoteEditor
        initialText="Remove me"
        initialColor="#A8D8FF"
        selectedText="A selected passage"
        requireText={false}
        onSave={save}
        onCancel={() => {}}
      />,
    );
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(save).toHaveBeenCalledWith("", "#A8D8FF");
  });
});
