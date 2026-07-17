package rpc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
)

const maxMessageBytes = 1 << 20

func Serve(input io.Reader, output io.Writer, expectedAuth string) error {
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 64*1024), maxMessageBytes)
	encoder := json.NewEncoder(output)

	for scanner.Scan() {
		request, err := DecodeRequest(scanner.Bytes())
		if err != nil {
			if encodeErr := encoder.Encode(failure("invalid-request", "INVALID_REQUEST", "Invalid RPC request", false)); encodeErr != nil {
				return fmt.Errorf("encode invalid request response: %w", encodeErr)
			}
			continue
		}
		if err := encoder.Encode(Handle(request, expectedAuth)); err != nil {
			return fmt.Errorf("encode response: %w", err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read request stream: %w", err)
	}
	return nil
}
