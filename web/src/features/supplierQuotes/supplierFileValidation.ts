export function clientValidateSupplierFiles(files: readonly Pick<File, "name" | "size">[]) {
  const issues: string[] = [];
  if (!files.length) issues.push("Select at least one PDF or DOCX file.");
  if (files.length > 10) issues.push("Select no more than 10 files.");
  let total = 0;
  for (const file of files) {
    total += file.size;
    if (!/\.(pdf|docx)$/i.test(file.name)) issues.push(`${file.name}: only PDF and DOCX are allowed.`);
    if (!file.size) issues.push(`${file.name}: empty files are not allowed.`);
    if (file.size > 50 * 1024 * 1024) issues.push(`${file.name}: exceeds 50 MB.`);
  }
  if (total > 150 * 1024 * 1024) issues.push("Combined file size exceeds 150 MB.");
  return issues;
}
