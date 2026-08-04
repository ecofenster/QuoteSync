import type { DrawingModel } from "../drawingModel";

export type AuthorityFixtureView = "internal" | "external";

export type AuthorityFixtureFieldOperation = "turn" | "tilt_turn";
export type AuthorityFixtureHanding = "left" | "right";
export type AuthorityFixtureFieldRole = "slave" | "master";

export type AuthorityFixtureField = {
  index: number;
  key: string;
  row: number;
  column: number;
  operation: AuthorityFixtureFieldOperation;
  handing: AuthorityFixtureHanding;
  role: AuthorityFixtureFieldRole;
  label: string;
};

export type AuthorityFixtureMetadata = {
  fixtureId: string;
  authorityStatus: "user_approved_authority";
  category: "windows";
  manufacturer: string;
  system: string;
  systemProfileNamespace: "B92";
  view: AuthorityFixtureView;
  fieldGroup: "2 Field";
  type: "Type 5";
  genericType: string;
  layout: {
    rows: number;
    columns: number;
  };
  fields: AuthorityFixtureField[];
  profiles: {
    head: "B92-7";
    sideJamb: "B92-10";
    sill: "B92-8";
    centre: "B92-18";
  };
  centreJunction: {
    type: "flying_mullion";
    intentionalGapMm: 5;
  };
  pairedExternalFixture: "Ext/2F/T/18/TT";
  sources: {
    dxf: string;
    svg: string | null;
  };
};

export type AuthorityFixtureRenderResult = {
  model: DrawingModel;
  fixture: AuthorityFixtureMetadata;
};
