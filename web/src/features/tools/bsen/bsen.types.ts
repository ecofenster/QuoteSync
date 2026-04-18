export type BSENCategory =
  | "Security"
  | "Performance"
  | "Glazing"
  | "Thermal"
  | "Fire"
  | "General";

export type BSENStandard = {
  code: string;
  family: string;
  number: string;
  title: string;
  applies: string;
  covers: string;
  plain: string;
  tags: string[];
  year?: string;
  category?: BSENCategory;
};
