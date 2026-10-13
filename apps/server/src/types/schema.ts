export type TempTableSchema = {
  id: number;
  operation_id: string;
  content: string;
  sequence: number;
  source_operation_id: string | null;
  created_at: number;
};

type TPaginationData = {
  pageNumber: number;
  rowsPerPage: number;
};

export function isPaginationData(data: unknown): data is TPaginationData {
  return (
    typeof data === "object" &&
    data !== null &&
    "pageNumber" in data &&
    "rowsPerPage" in data &&
    typeof data.pageNumber === "number" &&
    typeof data.rowsPerPage === "number"
  );
}
