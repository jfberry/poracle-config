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
    if (!el) return false;

    // Use the native input setter to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    ).set;

    const pos = cursorPosRef.current;
    const braceContext = insideHandlebars(el.value, pos);

    // If cursor is inside {{ }} or {{{ }}}, insert just the field name
    const insertText = braceContext ? stripBraces(text) : text;

    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    const newValue = before + insertText + after;

    nativeInputValueSetter.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Restore focus and set cursor after inserted text
    const newPos = pos + insertText.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
      cursorPosRef.current = newPos;
    });

    return true;
  }, []);

  return { containerRef, insertAtCursor };
}
