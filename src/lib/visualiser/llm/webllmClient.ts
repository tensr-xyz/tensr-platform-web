'use client';

import { CreateMLCEngine, MLCEngineInterface, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { LLM_CONFIG } from './config';
import { devLog } from '@/lib/dev-log';

let enginePromise: Promise<MLCEngineInterface> | null = null;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Gets or creates the WebLLM engine instance (singleton)
 */
export async function getEngine(): Promise<MLCEngineInterface> {
  if (!enginePromise) {
    devLog('WebLLM: Creating engine for model:', LLM_CONFIG.model);

    // Log available models for debugging
    try {
      const availableModels = prebuiltAppConfig.model_list.map(m => m.model_id);
      devLog('WebLLM: Available models:', availableModels.slice(0, 10), '... (showing first 10)');

      if (!availableModels.includes(LLM_CONFIG.model)) {
        console.warn(
          `WebLLM: Model "${LLM_CONFIG.model}" not found in available models.`,
          'Available models include:',
          availableModels.filter(m => m.includes('3B') || m.includes('Tiny')).slice(0, 5)
        );
      }
    } catch (err) {
      console.warn('WebLLM: Could not list available models:', err);
    }

    enginePromise = CreateMLCEngine(LLM_CONFIG.model, {
      initProgressCallback: report => {
        // Progress can be logged or displayed to user
        devLog('WebLLM: Model loading progress:', {
          text: report.text,
          progress: report.progress,
          timeElapsed: report.timeElapsed,
        });
      },
    });
    devLog('WebLLM: Engine creation initiated');
  }

  return enginePromise;
}

/**
 * Sends a chat completion request (non-streaming)
 */
export async function chatOnce(messages: ChatMessage[]): Promise<string> {
  const engine = await getEngine();

  const response = await engine.chat.completions.create({
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: LLM_CONFIG.temperature,
    max_tokens: LLM_CONFIG.maxTokens,
    stream: false,
  });

  return response.choices[0]?.message?.content ?? '';
}

/**
 * Checks if WebGPU is available
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false;
  }

  // Type assertion for WebGPU API (not in standard Navigator type yet)
  const nav = navigator as Navigator & { gpu?: any };

  if (!nav.gpu) {
    return false;
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}
