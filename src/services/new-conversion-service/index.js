const {
  htmlToPdf,
  htmlToImage,
} = require("../../../../new-conversion-system/index");

const htmlUnivConverter = async (type, html) => {
  try {
    if (!type || !html) {
      return "type and html both are required!";
    }

    let result;
    switch (type) {
      case "html-pdf":
        result = await htmlToPdf(html);
        break;

      case "html-image":
        result = await htmlToImage(html);
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
