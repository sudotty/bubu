package data

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func minimalKnowledgePDF(text string) []byte {
	var output bytes.Buffer
	output.WriteString("%PDF-1.4\n")
	content := fmt.Sprintf("BT /F1 12 Tf 72 720 Td (%s) Tj ET", text)
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = output.Len()
		fmt.Fprintf(&output, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := output.Len()
	fmt.Fprintf(&output, "xref\n0 %d\n0000000000 65535 f \n", len(offsets))
	for _, offset := range offsets[1:] {
		fmt.Fprintf(&output, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&output, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xref)
	return output.Bytes()
}

func TestKnowledgeSourcesVersionSearchAndDelete(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	service, err := Open(filepath.Join(root, "data"))
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()

	sourcePath := filepath.Join(root, "returns.md")
	if err := os.WriteFile(sourcePath, []byte("# Returns\n\nRefunds require a receipt.\nReturns close after thirty days."), 0o600); err != nil {
		t.Fatal(err)
	}
	source, err := service.ImportKnowledgeSource(ctx, KnowledgeSourceImportInput{SourcePath: sourcePath, DisplayName: "Returns policy"})
	if err != nil {
		t.Fatal(err)
	}
	if source.Kind != "markdown" || source.ChunkCount != 1 || source.Status != "ready" {
		t.Fatalf("unexpected source: %#v", source)
	}
	results, err := service.SearchKnowledge(ctx, KnowledgeSearchInput{Query: "refund receipt", SourceIDs: []string{source.ID}, Limit: 5})
	if err != nil {
		t.Fatal(err)
	}
	if len(results.Citations) != 1 || results.Citations[0].VersionID != source.VersionID || results.Citations[0].StartLine != 1 || results.Citations[0].EndLine != 4 {
		t.Fatalf("search did not return an exact current citation: %#v", results)
	}
	preview, err := service.PreviewKnowledgeDisclosure(ctx, "Answer the returns question", results)
	if err != nil || preview.PayloadBytes < 1 || len(preview.PayloadSHA256) != 64 {
		t.Fatalf("invalid disclosure preview: %#v, %v", preview, err)
	}

	rebuilt, err := service.RebuildKnowledgeSource(ctx, source.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rebuilt.VersionID == source.VersionID {
		t.Fatal("rebuild must create an immutable new source version")
	}
	if _, err := service.PreviewKnowledgeDisclosure(ctx, "stale citations must fail", results); err == nil {
		t.Fatal("stale citations were accepted after source rebuild")
	}
	current, err := service.SearchKnowledge(ctx, KnowledgeSearchInput{Query: "refund receipt", SourceIDs: []string{source.ID}, Limit: 5})
	if err != nil || len(current.Citations) != 1 || current.Citations[0].VersionID != rebuilt.VersionID {
		t.Fatalf("search did not move to the rebuilt version: %#v, %v", current, err)
	}

	if err := service.DeleteKnowledgeSource(ctx, source.ID); err != nil {
		t.Fatal(err)
	}
	listed, err := service.ListKnowledgeSources(ctx)
	if err != nil || len(listed) != 0 {
		t.Fatalf("deleted source remains visible: %#v, %v", listed, err)
	}
	if _, err := service.SearchKnowledge(ctx, KnowledgeSearchInput{Query: "refund", SourceIDs: []string{source.ID}, Limit: 5}); err == nil {
		t.Fatal("deleted source remained searchable")
	}
}

func TestKnowledgeSourceImportRejectsUnsupportedAndOversizedLines(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	service, err := Open(filepath.Join(root, "data"))
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()

	unsupported := filepath.Join(root, "notes.html")
	if err := os.WriteFile(unsupported, []byte("<p>not an approved local source</p>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ImportKnowledgeSource(ctx, KnowledgeSourceImportInput{SourcePath: unsupported, DisplayName: "Notes"}); err == nil {
		t.Fatal("unsupported source type was accepted")
	}
	oversized := filepath.Join(root, "oversized.txt")
	line := make([]byte, maximumKnowledgeChunkBytes+1)
	for index := range line {
		line[index] = 'x'
	}
	if err := os.WriteFile(oversized, line, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ImportKnowledgeSource(ctx, KnowledgeSourceImportInput{SourcePath: oversized, DisplayName: "Oversized"}); err == nil {
		t.Fatal("a line exceeding the deterministic chunk budget was accepted")
	}
}

func TestKnowledgeSourceImportsSearchablePDFTextLayer(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	service, err := Open(filepath.Join(root, "data"))
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	path := filepath.Join(root, "policy.pdf")
	if err := os.WriteFile(path, minimalKnowledgePDF("Refunds require a receipt within thirty days."), 0o600); err != nil {
		t.Fatal(err)
	}
	source, err := service.ImportKnowledgeSource(ctx, KnowledgeSourceImportInput{SourcePath: path, DisplayName: "PDF policy"})
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.SearchKnowledge(ctx, KnowledgeSearchInput{Query: "refund receipt", SourceIDs: []string{source.ID}, Limit: 3})
	if err != nil || len(result.Citations) != 1 || result.Citations[0].Text == "" {
		t.Fatalf("PDF text layer was not searchable: %#v, %v", result, err)
	}
}

func TestKnowledgeSearchSupportsChineseQuestionsWithoutRawFTSSyntax(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	service, err := Open(filepath.Join(root, "data"))
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	path := filepath.Join(root, "policy.md")
	if err := os.WriteFile(path, []byte("退款需要订单号与购买凭证。申请应在购买后 30 天内提交。"), 0o600); err != nil {
		t.Fatal(err)
	}
	source, err := service.ImportKnowledgeSource(ctx, KnowledgeSourceImportInput{SourcePath: path, DisplayName: "退款政策"})
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.SearchKnowledge(ctx, KnowledgeSearchInput{Query: "退款需要哪些材料和期限", SourceIDs: []string{source.ID}, Limit: 3})
	if err != nil || len(result.Citations) != 1 {
		t.Fatalf("Chinese question did not retrieve the authoritative chunk: %#v, %v", result, err)
	}
}
