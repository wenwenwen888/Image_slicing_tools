import { useEffect } from "react";
import { CanvasPanel } from "../components/CanvasPanel";
import { Inspector } from "../components/Inspector";
import { StatusBar } from "../components/StatusBar";
import { ToolRail } from "../components/ToolRail";
import { TopBar } from "../components/TopBar";
import { useWorkspaceStore } from "../store/workspace-store";

export function App() {
  useEffect(() => {
    return () => {
      const imageDocument = useWorkspaceStore.getState().imageDocument;
      if (imageDocument) {
        URL.revokeObjectURL(imageDocument.url);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const { selectedSliceId, deleteSlice } = useWorkspaceStore.getState();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedSliceId) {
        event.preventDefault();
        deleteSlice(selectedSliceId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleWindowDragOver(event: globalThis.DragEvent) {
      event.preventDefault();
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        useWorkspaceStore.getState().setIsDraggingOver(true);
      }
    }

    function handleWindowDrop(event: globalThis.DragEvent) {
      event.preventDefault();
      useWorkspaceStore.getState().setIsDraggingOver(false);
      const file = Array.from(event.dataTransfer?.files ?? [])[0];

      if (file) {
        void useWorkspaceStore.getState().openDroppedFile(file);
      }
    }

    function handleWindowDragLeave(event: globalThis.DragEvent) {
      if (event.clientX <= 0 || event.clientY <= 0) {
        useWorkspaceStore.getState().setIsDraggingOver(false);
      }
    }

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  return (
    <main className="app-shell">
      <TopBar />
      <section className="workspace">
        <ToolRail />
        <CanvasPanel />
        <Inspector />
      </section>
      <StatusBar />
    </main>
  );
}
