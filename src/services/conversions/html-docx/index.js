const { Document, Packer, Paragraph, TextRun } = require("docx");
const cheerio = require("cheerio"); // For HTML parsing

const htmlToDocx = async (html) => {
  try {
    if (!html || typeof html !== "string" || !html.trim()) {
      throw new Error("Valid HTML content is required");
    }

    const $ = cheerio.load(`<body>${html}</body>`); // Ensure body is wrapped
    const docElements = [];

    const parseElement = (element) => {
      const children = [];
      $(element)
        .contents()
        .each((_, el) => {
          if (el.type === "text") {
            children.push(new TextRun(el.data));
          } else if (el.type === "tag") {
            const text = $(el).text();
            switch (el.tagName.toLowerCase()) {
              case "b":
              case "strong":
                children.push(new TextRun({ text, bold: true }));
                break;
              case "i":
              case "em":
                children.push(new TextRun({ text, italics: true }));
                break;
              case "u":
                children.push(new TextRun({ text, underline: {} }));
                break;
              case "a":
                children.push(new TextRun({ text, style: "Hyperlink" }));
                break;
              default:
                children.push(new TextRun(text));
            }
          }
        });
      return children;
    };

    $("body")
      .children()
      .each((_, element) => {
        const tagName = element.tagName.toLowerCase();
        switch (tagName) {
          case "h1":
            docElements.push(
              new Paragraph({
                children: parseElement(element),
                heading: "Heading1",
              })
            );
            break;
          case "h2":
            docElements.push(
              new Paragraph({
                children: parseElement(element),
                heading: "Heading2",
              })
            );
            break;
          case "h3":
            docElements.push(
              new Paragraph({
                children: parseElement(element),
                heading: "Heading3",
              })
            );
            break;
          case "p":
            docElements.push(
              new Paragraph({ children: parseElement(element) })
            );
            break;
          case "ul":
            $(element)
              .find("li")
              .each((_, li) => {
                docElements.push(
                  new Paragraph({
                    children: parseElement(li),
                    bullet: { level: 0 },
                  })
                );
              });
            break;
          case "ol":
            let counter = 1;
            $(element)
              .find("li")
              .each((_, li) => {
                docElements.push(
                  new Paragraph({
                    children: parseElement(li),
                    numbering: {
                      reference: "numbered",
                      level: 0,
                      number: counter++,
                    },
                  })
                );
              });
            break;
          default:
            docElements.push(
              new Paragraph({ children: parseElement(element) })
            );
            break;
        }
      });

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "numbered",
            levels: [
              { level: 0, format: "decimal", text: "%1.", alignment: "left" },
            ],
          },
        ],
      },
      sections: [{ properties: {}, children: docElements }],
    });

    return await Packer.toBuffer(doc); // Return buffer instead of writing to disk
  } catch (error) {
    console.error("Error generating DOCX:", error.message);
    throw new Error("Failed to generate DOCX");
  }
};

module.exports = { htmlToDocx };
