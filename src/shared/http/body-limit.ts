/**
 * The largest request body the API reads. A save export is a few hundred KB; the browser already
 * refuses files over 8 MB, and the extra MB covers the JSON escaping of the file's text.
 */
export const MAX_BODY_MB = 9;
