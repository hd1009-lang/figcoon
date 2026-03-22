// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

import { buildFlatCSS } from "../../../features/css-styles/api/css-style";
import { extractGroupCSS } from "../../../features/css-styles-structure/api/css-style-structure";
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
figma.ui.resize(600, 600);

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = async (msg: { type: string; count: number }) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === COMMAND.get_variables) {
    const tokens = await extractDesignTokens();
    figma.ui.postMessage({
      type: COMMAND.receive_result,
      data: JSON.stringify(tokens, null, 2),
    });
  }
  if (msg.type === COMMAND.get_json_structure) {
    const target = figma.currentPage.selection[0];
    if (!target) {
      figma.ui.postMessage({
        type: COMMAND.receive_result,
        data: JSON.stringify({ error: "No target selected" }, null, 2),
      });
      return;
    }
    const data = await extractLayoutSummary(target);
    figma.ui.postMessage({
      type: COMMAND.receive_result,
      data: JSON.stringify(data, null, 2),
    });
  }
  if (msg.type === COMMAND.get_css_structure) {
    const target = figma.currentPage.selection[0];
    if (!target) {
      figma.ui.postMessage({
        type: COMMAND.receive_result,
        data: JSON.stringify({ error: "No target selected" }, null, 2),
      });
      return;
    }
    const data = await extractGroupCSS(target);
    figma.ui.postMessage({
      type: COMMAND.receive_result,
      data: JSON.stringify(data, null, 2),
    });
  }
  if (msg.type === COMMAND.get_css_layout) {
    const target = figma.currentPage.selection[0];
    if (!target) {
      figma.ui.postMessage({
        type: COMMAND.receive_result,
        data: JSON.stringify({ error: "No target selected" }, null, 2),
      });
      return;
    }
    const data = await buildFlatCSS(target);
    figma.ui.postMessage({
      type: COMMAND.receive_result,
      data: JSON.stringify(data, null, 2),
    });
  }
};
