const puppeteer = require("puppeteer");

const urlToImage = async (url) => {
  let browser;
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Valid URL is required");
    }

    console.log(`Generating Image from URL: ${url}`);

    // Launch Puppeteer with optimizations
    browser = await puppeteer.launch({
      headless: "new", // Uses Puppeteer's latest optimized headless mode
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Block unnecessary resources (ads, tracking scripts) for speed
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (
        ["image", "stylesheet", "font", "media"].includes(req.resourceType())
      ) {
        req.abort(); // Block unwanted requests
      } else {
        req.continue();
      }
    });

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000, // Timeout to avoid indefinite waits
    });

    // Capture screenshot and get buffer
    const imageBuffer = await page.screenshot({ fullPage: true });

    return imageBuffer; // Return the image buffer
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Failed to generate image");
  } finally {
    if (browser) await browser.close(); // Ensure cleanup
  }
};

module.exports = { urlToImage };
