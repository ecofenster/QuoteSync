export type B92ProfileSectionProofView = "internal" | "external";

export type B92ProfileSectionProofLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  role?: string;
  opening?: boolean;
};

export type B92ProfileSectionProofBounds = { x: number; y: number; width: number; height: number };

export type B92ProfileSectionProofViewGeometry = {
  sourceFile: string;
  sourceDxfFile: string | null;
  segmentCount: number;
  bounds: B92ProfileSectionProofBounds;
  lines: readonly B92ProfileSectionProofLine[];
};

export type B92ProfileSectionProofGeometryFamily = {
  id: string;
  label: string;
  group: string;
  views: Record<B92ProfileSectionProofView, B92ProfileSectionProofViewGeometry>;
};

// Static source-time extraction from the approved B92 profile-section assembly proof SVG files.
// Coordinates are flattened with SVG group transforms applied; the app must not parse SVG/DXF at runtime.
export const B92_PROFILE_SECTION_PROOF_GEOMETRY = [
  {
    "id": "b92-1-field-fixed",
    "label": "1 Field Fixed",
    "group": "1 Field",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\1 Field\\\\Fixed\\\\1_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 30,
        "bounds": {
          "x": 0,
          "y": 0,
          "width": 1000,
          "height": 999.95
        },
        "lines": [
          {
            "x1": 0,
            "y1": 927.975,
            "x2": 0,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 56.975,
            "y1": 927.975,
            "x2": 56.975,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 77.975,
            "y1": 78.06,
            "x2": 77.975,
            "y2": 906.89,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 927.975,
            "x2": 56.975,
            "y2": 927.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 56.975,
            "y1": 927.975,
            "x2": 77.975,
            "y2": 906.89,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 56.975,
            "x2": 56.975,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 56.975,
            "y1": 56.975,
            "x2": 77.975,
            "y2": 78.06,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 927.975,
            "x2": 1000,
            "y2": 927.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 999.95,
            "x2": 0,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 77.975,
            "y1": 906.975,
            "x2": 921.975,
            "y2": 906.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 56.975,
            "y1": 927.975,
            "x2": 77.975,
            "y2": 906.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 942.975,
            "y1": 927.925,
            "x2": 921.975,
            "y2": 906.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 927.975,
            "x2": 0,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 927.975,
            "x2": 1000,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 927.975,
            "x2": 1000,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 942.989,
            "y1": 927.975,
            "x2": 942.989,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 921.975,
            "y1": 78.06,
            "x2": 921.975,
            "y2": 906.89,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 927.975,
            "x2": 942.989,
            "y2": 927.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 942.989,
            "y1": 927.975,
            "x2": 921.975,
            "y2": 906.89,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 56.975,
            "x2": 942.989,
            "y2": 56.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 942.989,
            "y1": 56.975,
            "x2": 921.975,
            "y2": 78.06,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 0,
            "x2": 1000,
            "y2": 0,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 56.975,
            "x2": 0,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 77.975,
            "y1": 77.975,
            "x2": 921.975,
            "y2": 77.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 498,
            "y1": 56.975,
            "x2": 497.975,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 498,
            "y1": 77.975,
            "x2": 497.975,
            "y2": 77.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 77.975,
            "y1": 77.975,
            "x2": 56.975,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 921.975,
            "y1": 77.975,
            "x2": 942.975,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 0,
            "x2": 0,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 0,
            "x2": 1000,
            "y2": 56.975,
            "role": "B92-1",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\1 Field\\\\Fixed\\\\1_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 37,
        "bounds": {
          "x": 0,
          "y": 0,
          "width": 1000,
          "height": 999.95
        },
        "lines": [
          {
            "x1": 997.025,
            "y1": 981.975,
            "x2": 997.025,
            "y2": 2.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 58.488,
            "x2": 1000,
            "y2": 942.95,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 981.975,
            "x2": 918.975,
            "y2": 903.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 918.975,
            "y1": 903.975,
            "x2": 918.975,
            "y2": 80.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 918.975,
            "y1": 80.975,
            "x2": 997.025,
            "y2": 2.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 58.488,
            "x2": 997.025,
            "y2": 58.488,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 942.95,
            "x2": 1000,
            "y2": 942.95,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 981.975,
            "x2": 997.025,
            "y2": 981.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 999.95,
            "x2": 0,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 999.95,
            "x2": 0,
            "y2": 942.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 981.975,
            "x2": 80.975,
            "y2": 903.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 80.975,
            "y1": 903.975,
            "x2": 918.975,
            "y2": 903.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 981.975,
            "x2": 918.975,
            "y2": 903.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 942.95,
            "x2": 1000,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 981.975,
            "x2": 2.975,
            "y2": 942.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 942.95,
            "x2": 0,
            "y2": 942.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 981.975,
            "x2": 997.025,
            "y2": 942.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 942.95,
            "x2": 1000,
            "y2": 942.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 981.975,
            "x2": 997.025,
            "y2": 999.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 942.95,
            "x2": 0,
            "y2": 57,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 2.975,
            "x2": 2.975,
            "y2": 981.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 80.975,
            "y1": 80.975,
            "x2": 80.975,
            "y2": 903.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 80.975,
            "y1": 80.975,
            "x2": 2.975,
            "y2": 2.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 942.95,
            "x2": 2.975,
            "y2": 942.95,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 57,
            "x2": 2.975,
            "y2": 57,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 981.975,
            "x2": 80.975,
            "y2": 903.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 0,
            "x2": 1000,
            "y2": 0,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 997.025,
            "y1": 2.975,
            "x2": 2.975,
            "y2": 2.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 996.975,
            "y1": 2.975,
            "x2": 918.975,
            "y2": 80.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 918.975,
            "y1": 80.975,
            "x2": 80.975,
            "y2": 80.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 80.975,
            "y1": 80.975,
            "x2": 2.975,
            "y2": 2.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 0,
            "y1": 57,
            "x2": 0,
            "y2": 0,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 2.975,
            "x2": 2.975,
            "y2": 57,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2.975,
            "y1": 57,
            "x2": 0,
            "y2": 57,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1000,
            "y1": 57,
            "x2": 1000,
            "y2": 0,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 996.975,
            "y1": 2.975,
            "x2": 996.975,
            "y2": 57,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 996.975,
            "y1": 57,
            "x2": 1000,
            "y2": 57,
            "role": "B92-1",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-1-field-tilt-turn",
    "label": "1 Field Tilt & Turn",
    "group": "1 Field",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\1 Field\\\\Tilt & Turn\\\\1_FIELD_TILT_TURN_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 38,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000,
          "height": 999.951
        },
        "lines": [
          {
            "x1": 1030,
            "y1": 1029.951,
            "x2": 30,
            "y2": 1029.951,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.475,
            "y1": 977.476,
            "x2": 992.475,
            "y2": 977.476,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 920.476,
            "x2": 935.475,
            "y2": 920.476,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 920.476,
            "x2": 145.475,
            "y2": 899.476,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 145.475,
            "y1": 899.476,
            "x2": 914.525,
            "y2": 899.476,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 914.525,
            "y1": 899.476,
            "x2": 935.525,
            "y2": 920.476,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.976,
            "x2": 67.475,
            "y2": 972.976,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 992.475,
            "y1": 972.976,
            "x2": 1029.95,
            "y2": 972.976,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.475,
            "y1": 86.976,
            "x2": 30,
            "y2": 86.976,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.976,
            "x2": 30,
            "y2": 86.976,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 67.475,
            "y1": 977.476,
            "x2": 67.475,
            "y2": 67.476,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 977.476,
            "x2": 124.475,
            "y2": 67.476,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 124.476,
            "x2": 145.475,
            "y2": 145.476,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 145.475,
            "y1": 145.476,
            "x2": 145.475,
            "y2": 899.476,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 920.476,
            "x2": 145.475,
            "y2": 899.476,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.976,
            "x2": 67.475,
            "y2": 972.976,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.475,
            "y1": 86.976,
            "x2": 1030,
            "y2": 86.976,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 86.976,
            "x2": 1029.95,
            "y2": 972.976,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 992.475,
            "y1": 977.476,
            "x2": 992.475,
            "y2": 67.476,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 935.475,
            "y1": 977.476,
            "x2": 935.475,
            "y2": 67.476,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 914.475,
            "y1": 899.476,
            "x2": 914.475,
            "y2": 145.476,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 914.525,
            "y1": 899.476,
            "x2": 935.525,
            "y2": 920.476,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 935.475,
            "y1": 124.476,
            "x2": 914.475,
            "y2": 145.476,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 992.475,
            "y1": 972.976,
            "x2": 1029.95,
            "y2": 972.976,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 992.475,
            "y1": 86.976,
            "x2": 1030,
            "y2": 86.976,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30.001,
            "x2": 1030,
            "y2": 30.001,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 67.475,
            "y1": 86.976,
            "x2": 30,
            "y2": 86.976,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 67.475,
            "y1": 67.476,
            "x2": 992.475,
            "y2": 67.476,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.475,
            "y1": 124.476,
            "x2": 935.475,
            "y2": 124.476,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 145.475,
            "y1": 145.476,
            "x2": 914.475,
            "y2": 145.476,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 145.475,
            "y1": 145.476,
            "x2": 914.475,
            "y2": 522.476,
            "role": "OPENING",
            "opening": false
          },
          {
            "x1": 914.475,
            "y1": 522.476,
            "x2": 145.475,
            "y2": 899.476,
            "role": "OPENING",
            "opening": false
          },
          {
            "x1": 145.475,
            "y1": 899.476,
            "x2": 529.975,
            "y2": 145.476,
            "role": "OPENING",
            "opening": false
          },
          {
            "x1": 529.975,
            "y1": 145.476,
            "x2": 914.475,
            "y2": 899.476,
            "role": "OPENING",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.975,
            "x2": 30,
            "y2": 1029.95,
            "role": "AUTHORITY_RETURN",
            "opening": false
          },
          {
            "x1": 1029.95,
            "y1": 972.975,
            "x2": 1029.95,
            "y2": 1029.95,
            "role": "AUTHORITY_RETURN",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 86.975,
            "x2": 30,
            "y2": 30,
            "role": "AUTHORITY_RETURN",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 1030,
            "y2": 86.975,
            "role": "AUTHORITY_RETURN",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\1 Field\\\\Tilt & Turn\\\\1_FIELD_TILT_TURN_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 52,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000,
          "height": 999.95
        },
        "lines": [
          {
            "x1": 32.975,
            "y1": 1011.975,
            "x2": 1026.975,
            "y2": 1011.975,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 972.95,
            "x2": 1030,
            "y2": 1029.95,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1029.95,
            "x2": 30,
            "y2": 1029.95,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 1011.975,
            "x2": 110.975,
            "y2": 933.975,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 933.975,
            "x2": 948.975,
            "y2": 933.975,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1026.975,
            "y1": 1011.975,
            "x2": 948.975,
            "y2": 933.975,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 933.975,
            "x2": 115.775,
            "y2": 929.175,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 115.775,
            "y1": 929.175,
            "x2": 944.225,
            "y2": 929.175,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 949.026,
            "y1": 933.925,
            "x2": 944.175,
            "y2": 929.174,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 115.775,
            "y1": 929.175,
            "x2": 148.575,
            "y2": 896.375,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 148.575,
            "y1": 896.375,
            "x2": 911.55,
            "y2": 896.375,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 944.15,
            "y1": 929.175,
            "x2": 911.55,
            "y2": 896.375,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.95,
            "x2": 30,
            "y2": 87,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 32.975,
            "x2": 32.975,
            "y2": 1011.975,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 110.975,
            "y2": 933.975,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 1011.975,
            "x2": 110.975,
            "y2": 933.975,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 32.975,
            "y2": 32.975,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 115.775,
            "y2": 115.775,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 115.775,
            "y1": 115.775,
            "x2": 115.775,
            "y2": 929.175,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 933.975,
            "x2": 115.775,
            "y2": 929.175,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 148.575,
            "y1": 148.575,
            "x2": 148.575,
            "y2": 896.375,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 115.775,
            "y1": 929.175,
            "x2": 148.575,
            "y2": 896.375,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 148.575,
            "y1": 148.575,
            "x2": 115.775,
            "y2": 115.775,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 1011.975,
            "x2": 1027.025,
            "y2": 32.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 972.95,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1026.975,
            "y1": 1011.975,
            "x2": 948.975,
            "y2": 933.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 933.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1026.975,
            "y1": 32.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.226,
            "y1": 929.174,
            "x2": 944.176,
            "y2": 115.774,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 948.976,
            "y1": 110.974,
            "x2": 944.176,
            "y2": 115.774,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 949.026,
            "y1": 933.925,
            "x2": 944.175,
            "y2": 929.174,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.15,
            "y1": 929.175,
            "x2": 911.55,
            "y2": 896.375,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 911.55,
            "y1": 896.375,
            "x2": 911.35,
            "y2": 148.575,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.15,
            "y1": 115.775,
            "x2": 911.35,
            "y2": 148.575,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 1030,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 32.975,
            "x2": 32.975,
            "y2": 32.975,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1026.975,
            "y1": 32.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 110.975,
            "x2": 110.975,
            "y2": 110.975,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 32.975,
            "y2": 32.975,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.775,
            "y1": 115.775,
            "x2": 944.175,
            "y2": 115.775,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 115.775,
            "y2": 115.775,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 948.976,
            "y1": 110.974,
            "x2": 944.176,
            "y2": 115.774,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 944.15,
            "y1": 115.775,
            "x2": 911.35,
            "y2": 148.575,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 911.35,
            "y1": 148.575,
            "x2": 148.575,
            "y2": 148.575,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 148.575,
            "y1": 148.575,
            "x2": 115.775,
            "y2": 115.775,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.95,
            "x2": 32.975,
            "y2": 972.95,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 972.95,
            "x2": 1026.975,
            "y2": 972.95,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.95,
            "x2": 30,
            "y2": 1029.95,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 32.975,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1027.025,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-fixed-fixed",
    "label": "2 Field Horizontal Fixed / Fixed",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed\\\\HOR_2_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 53,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 1030,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 2030,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 991,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 108,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 87,
            "x2": 991,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1069,
            "y1": 108,
            "x2": 1952,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 87,
            "x2": 1069,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1973,
            "y1": 87,
            "x2": 1952,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 973,
            "x2": 1973.05,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 973,
            "x2": 1012,
            "y2": 972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 952,
            "x2": 991,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 991.05,
            "y1": 952,
            "x2": 1012.05,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 973,
            "x2": 1069,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1069,
            "y1": 952,
            "x2": 1952,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1952.05,
            "y1": 952,
            "x2": 1973.05,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 30,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1012.05,
            "y1": 973,
            "x2": 1048,
            "y2": 972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 87,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 1973,
            "y2": 972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 952,
            "x2": 87,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 86.993,
            "y1": 973,
            "x2": 86.993,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108.448,
            "x2": 108,
            "y2": 951.552,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 86.993,
            "y2": 973,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 86.993,
            "y1": 973,
            "x2": 108,
            "y2": 951.552,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 86.993,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 86.993,
            "y1": 87,
            "x2": 108,
            "y2": 108.448,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2030,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1973.007,
            "y1": 973,
            "x2": 1973.007,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1952,
            "y1": 108.448,
            "x2": 1952,
            "y2": 951.552,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 1973.007,
            "y2": 973,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1973.007,
            "y1": 973,
            "x2": 1952,
            "y2": 951.552,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 1973.007,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1973.007,
            "y1": 87,
            "x2": 1952,
            "y2": 108.448,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 87,
            "x2": 1048,
            "y2": 973,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 973,
            "x2": 1012,
            "y2": 87,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 972.95,
            "x2": 1012,
            "y2": 87,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 991.05,
            "y1": 952,
            "x2": 1012.05,
            "y2": 973,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 87,
            "x2": 991,
            "y2": 108,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 972.95,
            "x2": 1048,
            "y2": 87,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 87,
            "x2": 1069,
            "y2": 108,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1069,
            "y1": 108,
            "x2": 1069,
            "y2": 951.95,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 973,
            "x2": 1069,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 991,
            "y1": 952,
            "x2": 991,
            "y2": 108,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012.05,
            "y1": 973,
            "x2": 1048,
            "y2": 972.95,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 87,
            "x2": 1048,
            "y2": 87,
            "role": "B92-11",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed\\\\HOR_2_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 48,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 988,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 33,
            "x2": 2027,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 111,
            "y2": 111,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 111,
            "x2": 1949,
            "y2": 111,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 2027,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2027,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 33,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 33,
            "x2": 1072,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 87,
            "x2": 2027,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 87,
            "x2": 33,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 988,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 111,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 988,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 1012,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 1949,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 1072,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 2030,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2027,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 973,
            "x2": 33,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 1012,
            "x2": 1072,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 973,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.975,
            "x2": 30,
            "y2": 87.025,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 32.976,
            "y1": 33,
            "x2": 32.976,
            "y2": 1012,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 111,
            "y2": 934,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 32.976,
            "y2": 33,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.975,
            "x2": 32.976,
            "y2": 972.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87.025,
            "x2": 32.976,
            "y2": 87.025,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 32.976,
            "y1": 1012,
            "x2": 111,
            "y2": 934,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2027.026,
            "y1": 1012,
            "x2": 2027.026,
            "y2": 33,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 88.512,
            "x2": 2030,
            "y2": 972.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2027.026,
            "y1": 1012,
            "x2": 1949,
            "y2": 934,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 1949,
            "y2": 111,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 2027.026,
            "y2": 33,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 88.512,
            "x2": 2027.026,
            "y2": 88.512,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2027.026,
            "y1": 972.975,
            "x2": 2030,
            "y2": 972.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 986.305,
            "y1": 111,
            "x2": 986.305,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 111,
            "x2": 1072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 986.305,
            "y1": 111,
            "x2": 1072,
            "y2": 111,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 986.305,
            "y1": 934,
            "x2": 1072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-fixed-tilt-turn-left",
    "label": "2 Field Horizontal Fixed / Tilt & Turn Left",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed - Tilt and Turn Left\\\\HOR_2_FIELD_FIXED_TILT_TURN_LEFT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 55,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 73,
            "x2": 1009.75,
            "y2": 73,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 108,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 972.25,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 972.25,
            "y1": 108,
            "x2": 993.25,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 73,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 73,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 73,
            "x2": 73,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1009.75,
            "y1": 972,
            "x2": 30,
            "y2": 972,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 993.25,
            "y1": 921,
            "x2": 87,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 972.25,
            "y1": 900,
            "x2": 108,
            "y2": 900,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 900,
            "x2": 87,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 921,
            "x2": 73,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 30,
            "y2": 972,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 993.25,
            "y1": 921,
            "x2": 1009.75,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 972.25,
            "y1": 900,
            "x2": 993.25,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 30,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 972,
            "x2": 73,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 921,
            "x2": 87,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 900,
            "x2": 108,
            "y2": 108,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 124.5,
            "x2": 1935.5,
            "y2": 124.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1087.75,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 145.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 124.5,
            "x2": 1914.5,
            "y2": 145.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 1992.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1087.75,
            "y1": 145.5,
            "x2": 1066.75,
            "y2": 124.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 920.5,
            "x2": 1935.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 920.5,
            "x2": 1087.75,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1087.75,
            "y1": 899.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 920.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 977.5,
            "x2": 1009.75,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 972,
            "x2": 1992.5,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 2030,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 972,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 67.5,
            "x2": 1935.5,
            "y2": 977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1914.5,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 972.25,
            "y1": 900,
            "x2": 972.25,
            "y2": 108,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 993.25,
            "y1": 921,
            "x2": 993.25,
            "y2": 87,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 977.5,
            "x2": 1066.75,
            "y2": 67.5,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 1087.75,
            "y1": 145.5,
            "x2": 1087.75,
            "y2": 899.5,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 993.25,
            "y1": 87,
            "x2": 1009.75,
            "y2": 87,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 67.5,
            "x2": 1009.75,
            "y2": 67.5,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 993.25,
            "y2": 87,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1009.75,
            "y1": 977.5,
            "x2": 1009.75,
            "y2": 87,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1066.75,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 67.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1914.5,
            "y1": 145.5,
            "x2": 1087.75,
            "y2": 528.356,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 1087.75,
            "y1": 528.356,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 1914.5,
            "y1": 899.5,
            "x2": 1501.125,
            "y2": 145.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 1501.125,
            "y1": 145.5,
            "x2": 1087.75,
            "y2": 899.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 1009.75,
            "y1": 87,
            "x2": 1009.75,
            "y2": 67.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed - Tilt and Turn Left\\\\HOR_2_FIELD_FIXED_TILT_TURN_LEFT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 54,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 1949,
            "y1": 111,
            "x2": 2027,
            "y2": 33,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2027,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 30,
            "x2": 2030,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 929.2,
            "x2": 1949,
            "y2": 929.2,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 896.5,
            "x2": 1949,
            "y2": 896.5,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 2030,
            "y2": 973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2027,
            "y2": 973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 1949,
            "y2": 934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 988,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 111,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 115.8,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 115.8,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 111,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 929.2,
            "x2": 115.8,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 148.5,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 33,
            "y2": 1012,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 115.8,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 983.192,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 929.2,
            "x2": 988,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 896.5,
            "x2": 115.8,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 33,
            "y2": 33,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 111,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 929.2,
            "x2": 115.8,
            "y2": 115.8,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 896.5,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 929.2,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 988,
            "y2": 111,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 934,
            "x2": 1072,
            "y2": 111,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 1072,
            "y2": 111,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 1072,
            "y2": 934,
            "role": "B92-12_Mullion",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 2027,
            "y2": 33,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1012,
            "x2": 33,
            "y2": 1012,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 522.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 950.5,
            "y1": 522.5,
            "x2": 148.5,
            "y2": 896.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 148.5,
            "y1": 896.5,
            "x2": 549.5,
            "y2": 148.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 549.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 896.5,
            "role": "AUTHORITY_RECONCILED",
            "opening": true
          },
          {
            "x1": 1072,
            "y1": 111,
            "x2": 1949,
            "y2": 111,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 934,
            "x2": 1949,
            "y2": 934,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1012,
            "x2": 2027,
            "y2": 1012,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-turn-tilt-turn",
    "label": "2 Field Horizontal Turn / Tilt & Turn",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Turn - Tilt and Turn\\\\HOR_2_FIELD_TURN_TILT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 96,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 67.5,
            "x2": 1012.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 119,
            "x2": 985.5,
            "y2": 119,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1076,
            "y1": 119,
            "x2": 1935.5,
            "y2": 119,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 140,
            "x2": 964.5,
            "y2": 140,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 119,
            "x2": 145.5,
            "y2": 140,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 119,
            "x2": 1935.5,
            "y2": 119,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1095.5,
            "y1": 140,
            "x2": 1914.5,
            "y2": 140,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 119,
            "x2": 1914.5,
            "y2": 140,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 67.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 1992.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 67.5,
            "x2": 67.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 119,
            "x2": 124.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 964.5,
            "y1": 140,
            "x2": 985.5,
            "y2": 119,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 119,
            "x2": 985.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 67.5,
            "x2": 1012.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 87,
            "x2": 1017.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 87,
            "x2": 1017.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1095.5,
            "y1": 140,
            "x2": 1076,
            "y2": 119,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1076,
            "y1": 119,
            "x2": 1076,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 87,
            "x2": 1992.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 119,
            "x2": 1935.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 972,
            "x2": 1992.5,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 977.5,
            "x2": 1992.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 977.5,
            "x2": 67.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 920.5,
            "x2": 124.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 920.5,
            "x2": 1935.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 972,
            "x2": 30,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 899.5,
            "x2": 964.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 920.5,
            "x2": 964.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 920.5,
            "x2": 1095.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1914.5,
            "y1": 899.5,
            "x2": 1935.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 920.5,
            "x2": 985.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1095.5,
            "y1": 899.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 973,
            "x2": 1012.5,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 30,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 2030,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 972,
            "x2": 67.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 899.5,
            "x2": 124.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 920.5,
            "x2": 124.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 920.5,
            "x2": 985.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 977.5,
            "x2": 1012.5,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 977.5,
            "x2": 1017.5,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 920.5,
            "x2": 1074.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 920.5,
            "x2": 1935.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 977.5,
            "x2": 1992.5,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.483,
            "y1": 87,
            "x2": 30,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 67.483,
            "y1": 977.5,
            "x2": 67.483,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.495,
            "y1": 977.5,
            "x2": 124.495,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.495,
            "y1": 119,
            "x2": 145.5,
            "y2": 140,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 140,
            "x2": 145.5,
            "y2": 899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 124.495,
            "y1": 920.5,
            "x2": 145.5,
            "y2": 899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 67.483,
            "y2": 973,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 67.483,
            "y1": 977.5,
            "x2": 124.495,
            "y2": 977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 67.483,
            "y1": 67.5,
            "x2": 124.495,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1992.517,
            "y1": 87,
            "x2": 2030,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2030,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1992.517,
            "y1": 977.5,
            "x2": 1992.517,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1935.505,
            "y1": 977.5,
            "x2": 1935.505,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1935.505,
            "y1": 119,
            "x2": 1914.5,
            "y2": 140,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1914.5,
            "y1": 140,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1935.505,
            "y1": 920.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 1992.517,
            "y2": 973,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1992.517,
            "y1": 977.5,
            "x2": 1935.505,
            "y2": 977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1992.517,
            "y1": 67.5,
            "x2": 1935.505,
            "y2": 67.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 977.5,
            "x2": 1012.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 977.5,
            "x2": 1017.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 977.5,
            "x2": 985.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 977.5,
            "x2": 1074.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 964.5,
            "y1": 140,
            "x2": 964.5,
            "y2": 899.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 119,
            "x2": 964.5,
            "y2": 140,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 920.5,
            "x2": 964.5,
            "y2": 899.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 119,
            "x2": 1095.5,
            "y2": 140,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1095.5,
            "y1": 140,
            "x2": 1095.5,
            "y2": 899.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 920.5,
            "x2": 1095.5,
            "y2": 899.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 915,
            "x2": 985.5,
            "y2": 119,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1074.5,
            "y1": 119,
            "x2": 1074.5,
            "y2": 915,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 973,
            "x2": 1012.5,
            "y2": 973,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 87,
            "x2": 1012.5,
            "y2": 87,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1012.5,
            "y1": 977.5,
            "x2": 985.5,
            "y2": 977.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 977.5,
            "x2": 1074.5,
            "y2": 977.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 985.5,
            "y1": 67.5,
            "x2": 1012.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1017.5,
            "y1": 67.5,
            "x2": 1074.5,
            "y2": 67.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 140,
            "x2": 964.5,
            "y2": 517,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 964.5,
            "y1": 517,
            "x2": 145.5,
            "y2": 899.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1914.5,
            "y1": 140,
            "x2": 1095.5,
            "y2": 517,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1095.5,
            "y1": 517,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1914.5,
            "y1": 899.5,
            "x2": 1505,
            "y2": 140,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1505,
            "y1": 140,
            "x2": 1095.5,
            "y2": 899.5,
            "role": "authority-opening",
            "opening": true
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Turn - Tilt and Turn\\\\HOR_2_FIELD_TURN_TILT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 110,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 33,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 982.474,
            "y1": 111,
            "x2": 111,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 1949,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 1046.474,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.5,
            "y1": 115.8,
            "x2": 977.198,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 115.5,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1046.474,
            "y1": 111,
            "x2": 1048.774,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1048.774,
            "y1": 115.8,
            "x2": 1944.2,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 1944.2,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 944.5,
            "y1": 148.5,
            "x2": 148.2,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.5,
            "y1": 115.8,
            "x2": 148.2,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1911.502,
            "y1": 148.5,
            "x2": 1081.476,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1048.776,
            "y1": 115.8,
            "x2": 1081.476,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1944.202,
            "y1": 115.8,
            "x2": 1911.502,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2027,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 982.498,
            "y1": 111,
            "x2": 1046.474,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 2027,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 977.198,
            "y1": 115.8,
            "x2": 944.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 977.198,
            "y1": 115.8,
            "x2": 982.474,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 33,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 33,
            "y2": 1012,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 111,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 982.474,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1046.798,
            "y1": 934,
            "x2": 1949,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 1949,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 115.5,
            "y1": 929.2,
            "x2": 111,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 982.498,
            "y1": 934,
            "x2": 977.198,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 977.198,
            "y1": 929.2,
            "x2": 115.5,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1046.798,
            "y1": 934,
            "x2": 1048.774,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1048.774,
            "y1": 929.2,
            "x2": 1944.2,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 1944.2,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 115.5,
            "y1": 929.2,
            "x2": 148.2,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 148.2,
            "y1": 896.5,
            "x2": 944.5,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 977.2,
            "y1": 929.2,
            "x2": 944.5,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1048.776,
            "y1": 929.2,
            "x2": 1081.476,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1081.476,
            "y1": 896.5,
            "x2": 1911.502,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1944.202,
            "y1": 929.2,
            "x2": 1911.502,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2027,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 2030,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 982.474,
            "y1": 934,
            "x2": 1046.798,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 33,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 2027,
            "y2": 973,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 32.964,
            "y1": 1012,
            "x2": 32.964,
            "y2": 33,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87.025,
            "x2": 30,
            "y2": 972.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33.013,
            "y1": 1012,
            "x2": 110.718,
            "y2": 934,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 110.718,
            "y1": 934,
            "x2": 110.718,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33.013,
            "y1": 33,
            "x2": 110.718,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.449,
            "y1": 929.199,
            "x2": 115.499,
            "y2": 115.799,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 110.717,
            "y1": 110.999,
            "x2": 115.499,
            "y2": 115.799,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 110.668,
            "y1": 933.95,
            "x2": 115.5,
            "y2": 929.199,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.524,
            "y1": 929.2,
            "x2": 148.001,
            "y2": 896.4,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 148.001,
            "y1": 896.4,
            "x2": 148.2,
            "y2": 148.6,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.524,
            "y1": 115.8,
            "x2": 148.2,
            "y2": 148.6,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972.975,
            "x2": 33.013,
            "y2": 972.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87.025,
            "x2": 32.964,
            "y2": 87.025,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2027.029,
            "y1": 1012,
            "x2": 2027.029,
            "y2": 33,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87.025,
            "x2": 2030,
            "y2": 972.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2026.979,
            "y1": 1012,
            "x2": 1949.079,
            "y2": 934,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1949.079,
            "y1": 934,
            "x2": 1949.079,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2026.979,
            "y1": 33,
            "x2": 1949.079,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1944.335,
            "y1": 929.199,
            "x2": 1944.285,
            "y2": 115.799,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1949.079,
            "y1": 110.999,
            "x2": 1944.285,
            "y2": 115.799,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1949.129,
            "y1": 933.95,
            "x2": 1944.285,
            "y2": 929.199,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1944.26,
            "y1": 929.2,
            "x2": 1911.702,
            "y2": 896.4,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1911.702,
            "y1": 896.4,
            "x2": 1911.502,
            "y2": 148.6,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1944.26,
            "y1": 115.8,
            "x2": 1911.502,
            "y2": 148.6,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 972.975,
            "x2": 2026.979,
            "y2": 972.975,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87.025,
            "x2": 2027.029,
            "y2": 87.025,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 982.474,
            "y1": 933.979,
            "x2": 982.498,
            "y2": 111,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1046.798,
            "y1": 934,
            "x2": 1046.474,
            "y2": 111,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 982.498,
            "y1": 111,
            "x2": 977.198,
            "y2": 115.8,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 977.198,
            "y1": 115.8,
            "x2": 977.198,
            "y2": 929.2,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 982.498,
            "y1": 934,
            "x2": 977.198,
            "y2": 929.2,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1048.774,
            "y1": 115.8,
            "x2": 1048.774,
            "y2": 929.2,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1046.474,
            "y1": 111,
            "x2": 1046.798,
            "y2": 934,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1046.798,
            "y1": 934,
            "x2": 1048.774,
            "y2": 929.2,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1046.474,
            "y1": 111,
            "x2": 1048.774,
            "y2": 115.8,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 977.2,
            "y1": 929.2,
            "x2": 944.5,
            "y2": 896.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 944.5,
            "y1": 896.5,
            "x2": 944.5,
            "y2": 148.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 977.2,
            "y1": 115.8,
            "x2": 944.5,
            "y2": 148.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1048.776,
            "y1": 115.8,
            "x2": 1081.476,
            "y2": 148.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1081.476,
            "y1": 148.5,
            "x2": 1081.476,
            "y2": 896.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1048.776,
            "y1": 929.2,
            "x2": 1081.476,
            "y2": 896.5,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 982.474,
            "y1": 934,
            "x2": 1046.798,
            "y2": 934,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 982.498,
            "y1": 111,
            "x2": 1046.474,
            "y2": 111,
            "role": "B92-18",
            "opening": false
          },
          {
            "x1": 1048.774,
            "y1": 33,
            "x2": 1046.474,
            "y2": 33,
            "role": "authority-opening",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 115.5,
            "y2": 115.8,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 115.5,
            "y1": 929.2,
            "x2": 111,
            "y2": 934,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 982.498,
            "y1": 111,
            "x2": 977.198,
            "y2": 115.8,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 982.498,
            "y1": 934,
            "x2": 977.198,
            "y2": 929.2,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1046.798,
            "y1": 934,
            "x2": 1048.774,
            "y2": 929.2,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1046.474,
            "y1": 111,
            "x2": 1048.774,
            "y2": 115.8,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 1944.2,
            "y2": 115.8,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 1944.2,
            "y2": 929.2,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1911.502,
            "y1": 148.5,
            "x2": 1081.476,
            "y2": 522.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 1081.476,
            "y1": 522.5,
            "x2": 1911.502,
            "y2": 896.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 148.2,
            "y1": 148.5,
            "x2": 944.5,
            "y2": 522.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 944.5,
            "y1": 522.5,
            "x2": 148.2,
            "y2": 896.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 148.2,
            "y1": 896.5,
            "x2": 546.35,
            "y2": 148.5,
            "role": "authority-opening",
            "opening": true
          },
          {
            "x1": 546.35,
            "y1": 148.5,
            "x2": 944.5,
            "y2": 896.5,
            "role": "authority-opening",
            "opening": true
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-tilt-turn-left-right",
    "label": "2 Field Horizontal Tilt & Turn Left / Tilt & Turn Right",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right\\\\HOR_2_FIELD_TILT_TURN_LEFT_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 69,
        "bounds": {
          "x": 20,
          "y": 20,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 20,
            "y1": 20,
            "x2": 1020,
            "y2": 20,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 57.5,
            "y1": 57.5,
            "x2": 1010.5,
            "y2": 57.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1020,
            "y1": 20,
            "x2": 2020,
            "y2": 20,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 57.5,
            "x2": 1982.5,
            "y2": 57.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 114.5,
            "x2": 953.5,
            "y2": 114.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1086.5,
            "y1": 114.5,
            "x2": 1925.5,
            "y2": 114.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 135.5,
            "y1": 135.5,
            "x2": 932.5,
            "y2": 135.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 953.5,
            "y1": 114.5,
            "x2": 932.5,
            "y2": 135.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1108,
            "y1": 135.5,
            "x2": 1905,
            "y2": 135.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 1020,
            "x2": 1020,
            "y2": 1020,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 57.5,
            "y1": 967.5,
            "x2": 1010.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1020,
            "y1": 1020,
            "x2": 2020,
            "y2": 1020,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 967.5,
            "x2": 1982.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 910.5,
            "x2": 953.5,
            "y2": 910.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1086.5,
            "y1": 910.5,
            "x2": 1925.5,
            "y2": 910.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 910.5,
            "x2": 135.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 135.5,
            "y1": 889.5,
            "x2": 932.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 953.5,
            "y1": 910.5,
            "x2": 932.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1087,
            "y1": 910.5,
            "x2": 1108,
            "y2": 889.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1108,
            "y1": 889.5,
            "x2": 1905,
            "y2": 889.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 57.48299999999995,
            "y1": 77,
            "x2": 20,
            "y2": 77,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 20,
            "y2": 77,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 57.48299999999995,
            "y1": 967.5,
            "x2": 57.48299999999995,
            "y2": 57.5,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 114.49500000000012,
            "y1": 967.5,
            "x2": 114.49500000000012,
            "y2": 57.5,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 114.5,
            "x2": 135.5,
            "y2": 135.5,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 135.5,
            "y1": 135.5,
            "x2": 135.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 114.49500000000012,
            "y1": 910.5,
            "x2": 135.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 57.48299999999995,
            "y2": 963,
            "role": "INTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 1982.679,
            "y1": 77,
            "x2": 2020,
            "y2": 77,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 963,
            "x2": 2020,
            "y2": 77,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1982.679,
            "y1": 967.5,
            "x2": 1982.679,
            "y2": 57.5,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1925.913,
            "y1": 967.5,
            "x2": 1925.913,
            "y2": 57.5,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1926,
            "y1": 114.5,
            "x2": 1905,
            "y2": 135.5,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1905,
            "y1": 135.5,
            "x2": 1905,
            "y2": 889.5,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1925.913,
            "y1": 910.5,
            "x2": 1905,
            "y2": 889.5,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 963,
            "x2": 1982.679,
            "y2": 963,
            "role": "INTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1010.5,
            "y1": 57.5,
            "x2": 1010.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 953.5,
            "y1": 57.5,
            "x2": 953.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1086.5,
            "y1": 57.5,
            "x2": 1086.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 57.5,
            "x2": 1029.5,
            "y2": 967.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 932.5,
            "y1": 135.5,
            "x2": 932.5,
            "y2": 889.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1108,
            "y1": 135.5,
            "x2": 1108,
            "y2": 889.5,
            "role": "INTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1903,
            "y1": 889.5,
            "x2": 1817.219,
            "y2": 889.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 135.5,
            "y1": 135.5,
            "x2": 932.5,
            "y2": 512.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 932.5,
            "y1": 512.5,
            "x2": 135.5,
            "y2": 889.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 135.5,
            "y1": 889.5,
            "x2": 534,
            "y2": 135.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 534,
            "y1": 135.5,
            "x2": 932.5,
            "y2": 889.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1905,
            "y1": 135.5,
            "x2": 1108,
            "y2": 512.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1108,
            "y1": 512.5,
            "x2": 1905,
            "y2": 889.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1905,
            "y1": 889.5,
            "x2": 1506.5,
            "y2": 135.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1506.5,
            "y1": 135.5,
            "x2": 1108,
            "y2": 889.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1982.5,
            "y1": 967.5,
            "x2": 1982.5,
            "y2": 57.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 57.5,
            "y1": 57.5,
            "x2": 57.5,
            "y2": 967.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 57.5,
            "x2": 114.5,
            "y2": 967.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1925.5,
            "y1": 57.5,
            "x2": 1925.5,
            "y2": 967.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1087,
            "y1": 114.5,
            "x2": 1108,
            "y2": 135.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1905,
            "y1": 889.5,
            "x2": 1926,
            "y2": 910.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 114.5,
            "y1": 114.5,
            "x2": 114.5,
            "y2": 910.5,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1809.219,
            "y1": 879.5,
            "x2": 1829.219,
            "y2": 899.5,
            "role": "0",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 77,
            "x2": 57.5,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 1010.5,
            "y1": 77,
            "x2": 1029.5,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 77,
            "x2": 1982.5,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 57.5,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 1010.5,
            "y1": 963,
            "x2": 1029.5,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 963,
            "x2": 1982.5,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 77,
            "x2": 20,
            "y2": 20,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 20,
            "y2": 1020,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 963,
            "x2": 2020,
            "y2": 1020,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020,
            "y1": 20,
            "x2": 2020,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right\\\\HOR_2_FIELD_TILT_TURN_LEFT_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 92,
        "bounds": {
          "x": 20,
          "y": 20,
          "width": 2000.0000000000002,
          "height": 1000
        },
        "lines": [
          {
            "x1": 20,
            "y1": 20,
            "x2": 1020,
            "y2": 20,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1020,
            "y1": 20,
            "x2": 2020.0000000000002,
            "y2": 20,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 23,
            "y1": 23,
            "x2": 2017.0000000000002,
            "y2": 23,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 967,
            "y1": 99,
            "x2": 101,
            "y2": 99,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 101,
            "y1": 99,
            "x2": 23,
            "y2": 23,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 99,
            "x2": 1939.0000000000002,
            "y2": 99,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1939.0000000000002,
            "y1": 99,
            "x2": 2017.0000000000002,
            "y2": 23,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 105.79999999999995,
            "y1": 103.80000000000018,
            "x2": 962.1980000000001,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 101,
            "y1": 99,
            "x2": 105.79999999999995,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1077.8,
            "y1": 103.80000000000018,
            "x2": 1934.2,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1939.0000000000002,
            "y1": 99,
            "x2": 1934.2,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 138.5,
            "y1": 136.5,
            "x2": 929.7,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 962.2,
            "y1": 103.80000000000018,
            "x2": 929.5,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 105.79999999999995,
            "y1": 103.80000000000018,
            "x2": 138.5,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1110.5000000000002,
            "y1": 136.5,
            "x2": 1901.7,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1934.2,
            "y1": 103.80000000000018,
            "x2": 1901.5000000000002,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1077.8,
            "y1": 103.80000000000018,
            "x2": 1110.5000000000002,
            "y2": 136.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 1020,
            "x2": 1020,
            "y2": 1020,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 23,
            "y1": 1000,
            "x2": 1020,
            "y2": 1000,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1020,
            "y1": 1020,
            "x2": 2020.0000000000002,
            "y2": 1020,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1020,
            "y1": 1000,
            "x2": 2017.0000000000002,
            "y2": 1000,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 23,
            "y1": 1000,
            "x2": 101,
            "y2": 922,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 101,
            "y1": 922,
            "x2": 967,
            "y2": 922,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 2017.0000000000002,
            "y1": 1000,
            "x2": 1939.0000000000002,
            "y2": 922,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1939.0000000000002,
            "y1": 922,
            "x2": 1073,
            "y2": 922,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 105.79999999999995,
            "y1": 917.2,
            "x2": 101,
            "y2": 922,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 962.1980000000001,
            "y1": 917.2,
            "x2": 105.79999999999995,
            "y2": 917.2,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1077.799,
            "y1": 917.2,
            "x2": 1934.2,
            "y2": 917.2,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1939.0000000000002,
            "y1": 922,
            "x2": 1934.2,
            "y2": 917.2,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 929.5,
            "y1": 884.5,
            "x2": 138.5,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 105.79999999999995,
            "y1": 917.2,
            "x2": 138.5,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 962.2,
            "y1": 917.2,
            "x2": 929.5,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1901.5000000000002,
            "y1": 884.5,
            "x2": 1110.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1077.8,
            "y1": 917.2,
            "x2": 1110.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1934.2,
            "y1": 917.2,
            "x2": 1901.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 22.97199999999998,
            "y1": 1000,
            "x2": 22.97199999999998,
            "y2": 23,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 77,
            "x2": 20,
            "y2": 963,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 23.022000000000048,
            "y1": 1000,
            "x2": 100.923,
            "y2": 922.1590000000001,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 100.923,
            "y1": 922.1590000000001,
            "x2": 100.923,
            "y2": 100.84000000000015,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 23.022000000000048,
            "y1": 23,
            "x2": 100.923,
            "y2": 100.84000000000015,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 105.66699999999992,
            "y1": 917.3680000000002,
            "x2": 105.7170000000001,
            "y2": 105.63000000000011,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 100.923,
            "y1": 100.84000000000015,
            "x2": 105.7170000000001,
            "y2": 105.63000000000011,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 100.87300000000005,
            "y1": 922.1090000000002,
            "x2": 105.7170000000001,
            "y2": 917.3680000000002,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 105.74199999999996,
            "y1": 917.3690000000001,
            "x2": 138.30099999999993,
            "y2": 884.636,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 138.5,
            "y1": 884.5,
            "x2": 138.5,
            "y2": 136.5,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 105.74199999999996,
            "y1": 105.63000000000011,
            "x2": 138.5,
            "y2": 138.36300000000028,
            "role": "EXTERNAL_B92-10_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 2017.0290000000002,
            "y1": 1000,
            "x2": 2017.0290000000002,
            "y2": 23,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2020.0000000000002,
            "y1": 963,
            "x2": 2020.0000000000002,
            "y2": 77,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2016.979,
            "y1": 1000,
            "x2": 1939.0780000000002,
            "y2": 922.1590000000001,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1939.0780000000002,
            "y1": 922.1590000000001,
            "x2": 1939.0780000000002,
            "y2": 100.84000000000015,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2016.979,
            "y1": 23,
            "x2": 1939.0780000000002,
            "y2": 100.84000000000015,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1934.334,
            "y1": 917.3680000000002,
            "x2": 1934.2839999999999,
            "y2": 105.63000000000011,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1939.0780000000002,
            "y1": 100.84000000000015,
            "x2": 1934.2839999999999,
            "y2": 105.63000000000011,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1939.128,
            "y1": 922.1090000000002,
            "x2": 1934.2839999999999,
            "y2": 917.3680000000002,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1934.2590000000002,
            "y1": 917.3690000000001,
            "x2": 1901.7,
            "y2": 884.636,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1901.5000000000002,
            "y1": 136.5,
            "x2": 1901.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1934.2590000000002,
            "y1": 105.63000000000011,
            "x2": 1901.5000000000002,
            "y2": 138.36300000000028,
            "role": "EXTERNAL_B92-10_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 966.998,
            "y1": 99,
            "x2": 967,
            "y2": 922,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 99,
            "x2": 1073,
            "y2": 922,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 966.998,
            "y1": 99,
            "x2": 962.1980000000001,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 966.998,
            "y1": 922,
            "x2": 962.1980000000001,
            "y2": 917.2,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1077.8,
            "y1": 103.80000000000018,
            "x2": 1077.799,
            "y2": 917.2,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 922,
            "x2": 1077.799,
            "y2": 917.2,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 962.1980000000001,
            "y1": 103.80000000000018,
            "x2": 962.1980000000001,
            "y2": 917.2,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 929.5,
            "y1": 136.5,
            "x2": 929.5,
            "y2": 884.5,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1110.5000000000002,
            "y1": 884.5,
            "x2": 1110.5000000000002,
            "y2": 136.5,
            "role": "EXTERNAL_B92-15_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 99,
            "x2": 1077.8,
            "y2": 103.80000000000018,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 138.5,
            "y1": 136.5,
            "x2": 929.5,
            "y2": 510.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 929.5,
            "y1": 510.5,
            "x2": 138.5,
            "y2": 884.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 138.5,
            "y1": 884.5,
            "x2": 534.0999999999999,
            "y2": 136.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 534.0999999999999,
            "y1": 136.5,
            "x2": 929.5,
            "y2": 884.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1901.7,
            "y1": 136.5,
            "x2": 1110.5000000000002,
            "y2": 510.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1110.5000000000002,
            "y1": 510.5,
            "x2": 1901.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1901.5000000000002,
            "y1": 884.5,
            "x2": 1506.1000000000001,
            "y2": 136.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1506.1000000000001,
            "y1": 136.5,
            "x2": 1110.5000000000002,
            "y2": 884.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 2017.0000000000002,
            "y1": 1000,
            "x2": 2017.0000000000002,
            "y2": 23,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 23,
            "y1": 23,
            "x2": 23,
            "y2": 1000,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 101,
            "y1": 99,
            "x2": 101,
            "y2": 922,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1939.0000000000002,
            "y1": 99,
            "x2": 1939.0000000000002,
            "y2": 922,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 105.79999999999995,
            "y1": 917.2,
            "x2": 105.79999999999995,
            "y2": 103.80000000000018,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 101,
            "y1": 922,
            "x2": 911.3979999999999,
            "y2": 922,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 1934.2,
            "y1": 103.80000000000018,
            "x2": 1934.2,
            "y2": 917.2,
            "role": "Medis hatch",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 23,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 966.998,
            "y1": 99,
            "x2": 1073,
            "y2": 99,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 966.998,
            "y1": 922,
            "x2": 1073,
            "y2": 922,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 77,
            "x2": 23,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 20,
            "x2": 20,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020.0000000000002,
            "y1": 77,
            "x2": 2017.0000000000002,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020.0000000000002,
            "y1": 20,
            "x2": 2020.0000000000002,
            "y2": 77,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020.0000000000002,
            "y1": 963,
            "x2": 2017.0000000000002,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 2020.0000000000002,
            "y1": 1020,
            "x2": 2020.0000000000002,
            "y2": 963,
            "role": "MATMENYS",
            "opening": false
          },
          {
            "x1": 20,
            "y1": 963,
            "x2": 20,
            "y2": 1020,
            "role": "MATMENYS",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-tilt-turn-right-left",
    "label": "2 Field Horizontal Tilt & Turn Right / Tilt & Turn Left",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Tilt and Turn Right - Tilt and Turn Left\\\\HOR_2_FIELD_TILT_TURN_RIGHT_LEFT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 58,
        "bounds": {
          "x": 24,
          "y": 24,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 61.48299999999995,
            "y1": 81,
            "x2": 24,
            "y2": 81,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 967,
            "x2": 24,
            "y2": 81,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 61.48299999999995,
            "y1": 971.5,
            "x2": 61.48299999999995,
            "y2": 61.5,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 118.49500000000012,
            "y1": 971.5,
            "x2": 118.49500000000012,
            "y2": 61.5,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 118.5,
            "y1": 118.5,
            "x2": 139.5,
            "y2": 139.5,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 139.5,
            "y1": 139.5,
            "x2": 139.5,
            "y2": 893.5,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 118.49500000000012,
            "y1": 914.5,
            "x2": 139.5,
            "y2": 893.5,
            "role": "INTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 967,
            "x2": 61.48299999999995,
            "y2": 967,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1986.679,
            "y1": 81,
            "x2": 2024,
            "y2": 81,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 967,
            "x2": 2024,
            "y2": 81,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1986.679,
            "y1": 971.5,
            "x2": 1986.679,
            "y2": 61.5,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1929.913,
            "y1": 971.5,
            "x2": 1929.913,
            "y2": 61.5,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1930,
            "y1": 118.5,
            "x2": 1909,
            "y2": 139.5,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1909,
            "y1": 139.5,
            "x2": 1909,
            "y2": 893.5,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1929.913,
            "y1": 914.5,
            "x2": 1909,
            "y2": 893.5,
            "role": "INTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 967,
            "x2": 1986.679,
            "y2": 967,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES_BASELINE",
            "opening": false
          },
          {
            "x1": 1907,
            "y1": 893.5,
            "x2": 1821.219,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES_BASELINE",
            "opening": false
          },
          {
            "x1": 997.9540000000002,
            "y1": 61.5,
            "x2": 997.9540000000002,
            "y2": 971.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 941.0929999999998,
            "y1": 61.5,
            "x2": 941.0929999999998,
            "y2": 971.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1103.696,
            "y1": 61.5,
            "x2": 1103.696,
            "y2": 971.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1046.835,
            "y1": 61.5,
            "x2": 1046.835,
            "y2": 971.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 920.1440000000002,
            "y1": 139.5,
            "x2": 920.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1125.1440000000002,
            "y1": 139.5,
            "x2": 1125.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 1024,
            "x2": 1024,
            "y2": 1024,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1024,
            "y1": 1024,
            "x2": 2024,
            "y2": 1024,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 139.5,
            "y1": 139.5,
            "x2": 920.1440000000002,
            "y2": 139.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1125.1440000000002,
            "y1": 139.5,
            "x2": 1909,
            "y2": 139.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 24,
            "x2": 1024,
            "y2": 24,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1024,
            "y1": 24,
            "x2": 2024,
            "y2": 24,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 24,
            "x2": 24,
            "y2": 81,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 24,
            "x2": 2024,
            "y2": 81,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 967,
            "x2": 24,
            "y2": 1024,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 967,
            "x2": 2024,
            "y2": 1024,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 118.5,
            "y1": 118.5,
            "x2": 941.1440000000002,
            "y2": 118.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1104.1440000000002,
            "y1": 118.5,
            "x2": 1929.5,
            "y2": 118.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 61.5,
            "y1": 61.5,
            "x2": 998.1440000000002,
            "y2": 61.5,
            "role": "INTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1047.1440000000002,
            "y1": 61.5,
            "x2": 1986.5,
            "y2": 61.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 61.5,
            "y1": 971.5,
            "x2": 998.1440000000002,
            "y2": 971.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1047.1440000000002,
            "y1": 971.5,
            "x2": 1986.5,
            "y2": 971.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 118.5,
            "y1": 914.5,
            "x2": 941.1440000000002,
            "y2": 914.5,
            "role": "INTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1104.1440000000002,
            "y1": 914.5,
            "x2": 1929.5,
            "y2": 914.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 941.1440000000002,
            "y1": 118.5,
            "x2": 920.1440000000002,
            "y2": 139.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 941.1440000000002,
            "y1": 914.5,
            "x2": 920.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1104.1440000000002,
            "y1": 118.5,
            "x2": 1125.1440000000002,
            "y2": 139.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1104.1440000000002,
            "y1": 914.5,
            "x2": 1125.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 998.1440000000002,
            "y1": 81,
            "x2": 1047.1440000000002,
            "y2": 81,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 998.1440000000002,
            "y1": 967,
            "x2": 1047.1440000000002,
            "y2": 967,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 998.1440000000002,
            "y1": 967,
            "x2": 1047.1440000000002,
            "y2": 967,
            "role": "INTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 139.5,
            "y1": 893.5,
            "x2": 920.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1125.1440000000002,
            "y1": 893.5,
            "x2": 1909,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1125.1440000000002,
            "y1": 139.5,
            "x2": 1909,
            "y2": 516.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1909,
            "y1": 516.5,
            "x2": 1125.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1125.1440000000002,
            "y1": 893.5,
            "x2": 1510.5,
            "y2": 139.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1510.5,
            "y1": 139.5,
            "x2": 1909,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 920.1440000000002,
            "y1": 139.5,
            "x2": 139.5,
            "y2": 516.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 139.5,
            "y1": 516.5,
            "x2": 920.1440000000002,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 920.1440000000002,
            "y1": 893.5,
            "x2": 538,
            "y2": 139.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 538,
            "y1": 139.5,
            "x2": 139.5,
            "y2": 893.5,
            "role": "INTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Tilt and Turn Right - Tilt and Turn Left\\\\HOR_2_FIELD_TILT_TURN_RIGHT_LEFT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 84,
        "bounds": {
          "x": 24,
          "y": 24,
          "width": 2000,
          "height": 999.9999999999998
        },
        "lines": [
          {
            "x1": 1943,
            "y1": 103,
            "x2": 2021,
            "y2": 27,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 105,
            "y1": 103,
            "x2": 109.79999999999995,
            "y2": 107.79999999999973,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1943,
            "y1": 103,
            "x2": 1938.1999999999998,
            "y2": 107.79999999999973,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 109.79999999999995,
            "y1": 107.79999999999973,
            "x2": 142.5,
            "y2": 140.5,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1938.1999999999998,
            "y1": 107.79999999999973,
            "x2": 1905.5,
            "y2": 140.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 27,
            "y1": 1003.9999999999998,
            "x2": 105,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 2021,
            "y1": 1003.9999999999998,
            "x2": 1943,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 109.79999999999995,
            "y1": 921.1999999999998,
            "x2": 105,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1943,
            "y1": 925.9999999999998,
            "x2": 1938.1999999999998,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 109.79999999999995,
            "y1": 921.1999999999998,
            "x2": 142.5,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1938.1999999999998,
            "y1": 921.1999999999998,
            "x2": 1905.5,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 26.97199999999998,
            "y1": 1003.9999999999998,
            "x2": 26.97199999999998,
            "y2": 27,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 81,
            "x2": 24,
            "y2": 966.9999999999998,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 27.021999999999935,
            "y1": 1003.9999999999998,
            "x2": 104.923,
            "y2": 926.1589999999999,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 104.923,
            "y1": 926.1589999999999,
            "x2": 104.923,
            "y2": 104.83999999999969,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 27.021999999999935,
            "y1": 27,
            "x2": 104.923,
            "y2": 104.83999999999969,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 109.66699999999992,
            "y1": 921.3679999999999,
            "x2": 109.71699999999987,
            "y2": 109.62999999999965,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 104.923,
            "y1": 104.83999999999969,
            "x2": 109.71699999999987,
            "y2": 109.62999999999965,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 104.87299999999982,
            "y1": 926.1089999999999,
            "x2": 109.71699999999987,
            "y2": 921.3679999999999,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 109.74199999999996,
            "y1": 921.3689999999999,
            "x2": 142.30099999999993,
            "y2": 888.636,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 142.5,
            "y1": 888.4999999999998,
            "x2": 142.5,
            "y2": 140.5,
            "role": "EXTERNAL_B92-9_LEFT_SIDE",
            "opening": false
          },
          {
            "x1": 109.74199999999996,
            "y1": 109.62999999999965,
            "x2": 142.5,
            "y2": 142.36299999999983,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2021.029,
            "y1": 1003.9999999999998,
            "x2": 2021.029,
            "y2": 27,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 966.9999999999998,
            "x2": 2024,
            "y2": 81,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2020.9789999999998,
            "y1": 1003.9999999999998,
            "x2": 1943.078,
            "y2": 926.1589999999999,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1943.078,
            "y1": 926.1589999999999,
            "x2": 1943.078,
            "y2": 104.83999999999969,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 2020.9789999999998,
            "y1": 27,
            "x2": 1943.078,
            "y2": 104.83999999999969,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1938.3339999999998,
            "y1": 921.3679999999999,
            "x2": 1938.284,
            "y2": 109.62999999999965,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1943.078,
            "y1": 104.83999999999969,
            "x2": 1938.284,
            "y2": 109.62999999999965,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1943.1279999999997,
            "y1": 926.1089999999999,
            "x2": 1938.284,
            "y2": 921.3679999999999,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1938.259,
            "y1": 921.3689999999999,
            "x2": 1905.6999999999998,
            "y2": 888.636,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1905.5,
            "y1": 140.5,
            "x2": 1905.5,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-9_RIGHT_SIDE",
            "opening": false
          },
          {
            "x1": 1938.259,
            "y1": 109.62999999999965,
            "x2": 1905.5,
            "y2": 142.36299999999983,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES_BASELINE",
            "opening": false
          },
          {
            "x1": 955.9969999999998,
            "y1": 103,
            "x2": 955.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1091.9989999999998,
            "y1": 103,
            "x2": 1091.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 955.9989999999998,
            "y1": 103,
            "x2": 951.1990000000001,
            "y2": 107.79999999999973,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 955.9989999999998,
            "y1": 925.9999999999998,
            "x2": 951.1990000000001,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1096.799,
            "y1": 107.79999999999973,
            "x2": 1096.797,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1091.9989999999998,
            "y1": 103,
            "x2": 1096.799,
            "y2": 107.79999999999973,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 951.1970000000001,
            "y1": 107.79999999999973,
            "x2": 951.1970000000001,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 918.4989999999998,
            "y1": 140.5,
            "x2": 918.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 951.1990000000001,
            "y1": 107.79999999999973,
            "x2": 918.4989999999998,
            "y2": 140.5,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 951.1990000000001,
            "y1": 921.1999999999998,
            "x2": 918.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1129.4989999999998,
            "y1": 888.4999999999998,
            "x2": 1129.4989999999998,
            "y2": 140.5,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1096.799,
            "y1": 107.79999999999973,
            "x2": 1129.4989999999998,
            "y2": 140.5,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1096.799,
            "y1": 921.1999999999998,
            "x2": 1129.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 955.9989999999998,
            "y1": 103,
            "x2": 1091.9989999999998,
            "y2": 103,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 955.9989999999998,
            "y1": 925.9999999999998,
            "x2": 1091.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1002.9989999999998,
            "y1": 103,
            "x2": 1002.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-16_STATIC_CENTRE",
            "opening": false
          },
          {
            "x1": 1044.9989999999998,
            "y1": 103,
            "x2": 1044.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 27,
            "y1": 1003.9999999999998,
            "x2": 1024,
            "y2": 1003.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1024,
            "y1": 1003.9999999999998,
            "x2": 2021,
            "y2": 1003.9999999999998,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 24,
            "x2": 1024,
            "y2": 24,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1024,
            "y1": 24,
            "x2": 2024,
            "y2": 24,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 27,
            "y1": 27,
            "x2": 2021,
            "y2": 27,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 105,
            "y1": 925.9999999999998,
            "x2": 915.3969999999999,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 142.5,
            "y1": 140.5,
            "x2": 918.4989999999998,
            "y2": 140.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 918.4989999999998,
            "y1": 888.4999999999998,
            "x2": 142.5,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1905.5,
            "y1": 888.4999999999998,
            "x2": 1129.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1905.5,
            "y1": 140.5949999999998,
            "x2": 1129.4989999999998,
            "y2": 140.5,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 1023.9999999999998,
            "x2": 1024,
            "y2": 1023.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1024,
            "y1": 1023.9999999999998,
            "x2": 2024,
            "y2": 1023.9999999999998,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 24,
            "x2": 24,
            "y2": 81,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 24,
            "x2": 2024,
            "y2": 81,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 24,
            "y1": 966.9999999999998,
            "x2": 24,
            "y2": 1023.9999999999998,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2024,
            "y1": 966.9999999999998,
            "x2": 2024,
            "y2": 1023.9999999999998,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 109.79999999999995,
            "y1": 107.79999999999973,
            "x2": 951.1959999999999,
            "y2": 107.80299999999988,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1096.799,
            "y1": 107.79999999999973,
            "x2": 1953.199,
            "y2": 107.79999999999973,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 105,
            "y1": 103,
            "x2": 955.9960000000001,
            "y2": 103,
            "role": "EXTERNAL_B92-7_TOP_HEAD",
            "opening": false
          },
          {
            "x1": 1091.9989999999998,
            "y1": 103,
            "x2": 1943,
            "y2": 103,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 105,
            "y1": 925.9999999999998,
            "x2": 955.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1943,
            "y1": 925.9999999999998,
            "x2": 1091.9989999999998,
            "y2": 925.9999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 109.79999999999995,
            "y1": 921.1999999999998,
            "x2": 951.1990000000001,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_B92-8_BOTTOM_SILL",
            "opening": false
          },
          {
            "x1": 1096.799,
            "y1": 921.1999999999998,
            "x2": 1938.1999999999998,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1092,
            "y1": 925.9999999999998,
            "x2": 1096.799,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1092,
            "y1": 925.9999999999998,
            "x2": 1096.799,
            "y2": 921.1999999999998,
            "role": "EXTERNAL_AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 142.5,
            "y1": 888.4999999999998,
            "x2": 538.0999999999999,
            "y2": 140.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 538.0999999999999,
            "y1": 140.5,
            "x2": 918.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1905.5,
            "y1": 888.4999999999998,
            "x2": 1510.1,
            "y2": 140.5,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1510.1,
            "y1": 140.5,
            "x2": 1129.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 918.4989999999998,
            "y1": 140.5,
            "x2": 142.5,
            "y2": 514.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 142.5,
            "y1": 514.4999999999998,
            "x2": 918.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1129.4989999999998,
            "y1": 140.5,
            "x2": 1905.5,
            "y2": 514.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          },
          {
            "x1": 1905.5,
            "y1": 514.4999999999998,
            "x2": 1129.4989999999998,
            "y2": 888.4999999999998,
            "role": "EXTERNAL_AUTHORITY_OPENING_LINES",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-fixed-tilt-turn-right",
    "label": "2 Field Horizontal Fixed / Tilt & Turn Right",
    "group": "2 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed - Tilt and Turn Right\\\\HOR_2_FIELD_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 67,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 969,
            "y1": 900,
            "x2": 969,
            "y2": 108,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 972,
            "x2": 990,
            "y2": 87,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 977.5,
            "x2": 1028.5,
            "y2": 67.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 969,
            "y1": 108,
            "x2": 990,
            "y2": 87,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 921,
            "x2": 969,
            "y2": 900,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 977.5,
            "x2": 1085.5,
            "y2": 67.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1106.5,
            "y1": 145.5,
            "x2": 1106.5,
            "y2": 899.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 920.5,
            "x2": 1106.5,
            "y2": 899.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 87,
            "x2": 1028.5,
            "y2": 87,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 972,
            "x2": 1028.5,
            "y2": 972,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 977.5,
            "x2": 1085.5,
            "y2": 977.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 67.5,
            "x2": 1028.5,
            "y2": 67.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1106.5,
            "y1": 145.5,
            "x2": 1085.5,
            "y2": 124.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 73,
            "x2": 1028.5,
            "y2": 73,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 87,
            "x2": 990,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 94,
            "y1": 108,
            "x2": 969,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 73,
            "x2": 73,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 67.5,
            "x2": 1028.5,
            "y2": 73,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 73,
            "x2": 1028.5,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 921,
            "x2": 73,
            "y2": 921,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 969,
            "y1": 900,
            "x2": 94,
            "y2": 900,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 1028.5,
            "y2": 972,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 30,
            "y2": 1030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 921,
            "x2": 73,
            "y2": 972,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 990,
            "y1": 921,
            "x2": 990,
            "y2": 972,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 972,
            "x2": 1028.5,
            "y2": 977.5,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 30,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 972,
            "x2": 73,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 94,
            "y1": 900,
            "x2": 73,
            "y2": 921,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 87,
            "x2": 94,
            "y2": 108,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 73,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 94,
            "y1": 108,
            "x2": 94,
            "y2": 900,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 972,
            "x2": 73,
            "y2": 972,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1028.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 124.5,
            "x2": 1935.5,
            "y2": 124.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1106.5,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 145.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 30,
            "x2": 2030,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 124.5,
            "x2": 1085.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 124.5,
            "x2": 1935.5,
            "y2": 67.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 977.5,
            "x2": 1028.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 920.5,
            "x2": 1935.5,
            "y2": 920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1106.5,
            "y1": 899.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 972,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1085.5,
            "y1": 920.5,
            "x2": 1085.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 920.5,
            "x2": 1935.5,
            "y2": 977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 977.5,
            "x2": 1992.5,
            "y2": 972,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 972,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 977.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 67.5,
            "x2": 1935.5,
            "y2": 977.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1914.5,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 920.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 124.5,
            "x2": 1914.5,
            "y2": 145.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 972,
            "x2": 1992.5,
            "y2": 972,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 1992.5,
            "y2": 87,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1935.5,
            "y1": 67.5,
            "x2": 1992.5,
            "y2": 67.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1992.5,
            "y1": 977.5,
            "x2": 1935.5,
            "y2": 977.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1106.5,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 510.593,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 1914.5,
            "y1": 510.593,
            "x2": 1106.5,
            "y2": 899.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 1106.5,
            "y1": 899.5,
            "x2": 1510.5,
            "y2": 145.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 1510.5,
            "y1": 145.5,
            "x2": 1914.5,
            "y2": 899.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Hor - 2 Field Fixed - Tilt and Turn Right\\\\HOR_2_FIELD_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 68,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 2000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 33,
            "y2": 33,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 111,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 929.2,
            "x2": 115.8,
            "y2": 115.8,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 896.5,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 33,
            "y2": 1012,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 111,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 929.2,
            "x2": 148.5,
            "y2": 896.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 115.8,
            "y2": 115.8,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 115.8,
            "y2": 929.2,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 929.2,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 988,
            "y2": 111,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 934,
            "x2": 1072,
            "y2": 111,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 983.192,
            "y2": 929.2,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 115.8,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 111,
            "x2": 988,
            "y2": 111,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 934,
            "x2": 988,
            "y2": 934,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 983.192,
            "y2": 929.2,
            "role": "B92-13",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 30,
            "x2": 2030,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 2027,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 33,
            "x2": 2027,
            "y2": 33,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 111,
            "x2": 1949,
            "y2": 111,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 929.2,
            "x2": 1949,
            "y2": 929.2,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 896.5,
            "x2": 1949,
            "y2": 896.5,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 973,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 896.5,
            "x2": 1949,
            "y2": 934,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 896.5,
            "x2": 1072,
            "y2": 934,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 934,
            "x2": 1949,
            "y2": 934,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1012,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 2030,
            "y2": 1030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2030,
            "y2": 973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 33,
            "x2": 2027,
            "y2": 1012,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 1949,
            "y2": 934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 973,
            "x2": 2027,
            "y2": 973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 1949,
            "y2": 934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 111,
            "x2": 2027,
            "y2": 33,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 87,
            "x2": 2027,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 1030,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 1030,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 983.192,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1012,
            "x2": 33,
            "y2": 1012,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 934,
            "x2": 111,
            "y2": 934,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 983.192,
            "y1": 929.2,
            "x2": 115.8,
            "y2": 929.2,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 950.5,
            "y1": 896.5,
            "x2": 148.5,
            "y2": 896.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 973,
            "x2": 33,
            "y2": 1012,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 522.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 950.5,
            "y1": 522.5,
            "x2": 148.5,
            "y2": 896.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 148.5,
            "y1": 896.5,
            "x2": 549.5,
            "y2": 148.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 549.5,
            "y1": 148.5,
            "x2": 950.5,
            "y2": 896.5,
            "role": "AUTHORITY_OPENING_LINES",
            "opening": true
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 2030,
            "y2": 30,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 2027,
            "y2": 33,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 1949,
            "y2": 111,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 2027,
            "y1": 1012,
            "x2": 33,
            "y2": 1012,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          },
          {
            "x1": 1949,
            "y1": 934,
            "x2": 111,
            "y2": 934,
            "role": "AUTHORITY_RECONCILED",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-fixed-bottom-fixed-top",
    "label": "2 Field Vertical Fixed Bottom / Fixed Top",
    "group": "2 Field Vertical",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Fixed Bottom - Fixed Top\\\\VER_2_FIELD_FIXED_BOTTOM_FIXED_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 38,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000,
          "height": 2006
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 1030,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 952,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 1030,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1012,
            "x2": 973,
            "y2": 1012,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1048,
            "x2": 973,
            "y2": 1048,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1012,
            "x2": 108,
            "y2": 991,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 991,
            "x2": 952,
            "y2": 991,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 991,
            "x2": 973,
            "y2": 1012,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1048,
            "x2": 108,
            "y2": 1069,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 1069,
            "x2": 952,
            "y2": 1069,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1069,
            "x2": 973,
            "y2": 1048,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1012,
            "x2": 87,
            "y2": 1048,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1012,
            "x2": 973,
            "y2": 1048,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1952,
            "x2": 30,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1952,
            "x2": 87,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 991,
            "x2": 108,
            "y2": 108,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 1931,
            "x2": 108,
            "y2": 1069,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 1931,
            "x2": 87,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1952,
            "x2": 30,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 87,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 30,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 87,
            "x2": 973,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 108,
            "x2": 952,
            "y2": 991,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1931,
            "x2": 952,
            "y2": 1069,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 108,
            "x2": 973,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 87,
            "x2": 1030,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1931,
            "x2": 973,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1952,
            "x2": 1030,
            "y2": 1952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 2036,
            "x2": 30,
            "y2": 2036,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1958,
            "x2": 30,
            "y2": 1958,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1937,
            "x2": 108,
            "y2": 1937,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1958,
            "x2": 108,
            "y2": 1937,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1958,
            "x2": 952,
            "y2": 1937,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1958,
            "x2": 30,
            "y2": 2036,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1958,
            "x2": 1030,
            "y2": 2036,
            "role": "B92-3",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Fixed Bottom - Fixed Top\\\\VER_2_FIELD_FIXED_BOTTOM_FIXED_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 32,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000,
          "height": 1999.95
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 32.975,
            "x2": 32.975,
            "y2": 32.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1026.975,
            "y1": 32.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 110.975,
            "x2": 110.975,
            "y2": 110.975,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 30,
            "x2": 1030,
            "y2": 88.488,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 32.975,
            "x2": 32.975,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 988,
            "x2": 110.975,
            "y2": 988,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 1072,
            "x2": 948.975,
            "y2": 1072,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 988,
            "x2": 110.975,
            "y2": 1072,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 988,
            "x2": 948.975,
            "y2": 1072,
            "role": "B92-19",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1972.95,
            "x2": 30,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 32.975,
            "x2": 32.975,
            "y2": 2011.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 110.975,
            "x2": 110.975,
            "y2": 1933.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 32.975,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 32.975,
            "x2": 110.975,
            "y2": 110.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 88.488,
            "x2": 1030,
            "y2": 1972.95,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 2011.975,
            "x2": 1027.025,
            "y2": 32.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 948.975,
            "y1": 1933.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 88.488,
            "x2": 1027.025,
            "y2": 88.488,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 32.975,
            "x2": 948.975,
            "y2": 110.975,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 2011.975,
            "x2": 1027.025,
            "y2": 2011.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 2029.95,
            "x2": 30,
            "y2": 2029.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 2029.95,
            "x2": 30,
            "y2": 1972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 2011.975,
            "x2": 110.975,
            "y2": 1933.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 110.975,
            "y1": 1933.975,
            "x2": 948.975,
            "y2": 1933.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 2011.975,
            "x2": 948.975,
            "y2": 1933.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1972.95,
            "x2": 1027.025,
            "y2": 1972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1972.95,
            "x2": 32.975,
            "y2": 1972.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1972.95,
            "x2": 1030,
            "y2": 2029.95,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 32.975,
            "y1": 1972.95,
            "x2": 32.975,
            "y2": 2011.975,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1027.025,
            "y1": 1972.95,
            "x2": 1027.025,
            "y2": 2011.975,
            "role": "B92-3",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-tilt-turn-bottom-fixed-top",
    "label": "2 Field Vertical Tilt & Turn Bottom / Fixed Top",
    "group": "2 Field Vertical",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Tilt and Turn Bottom - Fixed Top\\\\VER_2_FIELD_TILT_TURN_BOTTOM_FIXED_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 68,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000,
          "height": 2000
        },
        "lines": [
          {
            "x1": 1030,
            "y1": 87,
            "x2": 30,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 952,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 108,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 87,
            "x2": 952,
            "y2": 108,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 989.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 989.05,
            "x2": 30,
            "y2": 989.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 87,
            "x2": 73,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 967.05,
            "x2": 87,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 108,
            "y2": 946.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 967.05,
            "x2": 108,
            "y2": 946.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 87,
            "x2": 30,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 967.05,
            "x2": 73,
            "y2": 967.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 989.05,
            "x2": 67.5,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 983.55,
            "x2": 73,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 989.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 989.05,
            "x2": 992.5,
            "y2": 989.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 967.05,
            "x2": 973,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 108,
            "x2": 952,
            "y2": 946.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 987,
            "y1": 87,
            "x2": 987,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 946.05,
            "x2": 973,
            "y2": 967.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 987,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 987,
            "y1": 87,
            "x2": 973,
            "y2": 87,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 967.05,
            "x2": 987,
            "y2": 967.05,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 989.05,
            "x2": 992.5,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 983.55,
            "x2": 987,
            "y2": 983.55,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 987.001,
            "y1": 983.55,
            "x2": 73.001,
            "y2": 983.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 935.501,
            "y1": 1040.55,
            "x2": 124.501,
            "y2": 1040.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 914.501,
            "y1": 1061.55,
            "x2": 145.501,
            "y2": 1061.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 987.001,
            "y1": 967.05,
            "x2": 73.001,
            "y2": 967.05,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 952.001,
            "y1": 946.05,
            "x2": 108.001,
            "y2": 946.05,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 1040.55,
            "x2": 145.501,
            "y2": 1061.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 935.501,
            "y1": 1040.55,
            "x2": 914.501,
            "y2": 1061.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 87.001,
            "y1": 967.05,
            "x2": 108.001,
            "y2": 946.05,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 73.001,
            "y1": 967.05,
            "x2": 73.001,
            "y2": 983.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 987.001,
            "y1": 967.05,
            "x2": 987.001,
            "y2": 983.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 1040.55,
            "x2": 124.501,
            "y2": 983.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 952.001,
            "y1": 946.05,
            "x2": 973.001,
            "y2": 967.05,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 935.501,
            "y1": 1040.55,
            "x2": 935.501,
            "y2": 983.55,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 2030,
            "x2": 30,
            "y2": 2030,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 1977.5,
            "x2": 992.5,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1920.5,
            "x2": 124.5,
            "y2": 1920.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1920.5,
            "x2": 914.5,
            "y2": 1899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 914.5,
            "y1": 1899.5,
            "x2": 145.5,
            "y2": 1899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 1920.5,
            "x2": 145.5,
            "y2": 1899.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 1977.5,
            "x2": 1030,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1977.5,
            "x2": 67.5,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 2030,
            "x2": 30,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 2030,
            "x2": 1030,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 1920.5,
            "x2": 124.5,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1920.5,
            "x2": 935.5,
            "y2": 1977.5,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1977.5,
            "x2": 30.001,
            "y2": 989.05,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 67.501,
            "y1": 1977.5,
            "x2": 67.501,
            "y2": 983.55,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 983.55,
            "x2": 124.501,
            "y2": 1977.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 145.501,
            "y1": 1061.55,
            "x2": 145.501,
            "y2": 1899.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 983.55,
            "x2": 67.501,
            "y2": 983.55,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 1977.5,
            "x2": 30.001,
            "y2": 1977.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 1920.5,
            "x2": 145.501,
            "y2": 1899.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 989.05,
            "x2": 67.501,
            "y2": 989.05,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 989.05,
            "x2": 1030,
            "y2": 1977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 983.55,
            "x2": 992.5,
            "y2": 1977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 983.55,
            "x2": 935.5,
            "y2": 1977.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 914.5,
            "y1": 1061.55,
            "x2": 914.5,
            "y2": 1899.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 987,
            "y1": 983.55,
            "x2": 935.5,
            "y2": 983.55,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 914.5,
            "y1": 1061.55,
            "x2": 935.5,
            "y2": 1040.55,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 1977.5,
            "x2": 935.5,
            "y2": 1977.5,
            "role": "B92-10",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Tilt and Turn Bottom - Fixed Top\\\\VER_2_FIELD_TILT_TURN_BOTTOM_FIXED_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 65,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000.001,
          "height": 1999.999
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 949,
            "y2": 111,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 111,
            "x2": 1027,
            "y2": 33,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 33,
            "x2": 33,
            "y2": 33,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 30,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 87,
            "x2": 30,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 33,
            "x2": 1027,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 87,
            "x2": 1030,
            "y2": 87,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 33,
            "y2": 33,
            "role": "B92-4",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1022.499,
            "x2": 111,
            "y2": 110.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 32.999,
            "x2": 111,
            "y2": 110.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 86.999,
            "x2": 33,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1029.999,
            "x2": 30,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 32.999,
            "x2": 33,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 110.999,
            "x2": 949,
            "y2": 1022.499,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 86.999,
            "x2": 1027,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 32.999,
            "x2": 949,
            "y2": 110.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 32.999,
            "x2": 1027,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 86.999,
            "x2": 1030,
            "y2": 1029.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 1022.499,
            "x2": 1027,
            "y2": 86.999,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 987.999,
            "x2": 111.001,
            "y2": 987.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 640.512,
            "y1": 1072,
            "x2": 530.001,
            "y2": 1072,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 944.193,
            "y1": 1076.807,
            "x2": 115.808,
            "y2": 1076.807,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 148.501,
            "y1": 1109.499,
            "x2": 111.001,
            "y2": 1071.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 911.501,
            "y1": 1109.499,
            "x2": 949.001,
            "y2": 1071.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 987.999,
            "x2": 949.001,
            "y2": 1071.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1071.999,
            "x2": 111.001,
            "y2": 1071.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1071.999,
            "x2": 111.001,
            "y2": 987.999,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 148.501,
            "y1": 1109.499,
            "x2": 911.501,
            "y2": 1109.499,
            "role": "B92-21",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 2029.999,
            "x2": 30.001,
            "y2": 2029.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1933.999,
            "x2": 111.001,
            "y2": 1933.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 33.001,
            "y1": 2011.999,
            "x2": 111.001,
            "y2": 1933.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 2011.999,
            "x2": 33.001,
            "y2": 2011.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 2011.999,
            "x2": 949.001,
            "y2": 1933.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 148.501,
            "y1": 1896.499,
            "x2": 911.501,
            "y2": 1896.499,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1933.999,
            "x2": 148.501,
            "y2": 1896.499,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1933.999,
            "x2": 911.501,
            "y2": 1896.499,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 115.808,
            "y1": 1929.192,
            "x2": 944.193,
            "y2": 1929.192,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 1972.999,
            "x2": 1027.001,
            "y2": 1972.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1972.999,
            "x2": 30.001,
            "y2": 2029.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 1972.999,
            "x2": 1030.001,
            "y2": 2029.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1972.999,
            "x2": 33.001,
            "y2": 1972.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 33.001,
            "y1": 2011.999,
            "x2": 33.001,
            "y2": 1972.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 1972.999,
            "x2": 1027.001,
            "y2": 2011.999,
            "role": "B92-8",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1022.5,
            "x2": 33,
            "y2": 2012,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1934,
            "x2": 111,
            "y2": 1022.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1934,
            "x2": 148.5,
            "y2": 1896.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 1896.5,
            "x2": 148.5,
            "y2": 1109.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1072,
            "x2": 148.5,
            "y2": 1109.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 115.808,
            "y1": 1076.808,
            "x2": 115.808,
            "y2": 1929.193,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1973,
            "x2": 33,
            "y2": 1973,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1934,
            "x2": 33,
            "y2": 2012,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 1030,
            "y2": 1973,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 1934,
            "x2": 1027,
            "y2": 2012,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 1022.5,
            "x2": 1027,
            "y2": 2012,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 1934,
            "x2": 949,
            "y2": 1022.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 911.5,
            "y1": 1896.5,
            "x2": 949,
            "y2": 1934,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 911.5,
            "y1": 1896.5,
            "x2": 911.5,
            "y2": 1109.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 911.5,
            "y1": 1109.5,
            "x2": 949,
            "y2": 1072,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.193,
            "y1": 1929.192,
            "x2": 944.193,
            "y2": 1076.808,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1973,
            "x2": 1027,
            "y2": 1973,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 86.999,
            "x2": 32.919,
            "y2": 1022.499,
            "role": "B92-6",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-2-field-fixed-bottom-tilt-turn-top",
    "label": "2 Field Vertical Fixed Bottom / Tilt & Turn Top",
    "group": "2 Field Vertical",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Fixed Bottom - Tilt and Turn Top\\\\VER_2_FIELD_FIXED_BOTTOM_TILT_TURN_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 69,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000.001,
          "height": 2000
        },
        "lines": [
          {
            "x1": 30.001,
            "y1": 30,
            "x2": 1030.001,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 992.501,
            "y1": 82.5,
            "x2": 67.501,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 139.5,
            "x2": 935.501,
            "y2": 139.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 139.5,
            "x2": 145.501,
            "y2": 160.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 145.501,
            "y1": 160.5,
            "x2": 914.501,
            "y2": 160.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 935.501,
            "y1": 139.5,
            "x2": 914.501,
            "y2": 160.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 67.501,
            "y1": 82.5,
            "x2": 30.001,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 82.5,
            "x2": 992.501,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 30,
            "x2": 30.001,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 30,
            "x2": 1030.001,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 139.5,
            "x2": 124.501,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 935.501,
            "y1": 139.5,
            "x2": 935.501,
            "y2": 82.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1022.8,
            "x2": 30.001,
            "y2": 82.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 67.501,
            "y1": 1028.3,
            "x2": 67.501,
            "y2": 82.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 1028.3,
            "x2": 124.501,
            "y2": 82.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 145.501,
            "y1": 950.3,
            "x2": 145.501,
            "y2": 160.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 124.501,
            "y1": 971.3,
            "x2": 145.501,
            "y2": 950.3,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1022.8,
            "x2": 67.501,
            "y2": 1022.8,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 67.501,
            "y1": 82.5,
            "x2": 124.501,
            "y2": 82.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 67.501,
            "y1": 1028.3,
            "x2": 124.501,
            "y2": 1028.3,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 82.501,
            "x2": 1030,
            "y2": 1022.801,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 82.501,
            "x2": 992.5,
            "y2": 1028.301,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1028.301,
            "x2": 935.5,
            "y2": 82.501,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 971.301,
            "x2": 914.5,
            "y2": 950.301,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 914.5,
            "y1": 950.301,
            "x2": 914.5,
            "y2": 160.501,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 1022.801,
            "x2": 1030,
            "y2": 1022.801,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 139.501,
            "x2": 914.5,
            "y2": 160.501,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 82.501,
            "x2": 992.5,
            "y2": 82.501,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 82.501,
            "x2": 935.5,
            "y2": 82.501,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1028.301,
            "x2": 992.5,
            "y2": 1028.301,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1958,
            "x2": 30,
            "y2": 1059.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 1059.8,
            "x2": 73,
            "y2": 1958,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1059.8,
            "x2": 87,
            "y2": 1958,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1958,
            "x2": 108,
            "y2": 1937,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 1937,
            "x2": 108,
            "y2": 1080.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1059.8,
            "x2": 108,
            "y2": 1080.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1059.8,
            "x2": 30,
            "y2": 1059.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1958,
            "x2": 30,
            "y2": 1958,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1958,
            "x2": 1030,
            "y2": 1059.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 987,
            "y1": 1958,
            "x2": 987,
            "y2": 1059.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1059.8,
            "x2": 973,
            "y2": 1958,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1937,
            "x2": 952,
            "y2": 1080.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1059.8,
            "x2": 952,
            "y2": 1080.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1958,
            "x2": 952,
            "y2": 1937,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 973,
            "y1": 1059.8,
            "x2": 1030,
            "y2": 1059.8,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1958,
            "x2": 973,
            "y2": 1958,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 2030,
            "x2": 30,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 2000,
            "x2": 1030,
            "y2": 2000,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1958,
            "x2": 1030,
            "y2": 1958,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 952,
            "y1": 1937,
            "x2": 108,
            "y2": 1937,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1958,
            "x2": 30,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1958,
            "x2": 1030,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 1028.3,
            "x2": 935.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 971.3,
            "x2": 935.5,
            "y2": 971.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 950.3,
            "x2": 914.5,
            "y2": 950.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 87,
            "y1": 1059.8,
            "x2": 973,
            "y2": 1059.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 1080.8,
            "x2": 952,
            "y2": 1080.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 145.5,
            "y1": 950.3,
            "x2": 124.5,
            "y2": 971.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 124.5,
            "y1": 971.3,
            "x2": 124.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1059.8,
            "x2": 30,
            "y2": 1022.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1022.8,
            "x2": 67.5,
            "y2": 1022.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 1028.3,
            "x2": 124.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 67.5,
            "y1": 1022.8,
            "x2": 67.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 1022.8,
            "x2": 1030,
            "y2": 1022.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1022.8,
            "x2": 1030,
            "y2": 1059.8,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 1028.3,
            "x2": 992.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 992.5,
            "y1": 1022.8,
            "x2": 992.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 935.5,
            "y1": 971.3,
            "x2": 935.5,
            "y2": 1028.3,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 914.5,
            "y1": 950.3,
            "x2": 935.5,
            "y2": 971.3,
            "role": "B92-20",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\2 Field\\\\Ver - 2 Field Fixed Bottom - Tilt and Turn Top\\\\VER_2_FIELD_FIXED_BOTTOM_TILT_TURN_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 68,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 1000.001,
          "height": 2000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 949,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 111,
            "x2": 1027,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 33,
            "x2": 33,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 33,
            "y2": 33,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1027,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 111,
            "y2": 111,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 111,
            "x2": 944.7,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 944.7,
            "y2": 115.8,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 148.5,
            "x2": 912,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 944.7,
            "y1": 115.8,
            "x2": 912,
            "y2": 148.5,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 30,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 30,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 33,
            "x2": 1027,
            "y2": 87,
            "role": "B92-7",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 30,
            "y2": 87,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 1022.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1022.5,
            "x2": 111,
            "y2": 111,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 115.8,
            "x2": 115.8,
            "y2": 966.042,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 933.35,
            "x2": 115.8,
            "y2": 966.042,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 115.8,
            "y1": 966.042,
            "x2": 111,
            "y2": 970.853,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 148.5,
            "y1": 933.35,
            "x2": 148.5,
            "y2": 148.5,
            "role": "B92-9",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 87,
            "x2": 1030,
            "y2": 1030,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 33,
            "x2": 1027,
            "y2": 1022.5,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 1022.5,
            "x2": 949,
            "y2": 111,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.7,
            "y1": 115.8,
            "x2": 944.7,
            "y2": 966.043,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 970.853,
            "x2": 944.7,
            "y2": 966.043,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 944.7,
            "y1": 966.043,
            "x2": 912,
            "y2": 933.35,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 912,
            "y1": 148.5,
            "x2": 912,
            "y2": 933.35,
            "role": "B92-10",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 2012,
            "x2": 111,
            "y2": 1934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1973,
            "x2": 33,
            "y2": 1973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 1022.5,
            "x2": 111,
            "y2": 1934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1022.5,
            "x2": 33,
            "y2": 2012,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 1030,
            "x2": 30,
            "y2": 1973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 2012,
            "x2": 949,
            "y2": 1934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1973,
            "x2": 1027,
            "y2": 1973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 949,
            "y1": 1022.5,
            "x2": 949,
            "y2": 1934,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1027,
            "y1": 1022.5,
            "x2": 1027,
            "y2": 2012,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030,
            "y1": 1030,
            "x2": 1030,
            "y2": 1973,
            "role": "B92-6",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 2030,
            "x2": 30.001,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 33.001,
            "y1": 2012,
            "x2": 111.001,
            "y2": 1934,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1934,
            "x2": 949.001,
            "y2": 1934,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1934,
            "x2": 1027.001,
            "y2": 2012,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 2012,
            "x2": 33.001,
            "y2": 2012,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1030.001,
            "y1": 1973,
            "x2": 1030.001,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 30.001,
            "y1": 1973,
            "x2": 30.001,
            "y2": 2030,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 2012,
            "x2": 1027.001,
            "y2": 1973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 1027.001,
            "y1": 1973,
            "x2": 1030.001,
            "y2": 1973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 33.001,
            "y1": 2012,
            "x2": 33.001,
            "y2": 1973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 33.001,
            "y1": 1973,
            "x2": 30.001,
            "y2": 1973,
            "role": "B92-5",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 970.854,
            "x2": 111.001,
            "y2": 970.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 970.854,
            "x2": 111.001,
            "y2": 1029.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1029.854,
            "x2": 949.001,
            "y2": 1029.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1029.854,
            "x2": 949.001,
            "y2": 970.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 944.701,
            "y1": 966.043,
            "x2": 115.801,
            "y2": 966.043,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1035.95,
            "x2": 111.001,
            "y2": 1035.95,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1069.851,
            "x2": 111.001,
            "y2": 1069.851,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 912.001,
            "y1": 933.351,
            "x2": 148.501,
            "y2": 933.351,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 148.501,
            "y1": 933.351,
            "x2": 115.801,
            "y2": 966.043,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 115.801,
            "y1": 966.043,
            "x2": 111.001,
            "y2": 970.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1069.851,
            "x2": 111.001,
            "y2": 1035.95,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 111.001,
            "y1": 1035.95,
            "x2": 111.001,
            "y2": 1029.854,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 970.854,
            "x2": 944.701,
            "y2": 966.043,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 944.701,
            "y1": 966.043,
            "x2": 912.001,
            "y2": 933.351,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1069.851,
            "x2": 949.001,
            "y2": 1035.95,
            "role": "B92-20",
            "opening": false
          },
          {
            "x1": 949.001,
            "y1": 1035.95,
            "x2": 949.001,
            "y2": 1029.854,
            "role": "B92-20",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-3-field-fixed-fixed-fixed",
    "label": "3 Field Horizontal Fixed / Fixed / Fixed",
    "group": "3 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Fixed\\\\HOR_3_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 60,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 3000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 3030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 108,
            "x2": 3030,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 991,
            "y1": 129,
            "x2": 129,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 129,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1069,
            "y1": 129,
            "x2": 1991,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2069,
            "y1": 129,
            "x2": 2931,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 30,
            "x2": 3030,
            "y2": 108,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 108,
            "x2": 1069,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 108,
            "x2": 991,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2048,
            "y1": 108,
            "x2": 2069,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2012,
            "y1": 108,
            "x2": 1991,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 2952,
            "y1": 108,
            "x2": 2931,
            "y2": 129,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 952,
            "x2": 30,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1069.4,
            "y1": 931,
            "x2": 1991.4,
            "y2": 931,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2069.4,
            "y1": 931,
            "x2": 2931,
            "y2": 931,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2952,
            "y1": 952,
            "x2": 2931,
            "y2": 931,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 991.4,
            "y1": 931,
            "x2": 129,
            "y2": 931,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 129,
            "y1": 931,
            "x2": 108,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 952,
            "x2": 30,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 952,
            "x2": 3030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 990.337,
            "y1": 931,
            "x2": 1011.337,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1069.4,
            "y1": 931,
            "x2": 1048.4,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 1991.4,
            "y1": 931,
            "x2": 2012.4,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2069.4,
            "y1": 931,
            "x2": 2048.4,
            "y2": 952,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 952,
            "x2": 30,
            "y2": 108,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 952,
            "x2": 108,
            "y2": 108,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 129,
            "y1": 931,
            "x2": 129,
            "y2": 129,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 108,
            "x2": 108,
            "y2": 108,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 108,
            "x2": 129,
            "y2": 129,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 952,
            "x2": 108,
            "y2": 952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 108,
            "y1": 952,
            "x2": 129,
            "y2": 931,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 108,
            "x2": 3030,
            "y2": 952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2952,
            "y1": 108,
            "x2": 2952,
            "y2": 952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2931,
            "y1": 129,
            "x2": 2931,
            "y2": 931,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2952,
            "y1": 108,
            "x2": 2931,
            "y2": 129,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 952,
            "x2": 2952,
            "y2": 952,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2952,
            "y1": 952,
            "x2": 2931,
            "y2": 931,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 108,
            "x2": 2952,
            "y2": 108,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 108,
            "x2": 1048,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 108,
            "x2": 1012.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1048,
            "y1": 108,
            "x2": 1069,
            "y2": 129,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1069,
            "y1": 129,
            "x2": 1069,
            "y2": 931.4,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1069.4,
            "y1": 931,
            "x2": 1048.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 108,
            "x2": 991,
            "y2": 129,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 991,
            "y1": 129,
            "x2": 991.4,
            "y2": 931,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 991.4,
            "y1": 931,
            "x2": 1012.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012,
            "y1": 108,
            "x2": 1048,
            "y2": 108,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1012.4,
            "y1": 952,
            "x2": 1048,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2048,
            "y1": 108,
            "x2": 2048,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2012,
            "y1": 108,
            "x2": 2012.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2048,
            "y1": 108,
            "x2": 2069,
            "y2": 129,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2069,
            "y1": 129,
            "x2": 2069,
            "y2": 931.4,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2069.4,
            "y1": 931,
            "x2": 2048.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2012,
            "y1": 108,
            "x2": 1991,
            "y2": 129,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1991,
            "y1": 129,
            "x2": 1991.4,
            "y2": 931,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1991.4,
            "y1": 931,
            "x2": 2012.4,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2012,
            "y1": 108,
            "x2": 2048,
            "y2": 108,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2012.4,
            "y1": 952,
            "x2": 2048,
            "y2": 952,
            "role": "B92-11",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Fixed\\\\HOR_3_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 44,
        "bounds": {
          "x": 30,
          "y": 30,
          "width": 3000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 30,
            "y1": 30,
            "x2": 3030,
            "y2": 30,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 3027,
            "y2": 33,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 111,
            "x2": 2949,
            "y2": 111,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 87,
            "x2": 3027,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 111,
            "y2": 111,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 33,
            "x2": 2949,
            "y2": 111,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 30,
            "x2": 30,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 30,
            "x2": 3030,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 33,
            "x2": 3027,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 33,
            "y2": 87,
            "role": "B92-1",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 1030,
            "x2": 30,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 1012,
            "x2": 33,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 2949,
            "y1": 934,
            "x2": 111,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 973,
            "x2": 3027,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 1012,
            "x2": 2949,
            "y2": 934,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 33,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 973,
            "x2": 3030,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 1030,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 973,
            "x2": 33,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 973,
            "x2": 3027,
            "y2": 1012,
            "role": "B92-3",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 30,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 33,
            "y2": 33,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 111,
            "y1": 934,
            "x2": 111,
            "y2": 111,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 973,
            "x2": 33,
            "y2": 973,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 1012,
            "x2": 111,
            "y2": 934,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 30,
            "y1": 87,
            "x2": 33,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 33,
            "y1": 33,
            "x2": 111,
            "y2": 111,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 87,
            "x2": 3030,
            "y2": 973,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 33,
            "x2": 3027,
            "y2": 1012,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2949,
            "y1": 111,
            "x2": 2949,
            "y2": 934,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 973,
            "x2": 3027,
            "y2": 973,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 2949,
            "y1": 934,
            "x2": 3027,
            "y2": 1012,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3030,
            "y1": 87,
            "x2": 3027,
            "y2": 87,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 3027,
            "y1": 33,
            "x2": 2949,
            "y2": 111,
            "role": "B92-2",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 988,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1072,
            "y1": 111,
            "x2": 1072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 934,
            "x2": 1072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 988,
            "y1": 111,
            "x2": 1072,
            "y2": 111,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1988,
            "y1": 111,
            "x2": 1988,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 2072,
            "y1": 111,
            "x2": 2072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1988,
            "y1": 934,
            "x2": 2072,
            "y2": 934,
            "role": "B92-11",
            "opening": false
          },
          {
            "x1": 1988,
            "y1": 111,
            "x2": 2072,
            "y2": 111,
            "role": "B92-11",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-3-field-tilt-turn-left-fixed-tilt-turn-right",
    "label": "3 Field Horizontal Tilt & Turn Left / Fixed / Tilt & Turn Right",
    "group": "3 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Left - Fixed - Tilt Turn Right\\\\HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 120,
        "bounds": {
          "x": 70,
          "y": 230,
          "width": 3000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 1070,
            "y1": 230,
            "x2": 70,
            "y2": 230,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 107.931,
            "y1": 287,
            "x2": 70,
            "y2": 287,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 267.5,
            "x2": 107.5,
            "y2": 267.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 324.5,
            "x2": 164.5,
            "y2": 324.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 995,
            "y1": 345.5,
            "x2": 185.5,
            "y2": 345.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 324.5,
            "x2": 995,
            "y2": 345.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 70,
            "y2": 230,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 324.5,
            "x2": 1016,
            "y2": 267.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 185.5,
            "y1": 345.5,
            "x2": 164.5,
            "y2": 324.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 107.5,
            "y1": 267.5,
            "x2": 107.931,
            "y2": 287,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 324.5,
            "x2": 164.5,
            "y2": 267.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 287,
            "x2": 3070,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 230,
            "x2": 3070,
            "y2": 230,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 267.5,
            "x2": 2068.5,
            "y2": 267.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 324.5,
            "x2": 2125.5,
            "y2": 324.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2954.5,
            "y1": 345.5,
            "x2": 2146.5,
            "y2": 345.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 324.5,
            "x2": 2146.5,
            "y2": 345.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 324.5,
            "x2": 2954.5,
            "y2": 345.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 324.5,
            "x2": 2975.5,
            "y2": 267.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 324.5,
            "x2": 2125.5,
            "y2": 267.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 230,
            "x2": 3070,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 267.5,
            "x2": 3032.5,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1230,
            "x2": 1073,
            "y2": 1230,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1177.5,
            "x2": 164.5,
            "y2": 1177.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 1120.5,
            "x2": 164.5,
            "y2": 1120.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 995,
            "y1": 1099.5,
            "x2": 185.5,
            "y2": 1099.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 1120.5,
            "x2": 995,
            "y2": 1099.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1120.5,
            "x2": 185.5,
            "y2": 1099.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1120.5,
            "x2": 164.5,
            "y2": 1177.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1172,
            "x2": 70,
            "y2": 1230,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1172,
            "x2": 107.5,
            "y2": 1172,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1177.5,
            "x2": 107.5,
            "y2": 1177.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 107.5,
            "y1": 1172,
            "x2": 107.5,
            "y2": 1177.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 1120.5,
            "x2": 1016,
            "y2": 1177.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 1230,
            "x2": 3070,
            "y2": 1230,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 1177.5,
            "x2": 2068.5,
            "y2": 1177.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1120.5,
            "x2": 2125.5,
            "y2": 1120.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2954.5,
            "y1": 1099.5,
            "x2": 2146.5,
            "y2": 1099.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 1120.5,
            "x2": 2146.5,
            "y2": 1099.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1120.5,
            "x2": 2954.5,
            "y2": 1099.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3032.5,
            "y2": 1173,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1120.5,
            "x2": 2975.5,
            "y2": 1177.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 1177.5,
            "x2": 3032.5,
            "y2": 1173,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3070,
            "y2": 1230,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 1120.5,
            "x2": 2125.5,
            "y2": 1177.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 230,
            "x2": 2070,
            "y2": 230,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 273,
            "x2": 2068.5,
            "y2": 273,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 287,
            "x2": 2068.5,
            "y2": 287,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1110.5,
            "y1": 308,
            "x2": 2031,
            "y2": 308,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1110.5,
            "y1": 308,
            "x2": 1089.5,
            "y2": 287,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 273,
            "x2": 1073,
            "y2": 287,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 287,
            "x2": 2031,
            "y2": 308,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 2068.5,
            "y1": 273,
            "x2": 2068.5,
            "y2": 287,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1230,
            "x2": 2070,
            "y2": 1230,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1172,
            "x2": 2068.5,
            "y2": 1172,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1121,
            "x2": 2068.5,
            "y2": 1121,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 1121,
            "x2": 2031,
            "y2": 1100,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 2031,
            "y1": 1100,
            "x2": 1110.5,
            "y2": 1100,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1089.5,
            "y1": 1121,
            "x2": 1110.5,
            "y2": 1100,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 2068.5,
            "y1": 1121,
            "x2": 2068.5,
            "y2": 1172,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1121,
            "x2": 1073,
            "y2": 1172,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 70,
            "y2": 1172,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 107.5,
            "y1": 1172,
            "x2": 107.5,
            "y2": 267.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1172,
            "x2": 107.5,
            "y2": 1172,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1177.5,
            "x2": 164.5,
            "y2": 324.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 185.5,
            "y1": 1099.5,
            "x2": 185.5,
            "y2": 345.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 324.5,
            "x2": 185.5,
            "y2": 345.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1120.5,
            "x2": 185.5,
            "y2": 1099.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 324.5,
            "x2": 164.5,
            "y2": 267.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 1177.5,
            "x2": 107.5,
            "y2": 1177.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 107.5,
            "y2": 287,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 164.5,
            "y1": 267.5,
            "x2": 107.5,
            "y2": 267.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 107.5,
            "y1": 1172,
            "x2": 107.5,
            "y2": 1177.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3070,
            "y2": 287,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 1177.5,
            "x2": 3032.5,
            "y2": 267.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1125,
            "x2": 2975.5,
            "y2": 329,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2954.5,
            "y1": 1104,
            "x2": 2954.5,
            "y2": 350,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 329,
            "x2": 2954.5,
            "y2": 350,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 287,
            "x2": 3032.5,
            "y2": 287,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 267.5,
            "x2": 2975.5,
            "y2": 267.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 267.5,
            "x2": 2975.5,
            "y2": 329,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 1177.5,
            "x2": 2975.5,
            "y2": 1177.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1177.5,
            "x2": 2975.5,
            "y2": 1125,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1172,
            "x2": 3032.5,
            "y2": 1172,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 1177.5,
            "x2": 3032.5,
            "y2": 1173,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3032.5,
            "y1": 287.709,
            "x2": 3032.5,
            "y2": 267.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 267.5,
            "x2": 3032.5,
            "y2": 267.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2975.5,
            "y1": 1125,
            "x2": 2954.5,
            "y2": 1104,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1177.5,
            "x2": 1073,
            "y2": 287,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 1177.5,
            "x2": 1016,
            "y2": 324.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 995,
            "y1": 1099.5,
            "x2": 995,
            "y2": 345.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1089.5,
            "y1": 1121,
            "x2": 1089.5,
            "y2": 287,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1089.5,
            "y1": 287,
            "x2": 1110.5,
            "y2": 308,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1110.5,
            "y1": 308,
            "x2": 1110.5,
            "y2": 1100,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 995,
            "y1": 345.5,
            "x2": 1016,
            "y2": 324.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1089.5,
            "y1": 287,
            "x2": 1073,
            "y2": 287,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1177.5,
            "x2": 1016,
            "y2": 1177,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 1120.5,
            "x2": 995,
            "y2": 1099.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1016,
            "y1": 324.5,
            "x2": 1016,
            "y2": 267.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 267.5,
            "x2": 1016,
            "y2": 267.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 287,
            "x2": 1073,
            "y2": 267.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1073,
            "y1": 1121,
            "x2": 1089.5,
            "y2": 1121,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1089.5,
            "y1": 1121,
            "x2": 1110.5,
            "y2": 1100,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2068.5,
            "y1": 1121,
            "x2": 2068.5,
            "y2": 267.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 1120.5,
            "x2": 2125.5,
            "y2": 324.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2146.5,
            "y1": 1099.5,
            "x2": 2146.5,
            "y2": 345.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 1121,
            "x2": 2052,
            "y2": 287,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 287,
            "x2": 2031,
            "y2": 308,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2031,
            "y1": 308,
            "x2": 2031,
            "y2": 1100,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2070.5,
            "y1": 1172,
            "x2": 2070.5,
            "y2": 1172,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 287,
            "x2": 2068.5,
            "y2": 287,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2146.5,
            "y1": 345.5,
            "x2": 2125.5,
            "y2": 324.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 324.5,
            "x2": 2125.5,
            "y2": 267.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 267.5,
            "x2": 2068.5,
            "y2": 267.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2068.5,
            "y1": 1121,
            "x2": 2068.5,
            "y2": 1177.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 1121,
            "x2": 2031,
            "y2": 1100,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2052,
            "y1": 1121,
            "x2": 2068.5,
            "y2": 1121,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2068.5,
            "y1": 1177.5,
            "x2": 2125.5,
            "y2": 1177.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 1177.5,
            "x2": 2125.5,
            "y2": 1120.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2125.5,
            "y1": 1120.5,
            "x2": 2146.5,
            "y2": 1099.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Left - Fixed - Tilt Turn Right\\\\HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": null,
        "segmentCount": 106,
        "bounds": {
          "x": 70,
          "y": 230,
          "width": 3000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 1070,
            "y1": 230,
            "x2": 70,
            "y2": 230,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 233,
            "x2": 73,
            "y2": 233,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 311,
            "x2": 151,
            "y2": 311,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 315.8,
            "x2": 155.8,
            "y2": 315.8,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 311,
            "x2": 73,
            "y2": 233,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 992,
            "y1": 348.5,
            "x2": 188.5,
            "y2": 348.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 311,
            "x2": 155.8,
            "y2": 315.8,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 315.8,
            "x2": 188.5,
            "y2": 348.5,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 73,
            "y2": 287,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 230,
            "x2": 70,
            "y2": 287,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 287,
            "x2": 73,
            "y2": 233,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 992,
            "y1": 348.5,
            "x2": 1024.693,
            "y2": 315.8,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 315.8,
            "x2": 1029.5,
            "y2": 311,
            "role": "B92-7 top left T&amp;T head",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 230,
            "x2": 3070,
            "y2": 230,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 233,
            "x2": 3067,
            "y2": 233,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2112,
            "y1": 311,
            "x2": 2989,
            "y2": 311,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 233,
            "x2": 2989,
            "y2": 311,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 315.808,
            "x2": 2116.808,
            "y2": 315.808,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2951.5,
            "y1": 348.5,
            "x2": 2149.5,
            "y2": 348.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2989,
            "y1": 311,
            "x2": 2984.192,
            "y2": 315.808,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 315.808,
            "x2": 2951.5,
            "y2": 348.5,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2149.5,
            "y1": 348.5,
            "x2": 2116.808,
            "y2": 315.808,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 2116.808,
            "y1": 315.808,
            "x2": 2112,
            "y2": 311,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 287,
            "x2": 3067,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 230,
            "x2": 3070,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 233,
            "x2": 3067,
            "y2": 287,
            "role": "B92-7 top right T&amp;T head",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1230,
            "x2": 1070,
            "y2": 1230,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 1212,
            "x2": 1070,
            "y2": 1212,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 1134,
            "x2": 1029.5,
            "y2": 1134,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 1129.2,
            "x2": 1024.693,
            "y2": 1129.2,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 1212,
            "x2": 151,
            "y2": 1134,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 992,
            "y1": 1096.5,
            "x2": 188.5,
            "y2": 1096.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 1129.2,
            "x2": 188.5,
            "y2": 1096.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1173,
            "x2": 73,
            "y2": 1173,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1173,
            "x2": 70,
            "y2": 1230,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 1173,
            "x2": 73,
            "y2": 1212,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 1134,
            "x2": 1024.693,
            "y2": 1129.2,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 1129.2,
            "x2": 992,
            "y2": 1096.5,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 1129.2,
            "x2": 151,
            "y2": 1134,
            "role": "B92-8 bottom left T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 1230,
            "x2": 3070,
            "y2": 1230,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2070,
            "y1": 1212,
            "x2": 3067,
            "y2": 1212,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2112,
            "y1": 1134,
            "x2": 2989,
            "y2": 1134,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 1129.192,
            "x2": 2116.808,
            "y2": 1129.192,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2989,
            "y1": 1134,
            "x2": 2984.192,
            "y2": 1129.192,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2951.5,
            "y1": 1096.5,
            "x2": 2149.5,
            "y2": 1096.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 1129.192,
            "x2": 2951.5,
            "y2": 1096.5,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3067,
            "y2": 1173,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3070,
            "y2": 1230,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 1173,
            "x2": 3067,
            "y2": 1212,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 1212,
            "x2": 2989,
            "y2": 1134,
            "role": "B92-8 bottom right T&amp;T sill",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 230,
            "x2": 2070,
            "y2": 230,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 233,
            "x2": 2070,
            "y2": 233,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1110.5,
            "y1": 311,
            "x2": 2028,
            "y2": 311,
            "role": "B92-4 fixed middle head",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 1230,
            "x2": 2070,
            "y2": 1230,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1070,
            "y1": 1212,
            "x2": 2070,
            "y2": 1212,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1113.5,
            "y1": 1134,
            "x2": 2028,
            "y2": 1134,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1113.483,
            "y1": 1129.2,
            "x2": 2028,
            "y2": 1129.2,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1113.483,
            "y1": 1097,
            "x2": 2028,
            "y2": 1097,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 1113.5,
            "y1": 1134,
            "x2": 1113.483,
            "y2": 1097,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 2028,
            "y1": 1097,
            "x2": 2028,
            "y2": 1134,
            "role": "B92-5 fixed middle sill",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 70,
            "y2": 1173,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 73,
            "y1": 233,
            "x2": 73,
            "y2": 1212,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 311,
            "x2": 151,
            "y2": 1134,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 315.8,
            "x2": 155.8,
            "y2": 1129.2,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 188.5,
            "y1": 348.5,
            "x2": 188.5,
            "y2": 1096.5,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 188.5,
            "y1": 348.5,
            "x2": 155.8,
            "y2": 315.8,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 315.8,
            "x2": 151,
            "y2": 311,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 311,
            "x2": 73,
            "y2": 233,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 287,
            "x2": 73,
            "y2": 287,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 70,
            "y1": 1173,
            "x2": 73,
            "y2": 1173,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 155.8,
            "y1": 1129.2,
            "x2": 151,
            "y2": 1134,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 151,
            "y1": 1134,
            "x2": 73,
            "y2": 1212,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 188.5,
            "y1": 1096.5,
            "x2": 155.8,
            "y2": 1129.2,
            "role": "B92-10 left outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3070,
            "y2": 287,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 233,
            "x2": 3067,
            "y2": 1212,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2989,
            "y1": 311,
            "x2": 2989,
            "y2": 1134,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 1129.192,
            "x2": 2984.192,
            "y2": 315.808,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2951.5,
            "y1": 1096.5,
            "x2": 2951.5,
            "y2": 348.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 1173,
            "x2": 3067,
            "y2": 1173,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 1212,
            "x2": 2989,
            "y2": 1134,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2989,
            "y1": 1134,
            "x2": 2984.192,
            "y2": 1129.192,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 1129.192,
            "x2": 2951.5,
            "y2": 1096.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3070,
            "y1": 287,
            "x2": 3067,
            "y2": 287,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 3067,
            "y1": 233,
            "x2": 2989,
            "y2": 311,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2989,
            "y1": 311,
            "x2": 2984.192,
            "y2": 315.808,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 2984.192,
            "y1": 315.808,
            "x2": 2951.5,
            "y2": 348.5,
            "role": "B92-10 right outer T&amp;T side",
            "opening": false
          },
          {
            "x1": 992,
            "y1": 1096.5,
            "x2": 992,
            "y2": 348.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 1129.2,
            "x2": 1024.693,
            "y2": 315.8,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 315.8,
            "x2": 992,
            "y2": 348.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 1134,
            "x2": 1029.5,
            "y2": 311,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1113.5,
            "y1": 1134,
            "x2": 1110.5,
            "y2": 311,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 311,
            "x2": 1110.5,
            "y2": 311,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 1134,
            "x2": 1024.693,
            "y2": 1129.2,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 1129.2,
            "x2": 992,
            "y2": 1096.5,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1029.5,
            "y1": 1134,
            "x2": 1113.5,
            "y2": 1134,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 1024.693,
            "y1": 315.8,
            "x2": 1029.5,
            "y2": 311,
            "role": "B92-12 left static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2149.5,
            "y1": 1096.5,
            "x2": 2149.5,
            "y2": 348.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2116.808,
            "y1": 1129.192,
            "x2": 2116.808,
            "y2": 315.808,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2112,
            "y1": 1134,
            "x2": 2112,
            "y2": 311,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2028,
            "y1": 1134,
            "x2": 2028,
            "y2": 311,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2028,
            "y1": 311,
            "x2": 2112,
            "y2": 311,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2028,
            "y1": 1134,
            "x2": 2112,
            "y2": 1134,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2112,
            "y1": 1134,
            "x2": 2116.808,
            "y2": 1129.192,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2116.808,
            "y1": 1129.192,
            "x2": 2149.5,
            "y2": 1096.5,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2149.5,
            "y1": 348.5,
            "x2": 2116.808,
            "y2": 315.808,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          },
          {
            "x1": 2116.808,
            "y1": 315.808,
            "x2": 2112,
            "y2": 311,
            "role": "B92-12 right static fixed/T&amp;T mullion",
            "opening": false
          }
        ]
      }
    }
  },
  {
    "id": "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference",
    "label": "3 Field Horizontal Tilt & Turn Right / Fixed / Tilt & Turn Left Equal-Field Reference",
    "group": "3 Field Horizontal",
    "views": {
      "internal": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left\\\\B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left\\\\B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf",
        "segmentCount": 106,
        "bounds": {
          "x": 1903.91753,
          "y": 1385.465693,
          "width": 3000,
          "height": 1000
        },
        "lines": [
          {
            "x1": 1903.91753,
            "y1": 2385.465693,
            "x2": 2903.917530000001,
            "y2": 2385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 2332.965693,
            "x2": 1941.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 2327.465693,
            "x2": 1941.41753,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2275.965693,
            "x2": 1998.41753,
            "y2": 2275.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2828.91753,
            "y1": 2254.965693,
            "x2": 2019.41753,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 2275.965693,
            "x2": 2019.41753,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2275.965693,
            "x2": 2828.91753,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 2327.465693,
            "x2": 1903.91753,
            "y2": 2385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1941.41753,
            "y1": 2327.465693,
            "x2": 1941.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 2275.965693,
            "x2": 1998.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2275.965693,
            "x2": 2849.91753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3903.91753,
            "y1": 2385.465693,
            "x2": 4903.91753,
            "y2": 2385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 2332.965693,
            "x2": 3924.41739,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 2275.965693,
            "x2": 3981.41739,
            "y2": 2275.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4788.417529999999,
            "y1": 2254.965693,
            "x2": 4002.41739,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 2275.965693,
            "x2": 4788.417529999999,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 2328.465693,
            "x2": 4903.91753,
            "y2": 2385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 2328.465693,
            "x2": 4866.417529999999,
            "y2": 2328.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 2328.465693,
            "x2": 4866.417529999999,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 2275.965693,
            "x2": 4809.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4002.41739,
            "y1": 2254.965693,
            "x2": 3981.41739,
            "y2": 2275.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 2275.965693,
            "x2": 3981.41739,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2903.917530000001,
            "y1": 2385.465693,
            "x2": 3903.91753,
            "y2": 2385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 2327.465693,
            "x2": 3924.41739,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 2276.465693,
            "x2": 3924.41739,
            "y2": 2276.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 2276.465693,
            "x2": 3864.91739,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 2276.465693,
            "x2": 2966.417530000001,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2966.417530000001,
            "y1": 2255.465693,
            "x2": 3864.91739,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 2276.465693,
            "x2": 2906.91753,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3924.41739,
            "y1": 2276.465693,
            "x2": 3924.41739,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 1442.465693,
            "x2": 1903.91753,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1941.41753,
            "y1": 2332.965693,
            "x2": 1941.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 2332.965693,
            "x2": 1998.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2019.41753,
            "y1": 2254.965693,
            "x2": 2019.41753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 2332.965693,
            "x2": 1941.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 2327.465693,
            "x2": 1941.41753,
            "y2": 2327.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 2275.965693,
            "x2": 2019.41753,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 1442.465693,
            "x2": 1941.41753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1941.41753,
            "y1": 1422.965693,
            "x2": 1998.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 1479.965693,
            "x2": 2019.41753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 2328.465693,
            "x2": 4903.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 2332.965693,
            "x2": 4866.417529999999,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 2332.965693,
            "x2": 4809.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4788.417529999999,
            "y1": 2254.965693,
            "x2": 4788.417529999999,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 2328.465693,
            "x2": 4866.417529999999,
            "y2": 2328.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 1479.965693,
            "x2": 4788.417529999999,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 1422.965693,
            "x2": 4866.417529999999,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 1442.465693,
            "x2": 4866.417529999999,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 2332.965693,
            "x2": 4809.41753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 2275.965693,
            "x2": 4788.417529999999,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 2332.965693,
            "x2": 2906.91753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2332.965693,
            "x2": 2849.91753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2828.91753,
            "y1": 2254.965693,
            "x2": 2828.91753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 2276.465693,
            "x2": 2945.41753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2966.417530000001,
            "y1": 1463.465693,
            "x2": 2966.417530000001,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2332.965693,
            "x2": 2906.91753,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 1422.965693,
            "x2": 2906.91753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2966.417530000001,
            "y1": 1463.465693,
            "x2": 2945.41753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 1442.465693,
            "x2": 2906.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 1479.965693,
            "x2": 2828.91753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 2275.965693,
            "x2": 2828.91753,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 2276.465693,
            "x2": 2906.91753,
            "y2": 2276.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 2276.465693,
            "x2": 2966.417530000001,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3924.41739,
            "y1": 2332.965693,
            "x2": 3924.41739,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 2332.965693,
            "x2": 3981.41739,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4002.41739,
            "y1": 2254.965693,
            "x2": 4002.41739,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 2276.465693,
            "x2": 3885.91739,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3864.91739,
            "y1": 1463.465693,
            "x2": 3864.91739,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 2332.965693,
            "x2": 3924.41739,
            "y2": 2332.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 1422.965693,
            "x2": 3924.41739,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3864.91739,
            "y1": 1463.465693,
            "x2": 3885.91739,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 1442.465693,
            "x2": 3924.41739,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 1479.965693,
            "x2": 4002.41739,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 2275.965693,
            "x2": 4002.41739,
            "y2": 2254.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 2276.465693,
            "x2": 3924.41739,
            "y2": 2276.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 2276.465693,
            "x2": 3864.91739,
            "y2": 2255.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2903.917530000001,
            "y1": 1385.465693,
            "x2": 1903.91753,
            "y2": 1385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1941.848681,
            "y1": 1442.465693,
            "x2": 1903.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 1422.965693,
            "x2": 1941.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 1479.965693,
            "x2": 1998.41753,
            "y2": 1479.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2828.91753,
            "y1": 1500.965693,
            "x2": 2019.41753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 1479.965693,
            "x2": 2019.41753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 1479.965693,
            "x2": 2828.91753,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1903.91753,
            "y1": 1385.465693,
            "x2": 1903.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1941.41753,
            "y1": 1422.965693,
            "x2": 1941.41753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1998.41753,
            "y1": 1479.965693,
            "x2": 1998.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2849.91753,
            "y1": 1479.965693,
            "x2": 2849.91753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 1442.465693,
            "x2": 4903.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3903.91753,
            "y1": 1385.465693,
            "x2": 4903.91753,
            "y2": 1385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 1422.965693,
            "x2": 3924.41739,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 1479.965693,
            "x2": 3981.41739,
            "y2": 1479.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4788.417529999999,
            "y1": 1500.965693,
            "x2": 4002.41739,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 1479.965693,
            "x2": 4788.417529999999,
            "y2": 1500.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4903.91753,
            "y1": 1442.465693,
            "x2": 4903.91753,
            "y2": 1385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4866.417529999999,
            "y1": 1442.465693,
            "x2": 4866.417529999999,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4809.41753,
            "y1": 1479.965693,
            "x2": 4809.41753,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4002.41739,
            "y1": 1500.965693,
            "x2": 3981.41739,
            "y2": 1479.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3981.41739,
            "y1": 1479.965693,
            "x2": 3981.41739,
            "y2": 1422.965693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2903.917530000001,
            "y1": 1385.465693,
            "x2": 3903.91753,
            "y2": 1385.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 1428.465693,
            "x2": 3924.41739,
            "y2": 1428.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 1442.465693,
            "x2": 3924.41739,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2966.417530000001,
            "y1": 1463.465693,
            "x2": 3864.91739,
            "y2": 1463.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2945.41753,
            "y1": 1442.465693,
            "x2": 2966.417530000001,
            "y2": 1463.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3885.91739,
            "y1": 1442.465693,
            "x2": 3864.91739,
            "y2": 1463.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2906.91753,
            "y1": 1428.465693,
            "x2": 2906.91753,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3924.41739,
            "y1": 1428.465693,
            "x2": 3924.41739,
            "y2": 1442.465693,
            "role": "PILOT_PROOF_LINES",
            "opening": false
          }
        ]
      },
      "external": {
        "sourceFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left\\\\B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
        "sourceDxfFile": "_project\\\\Test\\\\Europa 92 Alu Clad\\\\3 Field\\\\Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left\\\\B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf",
        "segmentCount": 82,
        "bounds": {
          "x": 1059.824182,
          "y": 1084.284332,
          "width": 2999.999999999999,
          "height": 1000.0000000000011
        },
        "lines": [
          {
            "x1": 1062.824182,
            "y1": 1087.2843320000009,
            "x2": 4056.824181999999,
            "y2": 1087.2843320000009,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4059.824181999999,
            "y1": 1141.284332000001,
            "x2": 4059.824181999999,
            "y2": 2027.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4056.824181999999,
            "y1": 1087.2843320000009,
            "x2": 4056.824181999999,
            "y2": 2066.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3978.824182,
            "y1": 1165.284332000001,
            "x2": 3978.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2059.824182,
            "y1": 2066.284332000001,
            "x2": 1062.824182,
            "y2": 2066.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1988.284332000001,
            "x2": 1140.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 2027.284332000001,
            "x2": 1059.824182,
            "y2": 1141.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1062.824182,
            "y1": 2066.284332000001,
            "x2": 1062.824182,
            "y2": 1087.2843320000009,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1140.824182,
            "y1": 1988.284332000001,
            "x2": 1140.824182,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 2027.284332000001,
            "x2": 1062.824182,
            "y2": 2027.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 2027.284332000001,
            "x2": 1059.824182,
            "y2": 2084.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4059.824181999999,
            "y1": 2027.284332000001,
            "x2": 4056.824181999999,
            "y2": 2027.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4059.824181999999,
            "y1": 2027.284332000001,
            "x2": 4059.824181999999,
            "y2": 2084.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4059.824181999999,
            "y1": 1141.284332000001,
            "x2": 4056.824181999999,
            "y2": 1141.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4059.824181999999,
            "y1": 1084.284332,
            "x2": 4059.824181999999,
            "y2": 1141.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 1141.284332000001,
            "x2": 1062.824182,
            "y2": 1141.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 1141.284332000001,
            "x2": 1059.824182,
            "y2": 1084.284332,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3006.827224,
            "y1": 1165.284332000001,
            "x2": 3006.827224,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3112.82113,
            "y1": 1165.284332000001,
            "x2": 3112.82113,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3117.654231,
            "y1": 1170.084332000001,
            "x2": 3117.654231,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3150.327868,
            "y1": 1202.784332000001,
            "x2": 3150.327868,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2112.824182,
            "y1": 1165.284332000001,
            "x2": 2112.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1970.041086,
            "y1": 1202.7919740000011,
            "x2": 1970.041086,
            "y2": 1955.591974000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4056.824181999999,
            "y1": 2066.284332000001,
            "x2": 3978.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 4056.824181999999,
            "y1": 1087.2843320000009,
            "x2": 3978.824182,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1062.824182,
            "y1": 1087.2843320000009,
            "x2": 1140.824182,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1140.824182,
            "y1": 1988.284332000001,
            "x2": 1062.824182,
            "y2": 2066.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2002.114723,
            "y1": 1170.091974000001,
            "x2": 1145.624182,
            "y2": 1170.091974000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1140.824182,
            "y1": 1165.284332000001,
            "x2": 1145.624182,
            "y2": 1170.091974000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1145.624182,
            "y1": 1170.091974000001,
            "x2": 1145.624182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1178.324182,
            "y1": 1202.7919740000011,
            "x2": 1970.041086,
            "y2": 1202.7919740000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1145.624182,
            "y1": 1170.091974000001,
            "x2": 1178.324182,
            "y2": 1202.7919740000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1178.324182,
            "y1": 1202.7919740000011,
            "x2": 1178.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2002.114723,
            "y1": 1170.091974000001,
            "x2": 1970.041086,
            "y2": 1202.7919740000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1165.284332000001,
            "x2": 2002.114723,
            "y2": 1170.091974000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1165.284332000001,
            "x2": 2006.830276,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2002.114723,
            "y1": 1170.091974000001,
            "x2": 2002.030276000001,
            "y2": 1988.2919740000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2002.030772,
            "y1": 1983.4843320000011,
            "x2": 1145.624182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1972.395815,
            "y1": 1950.784332000001,
            "x2": 1178.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1988.284332000001,
            "x2": 2002.030276000001,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2002.030276000001,
            "y1": 1983.4843320000011,
            "x2": 1970.041086,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1140.824182,
            "y1": 1988.284332000001,
            "x2": 1145.624182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1145.624182,
            "y1": 1983.4843320000011,
            "x2": 1178.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2112.824182,
            "y1": 1950.784332000001,
            "x2": 3006.827224,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3112.82113,
            "y1": 1988.284332000001,
            "x2": 3117.654231,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3117.654231,
            "y1": 1983.4843320000011,
            "x2": 3974.024182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3117.654231,
            "y1": 1983.4843320000011,
            "x2": 3150.327868,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3150.327868,
            "y1": 1950.784332000001,
            "x2": 3941.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3117.654231,
            "y1": 1170.084332000001,
            "x2": 3974.024182,
            "y2": 1170.084332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3117.654231,
            "y1": 1170.084332000001,
            "x2": 3150.327868,
            "y2": 1202.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3150.327868,
            "y1": 1202.784332000001,
            "x2": 3941.324182,
            "y2": 1202.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3978.824182,
            "y1": 1165.284332000001,
            "x2": 3974.024182,
            "y2": 1170.084332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3974.024182,
            "y1": 1170.084332000001,
            "x2": 3974.024182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3974.024182,
            "y1": 1170.084332000001,
            "x2": 3941.324182,
            "y2": 1202.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3941.324182,
            "y1": 1202.784332000001,
            "x2": 3941.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3941.324182,
            "y1": 1950.784332000001,
            "x2": 3974.024182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3978.824182,
            "y1": 1988.284332000001,
            "x2": 3974.024182,
            "y2": 1983.4843320000011,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 2084.284332000001,
            "x2": 2059.824182,
            "y2": 2084.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2059.824182,
            "y1": 2084.284332000001,
            "x2": 3059.824182,
            "y2": 2084.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3059.824182,
            "y1": 2084.284332000001,
            "x2": 4059.824181999999,
            "y2": 2084.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2059.824182,
            "y1": 2066.284332000001,
            "x2": 3059.824182,
            "y2": 2066.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3059.824182,
            "y1": 2066.284332000001,
            "x2": 4056.824181999999,
            "y2": 2066.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1059.824182,
            "y1": 1084.284332,
            "x2": 2059.824182,
            "y2": 1084.284332,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2059.824182,
            "y1": 1084.284332,
            "x2": 3059.824182,
            "y2": 1084.284332,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3059.824182,
            "y1": 1084.284332,
            "x2": 4059.824181999999,
            "y2": 1084.284332,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1165.284332000001,
            "x2": 2112.824182,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2112.824182,
            "y1": 1165.284332000001,
            "x2": 3006.827224,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3006.827224,
            "y1": 1165.284332000001,
            "x2": 3112.82113,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3112.82113,
            "y1": 1165.284332000001,
            "x2": 3978.824182,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2006.830276,
            "y1": 1988.284332000001,
            "x2": 2112.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 2112.824182,
            "y1": 1988.284332000001,
            "x2": 3006.827224,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3006.827224,
            "y1": 1988.284332000001,
            "x2": 3112.82113,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3112.82113,
            "y1": 1988.284332000001,
            "x2": 3978.824182,
            "y2": 1988.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1970.041086,
            "y1": 1202.7919740000011,
            "x2": 1178.324182,
            "y2": 1573.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1178.324182,
            "y1": 1573.784332000001,
            "x2": 1972.395815,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1972.395815,
            "y1": 1950.784332000001,
            "x2": 1582.324252,
            "y2": 1196.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1582.324252,
            "y1": 1196.784332000001,
            "x2": 1178.324182,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3150.327868,
            "y1": 1202.784332000001,
            "x2": 3941.324182,
            "y2": 1576.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3941.324182,
            "y1": 1576.784332000001,
            "x2": 3150.327868,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3150.327868,
            "y1": 1950.784332000001,
            "x2": 3555.077868,
            "y2": 1196.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 3555.077868,
            "y1": 1196.784332000001,
            "x2": 3953.828147999999,
            "y2": 1950.784332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          },
          {
            "x1": 1140.824182,
            "y1": 1165.284332000001,
            "x2": 2006.830276,
            "y2": 1165.284332000001,
            "role": "EXT_SEM_PROOF_LINES",
            "opening": false
          }
        ]
      }
    }
  }
] as const satisfies readonly B92ProfileSectionProofGeometryFamily[];
