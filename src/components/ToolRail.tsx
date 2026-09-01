import { BoxSelect, Circle, Grid3X3, MousePointer2, ScanSearch, Square, Squircle, X } from "lucide-react";
import type { SliceShape, ToolId } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { GridPanel } from "./GridPanel";
import { Hint } from "./Hint";
import { ScanPanel } from "./ScanPanel";

const tools: Array<{ id: ToolId; label: string; hint: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "选择", hint: "选择已有切片，拖动位置或拉角调整大小。", icon: MousePointer2 },
  { id: "rect", label: "矩形", hint: "拖拽绘制自由矩形切片。", icon: BoxSelect },
  { id: "rounded", label: "圆角", hint: "拖拽绘制圆角矩形切片。", icon: Squircle },
  { id: "square", label: "正方", hint: "拖拽绘制 1:1 正方形切片。", icon: Square },
  { id: "circle", label: "圆形", hint: "拖拽绘制 1:1 圆形切片。", icon: Circle },
  { id: "ellipse", label: "椭圆", hint: "拖拽绘制自由椭圆切片。", icon: Circle },
  { id: "grid", label: "网格", hint: "打开网格切图设置弹窗。", icon: Grid3X3 },
  { id: "scan", label: "识别", hint: "打开智能识别设置弹窗。", icon: ScanSearch },
];

export function ToolRail() {
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const setDefaultSliceShape = useWorkspaceStore((state) => state.setDefaultSliceShape);
  const setAspectRatioPreset = useWorkspaceStore((state) => state.setAspectRatioPreset);
  const isPickingScanBackground = useWorkspaceStore((state) => state.isPickingScanBackground);

  function handleToolClick(toolId: ToolId) {
    const toolShape = getToolShape(toolId);
    if (toolShape) {
      setDefaultSliceShape(toolShape);
      setAspectRatioPreset(toolId === "square" || toolId === "circle" ? "1:1" : "free");
    }

    setActiveTool(toolId);
  }

  return (
    <aside className="tool-rail" aria-label="切图工具">
      <div className="tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const disabled = !imageDocument && tool.id !== "select";
          return (
            <Hint fill key={tool.label} text={tool.hint}>
              <button
                className={activeTool === tool.id ? "tool-button active" : "tool-button"}
                data-testid={`tool-${tool.id}`}
                disabled={disabled}
                onClick={() => handleToolClick(tool.id)}
                type="button"
              >
                <Icon size={20} />
                <span>{tool.label}</span>
              </button>
            </Hint>
          );
        })}
      </div>
      {(activeTool === "grid" || (activeTool === "scan" && !isPickingScanBackground)) && (
        <div className="tool-popover" data-testid="tool-popover">
          <button className="tool-popover-close" onClick={() => setActiveTool("select")} type="button" aria-label="关闭工具设置">
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
