export function requiredText(value: string, field = "القيمة") {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} مطلوب`);
  return normalized;
}

export function positiveAmount(value: number, field = "المبلغ") {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} يجب أن يكون أكبر من صفر`);
  return value;
}
