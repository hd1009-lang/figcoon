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
  // Giữ tối đa 2 chữ số thập phân, bỏ .00
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

  if (paint.type === "IMAGE") return null; // skip image fill

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
// BUILD CSS LINES FOR A SINGLE NODE
// ─────────────────────────────────────────────────────────────────────────────

function buildNodeCSSLines(node: SceneNode): string[] {
  const lines: string[] = [];

  const add = (prop: string, value: string) => {
    lines.push(`${prop}: ${value};`);
  };

  // ── Position ──────────────────────────────────
  add("position", "absolute");

  if ("width" in node) {
    add("width", px(node.width));
    add("height", px(node.height));
  }

  // Absolute position relative to parent
  if ("x" in node) {
    add("left", px(node.x));
    add("top", px(node.y));
  }

  // ── Opacity ───────────────────────────────────
  if ("opacity" in node && node.opacity < 1) {
    add("opacity", formatNumber(node.opacity));
  }

  // ── Border Radius ─────────────────────────────
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    if (
      node.cornerRadius !== figma.mixed &&
      (node.cornerRadius as number) > 0
    ) {
      add("border-radius", px(node.cornerRadius as number));
    } else if (node.cornerRadius === figma.mixed) {
      const n = node as RectangleNode;
      add(
        "border-radius",
        `${px(n.topLeftRadius)} ${px(n.topRightRadius)} ${px(n.bottomRightRadius)} ${px(n.bottomLeftRadius)}`,
      );
    }
  }

  // ── Background / Fill ─────────────────────────
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = (node.fills as Paint[]).filter((f) => f.visible !== false);
    if (fills.length > 0) {
      // Multiple fills → use background shorthand (bottom to top = CSS order reversed)
      const parsed = fills
        .map(parsePaintValue)
        .filter((v): v is string => v !== null);

      if (parsed.length === 1) {
        const fill = fills[0];
        if (fill.type === "SOLID") {
          add("background", parsed[0]);
        } else {
          add("background", parsed[0]);
        }
      } else if (parsed.length > 1) {
        add("background", parsed.reverse().join(", "));
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
      add("border", `${px(weight)} solid ${color}`);
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
    if (shadows.length > 0) add("box-shadow", shadows.join(", "));

    const layerBlur = node.effects.find(
      (e): e is BlurEffect => e.type === "LAYER_BLUR" && (e.visible ?? true),
    );
    if (layerBlur) add("filter", `blur(${px(layerBlur.radius)})`);

    const bgBlur = node.effects.find(
      (e): e is BlurEffect =>
        e.type === "BACKGROUND_BLUR" && (e.visible ?? true),
    );
    if (bgBlur) add("backdrop-filter", `blur(${px(bgBlur.radius)})`);
  }

  // ── Auto Layout → Flexbox ─────────────────────
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const n = node as FrameNode;

    add("display", "flex");
    add("flex-direction", n.layoutMode === "HORIZONTAL" ? "row" : "column");

    if (n.layoutWrap === "WRAP") add("flex-wrap", "wrap");

    if (n.itemSpacing > 0) add("gap", px(n.itemSpacing));

    const {
      paddingTop: pt,
      paddingRight: pr,
      paddingBottom: pb,
      paddingLeft: pl,
    } = n;
    if (pt || pr || pb || pl) {
      if (pt === pr && pr === pb && pb === pl) {
        add("padding", px(pt));
      } else {
        add("padding", `${px(pt)} ${px(pr)} ${px(pb)} ${px(pl)}`);
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

    const jc = justifyMap[n.primaryAxisAlignItems];
    const ai = alignMap[n.counterAxisAlignItems];
    if (jc) add("justify-content", jc);
    if (ai) add("align-items", ai);

    if (n.clipsContent) add("overflow", "hidden");
  }

  // ── Typography (TEXT only) ────────────────────
  if (node.type === "TEXT") {
    const t = node as TextNode;

    if (t.fontName !== figma.mixed) {
      const fn = t.fontName as FontName;
      add("font-family", `'${fn.family}'`);
      add(
        "font-style",
        fn.style.toLowerCase().includes("italic") ? "italic" : "normal",
      );
      add("font-weight", String(getFontWeight(fn.style)));
    }

    if (t.fontSize !== figma.mixed) {
      add("font-size", px(t.fontSize as number));
    }

    if (t.lineHeight !== figma.mixed) {
      const lh = t.lineHeight as LineHeight;
      if (lh.unit === "PIXELS") add("line-height", px(lh.value));
      else if (lh.unit === "PERCENT")
        add("line-height", formatNumber(lh.value / 100));
      // AUTO → skip (browser default)
    }

    if (t.letterSpacing !== figma.mixed) {
      const ls = t.letterSpacing as LetterSpacing;
      if (ls.value !== 0) {
        add(
          "letter-spacing",
          ls.unit === "PIXELS"
            ? px(ls.value)
            : `${formatNumber(ls.value / 100)}em`,
        );
      }
    }

    // Text node inside auto layout → flex for vertical centering
    if (!("layoutMode" in node)) {
      const parentHasLayout =
        node.parent &&
        "layoutMode" in node.parent &&
        (node.parent as FrameNode).layoutMode !== "NONE";

      if (!parentHasLayout) {
        add("display", "flex");
        add("align-items", "center");
      }
    }

    if (t.textAlignHorizontal) {
      add("text-align", t.textAlignHorizontal.toLowerCase());
    }

    if (t.textDecoration !== figma.mixed) {
      if (t.textDecoration === "UNDERLINE") add("text-decoration", "underline");
      else if (t.textDecoration === "STRIKETHROUGH")
        add("text-decoration", "line-through");
    }

    if (t.textCase !== figma.mixed) {
      const caseMap: Record<string, string> = {
        UPPER: "uppercase",
        LOWER: "lowercase",
        TITLE: "capitalize",
      };
      const tc = caseMap[t.textCase as string];
      if (tc) add("text-transform", tc);
    }

    // Text color
    if (t.fills !== figma.mixed) {
      const fills = t.fills as Paint[];
      const solidFill = fills.find(
        (f): f is SolidPaint => f.type === "SOLID" && f.visible !== false,
      );
      if (solidFill) {
        const { r, g, b } = solidFill.color;
        add("color", rgbaColor(r, g, b, solidFill.opacity ?? 1));
      }
    }
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET COLOR STYLE NAME (comment trên color)
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
    const cssLines = buildNodeCSSLines(node);

    // Color style comment (e.g. /* White */)
    if (node.type === "TEXT") {
      const styleName = await getColorStyleName(node);
      if (styleName) {
        const colorIdx = cssLines.findIndex((l) => l.startsWith("color:"));
        if (colorIdx !== -1) {
          // Chèn comment ngay trước dòng color
          cssLines.splice(colorIdx, 0, `/* ${styleName} */`);
        }
      }
    }

    // Format block:
    // /* Node Name */
    // prop: value;
    // prop: value;
    const propLines = cssLines.join("\n");
    blocks.push(`/* ${node.name} */\n${propLines}`);

    // Recurse
    if ("children" in node) {
      for (const child of node.children) {
        await traverse(child);
      }
    }
  }

  await traverse(root);
  return blocks.join("\n\n");
}
