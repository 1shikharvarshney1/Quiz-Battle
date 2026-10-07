import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { mapLlmError } from '../utils/errors.js';

let aiClient = null;

/**
 * Returns the GoogleGenAI instance, created lazily.
 */
function getClient() {
  if (!aiClient && env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return aiClient;
}

/**
 * Helper to execute a model generation with a 60-second timeout.
 */
async function callModelWithTimeout(client, model, systemInstruction, userPrompt) {
  const timeoutMs = 60000;
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error('The AI took too long to respond.');
      err.status = 504;
      reject(err);
    }, timeoutMs);
  });

  const apiPromise = client.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  try {
    const response = await Promise.race([apiPromise, timeoutPromise]);
    return response;
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Checks if an error warrants retrying with the fallback model.
 * Retry on 503 (busy/overloaded), 429 (rate limited), or 404 (model not found).
 */
function isRetryableError(error) {
  const status = error.status || error.statusCode || error.response?.status;
  const msg = (error.message || '').toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('not found')
  );
}

/**
 * Strips markdown code block wrappers (e.g. ```json ... ```) from output.
 */
function cleanJsonText(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return text.trim();
}

/**
 * Generates JSON via Gemini with fallback model retry and timeout handling.
 *
 * @param {Object} options
 * @param {string} options.systemInstruction
 * @param {string} options.userPrompt
 * @returns {Promise<any>} Parsed JSON object
 */
export async function generateJson({ systemInstruction, userPrompt }) {
  const client = getClient();
  if (!client) {
    const err = new Error('Gemini API key is not configured');
    err.status = 500;
    throw err;
  }

  let primaryError = null;

  // Try primary model
  try {
    const response = await callModelWithTimeout(
      client,
      env.GEMINI_MODEL,
      systemInstruction,
      userPrompt
    );

    const rawText = response.text;
    const cleaned = cleanJsonText(rawText);
    if (!cleaned) {
      throw new Error('Empty response from model');
    }
    return JSON.parse(cleaned);
  } catch (err) {
    primaryError = err;
    console.warn(`[LLM] Primary model ${env.GEMINI_MODEL} failed: ${err.message}`);
  }

  // Attempt fallback model if the error qualifies
  if (isRetryableError(primaryError) && env.GEMINI_FALLBACK_MODEL !== env.GEMINI_MODEL) {
    try {
      console.log(`[LLM] Attempting fallback model: ${env.GEMINI_FALLBACK_MODEL}`);
      const fallbackResponse = await callModelWithTimeout(
        client,
        env.GEMINI_FALLBACK_MODEL,
        systemInstruction,
        userPrompt
      );

      const rawText = fallbackResponse.text;
      const cleaned = cleanJsonText(rawText);
      if (!cleaned) {
        throw new Error('Empty response from fallback model');
      }
      return JSON.parse(cleaned);
    } catch (fallbackErr) {
      console.error(`[LLM] Fallback model ${env.GEMINI_FALLBACK_MODEL} also failed: ${fallbackErr.message}`);
      throw mapLlmError(fallbackErr, env.GEMINI_FALLBACK_MODEL);
    }
  }

  // If not retryable or fallback wasn't attempted, map and throw primary error
  throw mapLlmError(primaryError, env.GEMINI_MODEL);
}
