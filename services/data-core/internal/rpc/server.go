package rpc

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
)

const maxMessageBytes = 1 << 20

type requestJob struct {
	request Request
	ctx     context.Context
	cancel  context.CancelFunc
}

func Serve(input io.Reader, output io.Writer, expectedAuth string, datasets DatasetService) error {
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 64*1024), maxMessageBytes)
	encoder := json.NewEncoder(output)
	registry := newCancellationRegistry()
	jobs := make(chan requestJob, 64)
	workerDone := make(chan struct{})
	var encoderMutex sync.Mutex
	var encoderError error
	writeResponse := func(response Response) {
		encoderMutex.Lock()
		defer encoderMutex.Unlock()
		if encoderError == nil {
			encoderError = encoder.Encode(response)
		}
	}
	go func() {
		defer close(workerDone)
		for job := range jobs {
			response := HandleWithData(job.ctx, job.request, expectedAuth, datasets)
			if !response.OK && job.ctx.Err() != nil {
				response = failure(job.request.ID, "CANCELLED", "Operation cancelled", false)
			}
			registry.complete(job.request.ID)
			job.cancel()
			writeResponse(response)
		}
	}()

	for scanner.Scan() {
		request, err := DecodeRequest(scanner.Bytes())
		if err != nil {
			writeResponse(failure("invalid-request", "INVALID_REQUEST", "Invalid RPC request", false))
			continue
		}
		if request.Method == "system.cancel" {
			writeResponse(handleCancellationRequest(request, expectedAuth, registry))
			continue
		}
		ctx, cancel := context.WithCancel(context.Background())
		if !registry.register(request.ID, cancel) {
			cancel()
			writeResponse(failure(request.ID, "DUPLICATE_REQUEST", "Request id is already active", false))
			continue
		}
		jobs <- requestJob{request: request, ctx: ctx, cancel: cancel}
	}

	close(jobs)
	<-workerDone
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read request stream: %w", err)
	}
	if encoderError != nil {
		return fmt.Errorf("encode response: %w", encoderError)
	}
	return nil
}
