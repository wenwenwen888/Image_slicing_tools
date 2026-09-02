import { useWorkspaceStore } from "../store/workspace-store";
import { APP_VERSION } from "../core/app-info";
import { translate } from "../core/i18n";

export function StatusBar() {
  const language = useWorkspaceStore((state) => state.language);
  const pointerInfo = useWorkspaceStore((state) => state.pointerInfo);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const zoom = useWorkspaceStore((state) => state.zoom);
  const statusText = useWorkspaceStore((state) => state.statusText);
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const selectedSizeLabel = selectedSlice
    ? `${t("size")} ${selectedSlice.width} x ${selectedSlice.height}`
    : `${t("size")} 0 x 0`;

  return (
    <footer className="status-bar">
      <div className="status-bar-meta">
        <span>{language === "en" && pointerInfo === "坐标 0, 0" ? t("coordZero") : pointerInfo}</span>
        <span>{selectedSizeLabel}</span>
        <span>{t("zoom")} {Math.round(zoom * 100)}%</span>
        <span data-testid="status-text">{statusText}</span>
      </div>
      <span className="status-author">大帅比制作 v{APP_VERSION}</span>
    </footer>
  );
}
