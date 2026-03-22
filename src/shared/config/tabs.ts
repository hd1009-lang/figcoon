import { COMMAND } from "@/shared/lib/figma";

export const TERMINAL_TABS = [
  {
    label:   "Variable",
    value:   "variable",
    command: COMMAND.get_variables,
  },
  {
    label:   "CSS",
    value:   "css",
    command: COMMAND.get_css_layout,
  },
  {
    label:   "CSS-Structure",
    value:   "css-structure",
    command: COMMAND.get_css_structure,  
  },
  {
    label:   "JSON Structure",
    value:   "json",
    command: COMMAND.get_json_structure,                    
  },
] as const;

export type TabValue  = (typeof TERMINAL_TABS)[number]["value"];
export type TabConfig = (typeof TERMINAL_TABS)[number];