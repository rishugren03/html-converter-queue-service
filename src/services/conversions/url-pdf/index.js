const puppeteer = require("puppeteer");

const urlToPdf = async (url, browser) => {
  let page;
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Valid URL is required");
    }

    console.log(`Generating PDF from URL: ${url}`);

    page = await browser.newPage();

    // Block unnecessary resources (ads, tracking scripts, images, fonts) for faster performance
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

    // Navigate to the URL with a timeout
    await page.goto(url, {
      waitUntil: "networkidle2", // Ensures all requests are completed
      timeout: 30000, // Timeout to prevent indefinite waiting
    });

    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // Ensures proper background rendering
    });

    return pdfBuffer; // Return the generated PDF
  } catch (error) {
    console.error("Error generating PDF:", error.message);
    throw new Error("Failed to generate PDF");
  } finally {
    if (page) await page.close(); // Ensure cleanup
  }
};

module.exports = { urlToPdf };
