export const PORTAL_REVIEW_POSITION_RESPONSES = Object.freeze([
  'accepted_as_shown',
  'amendment_requested',
  'question_comment'
]);

export const PORTAL_DECLINE_REASONS = Object.freeze([
  'cost',
  'confidence',
  'chose_another_supplier',
  'other'
]);

// This is the future signed acceptance boundary, not the informal review response.
// Each issued Position must eventually record yes/no against all applicable claims.
export const PORTAL_POSITION_ACCEPTANCE_CONFIRMATIONS = Object.freeze([
  'item_reference',
  'configuration',
  'dimensions',
  'specification'
]);

export const CLIENT_PORTAL_FEATURES = Object.freeze([
  'dashboard', 'estimates', 'orders', 'rejected', 'documents', 'certificates',
  'system_drawings', 'compare_options', 'review_estimate', 'request_amendments',
  'decline_estimate', 'intent_to_proceed', 'payments', 'delivery_installation'
]);
