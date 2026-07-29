"use client";

import * as React from "react";
import {
  autoPairCommand,
  backspacePairCommand,
  caretPosition,
  closeNearestTagCommand,
  closeTagCommand,
  duplicateLinesCommand,
  indentCommand,
  lineStartAt,
  moveLinesCommand,
  newlineCommand,
  reindent,
  toggleCommentCommand,
  type Edit,
} from "@/lib/editor-commands";
import { getCompletions, type Completion } from "@/lib/editor-complete";
import { CARET, expandCssAbbreviation, expandHtmlAbbreviation } from "@/lib/editor-emmet";
import { highlightToHtml, type EditorLang } from "@/lib/editor-highlight";
import "./editor.css";

export interface PaneSettings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  wrap: boolean;
  lineNumbers: boolean;
  autoComplete: boolean;
  autoClose: boolean;
}

export interface RevealRequest {
  offset: number;
  /** Bumped on every request so repeat jumps to the same spot still fire. */
  nonce: number;
}

interface CodePaneProps {
  value: string;
  onChange: (next: string) => void;
  lang: EditorLang;
  settings: PaneSettings;
  label: string;
  onRun?: () => void;
  onSave?: () => void;
  onCaretChange?: (position: { line: number; column: number }) => void;
  /** Ctrl+wheel zoom, reported so every pane stays the same size. */
  onZoom?: (delta: number) => void;
  reveal?: RevealRequest | null;
  className?: string;
}

interface PopupState {
  items: Completion[];
  from: number;
  to: number;
  index: number;
  x: number;
  y: number;
}

const countLinesBefore = (value: string, index: number) => {
  let count = 0;
  for (let i = 0; i < index; i++) if (value[i] === "\n") count++;
  return count;
};

/**
 * Applies an edit through `execCommand` so the browser keeps it on the native
 * undo stack. Setting `.value` directly would work but would make Ctrl+Z jump
 * over everything the editor did on the user's behalf.
 */
function applyEdit(textarea: HTMLTextAreaElement, edit: Edit, fallback: (next: string) => void) {
  const isCaretOnly = edit.from === edit.to && edit.text === "";

  if (!isCaretOnly) {
    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, edit.text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      const next = textarea.value.slice(0, edit.from) + edit.text + textarea.value.slice(edit.to);
      textarea.value = next;
      fallback(next);
    }
  }

  textarea.setSelectionRange(edit.selStart, edit.selEnd);
}

export function CodePane({
  value,
  onChange,
  lang,
  settings,
  label,
  onRun,
  onSave,
  onCaretChange,
  onZoom,
  reveal,
  className,
}: CodePaneProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const rowsRef = React.useRef<HTMLDivElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const activeRowRef = React.useRef(-1);

  const [popup, setPopup] = React.useState<PopupState | null>(null);

  const painted = React.useMemo(() => highlightToHtml(value, lang), [value, lang]);

  /* --------------------------------------------------------- painting */

  const syncScroll = React.useCallback(() => {
    const textarea = textareaRef.current;
    const rows = rowsRef.current;
    if (!textarea || !rows) return;
    rows.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }, []);

  const syncActiveRow = React.useCallback(() => {
    const textarea = textareaRef.current;
    const rows = rowsRef.current;
    if (!textarea || !rows) return;

    const line = countLinesBefore(textarea.value, textarea.selectionStart);
    if (line === activeRowRef.current) return;
    rows.children[activeRowRef.current]?.classList.remove("is-active");
    rows.children[line]?.classList.add("is-active");
    activeRowRef.current = line;
  }, []);

  // A fresh paint replaces every row, so the active marker has to be re-applied.
  React.useEffect(() => {
    activeRowRef.current = -1;
    syncActiveRow();
    syncScroll();
  }, [painted, syncActiveRow, syncScroll]);

  const reportCaret = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !onCaretChange) return;
    onCaretChange(caretPosition(textarea.value, textarea.selectionStart));
  }, [onCaretChange]);

  /* ------------------------------------------------------- completions */

  const closePopup = React.useCallback(() => setPopup(null), []);

  /** Caret coordinates inside the wrapper, for placing the popup. */
  const caretPoint = React.useCallback(() => {
    const textarea = textareaRef.current;
    const rows = rowsRef.current;
    if (!textarea || !rows) return { x: 0, y: 0 };

    const line = countLinesBefore(textarea.value, textarea.selectionStart);
    const column = textarea.selectionStart - lineStartAt(textarea.value, textarea.selectionStart);
    const row = rows.children[line] as HTMLElement | undefined;
    const code = row?.querySelector<HTMLElement>(".ed-code");

    const charWidth = measureCharWidth(settings.fontFamily, settings.fontSize);
    const lineHeight = settings.fontSize * 1.6;
    const left = (code?.offsetLeft ?? 0) + column * charWidth - textarea.scrollLeft;
    const top = (row?.offsetTop ?? 0) + (row?.offsetHeight ?? lineHeight) - textarea.scrollTop;

    const width = wrapperRef.current?.clientWidth ?? 0;
    return { x: Math.max(4, Math.min(left, Math.max(4, width - 288))), y: top + 4 };
  }, [settings.fontFamily, settings.fontSize]);

  const refreshCompletions = React.useCallback(
    (explicit: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (!settings.autoComplete && !explicit) {
        setPopup(null);
        return;
      }
      if (textarea.selectionStart !== textarea.selectionEnd) {
        setPopup(null);
        return;
      }

      const result = getCompletions(textarea.value, textarea.selectionStart, lang, explicit);
      if (!result || result.items.length === 0) {
        setPopup(null);
        return;
      }
      const point = caretPoint();
      setPopup({ ...result, index: 0, x: point.x, y: point.y });
    },
    [caretPoint, lang, settings.autoComplete]
  );

  const acceptCompletion = React.useCallback(
    (item: Completion) => {
      const textarea = textareaRef.current;
      if (!textarea || !popup) return;

      const template = item.insert ?? item.label;
      const caretAt = template.indexOf("|");
      const text = caretAt === -1 ? template : template.replace("|", "");
      const caret = popup.from + (caretAt === -1 ? text.length : caretAt);

      applyEdit(textarea, { from: popup.from, to: popup.to, text, selStart: caret, selEnd: caret }, onChange);
      setPopup(null);
      requestAnimationFrame(reportCaret);
    },
    [onChange, popup, reportCaret]
  );

  /* ------------------------------------------------------------- keys */

  const runEdit = React.useCallback(
    (edit: Edit | null) => {
      const textarea = textareaRef.current;
      if (!textarea || !edit) return false;
      applyEdit(textarea, edit, onChange);
      requestAnimationFrame(() => {
        syncScroll();
        syncActiveRow();
        reportCaret();
      });
      return true;
    },
    [onChange, reportCaret, syncActiveRow, syncScroll]
  );

  /** Tab in HTML/CSS first tries to expand an Emmet abbreviation. */
  const tryExpandAbbreviation = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || lang === "js") return false;
    const { selectionStart: caret, selectionEnd, value: current } = textarea;
    if (caret !== selectionEnd) return false;

    const from = lineStartAt(current, caret);
    const lineBefore = current.slice(from, caret);
    const token = /\S+$/.exec(lineBefore)?.[0];
    if (!token) return false;

    const expansion =
      lang === "html" ? expandHtmlAbbreviation(token, settings.tabSize) : expandCssAbbreviation(token);
    if (!expansion) return false;

    // Re-indent continuation lines to sit under the abbreviation.
    const indent = /^[ \t]*/.exec(lineBefore)![0];
    const text = expansion.split("\n").join(`\n${indent}`);
    const markerAt = text.indexOf(CARET);
    const clean = markerAt === -1 ? text : text.replace(CARET, "");
    const start = caret - token.length;
    const caretAt = start + (markerAt === -1 ? clean.length : markerAt);

    return runEdit({ from: start, to: caret, text: clean, selStart: caretAt, selEnd: caretAt });
  }, [lang, runEdit, settings.tabSize]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value: current } = textarea;
    const mod = event.ctrlKey || event.metaKey;

    // The popup owns these keys while it's open.
    if (popup) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setPopup((p) =>
          p ? { ...p, index: (p.index + delta + p.items.length) % p.items.length } : p
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptCompletion(popup.items[popup.index]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup();
        return;
      }
    }

    if (mod && event.key === "Enter") {
      event.preventDefault();
      onRun?.();
      return;
    }
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave?.();
      return;
    }
    if (mod && event.key === " ") {
      event.preventDefault();
      refreshCompletions(true);
      return;
    }
    if (mod && event.key === "/") {
      event.preventDefault();
      runEdit(toggleCommentCommand(current, start, end, lang));
      return;
    }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      runEdit(duplicateLinesCommand(current, start, end));
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      const formatted = reindent(current, lang, settings.tabSize);
      if (formatted !== current) {
        runEdit({ from: 0, to: current.length, text: formatted, selStart: start, selEnd: start });
      }
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      runEdit(moveLinesCommand(current, start, end, event.key === "ArrowUp" ? -1 : 1));
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const multiline = current.slice(start, end).includes("\n");
      if (!event.shiftKey && !multiline && tryExpandAbbreviation()) return;
      runEdit(indentCommand(current, start, end, settings.tabSize, event.shiftKey));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runEdit(newlineCommand(current, start, end, lang, settings.tabSize));
      return;
    }

    if (event.key === "Backspace" && settings.autoClose) {
      const edit = backspacePairCommand(current, start, end, settings.tabSize);
      if (edit) {
        event.preventDefault();
        runEdit(edit);
        return;
      }
    }

    if (event.key === "Escape") {
      closePopup();
      return;
    }

    // Printable characters: pairs and tag completion.
    if (event.key.length === 1 && !mod && settings.autoClose) {
      if (lang === "html" && event.key === ">") {
        const edit = closeTagCommand(current, start);
        if (edit && start === end) {
          event.preventDefault();
          runEdit(edit);
          return;
        }
      }
      if (lang === "html" && event.key === "/" && start === end && current[start - 1] === "<") {
        const virtual = `${current.slice(0, start)}/${current.slice(start)}`;
        const edit = closeNearestTagCommand(virtual, start + 1);
        if (edit) {
          event.preventDefault();
          runEdit({
            from: start,
            to: end,
            text: `/${edit.text}`,
            selStart: start + 1 + edit.text.length,
            selEnd: start + 1 + edit.text.length,
          });
          return;
        }
      }

      const edit = autoPairCommand(current, start, end, event.key, lang);
      if (edit) {
        event.preventDefault();
        runEdit(edit);
        return;
      }
    }
  };

  /* ------------------------------------------------------------ effects */

  React.useEffect(() => {
    if (!reveal) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const line = countLinesBefore(textarea.value, reveal.offset);
    const row = rowsRef.current?.children[line] as HTMLElement | undefined;
    textarea.focus();
    textarea.setSelectionRange(reveal.offset, reveal.offset);
    if (row) {
      textarea.scrollTop = Math.max(0, row.offsetTop - textarea.clientHeight / 2);
      syncScroll();
    }
    syncActiveRow();
  }, [reveal, syncActiveRow, syncScroll]);

  // Ctrl+wheel zoom needs a non-passive listener to be able to cancel the
  // browser's own page zoom, which React's synthetic handler can't guarantee.
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !onZoom) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onZoom(event.deltaY > 0 ? -1 : 1);
    };
    textarea.addEventListener("wheel", onWheel, { passive: false });
    return () => textarea.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  return (
    <div
      ref={wrapperRef}
      className={`ed-editor ${className ?? ""}`}
      data-ed-theme={settings.theme}
      data-wrap={settings.wrap ? "on" : "off"}
      data-gutter={settings.lineNumbers ? "on" : "off"}
      style={
        {
          "--ed-font": settings.fontFamily,
          "--ed-size": `${settings.fontSize}px`,
          "--ed-tab": settings.tabSize,
        } as React.CSSProperties
      }
    >
      <div className="ed-layer" aria-hidden>
        <div ref={rowsRef} className="ed-rows" dangerouslySetInnerHTML={{ __html: painted }} />
      </div>

      <textarea
        ref={textareaRef}
        className="ed-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          requestAnimationFrame(() => {
            syncScroll();
            syncActiveRow();
            reportCaret();
            refreshCompletions(false);
          });
        }}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        onKeyUp={syncActiveRow}
        onClick={() => {
          syncActiveRow();
          reportCaret();
          closePopup();
        }}
        onSelect={reportCaret}
        onBlur={closePopup}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap={settings.wrap ? "soft" : "off"}
        aria-label={label}
      />

      {popup && (
        <ul className="ed-complete" style={{ left: popup.x, top: popup.y }} role="listbox">
          {popup.items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <button
                type="button"
                className="ed-complete-item"
                role="option"
                aria-selected={index === popup.index}
                // Blur would close the popup before the click lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  acceptCompletion(item);
                }}
                onMouseEnter={() => setPopup((p) => (p ? { ...p, index } : p))}
              >
                <span className="ed-complete-label">{item.label}</span>
                {item.detail && <span className="ed-complete-detail">{item.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- metrics */

const widthCache = new Map<string, number>();

/** Monospace advance width, measured once per font/size pair. */
function measureCharWidth(fontFamily: string, fontSize: number): number {
  const key = `${fontFamily}@${fontSize}`;
  const cached = widthCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return fontSize * 0.6;
  context.font = `${fontSize}px ${fontFamily}`;
  const width = context.measureText("0".repeat(10)).width / 10;
  widthCache.set(key, width);
  return width;
}
