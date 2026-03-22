import type { TabConfig } from "@/shared/config/tabs";
import { TabButton } from "./TabButton";



interface TabBarProps {
  tabs: readonly TabConfig[];
  activeTab: string;
  onTabChange: (value: TabConfig) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-outline-variant/20 shrink-0">
      {tabs.map((tab) => (
        <TabButton
          key={tab.value}
          label={tab.label}
          isActive={activeTab === tab.value}
          onClick={() => onTabChange(tab)}
        />
      ))}
    </div>
  );
}