import { describe, expect, it } from "vitest";
import { csvCell, CsvParseError, normaliseHeader, parseCsv } from "./csv";

const BOM = String.fromCharCode(0xfeff);

describe("parseCsv", () => {
  it("parses simple rows with LF and CRLF", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles a bare CR line ending", () => {
    expect(parseCsv("a\r1")).toEqual([["a"], ["1"]]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv(`${BOM}name,phone\nA,1`)[0]).toEqual(["name", "phone"]);
  });

  it("supports quoted fields with commas, newlines and escaped quotes", () => {
    const text = 'name,msg\r\n"Sharma, Priya","Said ""hi""\r\nthen left"\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "msg"],
      ["Sharma, Priya", 'Said "hi"\r\nthen left'],
    ]);
  });

  it("keeps empty fields, including empty quoted and trailing ones", () => {
    expect(parseCsv('a,,""\n,b,')).toEqual([
      ["a", "", ""],
      ["", "b", ""],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a\n\n\r\nb\n\n")).toEqual([["a"], ["b"]]);
  });

  it("returns [] for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv(BOM)).toEqual([]);
  });

  it("keeps a stray quote inside an unquoted field literally", () => {
    expect(parseCsv('5" screen,x')).toEqual([['5" screen', "x"]]);
  });

  it("throws on an unclosed quote", () => {
    expect(() => parseCsv('a,"open\nb')).toThrow(CsvParseError);
  });

  it("supports a custom delimiter", () => {
    expect(parseCsv("a;b\n1;2", ";")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("normaliseHeader", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normaliseHeader(" Customer Name ")).toBe("customername");
    expect(normaliseHeader("E-mail")).toBe("email");
    expect(normaliseHeader(`${BOM}Lead ID`)).toBe("leadid");
  });
});

describe("csvCell", () => {
  it("quotes only when needed and round-trips through parseCsv", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    const tricky = ['a "b", c', "line\nbreak", "x"];
    expect(parseCsv(tricky.map(csvCell).join(","))).toEqual([tricky]);
  });
});
