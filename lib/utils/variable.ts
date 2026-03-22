// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

// ── Variables ────────────────────────────────────────────────────────────────

interface VariableValueByMode {
  modeName: string;
  value: string | number | boolean | null;
  /** Nếu value là alias đến variable khác */
  aliasTo?: string;
}

interface VariableSummary {
  id: string;
  name: string;
  /** Tên ngắn (phần cuối sau dấu /) */
  shortName: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  /** Giá trị theo từng mode */
  valuesByMode: VariableValueByMode[];
  /** Giá trị default (mode đầu tiên) */
  defaultValue: string | number | boolean | null;
  scopes: string[];
  description?: string;
}

interface CollectionSummary {
  id: string;
  name: string;
  modes: string[];
  defaultMode: string;
  variables: VariableSummary[];
}

interface VariablesJSON {
  totalCollections: number;
  totalVariables: number;
  collections: CollectionSummary[];
}

// ── Styles ───────────────────────────────────────────────────────────────────

interface PaintStyleSummary {
  id: string;
  name: string;
  shortName: string;
  group: string;
  description?: string;
  paints: PaintValueSummary[];
}

interface PaintValueSummary {
  type: string;
  color?: string;
  opacity?: number;
  gradient?: string;
}

interface TypographyStyleSummary {
  id: string;
  name: string;
  shortName: string;
  group: string;
  description?: string;
  fontFamily: string;
  fontStyle: string;
  fontWeight: number | string;
  fontSize: number;
  lineHeight: string;
  letterSpacing: string;
  textDecoration?: string;
  textCase?: string;
  paragraphSpacing?: number;
}

interface EffectStyleSummary {
  id: string;
  name: string;
  shortName: string;
  group: string;
  description?: string;
  effects: EffectValueSummary[];
}

interface EffectValueSummary {
  type: string;
  color?: string;
  offsetX?: number;
  offsetY?: number;
  radius?: number;
  spread?: number;
}

interface GridStyleSummary {
  id: string;
  name: string;
  shortName: string;
  group: string;
  description?: string;
  grids: GridValueSummary[];
}

interface GridValueSummary {
  pattern: string;
  sectionSize?: number;
  count?: number;
  gutterSize?: number;
  offset?: number;
  alignment?: string;
  color?: string;
}

interface StylesJSON {
  totalStyles: number;
  paint: {
    total: number;
    groups: Record<string, PaintStyleSummary[]>;
  };
  typography: {
    total: number;
    groups: Record<string, TypographyStyleSummary[]>;
  };
  effect: {
    total: number;
    groups: Record<string, EffectStyleSummary[]>;
  };
  grid: {
    total: number;
    groups: Record<string, GridStyleSummary[]>;
  };
}

interface DesignTokensJSON {
  meta: {
    extractedAt: string;
    fileName: string;
  };
  variables: VariablesJSON;
  styles: StylesJSON;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toHex(v: number): string {
  const hex = Math.round(v * 255).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbaColor(r: number, g: number, b: number, a: number): string {
  if (a >= 0.999) return rgbToHex(r, g, b);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+a.toFixed(3)})`;
}

/** Lấy phần tên cuối sau dấu / */
function shortName(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1].trim();
}

/** Lấy group (tất cả trừ phần cuối) */
function groupName(name: string): string {
  const parts = name.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/").trim() : "ungrouped";
}

/** Group array theo key */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

const fontWeightMap: Record<string, number> = {
  Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
  Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

function resolveVariableValue(
  value: VariableValue,
  type: VariableResolvedDataType,
  allVariables: Map<string, Variable>
): { resolved: string | number | boolean | null; aliasTo?: string } {
  // Alias reference
  if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
    const alias = value as VariableAlias;
    const target = allVariables.get(alias.id);
    return {
      resolved: null,
      aliasTo: target ? target.name : alias.id,
    };
  }

  // COLOR
  if (type === "COLOR" && typeof value === "object" && value !== null && "r" in value) {
    const c = value as RGBA;
    return { resolved: rgbaColor(c.r, c.g, c.b, c.a) };
  }

  // FLOAT, STRING, BOOLEAN
  if (typeof value === "number") return { resolved: +value.toFixed(4) };
  if (typeof value === "string") return { resolved: value };
  if (typeof value === "boolean") return { resolved: value };

  return { resolved: null };
}

async function extractVariables(): Promise<VariablesJSON> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVariablesList = await figma.variables.getLocalVariablesAsync();

  // Map id → variable để resolve alias
  const variableMap = new Map<string, Variable>();
  for (const v of allVariablesList) {
    variableMap.set(v.id, v);
  }

  const collectionSummaries: CollectionSummary[] = [];
  let totalVariables = 0;

  for (const collection of collections) {
    // Build mode id → name map
    const modeMap = new Map<string, string>();
    for (const mode of collection.modes) {
      modeMap.set(mode.modeId, mode.name);
    }

    const defaultModeId = collection.defaultModeId;
    const defaultModeName = modeMap.get(defaultModeId) ?? "Default";

    const variableSummaries: VariableSummary[] = [];

    for (const varId of collection.variableIds) {
      const variable = variableMap.get(varId);
      if (!variable) continue;

      const valuesByMode: VariableValueByMode[] = [];
      let defaultValue: string | number | boolean | null = null;

      for (const mode of collection.modes) {
        const rawValue = variable.valuesByMode[mode.modeId];
        if (rawValue === undefined) continue;

        const { resolved, aliasTo } = resolveVariableValue(
          rawValue,
          variable.resolvedType,
          variableMap
        );

        const entry: VariableValueByMode = {
          modeName: mode.name,
          value: aliasTo ? null : resolved,
        };
        if (aliasTo) entry.aliasTo = aliasTo;

        valuesByMode.push(entry);

        if (mode.modeId === defaultModeId) {
          defaultValue = aliasTo ? null : resolved;
        }
      }

      const summary: VariableSummary = {
        id: variable.id,
        name: variable.name,
        shortName: shortName(variable.name),
        type: variable.resolvedType,
        valuesByMode,
        defaultValue,
        scopes: variable.scopes as string[],
      };

      if (variable.description) summary.description = variable.description;

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
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

async function extractPaintStyles(): Promise<StylesJSON["paint"]> {
  const paintStyles = await figma.getLocalPaintStylesAsync();
  const summaries: PaintStyleSummary[] = [];

  for (const style of paintStyles) {
    const paints: PaintValueSummary[] = [];

    for (const paint of style.paints) {
      if (paint.visible === false) continue;

      const entry: PaintValueSummary = { type: paint.type };

      if (paint.type === "SOLID") {
        const { r, g, b } = paint.color;
        entry.color = rgbaColor(r, g, b, paint.opacity ?? 1);
        if ((paint.opacity ?? 1) < 1) entry.opacity = +(paint.opacity ?? 1).toFixed(3);
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

    const item: PaintStyleSummary = {
      id: style.id,
      name: style.name,
      shortName: shortName(style.name),
      group: groupName(style.name),
      paints,
    };
    if (style.description) item.description = style.description;
    summaries.push(item);
  }

  return {
    total: summaries.length,
    groups: groupBy(summaries, (s) => s.group),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

async function extractTextStyles(): Promise<StylesJSON["typography"]> {
  const textStyles = await figma.getLocalTextStylesAsync();
  const summaries: TypographyStyleSummary[] = [];

  for (const style of textStyles) {
    const styleKey = style.fontName.style.replace(/\s/g, "").replace(/Italic/i, "");
    const fontWeight: number | string = fontWeightMap[styleKey] ?? style.fontName.style;

    // Line height
    let lineHeight = "normal";
    if (style.lineHeight.unit === "PIXELS") lineHeight = `${style.lineHeight.value}px`;
    else if (style.lineHeight.unit === "PERCENT") lineHeight = `${+((style.lineHeight.value / 100).toFixed(3))}`;

    // Letter spacing
    let letterSpacing = "0";
    if (style.letterSpacing.unit === "PIXELS" && style.letterSpacing.value !== 0) {
      letterSpacing = `${style.letterSpacing.value}px`;
    } else if (style.letterSpacing.unit === "PERCENT" && style.letterSpacing.value !== 0) {
      letterSpacing = `${+(style.letterSpacing.value / 100).toFixed(4)}em`;
    }

    // Text decoration
    let textDecoration: string | undefined;
    if (style.textDecoration === "UNDERLINE") textDecoration = "underline";
    else if (style.textDecoration === "STRIKETHROUGH") textDecoration = "line-through";

    // Text case
    const caseMap: Record<string, string> = {
      UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize",
    };
    const textCase = caseMap[style.textCase];

    const item: TypographyStyleSummary = {
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

    if (textDecoration) item.textDecoration = textDecoration;
    if (textCase) item.textCase = textCase;
    if (style.paragraphSpacing) item.paragraphSpacing = style.paragraphSpacing;
    if (style.description) item.description = style.description;

    summaries.push(item);
  }

  return {
    total: summaries.length,
    groups: groupBy(summaries, (s) => s.group),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

async function extractEffectStyles(): Promise<StylesJSON["effect"]> {
  const effectStyles = await figma.getLocalEffectStylesAsync();
  const summaries: EffectStyleSummary[] = [];

  for (const style of effectStyles) {
    const effects: EffectValueSummary[] = [];

    for (const effect of style.effects) {
      if (effect.visible === false) continue;

      const entry: EffectValueSummary = { type: effect.type };

      if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
        const { r, g, b, a } = effect.color;
        entry.color = rgbaColor(r, g, b, a);
        entry.offsetX = effect.offset.x;
        entry.offsetY = effect.offset.y;
        entry.radius = effect.radius;
        entry.spread = effect.spread ?? 0;
      }

      if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
        entry.radius = effect.radius;
      }

      effects.push(entry);
    }

    const item: EffectStyleSummary = {
      id: style.id,
      name: style.name,
      shortName: shortName(style.name),
      group: groupName(style.name),
      effects,
    };
    if (style.description) item.description = style.description;
    summaries.push(item);
  }

  return {
    total: summaries.length,
    groups: groupBy(summaries, (s) => s.group),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID STYLES EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

async function extractGridStyles(): Promise<StylesJSON["grid"]> {
  const gridStyles = await figma.getLocalGridStylesAsync();
  const summaries: GridStyleSummary[] = [];

  for (const style of gridStyles) {
    const grids: GridValueSummary[] = [];

    for (const grid of style.layoutGrids) {
      const entry: GridValueSummary = {
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

    const item: GridStyleSummary = {
      id: style.id,
      name: style.name,
      shortName: shortName(style.name),
      group: groupName(style.name),
      grids,
    };
    if (style.description) item.description = style.description;
    summaries.push(item);
  }

  return {
    total: summaries.length,
    groups: groupBy(summaries, (s) => s.group),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

export async function extractDesignTokens(): Promise<DesignTokensJSON> {
  const [variables, paint, typography, effect, grid] = await Promise.all([
    extractVariables(),
    extractPaintStyles(),
    extractTextStyles(),
    extractEffectStyles(),
    extractGridStyles(),
  ]);

  const styles: StylesJSON = {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN MAIN
// ─────────────────────────────────────────────────────────────────────────────
