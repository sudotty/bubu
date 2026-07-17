package main

import (
	"fmt"
	"os"

	"github.com/sudotty/bubu/services/data-core/internal/data"
	"github.com/sudotty/bubu/services/data-core/internal/rpc"
)

func main() {
	auth := os.Getenv("BUBU_RPC_TOKEN")
	if len(auth) < 32 {
		fmt.Fprintln(os.Stderr, "BUBU_RPC_TOKEN must be set by the Electron supervisor")
		os.Exit(78)
	}
	dataDirectory := os.Getenv("BUBU_DATA_DIR")
	service, err := data.Open(dataDirectory)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open data core: %v\n", err)
		os.Exit(1)
	}
	defer service.Close()
	if err := rpc.Serve(os.Stdin, os.Stdout, auth, service); err != nil {
		fmt.Fprintf(os.Stderr, "data-core stopped: %v\n", err)
		os.Exit(1)
	}
}
