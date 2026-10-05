export type TempTableSchema = {
  id: number;
  operation_id: string;
  content: string;
  sequence: number;
  source_operation_id: string | null;
  created_at: number;
};
