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
  x?: number;
  y?: number;
  width: number;
  height: number;
}

interface FlexLayout {
  direction: "row" | "column";
  gap?: string;
  padding?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  alignItems: string;
  justifyContent: string;
  wrap: boolean;
  overflow?: "hidden";
}

interface VisualStyle {
  background?: string;
  border?: string;
  borderRadius?: string;
  opacity?: string;
  shadow?: string;
  blur?: string;
  backdropBlur?: string;
}

interface CustomTextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: number | string;
  fontStyle?: "italic" | "normal";
  color: string;
  align: string;
  lineHeight?: string;
  letterSpacing?: string;
  textDecoration?: string;
  textTransform?: string;
  fontVariantNumeric?: string;
  fontFeatureSettings: string;
}

interface TextContent {
  raw: string;
  truncated: string;
  style: CustomTextStyle;
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

/** Gắn comment variable vào cuối value string nếu có */
function withVar(value: string, varName: string | null): string {
  if (!varName) return value;
  return `${value} /* ${varName} */`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLE RESOLUTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function resolveVariableName(
  alias: VariableAlias | VariableAlias[] | undefined
): Promise<string | null> {
  if (!alias) return null;
  const id = Array.isArray(alias)
    ? alias[0]?.id
    : (alias as VariableAlias).id;
  if (!id) return null;
  const variable = await figma.variables.getVariableByIdAsync(id);
  return variable ? variable.name : null;
}

async function getScalarVar(
  node: SceneNode,
  field: string
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;
  const alias = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)[field];
  return resolveVariableName(alias as VariableAlias | undefined);
}

async function getFillVar(
  node: SceneNode,
  fillIndex: number
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;

  const fillsAliases = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)["fills"];
  if (Array.isArray(fillsAliases) && fillsAliases[fillIndex]) {
    const name = await resolveVariableName(fillsAliases[fillIndex]);
    if (name) return name;
  }

  if ("fills" in node && node.fills !== figma.mixed) {
    const paint = (node.fills as Paint[])[fillIndex] as Paint & {
      boundVariables?: Record<string, VariableAlias>;
    };
    if (paint?.boundVariables?.color) {
      return resolveVariableName(paint.boundVariables.color);
    }
  }

  return null;
}

async function getStrokeVar(
  node: SceneNode,
  strokeIndex: number
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;

  const strokesAliases = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)["strokes"];
  if (Array.isArray(strokesAliases) && strokesAliases[strokeIndex]) {
    const name = await resolveVariableName(strokesAliases[strokeIndex]);
    if (name) return name;
  }

  if ("strokes" in node) {
    const paint = node.strokes[strokeIndex] as Paint & {
      boundVariables?: Record<string, VariableAlias>;
    };
    if (paint?.boundVariables?.color) {
      return resolveVariableName(paint.boundVariables.color);
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INFER ROLE
// ─────────────────────────────────────────────────────────────────────────────

function inferRole(node: SceneNode): NodeRole {
  const name = node.name.toLowerCase().trim();
  const w = "width" in node ? node.width : 0;
  const h = "height" in node ? node.height : 0;

  if (node.type === "TEXT") {
    const fontSize =
      node.fontSize !== figma.mixed ? (node.fontSize as number) : 14;
    if (fontSize >= 40) return "text-heading";
    if (fontSize >= 24) return "text-heading";
    if (fontSize >= 16) return "text-body";
    if (fontSize >= 12) return "text-label";
    return "text-caption";
  }

  if (node.type === "RECTANGLE" && (h <= 4 || w <= 4)) return "divider";

  if (
    (node.type === "VECTOR" ||
      node.type === "BOOLEAN_OPERATION" ||
      node.type === "STAR") &&
    w <= 48 &&
    h <= 48
  )
    return "icon";

  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    if (fills.some((f) => f.type === "IMAGE" && f.visible !== false))
      return "image";
  }

  if (/\b(btn|button|cta)\b/.test(name)) return "button";
  if (/\b(icon)\b/.test(name)) return "icon";
  if (/\b(card)\b/.test(name)) return "card";
  if (/\b(divider|separator|line|hr)\b/.test(name)) return "divider";
  if (/\b(section|hero|banner|header|footer|navbar|nav)\b/.test(name))
    return "section";
  if (/\b(image|img|photo|thumbnail|avatar)\b/.test(name)) return "image";

  if (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE" ||
    node.type === "GROUP"
  ) {
    if (w <= 300 && h <= 60 && "fills" in node) {
      const fills = node.fills !== figma.mixed ? (node.fills as Paint[]) : [];
      if (fills.some((f) => f.visible !== false && f.type === "SOLID"))
        return "button";
    }
    if (w <= 500 && h <= 400) return "card";
    return w >= 600 ? "section" : "container";
  }

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT VISUAL STYLE
// ─────────────────────────────────────────────────────────────────────────────

async function extractStyle(node: SceneNode): Promise<VisualStyle> {
  const style: VisualStyle = {};

  // Opacity
  if ("opacity" in node && node.opacity !== 1) {
    const v = await getScalarVar(node, "opacity");
    style.opacity = withVar(String(round2(node.opacity)), v);
  }

  // Border radius
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    if (node.cornerRadius !== figma.mixed) {
      if ((node.cornerRadius as number) > 0) {
        const v = await getScalarVar(node, "cornerRadius");
        style.borderRadius = withVar(`${node.cornerRadius as number}px`, v);
      }
    } else {
      const n = node as RectangleNode;
      const value = `${n.topLeftRadius}px ${n.topRightRadius}px ${n.bottomRightRadius}px ${n.bottomLeftRadius}px`;
      const tlV = await getScalarVar(node, "topLeftRadius");
      const trV = await getScalarVar(node, "topRightRadius");
      const brV = await getScalarVar(node, "bottomRightRadius");
      const blV = await getScalarVar(node, "bottomLeftRadius");
      const vars = [tlV, trV, brV, blV].filter(Boolean).join(", ");
      style.borderRadius = withVar(value, vars || null);
    }
  }

  // Background from fills
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = (node.fills as Paint[]).filter((f) => f.visible !== false);
    if (fills.length > 0) {
      const parsed = fills
        .map(parsePaintToString)
        .filter((s): s is string => s !== null);
      if (parsed.length > 0) {
        const topFillOriginalIdx = (node.fills as Paint[])
          .map((f, i) => ({ f, i }))
          .filter(({ f }) => f.visible !== false)
          .pop()?.i ?? 0;
        const v = await getFillVar(node, topFillOriginalIdx);
        style.background = withVar(parsed[parsed.length - 1], v);
      }
    }
  }

  // Border from strokes
  if ("strokes" in node && node.strokes.length > 0) {
    const strokeIdx = node.strokes.findIndex((s) => s.visible !== false);
    if (strokeIdx !== -1) {
      const stroke = node.strokes[strokeIdx];
      if (stroke.type === "SOLID") {
        const { r, g, b } = stroke.color;
        const color = rgbaString(r, g, b, stroke.opacity ?? 1);
        const weight =
          "strokeWeight" in node && node.strokeWeight !== figma.mixed
            ? (node.strokeWeight as number)
            : 1;
        const strokeColorVar = await getStrokeVar(node, strokeIdx);
        const strokeWeightVar = await getScalarVar(node, "strokeWeight");
        const vars = [strokeColorVar, strokeWeightVar].filter(Boolean).join(", ");
        style.border = withVar(`${weight}px solid ${color}`, vars || null);
      }
    }
  }

  // Effects
  if ("effects" in node && node.effects.length > 0) {
    const dropShadows = node.effects.filter(
      (e): e is DropShadowEffect =>
        e.type === "DROP_SHADOW" && (e.visible ?? true),
    );
    const innerShadows = node.effects.filter(
      (e): e is InnerShadowEffect =>
        e.type === "INNER_SHADOW" && (e.visible ?? true),
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
      (e): e is BlurEffect => e.type === "LAYER_BLUR" && (e.visible ?? true),
    );
    if (layerBlur) style.blur = `${layerBlur.radius}px`;

    const bgBlur = node.effects.find(
      (e): e is BlurEffect =>
        e.type === "BACKGROUND_BLUR" && (e.visible ?? true),
    );
    if (bgBlur) style.backdropBlur = `${bgBlur.radius}px`;
  }

  return style;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT FLEX LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

async function extractFlexLayout(node: SceneNode): Promise<FlexLayout | undefined> {
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

  const layout: FlexLayout = {
    direction: n.layoutMode === "HORIZONTAL" ? "row" : "column",
    justifyContent: justifyMap[n.primaryAxisAlignItems] ?? n.primaryAxisAlignItems,
    alignItems: alignMap[n.counterAxisAlignItems] ?? n.counterAxisAlignItems,
    wrap: n.layoutWrap === "WRAP",
  };

  if (n.itemSpacing > 0) {
    const gapVar = await getScalarVar(node, "itemSpacing");
    layout.gap = withVar(String(n.itemSpacing), gapVar);
  }

  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = n;
  if (pt || pr || pb || pl) {
    const ptVar = await getScalarVar(node, "paddingTop");
    const prVar = await getScalarVar(node, "paddingRight");
    const pbVar = await getScalarVar(node, "paddingBottom");
    const plVar = await getScalarVar(node, "paddingLeft");
    layout.padding = {
      top: withVar(String(pt), ptVar),
      right: withVar(String(pr), prVar),
      bottom: withVar(String(pb), pbVar),
      left: withVar(String(pl), plVar),
    };
  }

  if (n.clipsContent) layout.overflow = "hidden";

  return layout;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT TEXT CONTENT
// ─────────────────────────────────────────────────────────────────────────────

async function extractTextContent(node: TextNode): Promise<TextContent> {
  const raw = node.characters;
  const truncated = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;

  const fontWeightMap: Record<string, number> = {
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

  const fontName =
    node.fontName !== figma.mixed
      ? (node.fontName as FontName)
      : { family: "Unknown", style: "Regular" };
  const styleKey = fontName.style.replace(/\s/g, "").replace(/Italic/i, "");
  const fontWeight: number | string = fontWeightMap[styleKey] ?? 400;
  const isItalic = fontName.style.toLowerCase().includes("italic");

  // Color
  let color = "#000000";
  if (node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    const solidFillIdx = fills.findIndex(
      (f) => f.visible !== false && f.type === "SOLID"
    );
    if (solidFillIdx !== -1) {
      const solidFill = fills[solidFillIdx] as SolidPaint;
      const { r, g, b } = solidFill.color;
      const colorValue = rgbaString(r, g, b, solidFill.opacity ?? 1);
      const colorVar = await getFillVar(node, solidFillIdx);
      color = withVar(colorValue, colorVar);
    }
  }

  // Line height
  let lineHeight: string | undefined;
  if (node.lineHeight !== figma.mixed) {
    const lh = node.lineHeight as LineHeight;
    let lhValue = "normal";
    if (lh.unit === "PIXELS") lhValue = `${lh.value}px`;
    else if (lh.unit === "PERCENT") lhValue = `${round2(lh.value / 100)}`;
    const lhVar = await getScalarVar(node, "lineHeight");
    lineHeight = withVar(lhValue, lhVar);
  }

  // Letter spacing
  let letterSpacing: string | undefined;
  if (node.letterSpacing !== figma.mixed) {
    const ls = node.letterSpacing as LetterSpacing;
    if (ls.value !== 0) {
      const lsValue = ls.unit === "PIXELS"
        ? `${ls.value}px`
        : `${round2(ls.value / 100)}em`;
      const lsVar = await getScalarVar(node, "letterSpacing");
      letterSpacing = withVar(lsValue, lsVar);
    }
  }

  // Text decoration
  let textDecoration: string | undefined;
  if (node.textDecoration !== figma.mixed) {
    if (node.textDecoration === "UNDERLINE") textDecoration = "underline";
    else if (node.textDecoration === "STRIKETHROUGH")
      textDecoration = "line-through";
  }

  // Text transform
  let textTransform: string | undefined;
  if (node.textCase !== figma.mixed) {
    const caseMap: Record<string, string> = {
      UPPER: "uppercase",
      LOWER: "lowercase",
      TITLE: "capitalize",
    };
    textTransform = caseMap[node.textCase as string];
  }

  // Font size
  const fontSizeValue = node.fontSize !== figma.mixed ? (node.fontSize as number) : 14;
  const fontSizeVar = await getScalarVar(node, "fontSize");
  const fontSize = withVar(`${fontSizeValue}px`, fontSizeVar);

  // Font family
  const fontFamilyVar = await getScalarVar(node, "fontFamily");
  const fontFamily = withVar(fontName.family, fontFamilyVar);

  const textStyle: CustomTextStyle = {
    fontFamily,
    fontSize,
    fontWeight,
    color,
    align: node.textAlignHorizontal?.toLowerCase() ?? "left",
    fontFeatureSettings: "",
    fontVariantNumeric: "",
  };

  if (isItalic) textStyle.fontStyle = "italic";
  if (lineHeight) textStyle.lineHeight = lineHeight;
  if (letterSpacing) textStyle.letterSpacing = letterSpacing;
  if (textDecoration) textStyle.textDecoration = textDecoration;
  if (textTransform) textStyle.textTransform = textTransform;

  // font-feature-settings
  if ("openTypeFeatures" in node) {
    const features = node.openTypeFeatures as Record<OpenTypeFeature, boolean>;
    const entries = Object.entries(features) as [OpenTypeFeature, boolean][];
    const active = entries.filter(([, on]) => on);
    if (active.length > 0) {
      textStyle.fontFeatureSettings = active
        .map(([tag, on]) => `'${tag.toLowerCase()}' ${on ? "on" : "off"}`)
        .join(", ");
    }
  }

  // font-variant-numeric
  if ("numberCase" in node || "numberSpacing" in node) {
    const variants: string[] = [];
    if ("numberCase" in node && node.numberCase !== figma.mixed) {
      const nc = node.numberCase as string;
      if (nc === "LINING_NUMS") variants.push("lining-nums");
      if (nc === "OLDSTYLE_NUMS") variants.push("oldstyle-nums");
    }
    if ("numberSpacing" in node && node.numberSpacing !== figma.mixed) {
      const ns = node.numberSpacing as string;
      if (ns === "PROPORTIONAL_NUM") variants.push("proportional-nums");
      if (ns === "TABULAR_NUM") variants.push("tabular-nums");
    }
    if (variants.length > 0) {
      textStyle.fontVariantNumeric = variants.join(" ");
    }
  }

  return { raw, truncated, style: textStyle };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: BUILD LAYOUT NODE (recursive, async)
// ─────────────────────────────────────────────────────────────────────────────

async function buildLayoutNode(node: SceneNode): Promise<LayoutNode> {
  const parentLayoutMode =
    node.parent && "layoutMode" in node.parent
      ? (node.parent as FrameNode).layoutMode
      : "NONE";
  const isAbsolutelyPositioned =
    parentLayoutMode === "NONE" ||
    ("layoutPositioning" in node &&
      (node as SceneNode & { layoutPositioning?: string }).layoutPositioning === "ABSOLUTE");

  const box: BoundingBox = {
    width: Math.round("width" in node ? node.width : 0),
    height: Math.round("height" in node ? node.height : 0),
  };

  if (isAbsolutelyPositioned && "x" in node) {
    box.x = Math.round(node.x);
    box.y = Math.round(node.y);
  }

  const role = inferRole(node);
  const style = await extractStyle(node);
  const layout = await extractFlexLayout(node);

  const result: LayoutNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    role,
    box,
    style,
  };

  if (layout) result.layout = layout;

  if (node.type === "TEXT") {
    result.content = await extractTextContent(node as TextNode);
  }

  if ("children" in node && node.children.length > 0) {
    const visibleChildren = node.children.filter((child) => child.visible !== false);
    if (visibleChildren.length > 0) {
      result.children = await Promise.all(
        visibleChildren.map((child) => buildLayoutNode(child))
      );
    }
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
// ENTRY: extractLayoutSummary (async)
// ─────────────────────────────────────────────────────────────────────────────

export async function extractLayoutSummary(node: SceneNode): Promise<LayoutSummary> {
  const layoutNode = await buildLayoutNode(node);
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