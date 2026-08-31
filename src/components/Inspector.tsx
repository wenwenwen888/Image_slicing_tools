import { ExportPanel } from "./ExportPanel";
import { GridPanel } from "./GridPanel";
import { ImageInfoPanel } from "./ImageInfoPanel";
import { ScanPanel } from "./ScanPanel";
import { SliceEditor } from "./SliceEditor";
import { SliceList } from "./SliceList";

export function Inspector() {
  return (
    <aside className="inspector" aria-label="属性面板">
      <div className="inspector-stack">
        <div className="inspector-row">
          <ImageInfoPanel />
          <SliceEditor />
        </div>
        <SliceList />
        <div className="inspector-row">
          <ScanPanel />
          <GridPanel />
        </div>
      </div>
      <div className="inspector-export">
        <ExportPanel />
      </div>
    </aside>
  );
}
