// Общий редактор Python (ED.1–ED.3): CodeMirror 6 + y-codemirror (курсоры, правки обоих).
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { tags as t } from '@lezer/highlight';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { authorship, type Author } from './authorship';
import { pyHints, pyCompletion } from './hints';

export const codeHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-fn)' },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: 'var(--syn-def)' },
  { tag: [t.standard(t.variableName), t.self], color: 'var(--syn-builtin)' },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator], color: 'var(--syn-op)' },
  { tag: [t.paren, t.squareBracket, t.brace, t.punctuation], color: 'var(--syn-punct)' },
]);

export interface CodeEditorOpts {
  parent: HTMLElement;
  onRun: () => void;
  fontSize: number;
  /** автодополнение: у учителя всегда, у ученика — по переключателю */
  completion: boolean;
}

export class CodeEditor {
  view: EditorView | null = null;
  private collab = new Compartment();
  private size = new Compartment();
  private complete = new Compartment();
  private undo: Y.UndoManager | null = null;

  constructor(private o: CodeEditorOpts) {}

  private fontTheme(px: number) {
    return EditorView.theme({ '&': { fontSize: px + 'px' } });
  }

  /** Привязать редактор к тексту задачи; при смене задачи вид пересоздаётся. */
  bind(text: Y.Text, awareness: Awareness, clients: Y.Map<Author>) {
    this.view?.destroy();
    this.undo?.destroy();
    this.undo = new Y.UndoManager(text);
    const runKey = Prec.highest(keymap.of([{ key: 'Mod-Enter', preventDefault: true, run: () => { this.o.onRun(); return true; } }]));
    this.view = new EditorView({
      parent: this.o.parent,
      state: EditorState.create({
        doc: text.toString(),
        extensions: [
          runKey,
          authorship(text, clients),
          lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(),
          indentOnInput(), bracketMatching(), closeBrackets(),
          indentUnit.of('    '), EditorState.tabSize.of(4),
          python(), syntaxHighlighting(codeHighlight),
          pyHints(), this.complete.of(pyCompletion(this.o.completion)),
          keymap.of([...closeBracketsKeymap, ...yUndoManagerKeymap, ...defaultKeymap, indentWithTab]),
          this.collab.of(yCollab(text, awareness, { undoManager: this.undo })),
          this.size.of(this.fontTheme(this.o.fontSize)),
          EditorView.contentAttributes.of({ 'aria-label': 'Код на Python', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        ],
      }),
    });
  }

  setFontSize(px: number) {
    this.o.fontSize = px;
    this.view?.dispatch({ effects: this.size.reconfigure(this.fontTheme(px)) });
  }

  setCompletion(on: boolean) {
    if (this.o.completion === on) return;
    this.o.completion = on;
    this.view?.dispatch({ effects: this.complete.reconfigure(pyCompletion(on)) });
  }

  focus() { this.view?.focus(); }
  destroy() { this.view?.destroy(); this.undo?.destroy(); }
}
