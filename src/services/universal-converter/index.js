// Conversion functions
const { htmlToPdf } = require("../conversions/html-pdf/index");
const { htmlToDocx } = require("../conversions/html-docx/index");
const { htmlToImage } = require("../conversions/html-image/index");
const { htmlToSvg } = require("../conversions/html-svg/index");
const { urlToPdf } = require("../conversions/url-pdf/index");
const { urlToImage } = require("../conversions/url-image/index");

const getMimeType = (type) => {
  const mimeTypes = {
    "html-pdf": "application/pdf",
    "html-docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "html-image": "image/png",
    "html-svg": "image/svg+xml",
    "url-pdf": "application/pdf",
    "url-image": "image/png",
  };
  return mimeTypes[type] || "application/octet-stream";
};

const getExtension = (type) => {
  const extensions = {
    "html-pdf": "pdf",
    "html-docx": "docx",
    "html-image": "png",
    "html-svg": "svg",
    "url-pdf": "pdf",
    "url-image": "png",
  };
  return extensions[type] || "bin";
};

/**
 * Convert HTML input to the specified format.
 * @param {string} html - The HTML content to convert.
 * @param {string} type - The conversion type (html-pdf, html-docx, html-image, html-svg).
 * @returns {Promise<{ data: Buffer, mimeType: string, extension: string }>} - The converted file data.
 */
const convertHTML = async (html, type, browser) => {
  try {
    let result;
    switch (type) {
      case "html-pdf":
        result = await htmlToPdf(html, browser);
        break;
      case "html-image":
        result = await htmlToImage(html);
        break;
      case "html-docx":
        result = await htmlToDocx(html);
        break;
      case "html-svg":
        result = await htmlToSvg(html);
        break;
      default:
        throw new Error("Invalid conversion type");
    }

    return {
      data: result,
      mimeType: getMimeType(type),
      extension: getExtension(type),
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Convert a URL to the specified format.
 * @param {string} url - The URL to convert.
 * @param {string} type - The conversion type (url-pdf, url-image).
 * @returns {Promise<{ data: Buffer, mimeType: string, extension: string }>} - The converted file data.
 */
const convertURL = async (url, type) => {
  try {
    let result;
    switch (type) {
      case "url-pdf":
        result = await urlToPdf(url);
        break;
      case "url-image":
        result = await urlToImage(url);
        break;
      default:
        throw new Error("Invalid conversion type");
    }

    return {
      data: result,
      mimeType: getMimeType(type),
      extension: getExtension(type),
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { convertHTML, convertURL };
