export const SUPPLIER_UPLOAD_LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 50 * 1024 * 1024,
  maxCombinedFileBytes: 150 * 1024 * 1024,
  maxOriginalFileNameLength: 255,
  maxFields: 20,
});

export const SUPPLIER_UPLOAD_MIME_TYPES = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
