'use strict';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function toHex(v) {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
function rgbaColor(r, g, b, a) {
    if (a >= 0.999)
        return rgbToHex(r, g, b);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}
/** Lấy phần tên cuối sau dấu / */
function shortName(name) {
    const parts = name.split("/");
    return parts[parts.length - 1].trim();
}
/** Lấy group (tất cả trừ phần cuối) */
function groupName(name) {
    const parts = name.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/").trim() : "ungrouped";
}
/** Group array theo key */
function groupBy(arr, keyFn) {
    const result = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key])
            result[key] = [];
        result[key].push(item);
    }
    return result;
}
const fontWeightMap = {
    Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
    Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};
// ─────────────────────────────────────────────────────────────────────────────
// VARIABLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function resolveVariableValue(value, type, allVariables) {
    // Alias reference
    if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
        const alias = value;
        const target = allVariables.get(alias.id);
        return {
            resolved: null,
            aliasTo: target ? target.name : alias.id,
        };
    }
    // COLOR
    if (type === "COLOR" && typeof value === "object" && value !== null && "r" in value) {
        const c = value;
        return { resolved: rgbaColor(c.r, c.g, c.b, c.a) };
    }
    // FLOAT, STRING, BOOLEAN
    if (typeof value === "number")
        return { resolved: +value.toFixed(4) };
    if (typeof value === "string")
        return { resolved: value };
    if (typeof value === "boolean")
        return { resolved: value };
    return { resolved: null };
}
function extractVariables() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const collections = yield figma.variables.getLocalVariableCollectionsAsync();
        const allVariablesList = yield figma.variables.getLocalVariablesAsync();
        // Map id → variable để resolve alias
        const variableMap = new Map();
        for (const v of allVariablesList) {
            variableMap.set(v.id, v);
        }
        const collectionSummaries = [];
        let totalVariables = 0;
        for (const collection of collections) {
            // Build mode id → name map
            const modeMap = new Map();
            for (const mode of collection.modes) {
                modeMap.set(mode.modeId, mode.name);
            }
            const defaultModeId = collection.defaultModeId;
            const defaultModeName = (_a = modeMap.get(defaultModeId)) !== null && _a !== void 0 ? _a : "Default";
            const variableSummaries = [];
            for (const varId of collection.variableIds) {
                const variable = variableMap.get(varId);
                if (!variable)
                    continue;
                const valuesByMode = [];
                let defaultValue = null;
                for (const mode of collection.modes) {
                    const rawValue = variable.valuesByMode[mode.modeId];
                    if (rawValue === undefined)
                        continue;
                    const { resolved, aliasTo } = resolveVariableValue(rawValue, variable.resolvedType, variableMap);
                    const entry = {
                        modeName: mode.name,
                        value: aliasTo ? null : resolved,
                    };
                    if (aliasTo)
                        entry.aliasTo = aliasTo;
                    valuesByMode.push(entry);
                    if (mode.modeId === defaultModeId) {
                        defaultValue = aliasTo ? null : resolved;
                    }
                }
                const summary = {
                    id: variable.id,
                    name: variable.name,
                    shortName: shortName(variable.name),
                    type: variable.resolvedType,
                    valuesByMode,
                    defaultValue,
                    scopes: variable.scopes,
                };
                if (variable.description)
                    summary.description = variable.description;
                variableSummaries.push(summary);
                totalVariables++;
            }
            collectionSummaries.push({
                id: collection.id,
                name: collection.name,
                modes: collection.modes.map((m) => m.name),
                defaultMode: defaultModeName,
                variables: variableSummaries,
            });
        }
        return {
            totalCollections: collectionSummaries.length,
            totalVariables,
            collections: collectionSummaries,
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// PAINT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function extractPaintStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const paintStyles = yield figma.getLocalPaintStylesAsync();
        const summaries = [];
        for (const style of paintStyles) {
            const paints = [];
            for (const paint of style.paints) {
                if (paint.visible === false)
                    continue;
                const entry = { type: paint.type };
                if (paint.type === "SOLID") {
                    const { r, g, b } = paint.color;
                    entry.color = rgbaColor(r, g, b, (_a = paint.opacity) !== null && _a !== void 0 ? _a : 1);
                    if (((_b = paint.opacity) !== null && _b !== void 0 ? _b : 1) < 1)
                        entry.opacity = +((_c = paint.opacity) !== null && _c !== void 0 ? _c : 1).toFixed(3);
                }
                if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") {
                    const stops = paint.gradientStops
                        .map((s) => {
                        const { r, g, b, a } = s.color;
                        return `${rgbaColor(r, g, b, a)} ${Math.round(s.position * 100)}%`;
                    })
                        .join(", ");
                    entry.gradient =
                        paint.type === "GRADIENT_LINEAR"
                            ? `linear-gradient(${stops})`
                            : `radial-gradient(${stops})`;
                }
                paints.push(entry);
            }
            const item = {
                id: style.id,
                name: style.name,
                shortName: shortName(style.name),
                group: groupName(style.name),
                paints,
            };
            if (style.description)
                item.description = style.description;
            summaries.push(item);
        }
        return {
            total: summaries.length,
            groups: groupBy(summaries, (s) => s.group),
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// TEXT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function extractTextStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const textStyles = yield figma.getLocalTextStylesAsync();
        const summaries = [];
        for (const style of textStyles) {
            const styleKey = style.fontName.style.replace(/\s/g, "").replace(/Italic/i, "");
            const fontWeight = (_a = fontWeightMap[styleKey]) !== null && _a !== void 0 ? _a : style.fontName.style;
            // Line height
            let lineHeight = "normal";
            if (style.lineHeight.unit === "PIXELS")
                lineHeight = `${style.lineHeight.value}px`;
            else if (style.lineHeight.unit === "PERCENT")
                lineHeight = `${+((style.lineHeight.value / 100).toFixed(3))}`;
            // Letter spacing
            let letterSpacing = "0";
            if (style.letterSpacing.unit === "PIXELS" && style.letterSpacing.value !== 0) {
                letterSpacing = `${style.letterSpacing.value}px`;
            }
            else if (style.letterSpacing.unit === "PERCENT" && style.letterSpacing.value !== 0) {
                letterSpacing = `${+(style.letterSpacing.value / 100).toFixed(4)}em`;
            }
            // Text decoration
            let textDecoration;
            if (style.textDecoration === "UNDERLINE")
                textDecoration = "underline";
            else if (style.textDecoration === "STRIKETHROUGH")
                textDecoration = "line-through";
            // Text case
            const caseMap = {
                UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize",
            };
            const textCase = caseMap[style.textCase];
            const item = {
                id: style.id,
                name: style.name,
                shortName: shortName(style.name),
                group: groupName(style.name),
                fontFamily: style.fontName.family,
                fontStyle: style.fontName.style,
                fontWeight,
                fontSize: style.fontSize,
                lineHeight,
                letterSpacing,
            };
            if (textDecoration)
                item.textDecoration = textDecoration;
            if (textCase)
                item.textCase = textCase;
            if (style.paragraphSpacing)
                item.paragraphSpacing = style.paragraphSpacing;
            if (style.description)
                item.description = style.description;
            summaries.push(item);
        }
        return {
            total: summaries.length,
            groups: groupBy(summaries, (s) => s.group),
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// EFFECT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function extractEffectStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const effectStyles = yield figma.getLocalEffectStylesAsync();
        const summaries = [];
        for (const style of effectStyles) {
            const effects = [];
            for (const effect of style.effects) {
                if (effect.visible === false)
                    continue;
                const entry = { type: effect.type };
                if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
                    const { r, g, b, a } = effect.color;
                    entry.color = rgbaColor(r, g, b, a);
                    entry.offsetX = effect.offset.x;
                    entry.offsetY = effect.offset.y;
                    entry.radius = effect.radius;
                    entry.spread = (_a = effect.spread) !== null && _a !== void 0 ? _a : 0;
                }
                if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
                    entry.radius = effect.radius;
                }
                effects.push(entry);
            }
            const item = {
                id: style.id,
                name: style.name,
                shortName: shortName(style.name),
                group: groupName(style.name),
                effects,
            };
            if (style.description)
                item.description = style.description;
            summaries.push(item);
        }
        return {
            total: summaries.length,
            groups: groupBy(summaries, (s) => s.group),
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// GRID STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function extractGridStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        const gridStyles = yield figma.getLocalGridStylesAsync();
        const summaries = [];
        for (const style of gridStyles) {
            const grids = [];
            for (const grid of style.layoutGrids) {
                const entry = {
                    pattern: grid.pattern,
                };
                if (grid.pattern === "GRID") {
                    entry.sectionSize = grid.sectionSize;
                }
                if (grid.pattern === "COLUMNS" || grid.pattern === "ROWS") {
                    entry.count = grid.count;
                    entry.gutterSize = grid.gutterSize;
                    entry.offset = grid.offset;
                    entry.alignment = grid.alignment;
                    entry.sectionSize = grid.sectionSize;
                }
                if (grid.color) {
                    const { r, g, b, a } = grid.color;
                    entry.color = rgbaColor(r, g, b, a);
                }
                grids.push(entry);
            }
            const item = {
                id: style.id,
                name: style.name,
                shortName: shortName(style.name),
                group: groupName(style.name),
                grids,
            };
            if (style.description)
                item.description = style.description;
            summaries.push(item);
        }
        return {
            total: summaries.length,
            groups: groupBy(summaries, (s) => s.group),
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// MASTER EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
function extractDesignTokens() {
    return __awaiter(this, void 0, void 0, function* () {
        const [variables, paint, typography, effect, grid] = yield Promise.all([
            extractVariables(),
            extractPaintStyles(),
            extractTextStyles(),
            extractEffectStyles(),
            extractGridStyles(),
        ]);
        const styles = {
            totalStyles: paint.total + typography.total + effect.total + grid.total,
            paint,
            typography,
            effect,
            grid,
        };
        return {
            meta: {
                extractedAt: new Date().toISOString(),
                fileName: figma.root.name,
            },
            variables,
            styles,
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN MAIN
// ─────────────────────────────────────────────────────────────────────────────

// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.
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
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
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
        const tokens = yield extractDesignTokens();
        console.log(JSON.stringify(tokens, null, 2));
        for (let i = 0; i < numberOfRectangles; i++) {
            const rect = figma.createRectangle();
            rect.x = i * 150;
            rect.fills = [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }];
            figma.currentPage.appendChild(rect);
        }
        // figma.currentPage.selection = nodes;
        // figma.viewport.scrollAndZoomIntoView(nodes);
        figma.ui.postMessage({
            type: "result", data: JSON.stringify(tokens, null, 2)
        });
    }
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    // figma.closePlugin();
});
