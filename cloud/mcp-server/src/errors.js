// Errors whose message is safe to show to the client. Anything else is logged and answered generically.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class LimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LimitError';
  }
}

// HTTP-level auth failure. `status` is 401 (no or bad token) or 403 (account not allowed).
export class AuthError extends Error {
  constructor(status, message, code = 'invalid_token') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}
