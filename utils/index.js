// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function rgbToHex(r, g, b) {
    function toHex(v) {
        const hex = Math.round(v * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function rgbaString(r, g, b, a) {
    if (a === 1)
        return rgbToHex(r, g, b);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}
function parsePaint(paint) {
    var _a;
    if (!paint.visible)
        return null;
    if (paint.type === "SOLID") {
        const { r, g, b } = paint.color;
        return rgbaString(r, g, b, (_a = paint.opacity) !== null && _a !== void 0 ? _a : 1);
    }
    if (paint.type === "GRADIENT_LINEAR") {
        const stops = paint.gradientStops
            .map((s) => {
            const { r, g, b, a } = s.color;
            return `${rgbaString(r, g, b, a)} ${Math.round(s.position * 100)}%`;
        })
            .join(", ");
        return `linear-gradient(to right, ${stops})`;
    }
    if (paint.type === "GRADIENT_RADIAL") {
        const stops = paint.gradientStops
            .map((s) => {
            const { r, g, b, a } = s.color;
            return `${rgbaString(r, g, b, a)} ${Math.round(s.position * 100)}%`;
        })
            .join(", ");
        return `radial-gradient(${stops})`;
    }
    if (paint.type === "IMAGE") {
        return "url(/* image */)";
    }
    return null;
}
// ─────────────────────────────────────────────
// Main CSS extractor
// ─────────────────────────────────────────────
function getCSSFromNode(node) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const css = {};
        // ── Position & Size ──────────────────────────
        if ("width" in node) {
            css["width"] = `${Math.round(node.width)}px`;
            css["height"] = `${Math.round(node.height)}px`;
        }
        if ("x" in node) {
            css["left"] = `${Math.round(node.x)}px`;
            css["top"] = `${Math.round(node.y)}px`;
            css["position"] = "absolute";
        }
        // ── Opacity ──────────────────────────────────
        if ("opacity" in node && node.opacity !== 1) {
            css["opacity"] = +node.opacity.toFixed(3);
        }
        // ── Border Radius ─────────────────────────────
        if ("cornerRadius" in node && node.cornerRadius !== undefined) {
            if (node.cornerRadius !== figma.mixed) {
                if (node.cornerRadius > 0)
                    css["border-radius"] = `${node.cornerRadius}px`;
            }
            else {
                // Individual corners
                const tl = "topLeftRadius" in node ? node.topLeftRadius : 0;
                const tr = "topRightRadius" in node ? node.topRightRadius : 0;
                const br = "bottomRightRadius" in node
                    ? node.bottomRightRadius
                    : 0;
                const bl = "bottomLeftRadius" in node
                    ? node.bottomLeftRadius
                    : 0;
                css["border-radius"] = `${tl}px ${tr}px ${br}px ${bl}px`;
            }
        }
        // ── Fills → background ───────────────────────
        if ("fills" in node && node.fills !== figma.mixed) {
            const fills = node.fills;
            const visibleFills = fills.filter((f) => f.visible !== false);
            if (visibleFills.length > 0) {
                const parsedFills = visibleFills
                    .map(parsePaint)
                    .filter(Boolean);
                if (parsedFills.length === 1) {
                    const fill = visibleFills[0];
                    if (fill.type === "SOLID") {
                        css["background-color"] = parsedFills[0];
                    }
                    else {
                        css["background"] = parsedFills[0];
                    }
                }
                else if (parsedFills.length > 1) {
                    css["background"] = parsedFills.reverse().join(", ");
                }
            }
        }
        // ── Strokes → border ─────────────────────────
        if ("strokes" in node && node.strokes.length > 0) {
            const stroke = node.strokes.find((s) => s.visible !== false);
            if (stroke && stroke.type === "SOLID") {
                const { r, g, b } = stroke.color;
                const color = rgbaString(r, g, b, (_a = stroke.opacity) !== null && _a !== void 0 ? _a : 1);
                const weight = "strokeWeight" in node && node.strokeWeight !== figma.mixed
                    ? node.strokeWeight
                    : 1;
                css["border"] = `${weight}px solid ${color}`;
            }
        }
        // ── Effects: shadow, blur ─────────────────────
        if ("effects" in node && node.effects.length > 0) {
            const dropShadows = node.effects.filter((e) => { var _a; return e.type === "DROP_SHADOW" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
            const innerShadows = node.effects.filter((e) => { var _a; return e.type === "INNER_SHADOW" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
            const allShadows = [
                ...dropShadows.map((s) => {
                    var _a;
                    const { r, g, b, a } = s.color;
                    return `${s.offset.x}px ${s.offset.y}px ${s.radius}px ${(_a = s.spread) !== null && _a !== void 0 ? _a : 0}px ${rgbaString(r, g, b, a)}`;
                }),
                ...innerShadows.map((s) => {
                    var _a;
                    const { r, g, b, a } = s.color;
                    return `inset ${s.offset.x}px ${s.offset.y}px ${s.radius}px ${(_a = s.spread) !== null && _a !== void 0 ? _a : 0}px ${rgbaString(r, g, b, a)}`;
                }),
            ];
            if (allShadows.length > 0)
                css["box-shadow"] = allShadows.join(", ");
            const layerBlur = node.effects.find((e) => { var _a; return e.type === "LAYER_BLUR" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
            if (layerBlur)
                css["filter"] = `blur(${layerBlur.radius}px)`;
            const bgBlur = node.effects.find((e) => { var _a; return e.type === "BACKGROUND_BLUR" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
            if (bgBlur)
                css["backdrop-filter"] = `blur(${bgBlur.radius}px)`;
        }
        // ── Auto Layout → Flexbox ─────────────────────
        if ("layoutMode" in node && node.layoutMode !== "NONE") {
            const n = node;
            css["display"] = "flex";
            css["flex-direction"] = n.layoutMode === "HORIZONTAL" ? "row" : "column";
            if (n.itemSpacing > 0)
                css["gap"] = `${n.itemSpacing}px`;
            const pt = n.paddingTop, pr = n.paddingRight, pb = n.paddingBottom, pl = n.paddingLeft;
            if (pt || pr || pb || pl) {
                css["padding"] =
                    pt === pr && pr === pb && pb === pl
                        ? `${pt}px`
                        : `${pt}px ${pr}px ${pb}px ${pl}px`;
            }
            const justifyMap = {
                MIN: "flex-start",
                CENTER: "center",
                MAX: "flex-end",
                SPACE_BETWEEN: "space-between",
            };
            const alignMap = {
                MIN: "flex-start",
                CENTER: "center",
                MAX: "flex-end",
                BASELINE: "baseline",
            };
            if (n.primaryAxisAlignItems in justifyMap)
                css["justify-content"] = justifyMap[n.primaryAxisAlignItems];
            if (n.counterAxisAlignItems in alignMap)
                css["align-items"] = alignMap[n.counterAxisAlignItems];
            // Sizing
            if (n.primaryAxisSizingMode === "AUTO") {
                css[n.layoutMode === "HORIZONTAL" ? "width" : "height"] = "fit-content";
            }
            if (n.counterAxisSizingMode === "AUTO") {
                css[n.layoutMode === "HORIZONTAL" ? "height" : "width"] = "fit-content";
            }
            css["overflow"] = n.clipsContent ? "hidden" : "visible";
        }
        // ── Typography (TEXT node only) ───────────────
        if (node.type === "TEXT") {
            const t = node;
            if (t.fontSize !== figma.mixed)
                css["font-size"] = `${t.fontSize}px`;
            if (t.fontName !== figma.mixed) {
                css["font-family"] = `"${t.fontName.family}"`;
                const weightMap = {
                    Thin: 100,
                    ExtraLight: 200,
                    Light: 300,
                    Regular: 400,
                    Medium: 500,
                    SemiBold: 600,
                    Bold: 700,
                    ExtraBold: 800,
                    Black: 900,
                };
                const style = t.fontName.style.replace(/\s/g, "");
                css["font-weight"] = (_b = weightMap[style]) !== null && _b !== void 0 ? _b : t.fontName.style;
                if (t.fontName.style.toLowerCase().includes("italic")) {
                    css["font-style"] = "italic";
                }
            }
            if (t.textAlignHorizontal) {
                css["text-align"] = t.textAlignHorizontal.toLowerCase();
            }
            if (t.letterSpacing !== figma.mixed) {
                const ls = t.letterSpacing;
                if (ls.unit === "PIXELS")
                    css["letter-spacing"] = `${ls.value}px`;
                if (ls.unit === "PERCENT")
                    css["letter-spacing"] = `${ls.value / 100}em`;
            }
            if (t.lineHeight !== figma.mixed) {
                const lh = t.lineHeight;
                if (lh.unit === "PIXELS")
                    css["line-height"] = `${lh.value}px`;
                if (lh.unit === "PERCENT")
                    css["line-height"] = `${lh.value / 100}`;
                if (lh.unit === "AUTO")
                    css["line-height"] = "normal";
            }
            if (t.textDecoration !== figma.mixed) {
                if (t.textDecoration === "UNDERLINE")
                    css["text-decoration"] = "underline";
                if (t.textDecoration === "STRIKETHROUGH")
                    css["text-decoration"] = "line-through";
            }
            if (t.textCase !== figma.mixed) {
                const caseMap = {
                    UPPER: "uppercase",
                    LOWER: "lowercase",
                    TITLE: "capitalize",
                    ORIGINAL: "none",
                };
                if (t.textCase in caseMap)
                    css["text-transform"] = caseMap[t.textCase];
            }
            // Text color
            if (t.fills !== figma.mixed) {
                const fills = t.fills;
                const fill = fills.find((f) => f.visible !== false && f.type === "SOLID");
                if (fill) {
                    const { r, g, b } = fill.color;
                    css["color"] = rgbaString(r, g, b, (_c = fill.opacity) !== null && _c !== void 0 ? _c : 1);
                }
            }
        }
        return css;
    });
}
// ─────────────────────────────────────────────
// Traverse toàn bộ group
// ─────────────────────────────────────────────
export function extractGroupCSS(node_1) {
    return __awaiter(this, arguments, void 0, function* (node, depth = 0) {
        const css = yield getCSSFromNode(node);
        const result = {
            id: node.id,
            name: node.name,
            type: node.type,
            depth,
            css,
        };
        if ("children" in node && node.children.length > 0) {
            result.children = yield Promise.all(node.children.map((child) => extractGroupCSS(child, depth + 1)));
        }
        return result;
    });
}
// ─────────────────────────────────────────────
// Format output thành chuỗi CSS class
// ─────────────────────────────────────────────
export function formatAsCSS(result) {
    const lines = [];
    function walk(node) {
        const selector = `.${node.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`;
        function formatProps(css) {
            const lines = [];
            for (const key in css) {
                if (Object.prototype.hasOwnProperty.call(css, key)) {
                    lines.push(`  ${key}: ${css[key]};`);
                }
            }
            return lines.join("\n");
        }
        // Dùng trong formatAsCSS:
        const props = formatProps(node.css);
        if (props) {
            lines.push(`/* [${node.type}] depth: ${node.depth} */`);
            lines.push(`${selector} {\n${props}\n}\n`);
        }
        if (node.children) {
            node.children.forEach(walk);
        }
    }
    walk(result);
    return lines.join("\n");
}
// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
// async function main() {
//   const selection = figma.currentPage.selection;
//   if (selection.length === 0) {
//     figma.notify("⚠️ Vui lòng chọn một group hoặc frame.");
//     figma.closePlugin();
//     return;
//   }
//   const target = selection[0];
//   console.log(`Extracting CSS from: ${target.name} (${target.type})`);
//   const result = await extractGroupCSS(target);
//   const cssString = formatAsCSS(result);
//   // Gửi lên UI
//   figma.ui.postMessage({
//     type: "CSS_RESULT",
//     json: result, // dạng object (dễ xử lý tiếp)
//     css: cssString, // dạng CSS string (dễ copy)
//   });
//   // Hoặc log ra console khi dev
//   console.log("=== JSON ===");
//   console.log(JSON.stringify(result, null, 2));
//   console.log("=== CSS ===");
//   console.log(cssString);
// }
// main().catch((err) => {
//   console.error(err);
//   figma.notify(`❌ Lỗi: ${err.message}`);
//   figma.closePlugin();
// });
