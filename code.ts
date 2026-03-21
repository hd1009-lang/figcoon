// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// import { extractGroupCSS, formatAsCSS } from "./utils/index";
// import { extractLayoutSummary } from "./utils/layout-summary";
import { extractDesignTokens } from "./utils/variable";

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
  if (msg.type === "create-shapes") {
    // This plugin creates rectangles on the screen.
    const numberOfRectangles = msg.count;
    // const target = figma.currentPage.selection[0];

    // const result = await extractGroupCSS(target);
    // const cssString = formatAsCSS(result);
    // console.log({cssString});
    // const summary = extractLayoutSummary(target);
    // console.log(JSON.stringify(summary, null, 2));
    // console.log({ variable });

     const tokens = await extractDesignTokens();

  console.log(JSON.stringify(tokens, null, 2));

    const nodes: SceneNode[] = [];
    for (let i = 0; i < numberOfRectangles; i++) {
      const rect = figma.createRectangle();
      rect.x = i * 150;
      rect.fills = [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }];
      figma.currentPage.appendChild(rect);
      nodes.push(rect);
    }
    // figma.currentPage.selection = nodes;
    // figma.viewport.scrollAndZoomIntoView(nodes);
    figma.ui.postMessage({
      type: "result", data: JSON.stringify(tokens, null, 2)
    })
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
