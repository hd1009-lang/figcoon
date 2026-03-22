import { useState } from "react";
import { TERMINAL_TABS, type TabConfig } from "@/shared/config/tabs";

export function useTabState(initial: TabConfig = TERMINAL_TABS[0]) {
  const [activeTab, setActiveTab] = useState<TabConfig>(initial);
  return { activeTab, setActiveTab };
}