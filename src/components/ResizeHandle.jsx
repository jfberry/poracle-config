import { useCallback, useEffect, useRef } from 'react';

/**
 * Vertical drag handle that resizes by calling onResize(deltaPx) on mouse move.
 * The parent decides what to do with the delta (e.g. update left panel width).
 */
export default function ResizeHandle({ onResize }) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      onResize(delta);
    };
    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 shrink-0 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
      title="Drag to resize"
    />
  );
}
