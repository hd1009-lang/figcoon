// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type NodeRole =
  | "section"
  | "container"
  | "card"
  | "button"
  | "image"
  | "icon"
  | "divider"
  | "text-heading"
  | "text-body"
  | "text-label"
  | "text-caption"
  | "unknown";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlexLayout {
  direction: "row" | "column";
  gap: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  alignItems: string;
  justifyContent: string;
  wrap: boolean;
  overflow: "hidden" | "visible";
}

interface VisualStyle {
  background?: string;
  border?: string;
  borderRadius?: number | string;
  opacity?: number;
  shadow?: string;
  blur?: number;
  backdropBlur?: number;
}

interface CustomTextStyle  {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle?: "italic" | "normal";
  color: string;
  align: string;
  lineHeight?: string;
  letterSpacing?: string;
  textDecoration?: string;
  textTransform?: string;
}

interface TextContent {
  raw: string;
  truncated: string;
  style: CustomTextStyle ;
}

interface LayoutNode {
  id: string;
  name: string;
  type: string;
  role: NodeRole;
  box: BoundingBox;
  layout?: FlexLayout;
  style: VisualStyle;
  content?: TextContent;
  children?: LayoutNode[];
}

interface LayoutSummary {
  meta: {
    name: string;
    type: string;
    width: number;
    height: number;
    totalNodes: number;
  };
  layout: LayoutNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toHex(v: number): string {
  const hex = Math.round(v * 255).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbaString(r: number, g: number, b: number, a: number): string {
  if (a >= 0.999) return rgbToHex(r, g, b);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}

function parsePaintToString(paint: Paint): string | null {
  if (paint.visible === false) return null;

  if (paint.type === "SOLID") {
    const { r, g, b } = paint.color;
    return rgbaString(r, g, b, paint.opacity ?? 1);
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

  if (paint.type === "IMAGE") return "image";

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// INFER ROLE
// ─────────────────────────────────────────────────────────────────────────────

function inferRole(node: SceneNode): NodeRole {
  const name = node.name.toLowerCase().trim();
  const w = "width" in node ? node.width : 0;
  const h = "height" in node ? node.height : 0;

  // TEXT node — classify by font size
  if (node.type === "TEXT") {
    const fontSize = node.fontSize !== figma.mixed ? (node.fontSize as number) : 14;
    if (fontSize >= 40) return "text-heading";
    if (fontSize >= 24) return "text-heading";
    if (fontSize >= 16) return "text-body";
    if (fontSize >= 12) return "text-label";
    return "text-caption";
  }

  // Divider — very thin rectangle
  if (node.type === "RECTANGLE" && (h <= 4 || w <= 4)) return "divider";

  // Icon — small vector or frame
  if (
    (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION" || node.type === "STAR") &&
    w <= 48 && h <= 48
  ) return "icon";

  // Image — rectangle with image fill
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    if (fills.some((f) => f.type === "IMAGE" && f.visible !== false)) return "image";
  }

  // Name-based hints (highest priority after type checks)
  if (/\b(btn|button|cta)\b/.test(name)) return "button";
  if (/\b(icon)\b/.test(name)) return "icon";
  if (/\b(card)\b/.test(name)) return "card";
  if (/\b(divider|separator|line|hr)\b/.test(name)) return "divider";
  if (/\b(section|hero|banner|header|footer|navbar|nav)\b/.test(name)) return "section";
  if (/\b(image|img|photo|thumbnail|avatar)\b/.test(name)) return "image";

  // Frame-based heuristics
  if (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE" ||
    node.type === "GROUP"
  ) {
    // Small frames with fills → likely button or card
    if (w <= 300 && h <= 60 && "fills" in node) {
      const fills = node.fills !== figma.mixed ? (node.fills as Paint[]) : [];
      if (fills.some((f) => f.visible !== false && f.type === "SOLID")) return "button";
    }
    if (w <= 500 && h <= 400) return "card";
    return w >= 600 ? "section" : "container";
  }

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT VISUAL STYLE
// ─────────────────────────────────────────────────────────────────────────────

function extractStyle(node: SceneNode): VisualStyle {
  const style: VisualStyle = {};

  // Opacity
  if ("opacity" in node && node.opacity !== 1) {
    style.opacity = round2(node.opacity);
  }

  // Border radius
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    if (node.cornerRadius !== figma.mixed) {
      if ((node.cornerRadius as number) > 0) {
        style.borderRadius = node.cornerRadius as number;
      }
    } else {
      // Mixed corner radius — cast to access individual corners
      const n = node as RectangleNode;
      style.borderRadius = `${n.topLeftRadius}px ${n.topRightRadius}px ${n.bottomRightRadius}px ${n.bottomLeftRadius}px`;
    }
  }

  // Background from fills
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = (node.fills as Paint[]).filter((f) => f.visible !== false);
    if (fills.length > 0) {
      const parsed = fills.map(parsePaintToString).filter((s): s is string => s !== null);
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
      const color = rgbaString(r, g, b, stroke.opacity ?? 1);
      const weight =
        "strokeWeight" in node && node.strokeWeight !== figma.mixed
          ? (node.strokeWeight as number)
          : 1;
      style.border = `${weight}px solid ${color}`;
    }
  }

  // Effects
  if ("effects" in node && node.effects.length > 0) {
    const dropShadows = node.effects.filter(
      (e): e is DropShadowEffect => e.type === "DROP_SHADOW" && (e.visible ?? true)
    );
    const innerShadows = node.effects.filter(
      (e): e is InnerShadowEffect => e.type === "INNER_SHADOW" && (e.visible ?? true)
    );

    const allShadows = [
      ...dropShadows.map((s) => {
        const { r, g, b, a } = s.color;
        return `${s.offset.x}px ${s.offset.y}px ${s.radius}px ${s.spread ?? 0}px ${rgbaString(r, g, b, a)}`;
      }),
      ...innerShadows.map((s) => {
        const { r, g, b, a } = s.color;
        return `inset ${s.offset.x}px ${s.offset.y}px ${s.radius}px ${s.spread ?? 0}px ${rgbaString(r, g, b, a)}`;
      }),
    ];
    if (allShadows.length > 0) style.shadow = allShadows.join(", ");

    const layerBlur = node.effects.find(
      (e): e is BlurEffect => e.type === "LAYER_BLUR" && (e.visible ?? true)
    );
    if (layerBlur) style.blur = layerBlur.radius;

    const bgBlur = node.effects.find(
      (e): e is BlurEffect => e.type === "BACKGROUND_BLUR" && (e.visible ?? true)
    );
    if (bgBlur) style.backdropBlur = bgBlur.radius;
  }

  return style;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT FLEX LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

function extractFlexLayout(node: SceneNode): FlexLayout | undefined {
  if (!("layoutMode" in node) || node.layoutMode === "NONE") return undefined;

  const n = node as FrameNode;

  const justifyMap: Record<string, string> = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    SPACE_BETWEEN: "space-between",
  };
  const alignMap: Record<string, string> = {
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
    justifyContent: justifyMap[n.primaryAxisAlignItems] ?? n.primaryAxisAlignItems,
    alignItems: alignMap[n.counterAxisAlignItems] ?? n.counterAxisAlignItems,
    wrap: n.layoutWrap === "WRAP",
    overflow: n.clipsContent ? "hidden" : "visible",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT TEXT CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function extractTextContent(node: TextNode): TextContent {
  const raw = node.characters;
  const truncated = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;

  const fontWeightMap: Record<string, number> = {
    Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
    Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
  };

  // Font
  const fontName = node.fontName !== figma.mixed ? node.fontName as FontName : { family: "Unknown", style: "Regular" };
  const styleKey = fontName.style.replace(/\s/g, "").replace(/Italic/i, "");
  const fontWeight: number | string = fontWeightMap[styleKey] ?? 400;
  const isItalic = fontName.style.toLowerCase().includes("italic");

  // Color
  let color = "#000000";
  if (node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    const solidFill = fills.find((f) => f.visible !== false && f.type === "SOLID") as SolidPaint | undefined;
    if (solidFill) {
      const { r, g, b } = solidFill.color;
      color = rgbaString(r, g, b, solidFill.opacity ?? 1);
    }
  }

  // Line height
  let lineHeight: string | undefined;
  if (node.lineHeight !== figma.mixed) {
    const lh = node.lineHeight as LineHeight;
    if (lh.unit === "PIXELS") lineHeight = `${lh.value}px`;
    else if (lh.unit === "PERCENT") lineHeight = `${round2(lh.value / 100)}`;
    else lineHeight = "normal";
  }

  // Letter spacing
  let letterSpacing: string | undefined;
  if (node.letterSpacing !== figma.mixed) {
    const ls = node.letterSpacing as LetterSpacing;
    if (ls.value !== 0) {
      letterSpacing = ls.unit === "PIXELS" ? `${ls.value}px` : `${round2(ls.value / 100)}em`;
    }
  }

  // Text decoration
  let textDecoration: string | undefined;
  if (node.textDecoration !== figma.mixed) {
    if (node.textDecoration === "UNDERLINE") textDecoration = "underline";
    else if (node.textDecoration === "STRIKETHROUGH") textDecoration = "line-through";
  }

  // Text transform
  let textTransform: string | undefined;
  if (node.textCase !== figma.mixed) {
    const caseMap: Record<string, string> = {
      UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize",
    };
    textTransform = caseMap[node.textCase as string];
  }

  const textStyle: CustomTextStyle  = {
    fontFamily: fontName.family,
    fontSize: node.fontSize !== figma.mixed ? (node.fontSize as number) : 14,
    fontWeight,
    color,
    align: node.textAlignHorizontal?.toLowerCase() ?? "left",
  };

  if (isItalic) textStyle.fontStyle = "italic";
  if (lineHeight) textStyle.lineHeight = lineHeight;
  if (letterSpacing) textStyle.letterSpacing = letterSpacing;
  if (textDecoration) textStyle.textDecoration = textDecoration;
  if (textTransform) textStyle.textTransform = textTransform;

  return { raw, truncated, style: textStyle };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: BUILD LAYOUT NODE (recursive)
// ─────────────────────────────────────────────────────────────────────────────

function buildLayoutNode(node: SceneNode): LayoutNode {
  const box: BoundingBox = {
    x: Math.round("x" in node ? node.x : 0),
    y: Math.round("y" in node ? node.y : 0),
    width: Math.round("width" in node ? node.width : 0),
    height: Math.round("height" in node ? node.height : 0),
  };

  const role = inferRole(node);
  const style = extractStyle(node);
  const layout = extractFlexLayout(node);

  const result: LayoutNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    role,
    box,
    style,
  };

  // Only add layout if exists (keeps JSON clean)
  if (layout) result.layout = layout;

  // Text content
  if (node.type === "TEXT") {
    result.content = extractTextContent(node as TextNode);
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

function countNodes(node: LayoutNode): number {
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

export function extractLayoutSummary(node: SceneNode): LayoutSummary {
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