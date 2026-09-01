import { Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function SliceList() {
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const setSelectedSliceId = useWorkspaceStore((state) => state.setSelectedSliceId);
  const clearSlices = useWorkspaceStore((state) => state.clearSlices);

  function confirmClearSlices() {
    if (window.confirm("确定移除所有选区？")) {
      clearSlices();
    }
  }

  return (
    <details className="panel-section tree-panel">
      <summary>切片列表</summary>
      <div className="tree-body">
        {slices.length > 0 ? (
          <>
            <Hint fill text="移除当前图片上的所有选区。">
              <button className="button secondary export-panel-button" data-testid="clear-slices-button" onClick={confirmClearSlices} type="button">
                <Trash2 size={16} />
                移除所有选区
              </button>
            </Hint>
            <div className="slice-list">
              {slices.map((slice) => (
                <button
                  className={slice.id === selectedSliceId ? "slice-list-item selected" : "slice-list-item"}
                  data-testid="slice-list-item"
                  key={slice.id}
                  onClick={() => setSelectedSliceId(slice.id)}
                  type="button"
                >
                  <span className="slice-list-name">{slice.name}</span>
                  <span>
                    {slice.width} x {slice.height}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-list">暂无切片</div>
        )}
      </div>
    </details>
  );
}
