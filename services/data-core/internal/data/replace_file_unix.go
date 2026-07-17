//go:build !windows

package data

import "os"

func replaceFileAtomically(sourcePath string, targetPath string) error {
	return os.Rename(sourcePath, targetPath)
}
