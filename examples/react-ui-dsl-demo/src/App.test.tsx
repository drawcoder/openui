// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { mockPrompt, mockParse, mockSchema, mockCreateParser } = vi.hoisted(() => {
  const parse = vi.fn(() => ({ root: "ok" }));
  return {
    mockPrompt: vi.fn(),
    mockParse: parse,
    mockSchema: { $defs: { Stack: { properties: {}, required: [] } } },
    mockCreateParser: vi.fn(() => ({ parse })),
  };
});

vi.mock("@openuidev/react-lang", () => ({
  Renderer: () => <div>rendered</div>,
  createParser: mockCreateParser,
}));

vi.mock("@openuidev/react-ui-dsl", () => ({
  dslLibrary: {
    prompt: (...args: unknown[]) => mockPrompt(...args),
    toJSONSchema: () => mockSchema,
  },
}));

vi.mock("./useGenerate", () => ({
  useGenerate: () => ({
    response: "",
    isStreaming: false,
    error: null,
    generate: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("App system prompt tab", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPrompt.mockReset();
    mockParse.mockClear();
    mockCreateParser.mockClear();
    mockPrompt.mockImplementation((options?: { dataModel?: { raw: Record<string, unknown> } }) =>
      options?.dataModel ? `system:${JSON.stringify(options.dataModel.raw)}` : "system:{}",
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows generated system prompt in the prompt tab and updates from data model before edits", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "prompt" }));

    const promptEditor = await screen.findByRole("textbox", { name: "System Prompt" });
    expect((promptEditor as HTMLTextAreaElement).value).toBe("system:{}");

    fireEvent.change(screen.getByLabelText("Data Model"), {
      target: { value: '{"region":"APAC"}' },
    });

    await waitFor(() => {
      expect((promptEditor as HTMLTextAreaElement).value).toBe('system:{"region":"APAC"}');
    });
  });

  it("keeps a manual system prompt edit when data model changes afterward", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "prompt" }));

    const promptEditor = await screen.findByRole("textbox", { name: "System Prompt" });
    fireEvent.change(promptEditor, { target: { value: "custom system prompt" } });

    fireEvent.change(screen.getByLabelText("Data Model"), {
      target: { value: '{"region":"EMEA"}' },
    });

    await waitFor(() => {
      expect((promptEditor as HTMLTextAreaElement).value).toBe("custom system prompt");
    });
  });

  it("allows entering open lang before generating", async () => {
    render(<App />);

    const langEditor = screen.getByRole("textbox", { name: "Open Lang" });
    fireEvent.change(langEditor, { target: { value: "root = Stack([])" } });

    await waitFor(() => {
      expect(mockCreateParser).toHaveBeenCalledWith(mockSchema);
      expect(mockParse).toHaveBeenCalledWith("root = Stack([])");
    });
  });
});
