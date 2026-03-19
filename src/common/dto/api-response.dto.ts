export class ApiResponseDto<T = any> {
  message: string;
  data?: T;
  id?: number | string;

  constructor(message: string, options?: { data?: T; id?: number | string }) {
    this.message = message;
    this.data = options?.data;
    this.id = options?.id;
  }
}
