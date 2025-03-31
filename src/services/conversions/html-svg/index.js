const puppeteer = require("puppeteer");
const fs = require("fs");

const htmlToSvg = async (html) => {
  try {
    if (!html) throw new Error("HTML content is required");

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Capture screenshot as PNG (Buffer)
    const imageBuffer = await page.screenshot({ fullPage: true });

    await browser.close();

    // Convert PNG Buffer to Base64
    const base64Image = imageBuffer.toString("base64");

    // Generate SVG Content
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <image href="data:image/png;base64,${base64Image}" width="100%" height="100%"/>
      </svg>
    `;

    // Convert SVG String to Buffer
    const svgBuffer = Buffer.from(svgContent, "utf-8");

    console.log(svgBuffer);

    fs.writeFileSync("image.svg", svgContent);

    return svgBuffer;
  } catch (error) {
    console.error("Error generating SVG:", error);
    throw new Error("Internal Server Error");
  }
};

module.exports = { htmlToSvg };
