import mammoth from "mammoth";
import { ValidationError } from "./errors.js";

const PDF_MAGIC = Buffer.from("%PDF");
const ZIP_MAGIC = Buffer.from("PK"); // DOCX is ZIP-based

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC);
}

function isDocx(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.subarray(0, 2).equals(ZIP_MAGIC);
}

export async function extractResumeText(buffer: Buffer, key: string): Promise<string> {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";

  if (isPdf(buffer) || ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (isDocx(buffer) || ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new ValidationError(
    "Unsupported file type. Only PDF and DOCX are allowed."
  );
}
