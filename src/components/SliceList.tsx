import { useWorkspaceStore } from "../store/workspace-store";

export function SliceList() {
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const setSelectedSliceId = useWorkspaceStore((state) => state.setSelectedSliceId);

  return (
    <section className="panel-section">
      <h2>切片列表</h2>
      {slices.length > 0 ? (
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
      ) : (
        <div className="empty-list">暂无切片</div>
      )}
    </section>
  );
}
