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
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function rgbaString(r, g, b, a) {
    if (a >= 0.999)
        return rgbToHex(r, g, b);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}
function parsePaintToString(paint) {
    var _a;
    if (paint.visible === false)
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
        return `linear-gradient(${stops})`;
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
    if (paint.type === "IMAGE")
        return "image";
    return null;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
// ─────────────────────────────────────────────────────────────────────────────
// INFER ROLE
// ─────────────────────────────────────────────────────────────────────────────
function inferRole(node) {
    const name = node.name.toLowerCase().trim();
    const w = "width" in node ? node.width : 0;
    const h = "height" in node ? node.height : 0;
    // TEXT node — classify by font size
    if (node.type === "TEXT") {
        const fontSize = node.fontSize !== figma.mixed ? node.fontSize : 14;
        if (fontSize >= 40)
            return "text-heading";
        if (fontSize >= 24)
            return "text-heading";
        if (fontSize >= 16)
            return "text-body";
        if (fontSize >= 12)
            return "text-label";
        return "text-caption";
    }
    // Divider — very thin rectangle
    if (node.type === "RECTANGLE" && (h <= 4 || w <= 4))
        return "divider";
    // Icon — small vector or frame
    if ((node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION" || node.type === "STAR") &&
        w <= 48 && h <= 48)
        return "icon";
    // Image — rectangle with image fill
    if ("fills" in node && node.fills !== figma.mixed) {
        const fills = node.fills;
        if (fills.some((f) => f.type === "IMAGE" && f.visible !== false))
            return "image";
    }
    // Name-based hints (highest priority after type checks)
    if (/\b(btn|button|cta)\b/.test(name))
        return "button";
    if (/\b(icon)\b/.test(name))
        return "icon";
    if (/\b(card)\b/.test(name))
        return "card";
    if (/\b(divider|separator|line|hr)\b/.test(name))
        return "divider";
    if (/\b(section|hero|banner|header|footer|navbar|nav)\b/.test(name))
        return "section";
    if (/\b(image|img|photo|thumbnail|avatar)\b/.test(name))
        return "image";
    // Frame-based heuristics
    if (node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE" ||
        node.type === "GROUP") {
        // Small frames with fills → likely button or card
        if (w <= 300 && h <= 60 && "fills" in node) {
            const fills = node.fills !== figma.mixed ? node.fills : [];
            if (fills.some((f) => f.visible !== false && f.type === "SOLID"))
                return "button";
        }
        if (w <= 500 && h <= 400)
            return "card";
        return w >= 600 ? "section" : "container";
    }
    return "unknown";
}
// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT VISUAL STYLE
// ─────────────────────────────────────────────────────────────────────────────
function extractStyle(node) {
    var _a;
    const style = {};
    // Opacity
    if ("opacity" in node && node.opacity !== 1) {
        style.opacity = round2(node.opacity);
    }
    // Border radius
    if ("cornerRadius" in node && node.cornerRadius !== undefined) {
        if (node.cornerRadius !== figma.mixed) {
            if (node.cornerRadius > 0) {
                style.borderRadius = node.cornerRadius;
            }
        }
        else {
            // Mixed corner radius — cast to access individual corners
            const n = node;
            style.borderRadius = `${n.topLeftRadius}px ${n.topRightRadius}px ${n.bottomRightRadius}px ${n.bottomLeftRadius}px`;
        }
    }
    // Background from fills
    if ("fills" in node && node.fills !== figma.mixed) {
        const fills = node.fills.filter((f) => f.visible !== false);
        if (fills.length > 0) {
            const parsed = fills.map(parsePaintToString).filter((s) => s !== null);
            if (parsed.length > 0) {
                style.background = parsed[parsed.length - 1]; // top-most fill
            }
        }
    }
    // Border from strokes
    if ("strokes" in node && node.strokes.length > 0) {
        const stroke = node.strokes.find((s) => s.visible !== false);
        if (stroke && stroke.type === "SOLID") {
            const { r, g, b } = stroke.color;
            const color = rgbaString(r, g, b, (_a = stroke.opacity) !== null && _a !== void 0 ? _a : 1);
            const weight = "strokeWeight" in node && node.strokeWeight !== figma.mixed
                ? node.strokeWeight
                : 1;
            style.border = `${weight}px solid ${color}`;
        }
    }
    // Effects
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
            style.shadow = allShadows.join(", ");
        const layerBlur = node.effects.find((e) => { var _a; return e.type === "LAYER_BLUR" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
        if (layerBlur)
            style.blur = layerBlur.radius;
        const bgBlur = node.effects.find((e) => { var _a; return e.type === "BACKGROUND_BLUR" && ((_a = e.visible) !== null && _a !== void 0 ? _a : true); });
        if (bgBlur)
            style.backdropBlur = bgBlur.radius;
    }
    return style;
}
// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT FLEX LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
function extractFlexLayout(node) {
    var _a, _b;
    if (!("layoutMode" in node) || node.layoutMode === "NONE")
        return undefined;
    const n = node;
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
    return {
        direction: n.layoutMode === "HORIZONTAL" ? "row" : "column",
        gap: n.itemSpacing,
        padding: {
            top: n.paddingTop,
            right: n.paddingRight,
            bottom: n.paddingBottom,
            left: n.paddingLeft,
        },
        justifyContent: (_a = justifyMap[n.primaryAxisAlignItems]) !== null && _a !== void 0 ? _a : n.primaryAxisAlignItems,
        alignItems: (_b = alignMap[n.counterAxisAlignItems]) !== null && _b !== void 0 ? _b : n.counterAxisAlignItems,
        wrap: n.layoutWrap === "WRAP",
        overflow: n.clipsContent ? "hidden" : "visible",
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT TEXT CONTENT
// ─────────────────────────────────────────────────────────────────────────────
function extractTextContent(node) {
    var _a, _b, _c, _d;
    const raw = node.characters;
    const truncated = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;
    const fontWeightMap = {
        Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
        Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
    };
    // Font
    const fontName = node.fontName !== figma.mixed ? node.fontName : { family: "Unknown", style: "Regular" };
    const styleKey = fontName.style.replace(/\s/g, "").replace(/Italic/i, "");
    const fontWeight = (_a = fontWeightMap[styleKey]) !== null && _a !== void 0 ? _a : 400;
    const isItalic = fontName.style.toLowerCase().includes("italic");
    // Color
    let color = "#000000";
    if (node.fills !== figma.mixed) {
        const fills = node.fills;
        const solidFill = fills.find((f) => f.visible !== false && f.type === "SOLID");
        if (solidFill) {
            const { r, g, b } = solidFill.color;
            color = rgbaString(r, g, b, (_b = solidFill.opacity) !== null && _b !== void 0 ? _b : 1);
        }
    }
    // Line height
    let lineHeight;
    if (node.lineHeight !== figma.mixed) {
        const lh = node.lineHeight;
        if (lh.unit === "PIXELS")
            lineHeight = `${lh.value}px`;
        else if (lh.unit === "PERCENT")
            lineHeight = `${round2(lh.value / 100)}`;
        else
            lineHeight = "normal";
    }
    // Letter spacing
    let letterSpacing;
    if (node.letterSpacing !== figma.mixed) {
        const ls = node.letterSpacing;
        if (ls.value !== 0) {
            letterSpacing = ls.unit === "PIXELS" ? `${ls.value}px` : `${round2(ls.value / 100)}em`;
        }
    }
    // Text decoration
    let textDecoration;
    if (node.textDecoration !== figma.mixed) {
        if (node.textDecoration === "UNDERLINE")
            textDecoration = "underline";
        else if (node.textDecoration === "STRIKETHROUGH")
            textDecoration = "line-through";
    }
    // Text transform
    let textTransform;
    if (node.textCase !== figma.mixed) {
        const caseMap = {
            UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize",
        };
        textTransform = caseMap[node.textCase];
    }
    const textStyle = {
        fontFamily: fontName.family,
        fontSize: node.fontSize !== figma.mixed ? node.fontSize : 14,
        fontWeight,
        color,
        align: (_d = (_c = node.textAlignHorizontal) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== null && _d !== void 0 ? _d : "left",
    };
    if (isItalic)
        textStyle.fontStyle = "italic";
    if (lineHeight)
        textStyle.lineHeight = lineHeight;
    if (letterSpacing)
        textStyle.letterSpacing = letterSpacing;
    if (textDecoration)
        textStyle.textDecoration = textDecoration;
    if (textTransform)
        textStyle.textTransform = textTransform;
    return { raw, truncated, style: textStyle };
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN: BUILD LAYOUT NODE (recursive)
// ─────────────────────────────────────────────────────────────────────────────
function buildLayoutNode(node) {
    const box = {
        x: Math.round("x" in node ? node.x : 0),
        y: Math.round("y" in node ? node.y : 0),
        width: Math.round("width" in node ? node.width : 0),
        height: Math.round("height" in node ? node.height : 0),
    };
    const role = inferRole(node);
    const style = extractStyle(node);
    const layout = extractFlexLayout(node);
    const result = {
        id: node.id,
        name: node.name,
        type: node.type,
        role,
        box,
        style,
    };
    // Only add layout if exists (keeps JSON clean)
    if (layout)
        result.layout = layout;
    // Text content
    if (node.type === "TEXT") {
        result.content = extractTextContent(node);
    }
    // Recurse children
    if ("children" in node && node.children.length > 0) {
        result.children = node.children.map((child) => buildLayoutNode(child));
    }
    return result;
}
// ─────────────────────────────────────────────────────────────────────────────
// COUNT TOTAL NODES
// ─────────────────────────────────────────────────────────────────────────────
function countNodes(node) {
    let count = 1;
    if (node.children) {
        for (const child of node.children) {
            count += countNodes(child);
        }
    }
    return count;
}
// ─────────────────────────────────────────────────────────────────────────────
// ENTRY: extractLayoutSummary
// ─────────────────────────────────────────────────────────────────────────────
export function extractLayoutSummary(node) {
    const layoutNode = buildLayoutNode(node);
    const totalNodes = countNodes(layoutNode);
    return {
        meta: {
            name: node.name,
            type: node.type,
            width: Math.round("width" in node ? node.width : 0),
            height: Math.round("height" in node ? node.height : 0),
            totalNodes,
        },
        layout: layoutNode,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN MAIN
// ─────────────────────────────────────────────────────────────────────────────
// main().catch((err) => {
//   console.error(err);
//   figma.notify(`❌ Lỗi: ${(err as Error).message}`);
//   figma.closePlugin();
// });
