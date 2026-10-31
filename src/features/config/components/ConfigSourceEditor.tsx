import { useMemo, type Ref } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  keymap,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

type ConfigSourceEditorProps = {
  value: string;
  onChange: (value: string) => void;
  editorRef?: Ref<ReactCodeMirrorRef>;
  theme: 'light' | 'dark';
  editable: boolean;
  placeholder: string;
};

/**
 * Token colors come from the app's semantic CSS variables (blue keys, green strings,
 * amber scalars, muted comments) so both themes follow config-source.png.
 */
const yamlHighlightStyle = HighlightStyle.define([
  { tag: tags.definition(tags.propertyName), color: 'var(--info-color)' },
  { tag: tags.propertyName, color: 'var(--info-color)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--status-success)' },
  { tag: tags.content, color: 'var(--text-primary)' },
  { tag: [tags.lineComment, tags.comment], color: 'var(--text-muted)' },
  { tag: [tags.separator, tags.meta], color: 'var(--text-tertiary)' },
  { tag: [tags.labelName, tags.typeName, tags.keyword], color: 'var(--status-warning)' },
]);

/** The YAML grammar tags plain scalars as content; mark numbers/booleans/null separately. */
const scalarMatcher = new MatchDecorator({
  regexp: /(?<=(?::|^\s*-)\s+)(?:true|false|null|~|-?\d+(?:\.\d+)?)(?=\s*(?:#.*)?$)/gim,
  decoration: Decoration.mark({ class: 'cm-yamlScalar' }),
});

const scalarHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = scalarMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = scalarMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

const darkBase = EditorView.theme({}, { dark: true });
const lightBase = EditorView.theme({}, { dark: false });

export default function ConfigSourceEditor({
  value,
  onChange,
  editorRef,
  theme,
  editable,
  placeholder,
}: ConfigSourceEditorProps) {
  const extensions = useMemo(
    () => [
      yaml(),
      syntaxHighlighting(yamlHighlightStyle),
      scalarHighlighter,
      search(),
      highlightSelectionMatches(),
      keymap.of(searchKeymap),
    ],
    []
  );

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme === 'dark' ? darkBase : lightBase}
      editable={editable}
      placeholder={placeholder}
      height="100%"
      style={{ height: '100%' }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        searchKeymap: true,
        foldKeymap: true,
        completionKeymap: false,
        lintKeymap: true,
      }}
    />
  );
}
