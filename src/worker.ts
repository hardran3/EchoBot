
import { pipeline, env } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Optimize for browser environment with safety limits
const coreCount = navigator.hardwareConcurrency || 4;
if (self.crossOriginIsolated) {
    // Use NumCores - 1 for responsiveness, capped at 8 for WASM stability
    env.backends.onnx.wasm.numThreads = Math.min(Math.max(coreCount - 1, 1), 8); 
    console.log(`[Worker] Environment is Cross-Origin Isolated. Threads: ${env.backends.onnx.wasm.numThreads} (Hardware cores: ${coreCount})`);
} else {
    console.warn(`[Worker] Environment is NOT Cross-Origin Isolated. Fallback to single-threaded mode.`);
}
env.backends.onnx.wasm.proxy = false; 

// Point to the CDN for WASM files to keep the build size small
const CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
env.backends.onnx.wasm.wasmPaths = CDN_URL;

try {
    const hasCache = typeof self.caches !== 'undefined';
    env.useBrowserCache = hasCache;
} catch (e) {
    env.useBrowserCache = false;
}

let generator: any = null;

// Message handling
self.addEventListener('message', async (event: any) => {
    const { type, data } = event.data;

    if (type === 'init') {
        const { model_id } = data;
        try {
            self.postMessage({ type: 'status', data: `Initializing Brain (${model_id.split('/').pop()})...` });
            
            const isWebGPUSupported = 'gpu' in navigator && !!(await (navigator as any).gpu.requestAdapter());
            const isSmolLM2 = model_id.includes('SmolLM2');

            // Force WASM for SmolLM2 due to WebGPU attention collapse issues
            const device = (isWebGPUSupported && !isSmolLM2) ? 'webgpu' : 'wasm';
            const dtype = device === 'webgpu' ? 'q4f16' : 'q4';

            console.log(`[Worker] Initializing ${model_id} on ${device} (dtype: ${dtype})`);

            generator = await pipeline('text-generation', model_id, {
                device: device as any,
                dtype: dtype as any,
                progress_callback: (p: any) => {
                    self.postMessage({ type: 'progress', data: p });
                }
            });

            console.log(`[Worker] Pipeline ready: ${model_id} on ${device}`);
            self.postMessage({ type: 'ready' });

        } catch (e: any) {
            console.error('[Worker] All backends failed:', e);
            self.postMessage({ type: 'error', data: `Engine initialization failed: ${e.message}` });
        }
    } else if (type === 'generate') {        if (!generator) {
            self.postMessage({ type: 'error', data: 'Generator not initialized' });
            return;
        }

        const { 
            messages, 
            max_new_tokens = 64, 
            temperature = 0.7, 
            top_p = 0.9, 
            top_k = 40,
            repetition_penalty = 1.1,
            stream = false
        } = data;

        try {
            // Apply chat template manually to ensure 'add_generation_prompt' is respected in v3
            const prompt = generator.tokenizer.apply_chat_template(messages, { 
                tokenize: false, 
                add_generation_prompt: true 
            });

            let lastLength = 0;
            const callback_function = stream ? (beams: any) => {
                const decoded = generator.tokenizer.decode(beams[0].output_token_ids, { skip_special_tokens: true });
                // When using a raw prompt string, decoded contains the full string including prompt
                const responsePart = decoded.substring(prompt.length);
                const delta = responsePart.substring(lastLength);
                lastLength = responsePart.length;
                if (delta) self.postMessage({ type: 'delta', data: delta });
            } : undefined;

            const result = await generator(prompt, {
                max_new_tokens,
                temperature,
                do_sample: temperature > 0,
                top_p,
                top_k,
                repetition_penalty,
                return_full_text: false,
                callback_function
            });

            let output = '';
            if (Array.isArray(result) && result[0]?.generated_text) {
                output = result[0].generated_text;
            } else if (typeof result === 'string') {
                output = result;
            }

            let finalOutput = String(output).trim();

            // If the model somehow included the prompt in the output despite return_full_text: false
            if (finalOutput.startsWith(prompt)) {
                finalOutput = finalOutput.substring(prompt.length).trim();
            }

            // Remove common character prefixes
            finalOutput = finalOutput.replace(/^(assistant|bot|reply|character|in character as|{name}|{target_name}):/i, '').trim();
            
            // Remove wrapping quotes (both double and single)
            finalOutput = finalOutput.replace(/^["']+|["']+$/g, '').trim();

            if (finalOutput.includes('\n')) {
                finalOutput = finalOutput.split('\n')[0].trim();
            }

            self.postMessage({ type: 'result', data: finalOutput });
        } catch (e: any) {
            console.error('Generation Error:', e);
            self.postMessage({ type: 'error', data: e.message });
        }
    }
});
