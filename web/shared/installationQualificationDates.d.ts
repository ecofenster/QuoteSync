export type QualificationValidity = 'dates_missing' | 'not_yet_valid' | 'expired' | 'expiring' | 'in_date';
export function isQualificationDate(value: unknown): value is string;
export function qualificationValidity(validFrom: string | null | undefined, expiry: string | null | undefined, onDate?: string, expiringDays?: number): QualificationValidity;
