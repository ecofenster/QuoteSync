import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUOTESYNC_THEME_CONFIGURATION,
  BUILT_IN_THEME_ID,
  QUOTESYNC_FONT_OPTIONS,
  getSelectedTheme,
  listThemes,
  normaliseThemeConfiguration,
  normaliseThemeStore,
  resolveThemePreference,
} from "../src/theme/themes.ts";

test("theme configuration safely falls back to Ecofenster defaults", () => {
  const configuration = normaliseThemeConfiguration(undefined);
  assert.deepEqual(configuration, DEFAULT_QUOTESYNC_THEME_CONFIGURATION);
});

test("named theme store keeps the Ecofenster default immutable and active by default", () => {
  const store = normaliseThemeStore(undefined);
  assert.equal(store.activeThemeId, BUILT_IN_THEME_ID);
  assert.equal(store.themes.length, 0);
  const themes = listThemes(store);
  assert.equal(themes[0].name, "Ecofenster Default");
  assert.equal(themes[0].builtIn, true);
  themes[0].configuration.primary = "#000000";
  assert.equal(listThemes(store)[0].configuration.primary, DEFAULT_QUOTESYNC_THEME_CONFIGURATION.primary);
});

test("legacy company configuration migrates without losing colours", () => {
  const store = normaliseThemeStore({ primary: "#123456", defaultMode: "dark" });
  assert.equal(store.activeThemeId, "migrated-company-theme");
  assert.equal(getSelectedTheme(store).configuration.primary, "#123456");
  assert.equal(getSelectedTheme(store).configuration.defaultMode, "dark");
});

test("custom named theme activation resolves its stored configuration", () => {
  const custom = normaliseThemeConfiguration({ primary: "#224466", fontFamily: "inter" });
  const store = normaliseThemeStore({ schemaVersion: 2, activeThemeId: "customer-corporate", themes: [{ id: "customer-corporate", name: "Customer Corporate", configuration: custom }] });
  assert.equal(getSelectedTheme(store).name, "Customer Corporate");
  assert.equal(getSelectedTheme(store).configuration.fontFamily, "inter");
});

test("theme configuration preserves valid company colours and rejects invalid values", () => {
  const configuration = normaliseThemeConfiguration({
    mode: "system",
    primary: "#33AA77",
    dark: { background: "not-a-colour", surface: "#202322" },
    operational: { ordersAttention: "#cc2233", installations: "rgb(0,0,0)" },
  });

  assert.equal(configuration.defaultMode, "system");
  assert.equal(configuration.primary, "#33aa77");
  assert.equal(configuration.dark.background, DEFAULT_QUOTESYNC_THEME_CONFIGURATION.dark.background);
  assert.equal(configuration.dark.surface, "#202322");
  assert.equal(configuration.operational.ordersAttention, "#cc2233");
  assert.equal(configuration.operational.installations, DEFAULT_QUOTESYNC_THEME_CONFIGURATION.operational.installations);
});

test("company default mode is subordinate to an explicit browser preference", () => {
  assert.equal(resolveThemePreference(null, "dark"), "dark");
  assert.equal(resolveThemePreference("light", "dark"), "light");
  assert.equal(resolveThemePreference("system", "dark"), "system");
});

test("approved company fonts normalize safely and retain the legacy theme mode", () => {
  assert.deepEqual(QUOTESYNC_FONT_OPTIONS.map((font) => font.name), [
    "System Default", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Source Sans 3", "Nunito Sans",
  ]);
  for (const font of QUOTESYNC_FONT_OPTIONS) {
    assert.equal(normaliseThemeConfiguration({ fontFamily: font.id }).fontFamily, font.id);
  }
  assert.equal(normaliseThemeConfiguration({ mode: "dark", fontFamily: "source-sans-3" }).defaultMode, "dark");
  assert.equal(normaliseThemeConfiguration({ fontFamily: "source-sans-3" }).fontFamily, "source-sans-3");
  assert.equal(normaliseThemeConfiguration({ fontFamily: "comic-sans" }).fontFamily, "system");
});
