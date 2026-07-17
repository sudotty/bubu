package rpc

import (
	"context"
	"sync"
)

type cancellationRegistry struct {
	mutex   sync.Mutex
	cancels map[string]context.CancelFunc
}

func newCancellationRegistry() *cancellationRegistry {
	return &cancellationRegistry{cancels: make(map[string]context.CancelFunc)}
}

func (registry *cancellationRegistry) register(id string, cancel context.CancelFunc) bool {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if _, exists := registry.cancels[id]; exists {
		return false
	}
	registry.cancels[id] = cancel
	return true
}

func (registry *cancellationRegistry) cancel(id string) bool {
	registry.mutex.Lock()
	cancel, exists := registry.cancels[id]
	registry.mutex.Unlock()
	if exists {
		cancel()
	}
	return exists
}

func (registry *cancellationRegistry) complete(id string) {
	registry.mutex.Lock()
	delete(registry.cancels, id)
	registry.mutex.Unlock()
}

func handleCancellationRequest(
	request Request,
	expectedAuth string,
	registry *cancellationRegistry,
) Response {
	if request.Auth != expectedAuth {
		return failure(request.ID, "UNAUTHORIZED", "Invalid process credential", false)
	}
	targetID, ok := stringParam(request.Params, "requestId")
	if !ok || targetID == request.ID {
		return failure(request.ID, "INVALID_ARGUMENT", "requestId is invalid", false)
	}
	return success(request.ID, map[string]any{
		"requestId": targetID,
		"cancelled": registry.cancel(targetID),
	})
}
