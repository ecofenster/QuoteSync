export type ISODate = string;
export type ISODateTime = string;
export type DecimalString = string;
export type CurrencyCode = string;

export type Money = {
  amount: DecimalString;
  currency: CurrencyCode;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};
