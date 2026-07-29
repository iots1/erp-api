export const PRINT_MOCK_INVOICE_SUMMARY =
  'Render a mock invoice (HTML → Gotenberg → PDF), store it via the storage BC, and return a download URL';

export const PRINT_MOCK_INVOICE_DESCRIPTION =
  'Demonstrates the report-bc print pipeline end to end: renders templates/invoice.ejs with the ' +
  'given (or default mock) data, converts it to PDF via Gotenberg, uploads the PDF to the storage ' +
  'BC over TCP, and returns a 1-hour presigned download URL. Every field is optional — an empty ' +
  'body `{}` renders a fully-populated sample invoice.';
