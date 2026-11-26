import { HttpException } from '@nestjs/common';

export class HttpError extends HttpException {
  constructor(status: number, message: string) {
    super({ error: message }, status);
  }
}
