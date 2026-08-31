import { FolderOpen } from "lucide-react";
import { DragEvent, PointerEvent, WheelEvent, useRef } from "react";
import { clamp, normalizeRect, resizeSlice } from "../core/geometry";
import { isAcceptedImageFile } from "../core/files";
import type { Interaction, ResizeHandle, SliceRegion } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";

export function CanvasPanel() {
  const canvasPanelRef = useRef<HTMLElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const zoom = useWorkspaceStore((state) => state.zoom);
  const pan = useWorkspaceStore((state) => state.pan);
  const isPanning = useWorkspaceStore((state) => state.isPanning);
  const isDraggingOver = useWorkspaceStore((state) => state.isDraggingOver);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const setIsDraggingOver = useWorkspaceStore((state) => state.setIsDraggingOver);
  const setIsPanning = useWorkspaceStore((state) => state.setIsPanning);
  const setPan = useWorkspaceStore((state) => state.setPan);
  const setPointerInfo = useWorkspaceStore((state) => state.setPointerInfo);
  const setStatusText = useWorkspaceStore((state) => state.setStatusText);
  const setSelectedSliceId = useWorkspaceStore((state) => state.setSelectedSliceId);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const changeZoom = useWorkspaceStore((state) => state.changeZoom);
  const openDroppedFile = useWorkspaceStore((state) => state.openDroppedFile);
  const pushHistory = useWorkspaceStore((state) => state.pushHistory);
  const updateSlice = useWorkspaceStore((state) => state.updateSlice);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = Array.from(event.dataTransfer.files).find((item) => isAcceptedImageFile(item)) ?? event.dataTransfer.files[0];

    if (file) {
      void openDroppedFile(file);
    }
  }

  function getImagePoint(event: PointerEvent<HTMLElement>) {
    const documentImage = useWorkspaceStore.getState().imageDocument;
    const currentPan = useWorkspaceStore.getState().pan;
    const currentZoom = useWorkspaceStore.getState().zoom;
    if (!documentImage || !canvasPanelRef.current) {
      return null;
    }

    const rect = canvasPanelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2 + currentPan.x;
    const centerY = rect.height / 2 + currentPan.y;
    const imageX = Math.round((event.clientX - rect.left - centerX) / currentZoom + documentImage.width / 2);
    const imageY = Math.round((event.clientY - rect.top - centerY) / currentZoom + documentImage.height / 2);

    if (imageX < 0 || imageY < 0 || imageX > documentImage.width || imageY > documentImage.height) {
      return null;
    }

    return { x: imageX, y: imageY };
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (!useWorkspaceStore.getState().imageDocument) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    changeZoom(useWorkspaceStore.getState().zoom + delta);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    const state = useWorkspaceStore.getState();
    if (!state.imageDocument) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (state.activeTool === "rect") {
      const point = getImagePoint(event);
      if (!point) {
        return;
      }

      pushHistory();
      const sliceId = crypto.randomUUID();
      const nextSlice: SliceRegion = {
        id: sliceId,
        name: `slice_${state.slices.length + 1}`,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        enabled: true,
        locked: false,
      };

      useWorkspaceStore.setState({
        slices: [...state.slices, nextSlice],
        selectedSliceId: sliceId,
        statusText: "创建矩形选区",
      });
      interactionRef.current = { mode: "create", sliceId, startX: point.x, startY: point.y };
      return;
    }

    interactionRef.current = {
      mode: "pan",
      pointerX: event.clientX,
      pointerY: event.clientY,
      pan: state.pan,
    };
    setSelectedSliceId(null);
    setIsPanning(true);
    setStatusText("拖动画布");
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const point = getImagePoint(event);
    setPointerInfo(point ? `坐标 ${point.x}, ${point.y}` : "坐标 --, --");

    const interaction = interactionRef.current;
    const documentImage = useWorkspaceStore.getState().imageDocument;
    if (!interaction || !documentImage) {
      return;
    }

    if (interaction.mode === "pan") {
      setPan({
        x: interaction.pan.x + event.clientX - interaction.pointerX,
        y: interaction.pan.y + event.clientY - interaction.pointerY,
      });
      return;
    }

    if (interaction.mode === "create") {
      if (!point) {
        return;
      }

      updateSlice(
        interaction.sliceId,
        normalizeRect(
          interaction.startX,
          interaction.startY,
          point.x - interaction.startX,
          point.y - interaction.startY,
          documentImage,
        ),
      );
      return;
    }

    const currentZoom = useWorkspaceStore.getState().zoom;
    if (interaction.mode === "move") {
      const deltaX = (event.clientX - interaction.pointerX) / currentZoom;
      const deltaY = (event.clientY - interaction.pointerY) / currentZoom;
      updateSlice(interaction.sliceId, {
        x: Math.round(clamp(interaction.original.x + deltaX, 0, documentImage.width - interaction.original.width)),
        y: Math.round(clamp(interaction.original.y + deltaY, 0, documentImage.height - interaction.original.height)),
      });
      return;
    }

    if (interaction.mode === "resize") {
      const deltaX = (event.clientX - interaction.pointerX) / currentZoom;
      const deltaY = (event.clientY - interaction.pointerY) / currentZoom;
      updateSlice(interaction.sliceId, resizeSlice(interaction.original, interaction.handle, deltaX, deltaY, documentImage));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const state = useWorkspaceStore.getState();
    if (interaction?.mode === "create") {
      const createdSlice = state.slices.find((slice) => slice.id === interaction.sliceId);
      if (createdSlice && (createdSlice.width < 3 || createdSlice.height < 3)) {
        useWorkspaceStore.setState({
          slices: state.slices.filter((slice) => slice.id !== interaction.sliceId),
          selectedSliceId: null,
          statusText: "选区太小，已取消",
        });
      } else {
        setActiveTool("select");
        setStatusText("矩形选区已创建");
      }
    } else if (interaction?.mode === "move") {
      setStatusText("选区已移动");
    } else if (interaction?.mode === "resize") {
      setStatusText("选区尺寸已调整");
    } else {
      setStatusText(state.imageDocument ? "图片查看中" : "就绪");
    }

    interactionRef.current = null;
    setIsPanning(false);
  }

  function handleSlicePointerDown(event: PointerEvent<HTMLDivElement>, slice: SliceRegion) {
    event.stopPropagation();
    const documentImage = useWorkspaceStore.getState().imageDocument;
    if (!documentImage || slice.locked) {
      return;
    }

    pushHistory();
    canvasPanelRef.current?.setPointerCapture(event.pointerId);
    setSelectedSliceId(slice.id);
    interactionRef.current = {
      mode: "move",
      sliceId: slice.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      original: slice,
    };
    setStatusText("移动选区");
  }

  function handleResizePointerDown(event: PointerEvent<HTMLButtonElement>, slice: SliceRegion, handle: ResizeHandle) {
    event.stopPropagation();
    const documentImage = useWorkspaceStore.getState().imageDocument;
    if (!documentImage || slice.locked) {
      return;
    }

    pushHistory();
    canvasPanelRef.current?.setPointerCapture(event.pointerId);
    setSelectedSliceId(slice.id);
    interactionRef.current = {
      mode: "resize",
      sliceId: slice.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      original: slice,
      handle,
    };
    setStatusText("调整选区尺寸");
  }

  return (
    <section
      className={[
        "canvas-panel",
        imageDocument ? "has-image" : "",
        activeTool === "rect" ? "is-rect-tool" : "",
        isPanning ? "is-panning" : "",
        isDraggingOver ? "is-dragging-over" : "",
      ].join(" ")}
      aria-label="图片画布"
      data-testid="canvas-panel"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      ref={canvasPanelRef}
    >
      {imageDocument ? (
        <div
          className="image-stage"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: imageDocument.width,
            height: imageDocument.height,
          }}
        >
          <img alt={imageDocument.fileName} data-testid="source-image" draggable={false} src={imageDocument.url} />
          {slices.map((slice) => {
            const selected = slice.id === selectedSliceId;
            return (
              <div
                className={selected ? "slice-box selected" : "slice-box"}
                key={slice.id}
                onPointerDown={(event) => handleSlicePointerDown(event, slice)}
                style={{
                  left: slice.x,
                  top: slice.y,
                  width: slice.width,
                  height: slice.height,
                }}
              >
                <span className="slice-label">{slice.name}</span>
                {selected && (
                  <>
                    <button
                      aria-label="左上角缩放"
                      className="resize-handle nw"
                      onPointerDown={(event) => handleResizePointerDown(event, slice, "nw")}
                      type="button"
                    />
                    <button
                      aria-label="右上角缩放"
                      className="resize-handle ne"
                      onPointerDown={(event) => handleResizePointerDown(event, slice, "ne")}
                      type="button"
                    />
                    <button
                      aria-label="左下角缩放"
                      className="resize-handle sw"
                      onPointerDown={(event) => handleResizePointerDown(event, slice, "sw")}
                      type="button"
                    />
                    <button
                      aria-label="右下角缩放"
                      className="resize-handle se"
                      onPointerDown={(event) => handleResizePointerDown(event, slice, "se")}
                      type="button"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="canvas-empty-state">
          <div className="empty-icon">
            <FolderOpen size={36} />
          </div>
          <h2>拖入图片或点击打开图片</h2>
          <p>支持 PNG、JPG/JPEG、WebP。导入后可以缩放、拖动画布，并在右侧查看图片信息。</p>
          {errorMessage && (
            <div className="error-message" data-testid="error-message">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
