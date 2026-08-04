import { B92_RAL_CLASSIC_BY_CODE } from "../admin/windowTypes/b92RalClassicColours";

export type TeknosLacquerOption = {
  id: string;
  label: string;
  url: string;
};

type ImportMetaWithGlob = ImportMeta & {
  glob: <T>(pattern: string, options: { eager: true; query: string; import: "default" }) => Record<string, T>;
};

const lacquerAssetModules = (import.meta as ImportMetaWithGlob).glob<string>("../../../_project/Lacquers/**/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const TEKNOS_LACQUER_OPTIONS = Object.entries(lacquerAssetModules)
  .map(([path, url]) => {
    const id = path.split(/[\\/]/).at(-1) ?? path;
    return {
      id,
      label: id.replace(/\.[^.]+$/, "").toUpperCase(),
      url,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })) satisfies TeknosLacquerOption[];

export const B92_RAL_DATALIST_ID = "b92-configurator-ral-classic-colours";
export const B92_NATIVE_FRAME_FILL = "#f4f4f5";

export function normalizeB92Ral(input: string, fallback = "7016") {
  const cleaned = input.replace(/[^0-9]/g, "").slice(0, 4);
  return cleaned || fallback;
}

export function getB92RalColour(input: string) {
  return B92_RAL_CLASSIC_BY_CODE[normalizeB92Ral(input)]?.hex ?? B92_RAL_CLASSIC_BY_CODE["7016"].hex;
}

export function getB92RalLabel(input: string) {
  const code = normalizeB92Ral(input);
  const colour = B92_RAL_CLASSIC_BY_CODE[code];
  return colour ? `RAL ${colour.code} ${colour.name}` : `RAL ${code}`;
}

export function getB92LacquerOption(id: string | null) {
  return TEKNOS_LACQUER_OPTIONS.find((option) => option.id === id) ?? TEKNOS_LACQUER_OPTIONS[0] ?? null;
}
