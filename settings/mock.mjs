import { $app } from "@nsnanocat/util/lib/app.mjs";
import { done } from "@nsnanocat/util/lib/done.mjs";
import assets from "#website-assets";

/**
 * 为非原生远程文件 Mock 平台返回同次网站构建的资源，不进行网络或存储操作。
 * Return same-build site assets for proxies without remote file mocks, with no network or storage operations.
 * @returns {void} 已完成的静态响应 / Completed static response.
 */
function serve() {
  let response;
  const pathname = /^https:\/\/app\.bilibili\.com(\/[^?#]*)/.exec($request.url)?.[1];
  const asset = assets[pathname];
  switch (true) {
    case !asset:
      response = { status: 404, body: "" };
      break;
    case !["GET", "HEAD"].includes($request.method):
      response = { status: 405, body: "" };
      break;
    default:
      response = { status: 200, headers: { "Content-Type": asset[0], "Cache-Control": "no-store" }, body: $request.method === "HEAD" ? "" : Array.isArray(asset[1]) ? new Uint8Array(asset[1]).buffer : asset[1] };
  }
  done($app === "Quantumult X" ? response : { response });
}
serve();
