const puppeteer = require("puppeteer");

const htmlToImage = async (html) => {
  let browser;
  try {
    if (!html || typeof html !== "string" || !html.trim()) {
      throw new Error("Valid HTML content is required");
    }

    console.log("Generating Image from HTML...");

    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.readyState === "complete");

    const imageBuffer = await page.screenshot({ fullPage: true });

    return imageBuffer;
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Failed to generate image");
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { htmlToImage };
