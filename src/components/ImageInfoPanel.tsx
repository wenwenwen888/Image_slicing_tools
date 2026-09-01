import { Info, X } from "lucide-react";
import { useState } from "react";
import { formatFileSize, formatMimeType } from "../core/numbers";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function ImageInfoPanel() {
  const [open, setOpen] = useState(false);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);

  return (
    <>
      <Hint text="查看当前图片信息。">
        <button
          aria-label="图片信息"
          className="icon-button"
          data-testid="image-info-button"
          disabled={!imageDocument}
          onClick={() => setOpen(true)}
          type="button"
        >
          <Info size={16} />
        </button>
      </Hint>
      {open && imageDocument && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <section
            aria-label="图片信息"
            className="info-modal"
            data-testid="image-info-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>图片信息</h2>
              <button aria-label="关闭图片信息" className="icon-button" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <dl className="info-list">
              <div>
                <dt>文件名</dt>
                <dd>{imageDocument.fileName}</dd>
              </div>
              <div>
                <dt>尺寸</dt>
                <dd>
                  {imageDocument.width} x {imageDocument.height}
                </dd>
              </div>
              <div>
                <dt>大小</dt>
                <dd>{formatFileSize(imageDocument.fileSize)}</dd>
              </div>
              <div>
                <dt>格式</dt>
                <dd>{formatMimeType(imageDocument.mimeType)}</dd>
              </div>
              <div>
                <dt>透明通道</dt>
                <dd>{imageDocument.hasAlpha ? "有" : "无"}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </>
  );
}
