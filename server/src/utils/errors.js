/**
 * Utility to map raw Gemini/LLM API errors into safe, user-friendly messages
 * with appropriate HTTP status codes.
 *
 * Rules:
 * - Never leak the API key or raw tokens in user-facing messages or logs.
 * - Log the status, model, and sanitized message for server debugging.
 */
export function mapLlmError(error, modelName = 'unknown') {
  const status = error.status || error.statusCode || error.response?.status;
  const rawMsg = (error.message || '').toLowerCase();

  // Log diagnostic info on the server without leaking sensitive secrets
  console.error(`[LLM Error] Status: ${status || 'N/A'}, Model: ${modelName}, Message: ${error.message || 'Unknown'}`);

  const err = new Error();

  if (status === 429 || rawMsg.includes('quota') || rawMsg.includes('rate limit') || rawMsg.includes('resource_exhausted')) {
    err.status = 429;
    err.message = 'AI rate limit reached. Please wait a minute and try again.';
  } else if (status === 503 || rawMsg.includes('overloaded') || rawMsg.includes('unavailable') || rawMsg.includes('503')) {
    err.status = 503;
    err.message = 'The AI model is busy right now. Please try again in a moment.';
  } else if (status === 404 || rawMsg.includes('not found') || rawMsg.includes('models/')) {
    err.status = 404;
    err.message = 'The configured GEMINI_MODEL is not available. Check the model name in Google AI Studio.';
  } else if (status === 400 || status === 401 || status === 403 || rawMsg.includes('api key') || rawMsg.includes('permission_denied')) {
    err.status = status || 401;
    err.message = 'The Gemini API key was rejected. Check GEMINI_API_KEY.';
  } else if (rawMsg.includes('timeout') || rawMsg.includes('timed out') || error.code === 'ETIMEDOUT') {
    err.status = 504;
    err.message = 'The AI took too long to respond.';
  } else {
    err.status = 500;
    err.message = 'The AI returned no usable questions. Try a different topic.';
  }

  return err;
}
