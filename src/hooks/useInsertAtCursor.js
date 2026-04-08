import { useRef, useState, useCallback, useEffect } from 'react';
import { detectBlockContext } from '../lib/handlebars-context';

/**
 * Tracks the last focused input/textarea in a container and provides
 * an insert function that inserts text at the cursor position.
 * Also detects handlebars block context at the cursor.
 */
export function useInsertAtCursor() {
  const activeElementRef = useRef(null);
  const cursorPosRef = useRef(0);
  const [blockContext, setBlockContext] = useState(null);

  const updateBlockContext = useCallback((el) => {
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) {
      return;
    }
    const pos = el.selectionStart ?? 0;
    const ctx = detectBlockContext(el.value, pos);
    setBlockContext(ctx);
  }, []);

  // Track focus and cursor position on any input/textarea
  const handleFocusIn = useCallback((e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeElementRef.current = el;
      cursorPosRef.current = el.selectionStart ?? el.value.length;
      updateBlockContext(el);
    }
  }, [updateBlockContext]);

  // Track cursor movement (clicks, arrow keys)
  const handleSelect = useCallback((e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeElementRef.current = el;
      cursorPosRef.current = el.selectionStart ?? el.value.length;
      updateBlockContext(el);
    }
  }, [updateBlockContext]);

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

  /**
   * Check if the cursor is inside a handlebars expression.
   * Returns false if not inside braces, 2 for {{ }}, 3 for {{{ }}}.
   */
  function insideHandlebars(value, pos) {
    const before = value.substring(0, pos);
    // Find the last opening {{ or {{{ before cursor
    const lastTriple = before.lastIndexOf('{{{');
    const lastDouble = before.lastIndexOf('{{');

    // No opening braces before cursor
    if (lastDouble === -1) return false;

    // Check if it's a triple brace
    const openPos = lastTriple !== -1 && lastTriple >= lastDouble - 1 ? lastTriple : lastDouble;
    const isTriple = lastTriple !== -1 && lastTriple === openPos;

    // Check there's no matching close between the open and cursor
    const afterOpen = before.substring(openPos);
    if (isTriple) {
      if (afterOpen.indexOf('}}}') !== -1) return false;
      return 3;
    } else {
      if (afterOpen.indexOf('}}') !== -1) return false;
      return 2;
    }
  }

  /**
   * Strip handlebars braces from text if present.
   * "{{fieldName}}" → "fieldName", "{{{fieldName}}}" → "fieldName"
   */
  function stripBraces(text) {
    if (text.startsWith('{{{') && text.endsWith('}}}')) {
      return text.slice(3, -3);
    }
    if (text.startsWith('{{') && text.endsWith('}}')) {
      return text.slice(2, -2);
    }
    return text;
  }

  const insertAtCursor = useCallback((text) => {
    const el = activeElementRef.current;
    if (!el || !document.body.contains(el)) return false;

    const start = el.selectionStart ?? cursorPosRef.current;
    const end = el.selectionEnd ?? start;
    const braceContext = insideHandlebars(el.value, start);

    // If cursor is inside {{ }} or {{{ }}}, insert just the field name
    const insertText = braceContext ? stripBraces(text) : text;

    // Restore focus + selection
    el.focus();
    el.setSelectionRange(start, end);

    // Try execCommand first (preserves native undo)
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, insertText);
    } catch {
      inserted = false;
    }

    // Fallback for React-controlled inputs where execCommand may not propagate:
    // use the native value setter then dispatch an input event so React picks it up.
    if (!inserted || el.value.substring(start, start + insertText.length) !== insertText) {
      const before = el.value.substring(0, start);
      const after = el.value.substring(end);
      const newValue = before + insertText + after;

      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Place cursor after the inserted text
    const newPos = start + insertText.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
    cursorPosRef.current = newPos;

    return true;
  }, []);

  return { containerRef, insertAtCursor, blockContext };
}
