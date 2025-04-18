const getConvQualitySettings = (plan) => {
  switch (plan) {
    case "pro_max":
      return { dpi: 300, imageQuality: 90, compressionLevel: 1 };
    case "pro":
      return { dpi: 150, imageQuality: 75, compressionLevel: 5 };
    case "free":
    default:
      return { dpi: 72, imageQuality: 50, compressionLevel: 9 };
  }
};

module.exports = getConvQualitySettings;
