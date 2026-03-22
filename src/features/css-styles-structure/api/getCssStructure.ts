import { COMMAND } from "@/shared/lib/figma/command";
import { sendToFigma } from "@/shared/lib/figma/messages";

export async function getCssStructure() {
  sendToFigma(COMMAND.get_css_structure);
}
