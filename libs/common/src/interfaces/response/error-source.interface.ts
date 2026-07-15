export interface IErrorSource {
  /** JSON pointer to the field, e.g. "/data/attributes/email" */
  pointer?: string;
  /** Query parameter name, e.g. "sort" */
  parameter?: string;
}
