package data

import "testing"

func TestInferColumnType(t *testing.T) {
	tests := []struct {
		name   string
		values []string
		want   ColumnType
	}{
		{name: "empty", values: []string{"", "  "}, want: ColumnTypeNull},
		{name: "boolean", values: []string{"true", "FALSE"}, want: ColumnTypeBoolean},
		{name: "integer", values: []string{"1", "-20", ""}, want: ColumnTypeInteger},
		{name: "real", values: []string{"1", "2.5"}, want: ColumnTypeReal},
		{name: "leading zero identifier", values: []string{"001", "002"}, want: ColumnTypeText},
		{name: "date time", values: []string{"2026-07-17", "2026-07-18 10:30:00"}, want: ColumnTypeDateTime},
		{name: "mixed", values: []string{"1", "North"}, want: ColumnTypeText},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			state := NewTypeInference()
			for _, value := range test.values {
				state = state.Observe(value)
			}
			if got := state.Type(); got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

func TestNormalizeHeadersCreatesStableUniqueNames(t *testing.T) {
	got := NormalizeHeaders([]string{" Name ", "", "Name", "Name"})
	want := []string{"Name", "Column 2", "Name (2)", "Name (3)"}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("header %d: got %q, want %q", index, got[index], want[index])
		}
	}
}
