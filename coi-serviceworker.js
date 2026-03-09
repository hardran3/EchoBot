/*! coi-serviceworker v0.1.7 - MIT License - https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === "undefined") {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
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
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const script = document.currentScript;
        if (window.crossOriginIsolated) return;

        if ("serviceWorker" in navigator) {
            const base = script.getAttribute("data-coi-base") || "/";
            const swPath = (base + "coi-serviceworker.js").replace(/\/+/g, "/");
            navigator.serviceWorker.register(swPath).then(
                (registration) => {
                    registration.addEventListener("updatefound", () => {
                        window.location.reload();
                    });

                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                },
                (err) => {
                    console.error("COI service worker registration failed", err);
                }
            );
        }
    })();
}
