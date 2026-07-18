import { create } from "zustand";
import { devtools } from "zustand/middleware";

type AdminUiState = {
  selectedProjectId: string | null;
  /** Resource id ("site" or a projectId) -> has unsaved changes. */
  dirtyResources: Record<string, boolean>;
  selectProject: (projectId: string | null) => void;
  setDirty: (resource: string, dirty: boolean) => void;
};

export const useAdminUiStore = create<AdminUiState>()(
  devtools(
    (set) => ({
      selectedProjectId: null,
      dirtyResources: {},
      selectProject: (projectId) =>
        set({ selectedProjectId: projectId }, false, "admin-ui/select-project"),
      setDirty: (resource, dirty) =>
        set(
          (state) => ({
            dirtyResources: { ...state.dirtyResources, [resource]: dirty },
          }),
          false,
          "admin-ui/set-dirty",
        ),
    }),
    { name: "admin-ui-store", enabled: process.env.NODE_ENV === "development" },
  ),
);

export function selectHasUnsavedChanges(state: AdminUiState): boolean {
  return Object.values(state.dirtyResources).some(Boolean);
}
