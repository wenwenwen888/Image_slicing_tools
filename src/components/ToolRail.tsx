import { BoxSelect, Circle, Grid3X3, MousePointer2, ScanSearch, Square, Squircle, X } from "lucide-react";
import { translate, type TranslationKey } from "../core/i18n";
import type { SliceShape, ToolId } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { GridPanel } from "./GridPanel";
import { Hint } from "./Hint";
import { ScanPanel } from "./ScanPanel";

const tools: Array<{ id: ToolId; labelKey: TranslationKey; hintKey: TranslationKey; icon: typeof MousePointer2 }> = [
  { id: "select", labelKey: "select", hintKey: "selectHint", icon: MousePointer2 },
  { id: "rect", labelKey: "rect", hintKey: "rectHint", icon: BoxSelect },
  { id: "rounded", labelKey: "rounded", hintKey: "roundedHint", icon: Squircle },
  { id: "square", labelKey: "square", hintKey: "squareHint", icon: Square },
  { id: "circle", labelKey: "circle", hintKey: "circleHint", icon: Circle },
  { id: "ellipse", labelKey: "ellipse", hintKey: "ellipseHint", icon: Circle },
  { id: "grid", labelKey: "grid", hintKey: "gridHint", icon: Grid3X3 },
  { id: "scan", labelKey: "scan", hintKey: "scanHint", icon: ScanSearch },
];

export function ToolRail() {
  const language = useWorkspaceStore((state) => state.language);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const setDefaultSliceShape = useWorkspaceStore((state) => state.setDefaultSliceShape);
  const setAspectRatioPreset = useWorkspaceStore((state) => state.setAspectRatioPreset);
  const isPickingScanBackground = useWorkspaceStore((state) => state.isPickingScanBackground);
  const t = (key: TranslationKey) => translate(language, key);

  function handleToolClick(toolId: ToolId) {
    const toolShape = getToolShape(toolId);
    if (toolShape) {
      setDefaultSliceShape(toolShape);
      setAspectRatioPreset(toolId === "square" || toolId === "circle" ? "1:1" : "free");
    }

    setActiveTool(toolId);
  }

  return (
    <aside className="tool-rail" aria-label={t("tools")}>
      <div className="tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const disabled = !imageDocument && tool.id !== "select";
          return (
            <Hint fill key={tool.id} text={t(tool.hintKey)}>
              <button
                className={activeTool === tool.id ? "tool-button active" : "tool-button"}
                data-testid={`tool-${tool.id}`}
                disabled={disabled}
                onClick={() => handleToolClick(tool.id)}
                type="button"
              >
                <Icon size={20} />
                <span>{t(tool.labelKey)}</span>
              </button>
            </Hint>
          );
        })}
      </div>
      {(activeTool === "grid" || (activeTool === "scan" && !isPickingScanBackground)) && (
        <div className="tool-popover" data-testid="tool-popover">
          <button className="tool-popover-close" onClick={() => setActiveTool("select")} type="button" aria-label={t("closeToolSettings")}>
            <X size={16} />
          </button>
          {activeTool === "grid" ? <GridPanel /> : <ScanPanel />}
        </div>
      )}
    </aside>
  );
}

function getToolShape(toolId: ToolId): SliceShape | null {
  if (toolId === "rounded") {
    return "rounded";
  }

  if (toolId === "circle" || toolId === "ellipse") {
    return "ellipse";
  }

  if (toolId === "rect" || toolId === "square") {
    return "rect";
  }

  return null;
}
