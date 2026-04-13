
class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

module.exports = ApiError;
