
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
env.backends.onnx.wasm.proxy = false; // Already in a worker, no need for proxying to another worker

// Point to the CDN for WASM files to keep the build size small
const CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
env.backends.onnx.wasm.wasmPaths = CDN_URL;

try {
    // Some mobile environments or non-secure contexts (HTTP) don't have access to the Cache API
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
            
            if (isWebGPUSupported) {
                try {
                    generator = await pipeline('text-generation', model_id, {
                        device: 'webgpu',
                        dtype: 'q4', 
                        progress_callback: (p: any) => {
                            self.postMessage({ type: 'progress', data: p });
                        }
                    });
                    self.postMessage({ type: 'ready' });
                    return;
                } catch (webgpuError: any) {
                    console.warn('WebGPU init failed, falling back to WASM:', webgpuError.message);
                }
            }

            // Fallback to WASM
            generator = await pipeline('text-generation', model_id, {
                device: 'wasm',
                dtype: 'q4',
                progress_callback: (p: any) => {
                    self.postMessage({ type: 'progress', data: p });
                }
            });
            self.postMessage({ type: 'ready' });

        } catch (e: any) {
            console.error('All backends failed:', e);
            self.postMessage({ type: 'error', data: `Engine initialization failed: ${e.message}` });
        }
    } else if (type === 'generate') {
        if (!generator) {
            self.postMessage({ type: 'error', data: 'Generator not initialized' });
            return;
        }

        const { 
            messages, 
            max_new_tokens = 64, 
            temperature = 0.7, 
            top_p = 0.9, 
            top_k = 40,
            repetition_penalty = 1.1
        } = data;

        try {
            console.log('Generating with messages:', JSON.stringify(messages, null, 2));
            const result = await generator(messages, {
                max_new_tokens,
                temperature,
                do_sample: true,
                top_p,
                top_k,
                repetition_penalty,
                return_full_text: false,
            }).catch((err: any) => {
                throw new Error(`Pipeline execution failed: ${err.message}`);
            });
            
            let output = '';
            if (Array.isArray(result) && result[0]?.generated_text) {
                const generated = result[0].generated_text;
                if (Array.isArray(generated)) {
                    const lastMessage = generated[generated.length - 1];
                    output = lastMessage?.content || '';
                } else {
                    output = generated;
                }
            } else if (typeof result === 'string') {
                output = result;
            }

            let finalOutput = String(output).trim();
            finalOutput = finalOutput.replace(/^(assistant|bot|reply):/i, '').trim();

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
