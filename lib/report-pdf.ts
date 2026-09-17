import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/** Print the existing report HTML so PDF and the original report share a layout. */
export async function renderReportPdf(html: string): Promise<Uint8Array> {
  const localPath = process.env.PDF_BROWSER_PATH || (process.platform === "win32"
    ? [
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      ].find(existsSync)
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : undefined);
  const browser = await puppeteer.launch({
    executablePath: localPath || await chromium.executablePath(),
    args: localPath ? [] : chromium.args,
    headless: localPath ? true : "shell",
    timeout: 30_000,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    // Reports are self-contained. Never fetch URLs supplied inside review text.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:") || request.url() === "about:blank") {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    return await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      timeout: 30_000,
    });
  } finally {
    await browser.close();
  }
}
