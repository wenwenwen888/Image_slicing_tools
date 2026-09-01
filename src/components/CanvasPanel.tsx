import { FolderOpen, X } from "lucide-react";
import { ChangeEvent, DragEvent, MouseEvent, PointerEvent, WheelEvent, useRef, useState } from "react";
import { clamp, getAspectRatioValue, normalizeRect, resizeSlice } from "../core/geometry";
import { isAcceptedImageFile } from "../core/files";
import type { AspectRatioPreset, Interaction, ResizeHandle, SliceRegion, SliceShape, ToolId } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";

type CanvasMenu =
  | { type: "image"; x: number; y: number }
  | { type: "slice"; x: number; y: number; sliceId: string }
  | null;

export function CanvasPanel() {
  const canvasPanelRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const emptyFileInputRef = useRef<HTMLInputElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasMenu>(null);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const slices = useWorkspaceStore((state) => state.slices);
  const scanPreviewSlices = useWorkspaceStore((state) => state.scanPreviewSlices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const zoom = useWorkspaceStore((state) => state.zoom);
  const pan = useWorkspaceStore((state) => state.pan);
  const isPanning = useWorkspaceStore((state) => state.isPanning);
  const isDraggingOver = useWorkspaceStore((state) => state.isDraggingOver);
  const isPickingScanBackground = useWorkspaceStore((state) => state.isPickingScanBackground);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const setIsDraggingOver = useWorkspaceStore((state) => state.setIsDraggingOver);
  const setIsPanning = useWorkspaceStore((state) => state.setIsPanning);
  const setPan = useWorkspaceStore((state) => state.setPan);
  const setPointerInfo = useWorkspaceStore((state) => state.setPointerInfo);
  const setStatusText = useWorkspaceStore((state) => state.setStatusText);
  const setSelectedSliceId = useWorkspaceStore((state) => state.setSelectedSliceId);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const changeZoom = useWorkspaceStore((state) => state.changeZoom);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const handleOpenImageClick = useWorkspaceStore((state) => state.handleOpenImageClick);
  const openDroppedFile = useWorkspaceStore((state) => state.openDroppedFile);
  const closeCurrentImage = useWorkspaceStore((state) => state.closeCurrentImage);
  const deleteSlice = useWorkspaceStore((state) => state.deleteSlice);
  const sampleScanBackgroundAt = useWorkspaceStore((state) => state.sampleScanBackgroundAt);
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

  async function handleEmptyFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await openFile(file);
    }
    event.target.value = "";
  }

  function getImagePoint(event: PointerEvent<HTMLElement>) {
    const documentImage = useWorkspaceStore.getState().imageDocument;
    if (!documentImage || !imageRef.current) {
      return null;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const imageX = Math.round(((event.clientX - rect.left) / rect.width) * documentImage.width);
    const imageY = Math.round(((event.clientY - rect.top) / rect.height) * documentImage.height);

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
    setContextMenu(null);
    if (event.button !== 0) {
      return;
    }

    const state = useWorkspaceStore.getState();
    if (!state.imageDocument) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getImagePoint(event);

    if (state.isPickingScanBackground) {
      if (point) {
        void sampleScanBackgroundAt(point.x, point.y);
      }
      return;
    }

    const drawingOptions = getDrawingOptions(state.activeTool, state.defaultSliceShape, state.aspectRatioPreset);
    if (drawingOptions) {
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
        shape: drawingOptions.shape,
        cornerRadius: state.defaultCornerRadius,
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
          getAspectRatioValue(getCreateAspectRatio(useWorkspaceStore.getState().activeTool, useWorkspaceStore.getState().aspectRatioPreset)),
        ),
      );
      return;
    }

    const currentImageRect = imageRef.current?.getBoundingClientRect();
    const currentZoom = currentImageRect && documentImage ? currentImageRect.width / documentImage.width : currentZoomFallback();
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
      updateSlice(
        interaction.sliceId,
        resizeSlice(
          interaction.original,
          interaction.handle,
          deltaX,
          deltaY,
          documentImage,
          getAspectRatioValue(useWorkspaceStore.getState().aspectRatioPreset),
        ),
      );
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
    setContextMenu(null);
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }

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
    setContextMenu(null);
    if (event.button !== 0) {
      return;
    }

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

  function confirmCloseCurrentImage() {
    if (window.confirm("确定关闭当前图片？关闭后会清空当前图片和所有选区。")) {
      closeCurrentImage();
    }
    setContextMenu(null);
  }

  function handleImageContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setContextMenu({ type: "image", x: event.clientX, y: event.clientY });
  }

  function handleSliceContextMenu(event: MouseEvent<HTMLDivElement>, sliceId: string) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedSliceId(sliceId);
    setContextMenu({ type: "slice", x: event.clientX, y: event.clientY, sliceId });
  }

  return (
    <section
      className={[
        "canvas-panel",
        imageDocument ? "has-image" : "",
        isDrawingTool(activeTool) ? "is-rect-tool" : "",
        isPickingScanBackground ? "is-color-picker" : "",
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
          onContextMenu={handleImageContextMenu}
        >
          <img alt={imageDocument.fileName} data-testid="source-image" draggable={false} ref={imageRef} src={imageDocument.url} />
          {slices.map((slice) => {
            const selected = slice.id === selectedSliceId;
            return (
              <div
                className={["slice-box", selected ? "selected" : "", slice.shape === "ellipse" ? "ellipse" : ""].join(" ")}
                data-testid="slice-box"
                key={slice.id}
                onContextMenu={(event) => handleSliceContextMenu(event, slice.id)}
                onPointerDown={(event) => handleSlicePointerDown(event, slice)}
                style={{
                  left: slice.x,
                  top: slice.y,
                  width: slice.width,
                  height: slice.height,
                  borderRadius:
                    slice.shape === "rounded"
                      ? `${Math.min(slice.cornerRadius ?? 12, slice.width / 2, slice.height / 2)}px`
                      : undefined,
                }}
              >
                <span className="slice-label">{slice.name}</span>
                {selected && (
                  <>
                    <button
                      aria-label="删除选区"
                      className="slice-close-button"
                      data-testid="slice-close-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSlice(slice.id);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      <X size={12} />
                    </button>
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
          {scanPreviewSlices.map((slice) => (
            <div
              className="slice-box preview"
              key={slice.id}
              style={{
                left: slice.x,
                top: slice.y,
                width: slice.width,
                height: slice.height,
              }}
            >
              <span className="slice-label">预览 {slice.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <button
          className="canvas-empty-state"
          data-testid="canvas-empty-open"
          onClick={() => void handleOpenImageClick(emptyFileInputRef.current)}
          type="button"
        >
          <input
            accept="image/png,image/jpeg,image/webp"
            className="file-input"
            data-testid="canvas-empty-file-input"
            onChange={(event) => void handleEmptyFileChange(event)}
            ref={emptyFileInputRef}
            type="file"
          />
          <div className="empty-icon">
            <FolderOpen size={36} />
          </div>
          <h2>拖入图片或点击打开图片</h2>
          <p>支持 PNG、JPG/JPEG、WebP。导入后可以缩放、拖动画布，并查看图片信息。</p>
          {errorMessage && (
            <div className="error-message" data-testid="error-message">
              {errorMessage}
            </div>
          )}
        </button>
      )}
      {contextMenu && (
        <div
          className="canvas-context-menu"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "image" ? (
            <button data-testid="context-close-image" onClick={confirmCloseCurrentImage} type="button">
              关闭当前图片
            </button>
          ) : (
            <button
              data-testid="context-delete-slice"
              onClick={() => {
                deleteSlice(contextMenu.sliceId);
                setContextMenu(null);
              }}
              type="button"
            >
              删除选区
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function currentZoomFallback() {
  return useWorkspaceStore.getState().zoom;
}

function isDrawingTool(toolId: ToolId) {
  return ["rect", "rounded", "square", "circle", "ellipse"].includes(toolId);
}

function getDrawingOptions(toolId: ToolId, fallbackShape: SliceShape, fallbackRatio: AspectRatioPreset) {
  if (!isDrawingTool(toolId)) {
    return null;
  }

  if (toolId === "rounded") {
    return { shape: "rounded" as const, aspectRatio: fallbackRatio };
  }

  if (toolId === "circle") {
    return { shape: "ellipse" as const, aspectRatio: "1:1" as const };
  }

  if (toolId === "ellipse") {
    return { shape: "ellipse" as const, aspectRatio: fallbackRatio };
  }

  if (toolId === "square") {
    return { shape: "rect" as const, aspectRatio: "1:1" as const };
  }

  return { shape: fallbackShape, aspectRatio: fallbackRatio };
}

function getCreateAspectRatio(toolId: ToolId, fallbackRatio: AspectRatioPreset) {
  return getDrawingOptions(toolId, "rect", fallbackRatio)?.aspectRatio ?? fallbackRatio;
}
