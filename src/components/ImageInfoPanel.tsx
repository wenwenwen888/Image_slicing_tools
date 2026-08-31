import { formatFileSize, formatMimeType } from "../core/numbers";
import { useWorkspaceStore } from "../store/workspace-store";

export function ImageInfoPanel() {
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);

  return (
    <section className="panel-section">
      <h2>图片信息</h2>
      {imageDocument ? (
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
      ) : (
        <div className="empty-list">尚未导入图片</div>
      )}
    </section>
  );
}
