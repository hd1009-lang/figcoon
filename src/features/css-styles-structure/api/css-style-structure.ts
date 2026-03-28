// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CSSProperties {
  [property: string]: string | number;
}

interface NodeCSSResult {
  id: string;
  name: string;
  type: string;
  depth: number;
  css: CSSProperties;
  /** Maps CSS property name → Figma variable name (e.g. "background-color" → "main-color") */
  variableComments?: Record<string, string>;
  children?: NodeCSSResult[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  function toHex(v: number): string {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbaString(r: number, g: number, b: number, a: number): string {
  if (a === 1) return rgbToHex(r, g, b);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}

function parsePaint(paint: Paint): string | null {
  if (!paint.visible) return null;

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
// Variable Resolution Helpers
// ─────────────────────────────────────────────

/**
 * Resolve a VariableAlias to its Figma variable name.
 */
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

/**
 * Get the bound variable name for a scalar field (e.g. "opacity", "fontSize", "itemSpacing").
 */
async function getScalarVar(
  node: SceneNode,
  field: string
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;
  const alias = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)[field];
  return resolveVariableName(alias as VariableAlias | undefined);
}

/**
 * Get the bound variable name for a specific fill index.
 * Checks node-level boundVariables.fills[i] first, then paint-level boundVariables.color.
 */
async function getFillVar(
  node: SceneNode,
  fillIndex: number
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;

  // Node-level fills binding
  const fillsAliases = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)["fills"];
  if (Array.isArray(fillsAliases) && fillsAliases[fillIndex]) {
    const name = await resolveVariableName(fillsAliases[fillIndex]);
    if (name) return name;
  }

  // Paint-level color binding
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

/**
 * Get the bound variable name for a specific stroke index.
 * Checks node-level boundVariables.strokes[i] first, then paint-level boundVariables.color.
 */
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

// ─────────────────────────────────────────────
// Main CSS extractor
// ─────────────────────────────────────────────

async function getCSSFromNode(node: SceneNode): Promise<{
  css: CSSProperties;
  variableComments: Record<string, string>;
}> {
  const css: CSSProperties = {};
  const variableComments: Record<string, string> = {};

  /** Helper: set a CSS property and optionally record its variable comment. */
  function set(prop: string, value: string | number, varName?: string | null) {
    css[prop] = value;
    if (varName) variableComments[prop] = varName;
  }

  // ── Size ──────────────────────────────────────
  if ("width" in node) {
    const wVar = await getScalarVar(node, "width");
    const hVar = await getScalarVar(node, "height");
    set("width", `${Math.round(node.width)}px`, wVar);
    set("height", `${Math.round(node.height)}px`, hVar);
  }

  // ── Position (chỉ cho node không nằm trong auto-layout) ───────
  const parentLayoutMode =
    node.parent && "layoutMode" in node.parent
      ? (node.parent as FrameNode).layoutMode
      : "NONE";
  const isAbsolutelyPositioned =
    parentLayoutMode === "NONE" ||
    ("layoutPositioning" in node &&
      (node as SceneNode & { layoutPositioning?: string }).layoutPositioning === "ABSOLUTE");

  if (isAbsolutelyPositioned && "x" in node) {
    set("position", "absolute");
    set("left", `${Math.round(node.x)}px`);
    set("top", `${Math.round(node.y)}px`);
  }

  // ── Opacity ──────────────────────────────────
  if ("opacity" in node && node.opacity !== 1) {
    const opVar = await getScalarVar(node, "opacity");
    set("opacity", +node.opacity.toFixed(3), opVar);
  }

  // ── Border Radius ─────────────────────────────
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    if (node.cornerRadius !== figma.mixed) {
      if (node.cornerRadius > 0) {
        const crVar = await getScalarVar(node, "cornerRadius");
        set("border-radius", `${node.cornerRadius}px`, crVar);
      }
    } else {
      const n = node as RectangleNode;
      const tl = "topLeftRadius" in node ? n.topLeftRadius : 0;
      const tr = "topRightRadius" in node ? n.topRightRadius : 0;
      const br = "bottomRightRadius" in node ? n.bottomRightRadius : 0;
      const bl = "bottomLeftRadius" in node ? n.bottomLeftRadius : 0;

      const tlVar = await getScalarVar(node, "topLeftRadius");
      const trVar = await getScalarVar(node, "topRightRadius");
      const brVar = await getScalarVar(node, "bottomRightRadius");
      const blVar = await getScalarVar(node, "bottomLeftRadius");

      const radVars = [tlVar, trVar, brVar, blVar].filter(Boolean).join(", ");
      set("border-radius", `${tl}px ${tr}px ${br}px ${bl}px`, radVars || null);
    }
  }

  // ── Fills → background ───────────────────────
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    const visibleFills = fills.filter((f) => f.visible !== false);

    if (visibleFills.length > 0) {
      const parsedFills = visibleFills
        .map(parsePaint)
        .filter(Boolean) as string[];

      if (parsedFills.length === 1) {
        const originalIdx = fills.findIndex((f) => f.visible !== false);
        const fillVar = await getFillVar(node, originalIdx);

        if (visibleFills[0].type === "SOLID") {
          set("background-color", parsedFills[0], fillVar);
        } else {
          set("background", parsedFills[0], fillVar);
        }
      } else if (parsedFills.length > 1) {
        // Collect variable names for each visible fill
        const varNames: string[] = [];
        for (let i = 0; i < fills.length; i++) {
          if (fills[i].visible === false || parsePaint(fills[i]) === null) continue;
          const v = await getFillVar(node, i);
          if (v) varNames.push(v);
        }
        set(
          "background",
          parsedFills.reverse().join(", "),
          varNames.length > 0 ? varNames.join(", ") : null
        );
      }
    }
  }

  // ── Strokes → border ─────────────────────────
  if ("strokes" in node && node.strokes.length > 0) {
    const strokeIdx = node.strokes.findIndex((s) => s.visible !== false);
    if (strokeIdx !== -1) {
      const stroke = node.strokes[strokeIdx];
      if (stroke.type === "SOLID") {
        const { r, g, b } = stroke.color;
        const color = rgbaString(r, g, b, stroke.opacity ?? 1);
        const weight =
          "strokeWeight" in node && node.strokeWeight !== figma.mixed
            ? node.strokeWeight
            : 1;

        const strokeColorVar = await getStrokeVar(node, strokeIdx);
        const strokeWeightVar = await getScalarVar(node, "strokeWeight");
        const borderVars = [strokeColorVar, strokeWeightVar]
          .filter(Boolean)
          .join(", ");

        set("border", `${weight}px solid ${color}`, borderVars || null);
      }
    }
  }

  // ── Effects: shadow, blur ─────────────────────
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

    if (allShadows.length > 0) set("box-shadow", allShadows.join(", "));

    const layerBlur = node.effects.find(
      (e): e is BlurEffect => e.type === "LAYER_BLUR" && (e.visible ?? true),
    );
    if (layerBlur) set("filter", `blur(${layerBlur.radius}px)`);

    const bgBlur = node.effects.find(
      (e): e is BlurEffect =>
        e.type === "BACKGROUND_BLUR" && (e.visible ?? true),
    );
    if (bgBlur) set("backdrop-filter", `blur(${bgBlur.radius}px)`);
  }

  // ── Auto Layout → Flexbox ─────────────────────
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const n = node as FrameNode;
    set("display", "flex");
    set("flex-direction", n.layoutMode === "HORIZONTAL" ? "row" : "column");

    if (n.itemSpacing > 0) {
      const gapVar = await getScalarVar(node, "itemSpacing");
      set("gap", `${n.itemSpacing}px`, gapVar);
    }

    const pt = n.paddingTop,
      pr = n.paddingRight,
      pb = n.paddingBottom,
      pl = n.paddingLeft;

    if (pt || pr || pb || pl) {
      const ptVar = await getScalarVar(node, "paddingTop");
      const prVar = await getScalarVar(node, "paddingRight");
      const pbVar = await getScalarVar(node, "paddingBottom");
      const plVar = await getScalarVar(node, "paddingLeft");

      if (pt === pr && pr === pb && pb === pl) {
        set("padding", `${pt}px`, ptVar || prVar || pbVar || plVar);
      } else {
        const padVars = [ptVar, prVar, pbVar, plVar].filter(Boolean).join(", ");
        set("padding", `${pt}px ${pr}px ${pb}px ${pl}px`, padVars || null);
      }
    }

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

    if (n.primaryAxisAlignItems in justifyMap)
      set("justify-content", justifyMap[n.primaryAxisAlignItems]);
    if (n.counterAxisAlignItems in alignMap)
      set("align-items", alignMap[n.counterAxisAlignItems]);

    if (n.primaryAxisSizingMode === "AUTO")
      set(n.layoutMode === "HORIZONTAL" ? "width" : "height", "fit-content");
    if (n.counterAxisSizingMode === "AUTO")
      set(n.layoutMode === "HORIZONTAL" ? "height" : "width", "fit-content");

    if (n.clipsContent) set("overflow", "hidden");
  }

  // ── Typography (TEXT node only) ───────────────
  if (node.type === "TEXT") {
    const t = node as TextNode;

    if (t.fontSize !== figma.mixed) {
      const fsVar = await getScalarVar(node, "fontSize");
      set("font-size", `${t.fontSize}px`, fsVar);
    }

    if (t.fontName !== figma.mixed) {
      const familyVar = await getScalarVar(node, "fontFamily");
      set("font-family", `${t.fontName.family}`, familyVar);

      const weightMap: Record<string, number> = {
        Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
        Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
      };
      const style = t.fontName.style.replace(/\s/g, "");
      set("font-weight", weightMap[style] ?? t.fontName.style);

      if (t.fontName.style.toLowerCase().includes("italic"))
        set("font-style", "italic");
    }

    // ── font-variant-numeric ───────────────────
    if ("numberCase" in t || "numberSpacing" in t) {
      const variants: string[] = [];
      if ("numberCase" in t && t.numberCase !== figma.mixed) {
        const nc = t.numberCase as string;
        if (nc === "LINING_NUMS") variants.push("lining-nums");
        if (nc === "OLDSTYLE_NUMS") variants.push("oldstyle-nums");
      }
      if ("numberSpacing" in t && t.numberSpacing !== figma.mixed) {
        const ns = t.numberSpacing as string;
        if (ns === "PROPORTIONAL_NUM") variants.push("proportional-nums");
        if (ns === "TABULAR_NUM") variants.push("tabular-nums");
      }
      if (variants.length > 0) set("font-variant-numeric", variants.join(" "));
    }

    // ── font-feature-settings ──────────────────
    if (t.openTypeFeatures !== figma.mixed) {
      const features = t.openTypeFeatures as Record<OpenTypeFeature, boolean>;
      const entries = Object.entries(features) as [OpenTypeFeature, boolean][];
      const active = entries.filter(([, on]) => on);
      if (active.length > 0) {
        set(
          "font-feature-settings",
          active.map(([tag, on]) => `'${tag.toLocaleLowerCase()}' ${on ? "on" : "off"}`).join(", ")
        );
      }
    }

    if (t.textAlignHorizontal)
      set("text-align", t.textAlignHorizontal.toLowerCase());

    if (t.letterSpacing !== figma.mixed) {
      const ls = t.letterSpacing as LetterSpacing;
      const lsVar = await getScalarVar(node, "letterSpacing");
      if (ls.unit === "PIXELS") set("letter-spacing", `${ls.value}px`, lsVar);
      if (ls.unit === "PERCENT") set("letter-spacing", `${ls.value / 100}em`, lsVar);
    }

    if (t.lineHeight !== figma.mixed) {
      const lh = t.lineHeight as LineHeight;
      const lhVar = await getScalarVar(node, "lineHeight");
      if (lh.unit === "PIXELS") set("line-height", `${lh.value}px`, lhVar);
      if (lh.unit === "PERCENT") set("line-height", `${lh.value / 100}`, lhVar);
      if (lh.unit === "AUTO") set("line-height", "normal");
    }

    if (t.textDecoration !== figma.mixed) {
      if (t.textDecoration === "UNDERLINE") set("text-decoration", "underline");
      if (t.textDecoration === "STRIKETHROUGH") set("text-decoration", "line-through");
    }

    if (t.textCase !== figma.mixed) {
      const caseMap: Record<string, string> = {
        UPPER: "uppercase", LOWER: "lowercase",
        TITLE: "capitalize", ORIGINAL: "none",
      };
      if (t.textCase in caseMap)
        set("text-transform", caseMap[t.textCase as string]);
    }

    // Text color
    if (t.fills !== figma.mixed) {
      const fills = t.fills as Paint[];
      const fillIdx = fills.findIndex(
        (f) => f.visible !== false && f.type === "SOLID"
      );
      if (fillIdx !== -1) {
        const fill = fills[fillIdx] as SolidPaint;
        const { r, g, b } = fill.color;
        const colorVar = await getFillVar(node, fillIdx);
        set("color", rgbaString(r, g, b, fill.opacity ?? 1), colorVar);
      }
    }
  }

  return { css, variableComments };
}

// ─────────────────────────────────────────────
// Traverse all group
// ─────────────────────────────────────────────

export async function extractGroupCSS(
  node: SceneNode,
  depth: number = 0,
): Promise<NodeCSSResult> {
  const { css, variableComments } = await getCSSFromNode(node);

  const result: NodeCSSResult = {
    id: node.id,
    name: node.name,
    type: node.type,
    depth,
    css,
    variableComments,
  };

  if ("children" in node && node.children.length > 0) {
    const visibleChildren = node.children.filter((child) => child.visible !== false);
    if (visibleChildren.length > 0) {
      result.children = await Promise.all(
        visibleChildren.map((child) => extractGroupCSS(child, depth + 1)),
      );
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Format output CSS class
// ─────────────────────────────────────────────

export function formatAsCSS(result: NodeCSSResult): string {
  const lines: string[] = [];

  function walk(node: NodeCSSResult) {
    const selector = `.${node.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`;

    const props: string[] = [];
    for (const key in node.css) {
      if (!Object.prototype.hasOwnProperty.call(node.css, key)) continue;
      const value = node.css[key];
      const varName = node.variableComments?.[key];
      const comment = varName ? ` /* ${varName} */` : "";
      props.push(`  ${key}: ${value};${comment}`);
    }

    if (props.length > 0) {
      lines.push(`/* [${node.type}] depth: ${node.depth} */`);
      lines.push(`${selector} {\n${props.join("\n")}\n}\n`);
    }

    if (node.children) node.children.forEach(walk);
  }

  walk(result);
  return lines.join("\n");
}

export function mergeVariableComments(result: NodeCSSResult): NodeCSSResult {
  const mergedCss: CSSProperties = {};
  for (const key in result.css) {
    if (!Object.prototype.hasOwnProperty.call(result.css, key)) continue;
    const value = result.css[key];
    const varName = result.variableComments?.[key];
    mergedCss[key] = varName ? `${value} /* ${varName} */` : value;
  }

  const merged: NodeCSSResult = {
    id: result.id,
    name: result.name,
    type: result.type,
    depth: result.depth,
    css: mergedCss,
  };

  if (result.children && result.children.length > 0) {
    merged.children = result.children.map(mergeVariableComments);
  }

  return merged;
}
