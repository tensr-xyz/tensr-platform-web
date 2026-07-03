export const LLM_CONFIG = {
  // Model identifier - using a small quantized model suitable for browser
  // Model must be in prebuiltAppConfig.model_list
  // Common models: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', 'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC'
  // Check https://mlc.ai/models for available models
  // Format: ModelName-Variant-MLC (e.g., 'Llama-3.2-3B-Instruct-q4f16_1-MLC')
  model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',

  // Generation parameters
  temperature: 0.2,
  maxTokens: 1000,

  // Context limits (keep prompts concise)
  maxContextLength: 4096,

  // WebGPU/WASM settings
  useWebGPU: true,
  lowCpuMemUsage: true,
};
