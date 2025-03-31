const puppeteer = require("puppeteer");

const htmlToImage = async (html, browser) => {
  let page;
  try {
    if (!html || typeof html !== "string" || !html.trim()) {
      throw new Error("Valid HTML content is required");
    }

    console.log("Generating Image from HTML...");

    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.readyState === "complete");

    const imageBuffer = await page.screenshot({ fullPage: true });

    return imageBuffer;
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Failed to generate image");
  } finally {
    if (page) await page.close();
  }
};

module.exports = { htmlToImage };
