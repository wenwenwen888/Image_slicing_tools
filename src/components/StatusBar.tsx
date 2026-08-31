import { useWorkspaceStore } from "../store/workspace-store";

export function StatusBar() {
  const pointerInfo = useWorkspaceStore((state) => state.pointerInfo);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const zoom = useWorkspaceStore((state) => state.zoom);
  const statusText = useWorkspaceStore((state) => state.statusText);
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
  const selectedSizeLabel = selectedSlice
    ? `尺寸 ${selectedSlice.width} x ${selectedSlice.height}`
    : "尺寸 0 x 0";

  return (
    <footer className="status-bar">
      <div className="status-bar-meta">
        <span>{pointerInfo}</span>
        <span>{selectedSizeLabel}</span>
        <span>缩放 {Math.round(zoom * 100)}%</span>
        <span data-testid="status-text">{statusText}</span>
      </div>
      <span className="status-author">大帅比制作</span>
    </footer>
  );
}
