// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

import { buildFlatCSS } from "../../../features/css-styles/api/css-style";
import { extractGroupCSS, mergeVariableComments } from "../../../features/css-styles-structure/api/css-style-structure";
import { extractLayoutSummary } from "../../../features/json-structure/api/layout-summary";
import { extractDesignTokens } from "../../../features/variables/api/variable";
import { COMMAND } from "./command";

// import { extractGroupCSS, formatAsCSS } from "./utils/index";

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);
figma.ui.resize(800, 600);

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
type CommandHandler = (target?: SceneNode) => Promise<unknown>;

const requiresSelection: Set<string> = new Set([
  COMMAND.get_json_structure,
  COMMAND.get_css_structure,
  COMMAND.get_css_layout,
]);

const commandHandlers: Record<string, CommandHandler> = {
  [COMMAND.get_variables]: () => extractDesignTokens(),
  [COMMAND.get_json_structure]: (target) => Promise.resolve(extractLayoutSummary(target!)),
  [COMMAND.get_css_structure]: async (target) => {
    const result = await extractGroupCSS(target!);
    return mergeVariableComments(result);
  },
  [COMMAND.get_css_layout]: (target) => buildFlatCSS(target!),
};

figma.ui.onmessage = async (msg: { type: string; count: number }) => {
  const handler = commandHandlers[msg.type];
  if (!handler) return;

  let target: SceneNode | undefined;

  if (requiresSelection.has(msg.type)) {
    target = figma.currentPage.selection[0];
    if (!target) {
      figma.ui.postMessage({
        type: COMMAND.receive_result,
        data: JSON.stringify({ error: "No target selected" }, null, 2),
      });
      return;
    }
  }

  const data = await handler(target);
  figma.ui.postMessage({
    type: COMMAND.receive_result,
    data: JSON.stringify(data, null, 2),
  });
};
