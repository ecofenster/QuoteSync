import type { AuthorityFixtureMetadata } from "./authorityFixture.types";

export const EUROPA92_TYPE5_INTERNAL_AUTHORITY_DESIGN_ID = "windows-2-authority-europa92-type5-internal";

export const EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE = {
  fixtureId: "Int/2F/T/18/TT",
  authorityStatus: "user_approved_authority",
  category: "windows",
  manufacturer: "Zyle Fenster",
  system: "Europa 92 Alu Clad",
  systemProfileNamespace: "B92",
  view: "internal",
  fieldGroup: "2 Field",
  type: "Type 5",
  genericType: "2 Field, Type 5: Turn Left / Tilt & Turn Right with Flying Mullion",
  layout: {
    rows: 1,
    columns: 2,
  },
  fields: [
    {
      index: 1,
      key: "0:0",
      row: 0,
      column: 0,
      operation: "turn",
      handing: "left",
      role: "slave",
      label: "Turn Left",
    },
    {
      index: 2,
      key: "1:0",
      row: 0,
      column: 1,
      operation: "tilt_turn",
      handing: "right",
      role: "master",
      label: "Tilt & Turn Right",
    },
  ],
  profiles: {
    head: "B92-7",
    sideJamb: "B92-10",
    sill: "B92-8",
    centre: "B92-18",
  },
  centreJunction: {
    type: "flying_mullion",
    intentionalGapMm: 5,
  },
  pairedExternalFixture: "Ext/2F/T/18/TT",
  sources: {
    dxf: "_project/Test/Europa 92 Alu Clad/2 Field/Table_Test/2 Field, Type 5.dxf",
    svg: null,
  },
} as const satisfies AuthorityFixtureMetadata;

export function isAuthorityFixtureType5PreviewEnabled() {
  return import.meta.env.VITE_QS_ENABLE_AUTHORITY_FIXTURE_TYPE5_PREVIEW === "true";
}

export function isEuropa92Type5InternalAuthorityDesign(designId: string | null | undefined) {
  return designId === EUROPA92_TYPE5_INTERNAL_AUTHORITY_DESIGN_ID;
}

export function shouldRenderEuropa92Type5InternalAuthorityFixture(input: {
  designId: string | null | undefined;
  view: "internal" | "external";
}) {
  return (
    isAuthorityFixtureType5PreviewEnabled() &&
    input.view === EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE.view &&
    isEuropa92Type5InternalAuthorityDesign(input.designId) &&
    EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE.manufacturer === "Zyle Fenster" &&
    EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE.system === "Europa 92 Alu Clad" &&
    EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE.systemProfileNamespace === "B92" &&
    EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE.fixtureId === "Int/2F/T/18/TT"
  );
}
