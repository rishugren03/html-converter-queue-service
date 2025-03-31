const puppeteer = require("puppeteer");

const htmlToPdf = async (html, browser) => {
  let page;
  try {
    if (!html || typeof html !== "string" || !html.trim()) {
      throw new Error("Valid HTML content is required");
    }

    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.readyState === "complete");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, // Avoids clipping
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF:", error.message);
    throw new Error("Failed to generate PDF");
  } finally {
    if (page) await page.close();
  }
};

module.exports = { htmlToPdf };
