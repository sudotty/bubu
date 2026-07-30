package data

import "strings"

const sha256HexLength = 64

func validBackupDigest(value string) bool {
	return len(value) == sha256HexLength && strings.Trim(value, "0123456789abcdef") == ""
}
