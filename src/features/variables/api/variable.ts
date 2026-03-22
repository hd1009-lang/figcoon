// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TokenValue = string | number | boolean | null;
type ModeTokenMap = Record<string, TokenValue>;
type CollectionTokenMap = Record<string, ModeTokenMap>;

interface CompactTypography {
  fontFamily: string;
  fontStyle: string;
  fontWeight: number | string;
  fontSize: number;
  lineHeight: string;
  letterSpacing?: string;
  textDecoration?: string;
  textCase?: string;
}

interface CompactGrid {
  pattern: string;
  count?: number;
  gutterSize?: number;
  offset?: number;
  sectionSize?: number;
  alignment?: string;
}

interface CompactDesignTokens {
  meta: {
    fileName: string;
    extractedAt: string;
    totalVariables: number;
    totalStyles: number;
  };
  /**
   * Luôn nest theo mode — nhất quán cho mọi collection:
   *
   * {
   *   "GAP": {
   *     "PC":     { "gap-s": 8,  "gap-m": 16 },
   *     "Tablet": { "gap-s": 4,  "gap-m": 8  }
   *   },
   *   "Primitives": {
   *     "Default": { "color/white": "#FFFFFF" }
   *   },
   *   "Semantic": {
   *     "Light": { "color/bg": "#FFFFFF" },
   *     "Dark":  { "color/bg": "#0F0F0F" }
   *   }
   * }
   */
  variables: Record<string, CollectionTokenMap>;
  styles: {
    paint:      Record<string, string>;
    typography: Record<string, CompactTypography>;
    effect:     Record<string, string>;
    grid:       Record<string, CompactGrid>;
  };
}

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

const FONT_WEIGHT_MAP: Record<string, number> = {
  Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
  Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};

function parseFontWeight(style: string): number | string {
  const key = style.replace(/\s*Italic$/i, "").trim().replace(/\s/g, "");
  return FONT_WEIGHT_MAP[key] ?? style;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE VARIABLE VALUE — đệ quy resolve alias
// ─────────────────────────────────────────────────────────────────────────────

function resolveValue(
  raw: VariableValue,
  type: VariableResolvedDataType,
  variableMap: Map<string, Variable>,
  defaultModeId: string,
  depth: number = 0
): TokenValue {
  if (depth > 10) return null; // tránh vòng lặp vô tận

  // Alias → resolve sang giá trị thực
  if (
    typeof raw === "object" &&
    raw !== null &&
    "type" in raw &&
    (raw as VariableAlias).type === "VARIABLE_ALIAS"
  ) {
    const alias = raw as VariableAlias;
    const target = variableMap.get(alias.id);
    if (!target) return null;

    // Ưu tiên lấy từ default mode của target, fallback về mode đầu tiên
    const targetRaw =
      target.valuesByMode[defaultModeId] ??
      Object.values(target.valuesByMode)[0];

    if (targetRaw === undefined) return null;

    return resolveValue(targetRaw, target.resolvedType, variableMap, defaultModeId, depth + 1);
  }

  // COLOR
  if (type === "COLOR" && typeof raw === "object" && raw !== null && "r" in raw) {
    const c = raw as RGBA;
    return rgbaColor(c.r, c.g, c.b, c.a);
  }

  // FLOAT — giữ số nguyên nếu không có thập phân
  if (typeof raw === "number") {
    return raw % 1 === 0 ? raw : +raw.toFixed(4);
  }

  // STRING, BOOLEAN
  return raw as string | boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLES
// ─────────────────────────────────────────────────────────────────────────────

async function extractVariablesCompact(): Promise<CompactDesignTokens["variables"]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();

  const variableMap = new Map<string, Variable>();
  for (const v of allVars) variableMap.set(v.id, v);

  const result: CompactDesignTokens["variables"] = {};

  for (const collection of collections) {
    const collectionResult: CollectionTokenMap = {};

    // Khởi tạo object rỗng cho từng mode
    for (const mode of collection.modes) {
      collectionResult[mode.name] = {};
    }

    // Fill giá trị từng variable theo từng mode
    for (const varId of collection.variableIds) {
      const variable = variableMap.get(varId);
      if (!variable) continue;

      for (const mode of collection.modes) {
        const raw = variable.valuesByMode[mode.modeId];
        if (raw === undefined) continue;

        collectionResult[mode.name][variable.name] = resolveValue(
          raw,
          variable.resolvedType,
          variableMap,
          collection.defaultModeId
        );
      }
    }

    result[collection.name] = collectionResult;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINT STYLES
// ─────────────────────────────────────────────────────────────────────────────

async function extractPaintCompact(): Promise<Record<string, string>> {
  const styles = await figma.getLocalPaintStylesAsync();
  const result: Record<string, string> = {};

  for (const style of styles) {
    const visible = style.paints.filter((p) => p.visible !== false);
    if (visible.length === 0) continue;

    const parsed: string[] = [];

    for (const paint of visible) {
      if (paint.type === "SOLID") {
        const { r, g, b } = paint.color;
        parsed.push(rgbaColor(r, g, b, paint.opacity ?? 1));
        continue;
      }

      if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") {
        const stops = paint.gradientStops
          .map((s) => {
            const { r, g, b, a } = s.color;
            return `${rgbaColor(r, g, b, a)} ${Math.round(s.position * 100)}%`;
          })
          .join(", ");
        parsed.push(
          paint.type === "GRADIENT_LINEAR"
            ? `linear-gradient(180deg, ${stops})`
            : `radial-gradient(${stops})`
        );
        continue;
      }

      if (paint.type === "IMAGE") parsed.push("image");
    }

    if (parsed.length > 0) result[style.name] = parsed.join(", ");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY STYLES
// ─────────────────────────────────────────────────────────────────────────────

async function extractTypographyCompact(): Promise<Record<string, CompactTypography>> {
  const styles = await figma.getLocalTextStylesAsync();
  const result: Record<string, CompactTypography> = {};

  for (const style of styles) {
    let lineHeight = "normal";
    if (style.lineHeight.unit === "PIXELS") {
      lineHeight = `${style.lineHeight.value}px`;
    } else if (style.lineHeight.unit === "PERCENT") {
      lineHeight = `${+(style.lineHeight.value / 100).toFixed(3)}`;
    }

    const token: CompactTypography = {
      fontFamily: style.fontName.family,
      fontStyle:  style.fontName.style,
      fontWeight: parseFontWeight(style.fontName.style),
      fontSize:   style.fontSize,
      lineHeight,
    };

    if (style.letterSpacing.value !== 0) {
      token.letterSpacing =
        style.letterSpacing.unit === "PIXELS"
          ? `${style.letterSpacing.value}px`
          : `${+(style.letterSpacing.value / 100).toFixed(4)}em`;
    }

    if (style.textDecoration === "UNDERLINE") token.textDecoration = "underline";
    else if (style.textDecoration === "STRIKETHROUGH") token.textDecoration = "line-through";

    const caseMap: Record<string, string> = {
      UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize",
    };
    const tc = caseMap[style.textCase];
    if (tc) token.textCase = tc;

    result[style.name] = token;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT STYLES
// ─────────────────────────────────────────────────────────────────────────────

async function extractEffectCompact(): Promise<Record<string, string>> {
  const styles = await figma.getLocalEffectStylesAsync();
  const result: Record<string, string> = {};

  for (const style of styles) {
    const visible = style.effects.filter((e) => e.visible !== false);
    if (visible.length === 0) continue;

    const parts: string[] = [];

    for (const effect of visible) {
      if (effect.type === "DROP_SHADOW") {
        const { r, g, b, a } = effect.color;
        parts.push(
          `${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread ?? 0}px ${rgbaColor(r, g, b, a)}`
        );
      } else if (effect.type === "INNER_SHADOW") {
        const { r, g, b, a } = effect.color;
        parts.push(
          `inset ${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread ?? 0}px ${rgbaColor(r, g, b, a)}`
        );
      } else if (effect.type === "LAYER_BLUR") {
        parts.push(`blur(${effect.radius}px)`);
      } else if (effect.type === "BACKGROUND_BLUR") {
        parts.push(`backdrop-blur(${effect.radius}px)`);
      }
    }

    if (parts.length > 0) result[style.name] = parts.join(", ");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID STYLES
// ─────────────────────────────────────────────────────────────────────────────

async function extractGridCompact(): Promise<Record<string, CompactGrid>> {
  const styles = await figma.getLocalGridStylesAsync();
  const result: Record<string, CompactGrid> = {};

  for (const style of styles) {
    if (style.layoutGrids.length === 0) continue;

    const grid = style.layoutGrids[0];
    const token: CompactGrid = { pattern: grid.pattern.toLowerCase() };

    if (grid.pattern === "GRID") {
      token.sectionSize = grid.sectionSize;
    } else if (grid.pattern === "COLUMNS" || grid.pattern === "ROWS") {
      token.count      = grid.count;
      token.gutterSize = grid.gutterSize;
      token.offset     = grid.offset;
      token.sectionSize = grid.sectionSize;
      token.alignment  = grid.alignment.toLowerCase();
    }

    result[style.name] = token;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

export async function extractDesignTokens(): Promise<CompactDesignTokens> {
  const [variables, paint, typography, effect, grid] = await Promise.all([
    extractVariablesCompact(),
    extractPaintCompact(),
    extractTypographyCompact(),
    extractEffectCompact(),
    extractGridCompact(),
  ]);

  // Đếm tổng variables (đếm theo mode đầu tiên để tránh nhân đôi)
  let totalVariables = 0;
  for (const collection of Object.values(variables)) {
    const firstMode = Object.values(collection)[0];
    if (firstMode) totalVariables += Object.keys(firstMode).length;
  }

  const totalStyles =
    Object.keys(paint).length +
    Object.keys(typography).length +
    Object.keys(effect).length +
    Object.keys(grid).length;

  return {
    meta: {
      fileName:       figma.root.name,
      extractedAt:    new Date().toISOString(),
      totalVariables,
      totalStyles,
    },
    variables,
    styles: { paint, typography, effect, grid },
  };
}
