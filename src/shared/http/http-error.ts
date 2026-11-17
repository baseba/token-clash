import { HttpException } from '@nestjs/common';

/** An HTTP answer that isn't a domain rule (no session, too many requests…), as `{ error }`. */
export class HttpError extends HttpException {
  constructor(status: number, message: string) {
    super({ error: message }, status);
  }
}
