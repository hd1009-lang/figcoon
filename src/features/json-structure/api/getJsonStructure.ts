import { COMMAND } from "@/shared/lib/figma/command";
import { sendToFigma } from "@/shared/lib/figma/messages";

export async function getJsonStructure() {
  sendToFigma(COMMAND.get_json_structure);
}