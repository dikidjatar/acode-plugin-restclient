import * as Constants from "../common/constants";
import { Selector } from "../utils/selector";

const { Decoration, WidgetType, EditorView } =
  acode.require("@codemirror/view");
const { RangeSetBuilder, StateField, EditorSelection } =
  acode.require("@codemirror/state");
const commands = acode.require("commands");

class SendRequestWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  eq(other: SendRequestWidget): boolean {
    return this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "rest-client-codelens";

    const button = document.createElement("span");
    button.className = "rest-client-codelens-button";
    button.textContent = "▶ Send Request";
    button.title = "Send this HTTP request";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      commands.registry.execute(
        "rest-client.request",
        editorManager.editor,
        EditorSelection.range(this.from, this.to)
      );
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecorations(state: any) {
  const builder = new RangeSetBuilder();
  const doc = state.doc;

  const lines: string[] = doc.toString().split(Constants.LineSplitterRegex);
  const requestRanges: [number, number][] = Selector.getRequestRanges(lines);

  for (const [blockStart, blockEnd] of requestRanges) {
    if (blockStart >= doc.lines) {
      continue;
    }

    const startLine = doc.line(blockStart + 1);
    const endLineNumber = Math.min(blockEnd + 1, doc.lines);
    const endLine = doc.line(endLineNumber);

    const from = startLine.from;
    const to = endLine.to;

    builder.add(
      from,
      from,
      Decoration.widget({
        widget: new SendRequestWidget(from, to),
        block: true,
        side: -1,
      })
    );
  }

  return builder.finish();
}

export const httpCodeLensExtension = StateField.define({
  create(state: any) {
    return buildDecorations(state);
  },
  update(decorations: any, transaction: any) {
    if (transaction.docChanged) {
      return buildDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field: any) => EditorView.decorations.from(field),
});
