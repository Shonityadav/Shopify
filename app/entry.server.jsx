import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
) {
  const DEBUG_EXT = process.env.DEBUG_EXT === "true";

  if (DEBUG_EXT) {
    try {
      console.log("=== DEBUG REQUEST START ===");
      console.log("method:", request.method);
      console.log("url:", request.url);
      console.log("headers:", {
        referer: request.headers.get("referer"),
        host: request.headers.get("host"),
        "x-shopify-shop-domain": request.headers.get("x-shopify-shop-domain"),
        "user-agent": request.headers.get("user-agent"),
      });

      if (request.method !== "GET") {
        const clone = request.clone();
        const text = await clone.text().catch(() => "<body-read-error>");
        console.log("body:", text.slice(0, 2000));
      }

      console.log("=== DEBUG REQUEST END ===");
    } catch (err) {
      console.error("DEBUG LOG ERROR", err);
    }
  }

  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
