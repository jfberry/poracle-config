import { useRef, useCallback, useEffect } from 'react';

/**
 * Tracks the last focused input/textarea in a container and provides
 * an insert function that inserts text at the cursor position.
 */
export function useInsertAtCursor() {
  const activeElementRef = useRef(null);
  const cursorPosRef = useRef(0);

  // Track focus and cursor position on any input/textarea
  const handleFocusIn = useCallback((e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeElementRef.current = el;
      cursorPosRef.current = el.selectionStart ?? el.value.length;
    }
  }, []);

  // Track cursor movement (clicks, arrow keys)
  const handleSelect = useCallback((e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeElementRef.current = el;
      cursorPosRef.current = el.selectionStart ?? el.value.length;
    }
  }, []);

  // Attach listeners to the editor container
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('select', handleSelect);
    container.addEventListener('click', handleSelect);
    container.addEventListener('keyup', handleSelect);
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('select', handleSelect);
      container.removeEventListener('click', handleSelect);
      container.removeEventListener('keyup', handleSelect);
    };
  }, [handleFocusIn, handleSelect]);

  const insertAtCursor = useCallback((text) => {
    const el = activeElementRef.current;
    if (!el) return false;

    // Use the native input setter to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    ).set;

    const pos = cursorPosRef.current;
    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    const newValue = before + text + after;

    nativeInputValueSetter.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Restore focus and set cursor after inserted text
    const newPos = pos + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
      cursorPosRef.current = newPos;
    });

    return true;
  }, []);

  return { containerRef, insertAtCursor };
}
