import React, { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES, MAX_FILES } from "../config";
import { formatBytes } from "../utils/format";
import styles from "../imageConverter.module.css";

interface UploadDropzoneProps {
  /** Free slots left in this batch */
  remaining: number;
  disabled?: boolean;
  onFiles:   (files: File[]) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({ remaining, disabled = false, onFiles }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // dragenter/leave fire for every child element — count them to know when the pointer really left
  const depth = useRef(0);

  const blocked = disabled || remaining <= 0;

  const openPicker = () => { if (!blocked) inputRef.current?.click(); };

  const take = (list: FileList | null) => {
    if (!list || !list.length || blocked) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked}
      aria-label={`Add images. ${remaining} of ${MAX_FILES} slots left.`}
      className={styles.dropzone}
      data-active={dragging}
      data-no-swipe
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
      }}
      onDragEnter={(e) => { e.preventDefault(); depth.current++; if (!blocked) setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = blocked ? "none" : "copy"; }}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        take(e.dataTransfer.files);
      }}
    >
      <ImagePlus aria-hidden style={{ width: 28, height: 28, color: "var(--primary)" }} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
        {remaining <= 0 ? `Batch is full (${MAX_FILES} images)` : dragging ? "Drop images to add them" : (
          <>
            <span className={styles.desktopOnly}>Drag &amp; drop images here, or click to browse</span>
            <span className={styles.mobileOnly}>Tap to choose images</span>
          </>
        )}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--fi-muted)", lineHeight: 1.45 }}>
        <span className={styles.desktopOnly}>JPEG, PNG, WebP, BMP, GIF, AVIF and other formats your browser can open · </span>
        <span className={styles.mobileOnly}>JPEG, PNG, WebP, BMP, GIF &amp; more · </span>
        up to {MAX_FILES} images · max {formatBytes(MAX_FILE_BYTES)} each
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className={styles.srOnly}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => { take(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
};
