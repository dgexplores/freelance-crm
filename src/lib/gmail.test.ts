import { describe, it, expect } from "vitest";
import { htmlToText, extractBody } from "@/lib/gmail";

/** Gmail returns part bodies as base64url. */
const b64 = (text: string): string => Buffer.from(text, "utf8").toString("base64url");

describe("htmlToText", () => {
  it("strips tags and keeps the readable text", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("drops script and style content entirely, not just their tags", () => {
    const html = '<style>.a{color:red}</style><p>Keep me</p><script>alert("x")</script>';
    expect(htmlToText(html)).toBe("Keep me");
  });

  it("turns block boundaries and <br> into line breaks", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    expect(htmlToText("One<br>Two")).toBe("One\nTwo");
    expect(htmlToText("One<br/>Two")).toBe("One\nTwo");
  });

  it("decodes the entities that show up in real email", () => {
    expect(htmlToText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(htmlToText("&lt;tag&gt;")).toBe("<tag>");
    expect(htmlToText("a&nbsp;b")).toBe("a b");
    expect(htmlToText("&#65;&#66;")).toBe("AB");
  });

  it("collapses the whitespace soup left by tag stripping", () => {
    const html = "<div>\n  <span>  lots   of   space  </span>\n</div>\n\n\n\n<div>next</div>";
    expect(htmlToText(html)).toBe("lots of space\nnext");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("   ")).toBe("");
  });
});

describe("extractBody", () => {
  it("prefers the text/plain part when the message has both", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("plain version") } },
        { mimeType: "text/html", body: { data: b64("<p>html version</p>") } },
      ],
    };
    expect(extractBody(payload)).toBe("plain version");
  });

  it("converts HTML when there is no text/plain part", () => {
    // The regression that mattered: HTML-only mail used to yield "" and fall
    // back to Gmail's ~200-char snippet, degrading the email view and every
    // AI prompt built from it.
    const payload = {
      mimeType: "text/html",
      body: { data: b64("<p>Budget is <b>$10k</b> for the rebuild.</p>") },
    };
    expect(extractBody(payload)).toBe("Budget is $10k for the rebuild.");
  });

  it("walks nested multipart containers", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "multipart/related",
              parts: [{ mimeType: "text/html", body: { data: b64("<div>deep</div>") } }],
            },
          ],
        },
      ],
    };
    expect(extractBody(payload)).toBe("deep");
  });

  it("ignores attachment parts so a text file cannot masquerade as the body", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", filename: "notes.txt", body: { data: b64("ATTACHMENT") } },
        { mimeType: "text/plain", body: { data: b64("real body") } },
      ],
    };
    expect(extractBody(payload)).toBe("real body");
  });

  it("returns an empty string when there is no text at all", () => {
    expect(extractBody(undefined)).toBe("");
    expect(extractBody({ mimeType: "multipart/mixed", parts: [] })).toBe("");
  });

  it("does not blow up on a part with no body data", () => {
    expect(extractBody({ mimeType: "text/plain" })).toBe("");
  });
});
