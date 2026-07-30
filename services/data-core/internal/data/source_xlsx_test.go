package data

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestImportWorkbookReadsSharedInlineAndCachedFormulaValues(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "operations.xlsx")
	if err := writeTestWorkbook(source); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	result, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Datasets) != 2 {
		t.Fatalf("got %d datasets, want 2", len(result.Datasets))
	}
	preview, err := service.Preview(context.Background(), result.Datasets[0].ID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Rows) != 2 || preview.Rows[0][0] != "A-1" || preview.Rows[0][1] != "12.5" || preview.Rows[1][0] != "A-2" || preview.Rows[1][1] != "20" {
		t.Fatalf("unexpected XLSX values: %#v", preview.Rows)
	}
	targetsPreview, err := service.Preview(context.Background(), result.Datasets[1].ID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if targetsPreview.Columns[0].Name != "Region" {
		t.Fatalf("rich shared string was not combined: %#v", targetsPreview.Columns)
	}
}

func TestOpenXLSXWorkbookRejectsExternalWorksheetRelationship(t *testing.T) {
	filePath := filepath.Join(t.TempDir(), "external.xlsx")
	parts := testWorkbookParts()
	parts["xl/_rels/workbook.xml.rels"] = strings.Replace(
		parts["xl/_rels/workbook.xml.rels"],
		`Target="worksheets/sheet1.xml"`,
		`Target="https://example.com/sheet.xml" TargetMode="External"`,
		1,
	)
	if err := writeXLSXPackage(filePath, parts); err != nil {
		t.Fatal(err)
	}
	if _, err := openXLSXWorkbook(filePath); err == nil || !strings.Contains(err.Error(), "external workbook relationships are not supported") {
		t.Fatalf("expected external relationship rejection, got %v", err)
	}
}

func TestImportWorkbookRejectsOutOfOrderCells(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "out-of-order.xlsx")
	parts := testWorkbookParts()
	parts["xl/worksheets/sheet1.xml"] = strings.Replace(
		parts["xl/worksheets/sheet1.xml"],
		`<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>`,
		`<c r="B1" t="s"><v>1</v></c><c r="A1" t="s"><v>0</v></c>`,
		1,
	)
	if err := writeXLSXPackage(filePath, parts); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	if _, err := service.ImportFile(context.Background(), filePath); err == nil || !strings.Contains(err.Error(), "duplicated or out of order") {
		t.Fatalf("expected malformed row rejection, got %v", err)
	}
}

func TestXLSXColumnIndexPreservesSparseColumnsAndRejectsInvalidReferences(t *testing.T) {
	for reference, expected := range map[string]int{"A1": 0, "Z9": 25, "AA12": 26, "$CV$3": 99} {
		actual, err := xlsxColumnIndex(reference)
		if err != nil || actual != expected {
			t.Fatalf("xlsxColumnIndex(%q) = %d, %v; want %d", reference, actual, err, expected)
		}
	}
	for _, reference := range []string{"12", "Afoo", "A0", "XFE1"} {
		if _, err := xlsxColumnIndex(reference); err == nil {
			t.Fatalf("expected invalid cell reference %q to fail", reference)
		}
	}
}

func writeTestWorkbook(filePath string) error {
	return writeXLSXPackage(filePath, testWorkbookParts())
}

func testWorkbookParts() map[string]string {
	return map[string]string{
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
		"_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
		"xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sales" sheetId="1" r:id="rId1"/>
    <sheet name="Targets" sheetId="2" r:id="rId2"/>
    <sheet name="Empty" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`,
		"xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
		"xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
  <si><t>Order</t></si>
  <si><t>Amount</t></si>
  <si><r><t>Reg</t></r><r><t>ion</t></r><rPh><t>ignored phonetic guide</t></rPh></si>
  <si><t>Target</t></si>
  <si><t>North</t></si>
  <si><t>A-1</t></si>
</sst>`,
		"xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>5</v></c><c r="B2"><v>12.5</v></c></row>
  <row r="3"><c r="A3" t="inlineStr"><is><t>A-2</t><rPh><t>ignored</t></rPh></is></c><c r="B3"><f>SUM(B2,7.5)</f><v>20</v></c></row>
</sheetData></worksheet>`,
		"xl/worksheets/sheet2.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
  <row r="1"><c r="A1" t="s"><v>2</v></c><c r="B1" t="s"><v>3</v></c></row>
  <row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2"><v>20</v></c></row>
</sheetData></worksheet>`,
		"xl/worksheets/sheet3.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`,
	}
}

func writeXLSXPackage(filePath string, parts map[string]string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	archive := zip.NewWriter(file)
	for name, contents := range parts {
		entry, err := archive.Create(name)
		if err != nil {
			_ = archive.Close()
			_ = file.Close()
			return err
		}
		if _, err := entry.Write([]byte(contents)); err != nil {
			_ = archive.Close()
			_ = file.Close()
			return err
		}
	}
	if err := archive.Close(); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}
