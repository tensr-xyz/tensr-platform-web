type Search = Record<string, string | string[] | undefined>;

/** /settings/billing?checkout=success → /flow/settings/billing?checkout=success */
export function flowSettingsPath(section: string, search: Search = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  const text = query.toString();
  return `/flow/settings/${section}${text ? `?${text}` : ''}`;
}
