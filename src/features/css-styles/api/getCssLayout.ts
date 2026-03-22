import { COMMAND } from "@/shared/lib/figma/command";
import { sendToFigma } from "@/shared/lib/figma/messages";

export async function getCssLayout() {
  sendToFigma(COMMAND.get_css_layout);
}
