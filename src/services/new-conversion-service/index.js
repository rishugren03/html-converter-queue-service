const {
  htmlToPdf,
  htmlToImage,
  htmlToDocx,
} = require("../../../../new-conversion-package/index");

const htmlUnivConverter = async (type, html, qualitySettings) => {
  try {
    if (!type || !html) {
      return "type and html both are required!";
    }

    let result;
    switch (type) {
      case "html-pdf":
      case "html-pdf-batch":
        result = await htmlToPdf(html, qualitySettings);
        break;

      case "html-image":
      case "html-image-batch":
        result = await htmlToImage(html, qualitySettings);
        break;

      case "html-docx":
      case "html-docx-batch":
        result = await htmlToDocx(html);
        break;

      default:
        throw new Error("Invalid conversion type");
    }

    return result;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { htmlUnivConverter };
