/** Column names from tensr-api GET /datasets/{id}/schema */
export function columnNamesFromSchemaResponse(json: { schema?: { name: string }[] }): string[] {
  return (json.schema ?? []).map(col => col.name).filter(Boolean);
}
