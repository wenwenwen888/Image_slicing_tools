import { Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function SliceEditor() {
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const deleteSlice = useWorkspaceStore((state) => state.deleteSlice);
  const pushHistory = useWorkspaceStore((state) => state.pushHistory);
  const updateSlice = useWorkspaceStore((state) => state.updateSlice);
  const handleNumericChange = useWorkspaceStore((state) => state.handleNumericChange);
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <h2>当前选区</h2>
        <Hint text="删除当前选中的切片，可用撤销找回。">
          <button
            className="mini-button danger"
            disabled={!selectedSlice}
            onClick={() => selectedSlice && deleteSlice(selectedSlice.id)}
            type="button"
          >
            <Trash2 size={14} />
            删除
          </button>
        </Hint>
      </div>

      <label className="field">
        名称
        <input
          disabled={!selectedSlice}
          onChange={(event) => {
            if (!selectedSlice) {
              return;
            }

            pushHistory();
            updateSlice(selectedSlice.id, { name: event.target.value });
          }}
          value={selectedSlice?.name ?? ""}
        />
      </label>

      <div className="field-grid">
        <label>
          X
          <input
            disabled={!selectedSlice}
            onChange={(event) => handleNumericChange("x", event.target.value)}
            type="number"
            value={selectedSlice?.x ?? 0}
          />
        </label>
        <label>
          Y
          <input
            disabled={!selectedSlice}
            onChange={(event) => handleNumericChange("y", event.target.value)}
            type="number"
            value={selectedSlice?.y ?? 0}
          />
        </label>
        <label>
          宽
          <input
            disabled={!selectedSlice}
            min={1}
            onChange={(event) => handleNumericChange("width", event.target.value)}
            type="number"
            value={selectedSlice?.width ?? 0}
          />
        </label>
        <label>
          高
          <input
            disabled={!selectedSlice}
            min={1}
            onChange={(event) => handleNumericChange("height", event.target.value)}
            type="number"
            value={selectedSlice?.height ?? 0}
          />
        </label>
      </div>

      <div className="toggle-row">
        <label>
          <input
            checked={selectedSlice?.enabled ?? false}
            disabled={!selectedSlice}
            onChange={(event) => {
              if (!selectedSlice) {
                return;
              }

              pushHistory();
              updateSlice(selectedSlice.id, { enabled: event.target.checked });
            }}
            type="checkbox"
          />
          启用导出
        </label>
        <label>
          <input
            checked={selectedSlice?.locked ?? false}
            disabled={!selectedSlice}
            onChange={(event) => {
              if (!selectedSlice) {
                return;
              }

              pushHistory();
              updateSlice(selectedSlice.id, { locked: event.target.checked });
            }}
            type="checkbox"
          />
          锁定
        </label>
      </div>
    </section>
  );
}
