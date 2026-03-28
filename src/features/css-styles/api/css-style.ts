// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toHexByte(v: number): string {
  const hex = Math.round(v * 255).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

function rgbaColor(r: number, g: number, b: number, a: number): string {
  if (a >= 0.999) return rgbToHex(r, g, b);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}

function formatNumber(n: number): string {
  
  const fixed = +n.toFixed(2);
  return fixed % 1 === 0 ? `${fixed}` : `${fixed}`;
}

function px(n: number): string {
  return `${formatNumber(n)}px`;
}

function parsePaintValue(paint: Paint): string | null {
  if (paint.visible === false) return null;

  if (paint.type === "SOLID") {
    const { r, g, b } = paint.color;
    return rgbaColor(r, g, b, paint.opacity ?? 1);
  }

  if (paint.type === "GRADIENT_LINEAR") {
    const stops = paint.gradientStops
      .map((s) => {
        const { r, g, b, a } = s.color;
        return `${rgbaColor(r, g, b, a)} ${Math.round(s.position * 100)}%`;
      })
      .join(", ");
    return `linear-gradient(180deg, ${stops})`;
  }

  if (paint.type === "GRADIENT_RADIAL") {
    const stops = paint.gradientStops
      .map((s) => {
        const { r, g, b, a } = s.color;
        return `${rgbaColor(r, g, b, a)} ${Math.round(s.position * 100)}%`;
      })
      .join(", ");
    return `radial-gradient(${stops})`;
  }

  if (paint.type === "IMAGE") return null;

  return null;
}

const FONT_WEIGHT_MAP: Record<string, number> = {
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

function getFontWeight(style: string): number {
  const key = style
    .replace(/\s*Italic$/i, "")
    .trim()
    .replace(/\s/g, "");
  return FONT_WEIGHT_MAP[key] ?? 400;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLE RESOLUTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a VariableAlias (or array of aliases) to a variable name string.
 * Returns e.g. "main-color" or null if no variable found.
 */
async function resolveVariableName(
  alias: VariableAlias | VariableAlias[] | undefined
): Promise<string | null> {
  if (!alias) return null;

  // Some fields (fills, strokes) return an array of aliases
  const id = Array.isArray(alias) ? alias[0]?.id : (alias as VariableAlias).id;
  if (!id) return null;

  const variable = await figma.variables.getVariableByIdAsync(id);
  return variable ? variable.name : null;
}

/**
 * Get the variable name bound to the color of fills[fillIndex].
 * Checks both node-level boundVariables.fills and paint-level boundVariables.color.
 */
async function getFillVariableName(
  node: SceneNode,
  fillIndex: number
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;

  // Node-level: boundVariables.fills is an array of aliases (one per fill layer)
  const fillsAliases = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)["fills"];
  if (Array.isArray(fillsAliases) && fillsAliases[fillIndex]) {
    const name = await resolveVariableName(fillsAliases[fillIndex]);
    if (name) return name;
  }

  // Paint-level: fills[i].boundVariables.color
  if ("fills" in node && node.fills !== figma.mixed) {
    const paint = (node.fills as Paint[])[fillIndex];
    const paintBoundVars = (paint as Paint & { boundVariables?: Record<string, VariableAlias> }).boundVariables;
    if (paintBoundVars?.color) {
      return resolveVariableName(paintBoundVars.color);
    }
  }

  return null;
}

/**
 * Get the variable name bound to a simple numeric/scalar field on a node.
 * e.g. field = "opacity", "width", "height", "cornerRadius", "itemSpacing" etc.
 */
async function getScalarVariableName(
  node: SceneNode,
  field: string
): Promise<string | null> {
  if (!("boundVariables" in node) || !node.boundVariables) return null;
  const alias = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)[field];
  return resolveVariableName(alias as VariableAlias | undefined);
}

/**
 * Append ` /* varName *\/` suffix to a CSS line if a variable name is found.
 */
function withVarComment(cssLine: string, varName: string | null): string {
  if (!varName) return cssLine;
  return `${cssLine} /* ${varName} */`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CSS LINES FOR A SINGLE NODE
// ─────────────────────────────────────────────────────────────────────────────

async function buildNodeCSSLines(node: SceneNode): Promise<string[]> {
  const lines: string[] = [];

  const add = (line: string) => lines.push(line);
  const prop = (p: string, v: string) => `${p}: ${v};`;

  // ── Size ─────────────────────────────────────
  if ("width" in node) {
    const wVar = await getScalarVariableName(node, "width");
    const hVar = await getScalarVariableName(node, "height");
    add(withVarComment(prop("width", px(node.width)), wVar));
    add(withVarComment(prop("height", px(node.height)), hVar));
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
    add(prop("position", "absolute"));
    add(prop("left", px(node.x)));
    add(prop("top", px(node.y)));
  }

  // ── Opacity ───────────────────────────────────
  if ("opacity" in node && node.opacity < 1) {
    const opVar = await getScalarVariableName(node, "opacity");
    add(withVarComment(prop("opacity", formatNumber(node.opacity)), opVar));
  }

  // ── Border Radius ─────────────────────────────
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    if (
      node.cornerRadius !== figma.mixed &&
      (node.cornerRadius as number) > 0
    ) {
      const crVar = await getScalarVariableName(node, "cornerRadius");
      add(withVarComment(prop("border-radius", px(node.cornerRadius as number)), crVar));
    } else if (node.cornerRadius === figma.mixed) {
      const n = node as RectangleNode;
      const tlVar = await getScalarVariableName(node, "topLeftRadius");
      const trVar = await getScalarVariableName(node, "topRightRadius");
      const brVar = await getScalarVariableName(node, "bottomRightRadius");
      const blVar = await getScalarVariableName(node, "bottomLeftRadius");

      let radiusLine = prop(
        "border-radius",
        `${px(n.topLeftRadius)} ${px(n.topRightRadius)} ${px(n.bottomRightRadius)} ${px(n.bottomLeftRadius)}`
      );
      const radVars = [tlVar, trVar, brVar, blVar].filter(Boolean);
      if (radVars.length > 0) radiusLine += ` /* ${radVars.join(", ")} */`;
      add(radiusLine);
    }
  }

  // ── Background / Fill ─────────────────────────
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = (node.fills as Paint[]).filter((f) => f.visible !== false);
    if (fills.length > 0) {
      const parsed = fills
        .map(parsePaintValue)
        .filter((v): v is string => v !== null);

      if (parsed.length === 1) {
        // Get variable for the first (only) fill
        const originalIndex = (node.fills as Paint[]).findIndex((f) => f.visible !== false);
        const varName = await getFillVariableName(node, originalIndex);
        add(withVarComment(prop("background", parsed[0]), varName));
      } else if (parsed.length > 1) {
        // Multiple fills: collect variables for each visible fill
        // let originalIdx = -1;
        const parsedWithVars: Array<{ value: string; varName: string | null }> = [];

        for (let i = 0; i < (node.fills as Paint[]).length; i++) {
          const fill = (node.fills as Paint[])[i];
          if (fill.visible === false) continue;
          const value = parsePaintValue(fill);
          if (value === null) continue;
          const varName = await getFillVariableName(node, i);
          parsedWithVars.push({ value, varName });
        }

        // CSS stacks fills bottom-to-top (reversed), but variables comment stays readable
        const reversedValues = parsedWithVars.map((p) => p.value).reverse().join(", ");
        const varNames = parsedWithVars
          .map((p) => p.varName)
          .filter(Boolean)
          .join(", ");

        let bgLine = prop("background", reversedValues);
        if (varNames) bgLine += ` /* ${varNames} */`;
        add(bgLine);
      }
    }
  }

  // ── Stroke → border ───────────────────────────
  if ("strokes" in node && node.strokes.length > 0) {
    const stroke = node.strokes.find((s) => s.visible !== false);
    if (stroke && stroke.type === "SOLID") {
      const { r, g, b } = stroke.color;
      const color = rgbaColor(r, g, b, stroke.opacity ?? 1);
      const weight =
        "strokeWeight" in node && node.strokeWeight !== figma.mixed
          ? (node.strokeWeight as number)
          : 1;

      // Try to get variable from stroke color binding
      const strokeIdx = node.strokes.findIndex((s) => s.visible !== false);
      let strokeVarName: string | null = null;
      if ("boundVariables" in node && node.boundVariables) {
        const strokesAliases = (node.boundVariables as Record<string, VariableAlias | VariableAlias[]>)["strokes"];
        if (Array.isArray(strokesAliases) && strokesAliases[strokeIdx]) {
          strokeVarName = await resolveVariableName(strokesAliases[strokeIdx]);
        }
        if (!strokeVarName) {
          const paintBoundVars = (stroke as Paint & { boundVariables?: Record<string, VariableAlias> }).boundVariables;
          if (paintBoundVars?.color) {
            strokeVarName = await resolveVariableName(paintBoundVars.color);
          }
        }
      }
      // Also check strokeWeight variable
      const weightVar = await getScalarVariableName(node, "strokeWeight");

      let borderLine = prop("border", `${px(weight)} solid ${color}`);
      const borderVars = [strokeVarName, weightVar].filter(Boolean);
      if (borderVars.length > 0) borderLine += ` /* ${borderVars.join(", ")} */`;
      add(borderLine);
    }
  }

  // ── Effects ───────────────────────────────────
  if ("effects" in node && node.effects.length > 0) {
    const dropShadows = node.effects.filter(
      (e): e is DropShadowEffect =>
        e.type === "DROP_SHADOW" && (e.visible ?? true),
    );
    const innerShadows = node.effects.filter(
      (e): e is InnerShadowEffect =>
        e.type === "INNER_SHADOW" && (e.visible ?? true),
    );

    const shadows = [
      ...dropShadows.map((s) => {
        const { r, g, b, a } = s.color;
        return `${px(s.offset.x)} ${px(s.offset.y)} ${px(s.radius)} ${rgbaColor(r, g, b, a)}`;
      }),
      ...innerShadows.map((s) => {
        const { r, g, b, a } = s.color;
        return `inset ${px(s.offset.x)} ${px(s.offset.y)} ${px(s.radius)} ${rgbaColor(r, g, b, a)}`;
      }),
    ];
    if (shadows.length > 0) add(prop("box-shadow", shadows.join(", ")));

    const layerBlur = node.effects.find(
      (e): e is BlurEffect => e.type === "LAYER_BLUR" && (e.visible ?? true),
    );
    if (layerBlur) add(prop("filter", `blur(${px(layerBlur.radius)})`));

    const bgBlur = node.effects.find(
      (e): e is BlurEffect =>
        e.type === "BACKGROUND_BLUR" && (e.visible ?? true),
    );
    if (bgBlur) add(prop("backdrop-filter", `blur(${px(bgBlur.radius)})`));
  }

  // ── Auto Layout → Flexbox ─────────────────────
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const n = node as FrameNode;

    add(prop("display", "flex"));
    add(prop("flex-direction", n.layoutMode === "HORIZONTAL" ? "row" : "column"));

    if (n.layoutWrap === "WRAP") add(prop("flex-wrap", "wrap"));

    if (n.itemSpacing > 0) {
      const gapVar = await getScalarVariableName(node, "itemSpacing");
      add(withVarComment(prop("gap", px(n.itemSpacing)), gapVar));
    }

    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = n;
    if (pt || pr || pb || pl) {
      const ptVar = await getScalarVariableName(node, "paddingTop");
      const prVar = await getScalarVariableName(node, "paddingRight");
      const pbVar = await getScalarVariableName(node, "paddingBottom");
      const plVar = await getScalarVariableName(node, "paddingLeft");

      let paddingLine: string;
      if (pt === pr && pr === pb && pb === pl) {
        paddingLine = prop("padding", px(pt));
        const padVar = ptVar || prVar || pbVar || plVar;
        paddingLine = withVarComment(paddingLine, padVar);
      } else {
        paddingLine = prop("padding", `${px(pt)} ${px(pr)} ${px(pb)} ${px(pl)}`);
        const padVars = [ptVar, prVar, pbVar, plVar].filter(Boolean);
        if (padVars.length > 0) paddingLine += ` /* ${padVars.join(", ")} */`;
      }
      add(paddingLine);
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

    const jc = justifyMap[n.primaryAxisAlignItems];
    const ai = alignMap[n.counterAxisAlignItems];
    if (jc) add(prop("justify-content", jc));
    if (ai) add(prop("align-items", ai));

    if (n.clipsContent) add(prop("overflow", "hidden"));
  }

  // ── Typography (TEXT only) ────────────────────
  if (node.type === "TEXT") {
    const t = node as TextNode;

    if (t.fontName !== figma.mixed) {
      const fn = t.fontName as FontName;
      const features = t.openTypeFeatures as Record<OpenTypeFeature, boolean>;
      const entries = Object.entries(features) as [OpenTypeFeature, boolean][];
      if (entries.length > 0) {
        add(
          prop(
            "font-feature-settings",
            entries.map(([tag, on]) => `'${tag.toLocaleLowerCase()}' ${on ? "on" : "off"}`).join(", ")
          )
        );
      }

      const familyVar = await getScalarVariableName(node, "fontFamily");
      add(withVarComment(prop("font-family", `'${fn.family}'`), familyVar));
      add(prop("font-style", fn.style.toLowerCase().includes("italic") ? "italic" : "normal"));
      add(prop("font-weight", String(getFontWeight(fn.style))));
    }

    if (t.fontSize !== figma.mixed) {
      const fsVar = await getScalarVariableName(node, "fontSize");
      add(withVarComment(prop("font-size", px(t.fontSize as number)), fsVar));
    }

    if (t.lineHeight !== figma.mixed) {
      const lh = t.lineHeight as LineHeight;
      const lhVar = await getScalarVariableName(node, "lineHeight");
      if (lh.unit === "PIXELS") add(withVarComment(prop("line-height", px(lh.value)), lhVar));
      else if (lh.unit === "PERCENT")
        add(withVarComment(prop("line-height", formatNumber(lh.value / 100)), lhVar));
    }

    if (t.letterSpacing !== figma.mixed) {
      const ls = t.letterSpacing as LetterSpacing;
      if (ls.value !== 0) {
        const lsVar = await getScalarVariableName(node, "letterSpacing");
        add(
          withVarComment(
            prop(
              "letter-spacing",
              ls.unit === "PIXELS"
                ? px(ls.value)
                : `${formatNumber(ls.value / 100)}em`
            ),
            lsVar
          )
        );
      }
    }

    if (t.textAlignHorizontal) {
      add(prop("text-align", t.textAlignHorizontal.toLowerCase()));
    }

    if (t.textDecoration !== figma.mixed) {
      if (t.textDecoration === "UNDERLINE") add(prop("text-decoration", "underline"));
      else if (t.textDecoration === "STRIKETHROUGH") add(prop("text-decoration", "line-through"));
    }

    if (t.textCase !== figma.mixed) {
      const caseMap: Record<string, string> = {
        UPPER: "uppercase",
        LOWER: "lowercase",
        TITLE: "capitalize",
      };
      const tc = caseMap[t.textCase as string];
      if (tc) add(prop("text-transform", tc));
    }

    // Text color
    if (t.fills !== figma.mixed) {
      const fills = t.fills as Paint[];
      const solidFillIdx = fills.findIndex(
        (f): f is SolidPaint => f.type === "SOLID" && f.visible !== false,
      );
      if (solidFillIdx !== -1) {
        const solidFill = fills[solidFillIdx] as SolidPaint;
        const { r, g, b } = solidFill.color;
        const colorVar = await getFillVariableName(node, solidFillIdx);
        add(withVarComment(prop("color", rgbaColor(r, g, b, solidFill.opacity ?? 1)), colorVar));
      }
    }
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET COLOR STYLE NAME
// ─────────────────────────────────────────────────────────────────────────────

async function getColorStyleName(node: SceneNode): Promise<string | null> {
  if (node.type !== "TEXT") return null;
  const t = node as TextNode;
  if (!t.fillStyleId || t.fillStyleId === figma.mixed) return null;

  const styleId = t.fillStyleId as string;
  const style = await figma.getStyleByIdAsync(styleId);
  return style ? style.name : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLATTEN TREE & BUILD FULL CSS STRING
// ─────────────────────────────────────────────────────────────────────────────

export async function buildFlatCSS(root: SceneNode): Promise<string> {
  const blocks: string[] = [];

  async function traverse(node: SceneNode): Promise<void> {
    const cssLines = await buildNodeCSSLines(node);

    // Color style comment (e.g. /* White */) - insert before color: line
    if (node.type === "TEXT") {
      const styleName = await getColorStyleName(node);
      if (styleName) {
        const colorIdx = cssLines.findIndex((l) => l.startsWith("color:"));
        if (colorIdx !== -1) {
          cssLines.splice(colorIdx, 0, `/* ${styleName} */`);
        }
      }
    }

    const propLines = cssLines.join("\n");
    blocks.push(`/* ${node.name} */\n${propLines}`);

    if ("children" in node) {
      for (const child of node.children) {
        if (child.visible !== false) await traverse(child);
      }
    }
  }

  await traverse(root);
  return blocks.join("\n\n");
}