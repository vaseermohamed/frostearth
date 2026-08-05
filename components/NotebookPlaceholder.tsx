import { useId } from "react";

/**
 * Fallback thumbnail for products with no coverImageKey — ruled notebook
 * paper instead of an empty box, since these ARE handwritten notes.
 * Size/shape is entirely controlled by `className` (e.g. "w-full h-40
 * rounded-md") from the call site.
 */
export default function NotebookPlaceholder({ className = "" }: { className?: string }) {
  const patternId = `notebook-rules-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={`relative overflow-hidden bg-paper ${className}`} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id={patternId} width="100%" height="26" patternUnits="userSpaceOnUse">
            <line x1="0" y1="25.5" x2="100%" y2="25.5" stroke="#DEDED7" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        <line x1="30" y1="0" x2="30" y2="100%" stroke="#DBB0B0" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
