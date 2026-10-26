import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CourseSearch } from "@/components/CourseSearch";

const place = { placeId: "place-1", name: "Test Links", city: "Madison, WI" };

function ControlledSearch({ onSelect = vi.fn() }) {
  const [value, setValue] = useState("");
  return <CourseSearch value={value} onChange={setValue} onSelect={(result) => {
    setValue(result.name);
    onSelect(result);
  }} />;
}

afterEach(() => vi.unstubAllGlobals());

function mockSearch(configured = true) {
  const fetch = vi.fn()
    .mockResolvedValueOnce({ json: async () => ({ configured }) })
    .mockResolvedValue({ ok: true, json: async () => ({ results: [place] }) });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("allows manual entry without autocomplete when Places is not configured", async () => {
  const fetch = mockSearch(false);
  render(<ControlledSearch />);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Manual Course" } });
  expect(screen.getByRole("textbox")).toHaveValue("Manual Course");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledOnce();
});

it("debounces queries, selects a suggestion, and does not reopen after selection", async () => {
  const fetch = mockSearch();
  const onSelect = vi.fn();
  render(<ControlledSearch onSelect={onSelect} />);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
  expect(await screen.findByText("searching…")).toBeInTheDocument();
  fireEvent.mouseDown(await screen.findByText("Test Links"));
  expect(onSelect).toHaveBeenCalledWith({ name: "Test Links", city: "Madison, WI" });
  expect(screen.getByRole("textbox")).toHaveValue("Test Links");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByText("searching…")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("clears suggestions and loading when the query becomes too short", async () => {
  mockSearch();
  render(<ControlledSearch />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
  await screen.findByText("Test Links");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "T" } });
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByText("searching…")).not.toBeInTheDocument();
});

it("reports failed searches and leaves manual entry usable", async () => {
  const fetch = mockSearch();
  fetch.mockResolvedValue({ ok: false, status: 502 });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ControlledSearch />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
  expect(await screen.findByRole("status")).toHaveTextContent("Course search unavailable");
  expect(screen.queryByText("searching…")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("Test");
  expect(log).toHaveBeenCalled();
});

it("discards a stale response after the input changes", async () => {
  const fetch = mockSearch();
  let resolveSearch: (response: { ok: boolean; json: () => Promise<{ results: typeof place[] }> }) => void;
  fetch.mockImplementation(() => new Promise((resolve) => { resolveSearch = resolve; }));
  render(<ControlledSearch />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  resolveSearch!({ ok: true, json: async () => ({ results: [place] }) });
  await waitFor(() => expect(screen.queryByRole("list")).not.toBeInTheDocument());
  expect(screen.queryByText("searching…")).not.toBeInTheDocument();
});
