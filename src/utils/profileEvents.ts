/** Fired (by the header's avatar menu) to bring the profile page to the front, optionally on one tab. */
export const OPEN_PROFILE_EVENT = 'nexuscore:open-profile';

/** Fired (by the header's book button) to bring a main tab of the settings page to the front. */
export const OPEN_SETTINGS_TAB_EVENT = 'nexuscore:open-settings-tab';
let pendingSettingsTab: string | null = null;
/** The settings page may not be mounted yet when the button is pressed: it reads this when it opens. */
export const requestSettingsTab = (tab: string) => {
  pendingSettingsTab = tab;
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_TAB_EVENT, { detail: { tab } })), 0);
};
export const takePendingSettingsTab = (): string | null => {
  const tab = pendingSettingsTab;
  pendingSettingsTab = null;
  return tab;
};

/** Fired to open one section inside a settings tab (e.g. «تقویم کاری» inside «اتوماسیون»). */
export const OPEN_SETTINGS_SECTION_EVENT = 'nexuscore:open-settings-section';
let pendingSettingsSection: string | null = null;
/** Opens a settings tab on one of its sections; the section reads it when it mounts, or hears the event. */
export const requestSettingsSection = (tab: string, section: string) => {
  pendingSettingsSection = section;
  requestSettingsTab(tab);
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_SECTION_EVENT, { detail: { section } })), 0);
};
export const takePendingSettingsSection = (): string | null => {
  const section = pendingSettingsSection;
  pendingSettingsSection = null;
  return section;
};
