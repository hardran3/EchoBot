/*! coi-serviceworker v0.2.3 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 0) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
        );
    });
} else {
    (() => {
        const rewriterScript = document.currentScript;
        const scope = rewriterScript.getAttribute("scope") || "./";

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register(window.location.pathname + "coi-serviceworker.js", { scope }).then(
                (registration) => {
                    registration.addEventListener("updatefound", () => {
                        window.location.reload();
                    });

                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                },
                (err) => {
                    console.error("COI-ServiceWorker registration failed: ", err);
                }
            );
        }

        if (window.crossOriginIsolated !== undefined && !window.crossOriginIsolated) {
            const outputPath = window.location.pathname;
            const isInsideIframe = window.parent !== window;
            if (!isInsideIframe) {
                // If we're not isolated, but we're the top-level window, we might need a reload
                // once the SW is active.
            }
        }
    })();
}
