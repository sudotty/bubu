export type AppView = "datasets" | "groups" | "knowledge" | "settings";
export type SettingsSection = "models" | "prompts" | "connectors" | "privacy";

export interface AppNavigationState {
  readonly view: AppView;
  readonly settingsSection: SettingsSection;
  readonly selectedDatasetId?: string | undefined;
  readonly selectedGroupId?: string | undefined;
}

export type AppNavigationAction =
  | { readonly type: "navigate"; readonly view: AppView }
  | { readonly type: "open-settings"; readonly section: SettingsSection }
  | { readonly type: "select-dataset"; readonly id: string | undefined }
  | { readonly type: "select-group"; readonly id: string | undefined }
  | { readonly type: "initialize-catalog"; readonly datasetId: string | undefined; readonly groupId: string | undefined };

export const initialAppNavigation: AppNavigationState = { view: "datasets", settingsSection: "models" };

export function reduceAppNavigation(state: AppNavigationState, action: AppNavigationAction): AppNavigationState {
  switch (action.type) {
    case "navigate": return { ...state, view: action.view };
    case "open-settings": return { ...state, view: "settings", settingsSection: action.section };
    case "select-dataset": return { ...state, selectedDatasetId: action.id };
    case "select-group": return { ...state, selectedGroupId: action.id };
    case "initialize-catalog": return { ...state, selectedDatasetId: action.datasetId, selectedGroupId: action.groupId };
  }
}
