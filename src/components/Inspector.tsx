import { ExportPanel } from "./ExportPanel";
import { SliceEditor } from "./SliceEditor";
import { SliceList } from "./SliceList";

export function Inspector() {
  return (
    <aside className="inspector" aria-label="属性面板">
      <div className="inspector-main">
        <div className="inspector-selection-row">
        <SliceEditor />
        <SliceList />
        </div>
        <ExportPanel />
      </div>
    </aside>
  );
}
