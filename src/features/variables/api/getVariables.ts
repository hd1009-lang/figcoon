import { COMMAND } from "@/shared/lib/figma/command";
import { sendToFigma } from "@/shared/lib/figma/messages";

export async function getVariables() {
  sendToFigma(COMMAND.get_variables);
}
