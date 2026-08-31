import { BoxSelect, Grid3X3, MousePointer2, ScanSearch } from "lucide-react";
import type { ToolId } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

const tools: Array<{ id: ToolId; label: string; hint: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "选择", hint: "选择已有切片，拖动位置或拉角调整大小。", icon: MousePointer2 },
  { id: "rect", label: "矩形", hint: "在图片上拖拽，绘制一个矩形切片。", icon: BoxSelect },
  { id: "grid", label: "网格", hint: "按网格批量切图，行列和尺寸在右侧参数区调整。", icon: Grid3X3 },
  { id: "scan", label: "识别", hint: "按透明或纯色背景自动找出图标区域，参数在右侧。", icon: ScanSearch },
];

export function ToolRail() {
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);

  return (
    <aside className="tool-rail" aria-label="切图工具">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const disabled = !imageDocument && tool.id !== "select";
        return (
          <Hint fill key={tool.label} text={tool.hint}>
            <button
              className={activeTool === tool.id ? "tool-button active" : "tool-button"}
              data-testid={`tool-${tool.id}`}
              disabled={disabled}
              onClick={() => setActiveTool(tool.id)}
              type="button"
            >
              <Icon size={20} />
              <span>{tool.label}</span>
            </button>
          </Hint>
        );
      })}
    </aside>
  );
}
