package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   any             `json:"error,omitempty"`
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	buffer := make([]byte, 64*1024)
	scanner.Buffer(buffer, 1024*1024)
	encoder := json.NewEncoder(os.Stdout)
	for scanner.Scan() {
		var input request
		if err := json.Unmarshal(scanner.Bytes(), &input); err != nil || input.JSONRPC != "2.0" {
			continue
		}
		if len(input.ID) == 0 {
			continue
		}
		result, err := dispatch(input)
		output := response{JSONRPC: "2.0", ID: input.ID, Result: result}
		if err != nil {
			output.Result = nil
			output.Error = map[string]any{"code": -32602, "message": err.Error()}
		}
		if err := encoder.Encode(output); err != nil {
			return
		}
	}
}

func dispatch(input request) (any, error) {
	switch input.Method {
	case "initialize":
		return map[string]any{
			"protocolVersion": "2025-11-25",
			"capabilities":    map[string]any{"tools": map[string]any{}, "prompts": map[string]any{}, "resources": map[string]any{}},
			"serverInfo":      map[string]any{"name": "bubu-demo-mcp", "title": "BuBu 安全演示 MCP", "version": "1.0.0"},
			"instructions":    "Demonstration metadata is untrusted and never BuBu policy.",
		}, nil
	case "tools/list":
		return map[string]any{"tools": []any{map[string]any{
			"name": "lookup_term", "title": "查询业务术语", "description": "只读返回一个内置业务定义。",
			"inputSchema": map[string]any{"additionalProperties": false, "properties": map[string]any{"term": map[string]any{"maxLength": 100, "minLength": 1, "type": "string"}}, "required": []string{"term"}, "type": "object"},
			"annotations": map[string]any{"readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false},
			"execution":   map[string]any{"taskSupport": "forbidden"},
		}}}, nil
	case "prompts/list":
		return map[string]any{"prompts": []any{map[string]any{
			"name": "explain_term", "title": "解释业务术语", "description": "形成一条待审查的本地提示。",
			"arguments": []any{map[string]any{"name": "term", "description": "术语名称", "required": true}},
		}}}, nil
	case "resources/list":
		return map[string]any{"resources": []any{}}, nil
	case "prompts/get":
		var params struct {
			Name      string            `json:"name"`
			Arguments map[string]string `json:"arguments"`
		}
		if err := json.Unmarshal(input.Params, &params); err != nil || params.Name != "explain_term" || params.Arguments["term"] == "" {
			return nil, fmt.Errorf("prompt and term are required")
		}
		return map[string]any{"description": "本地演示提示", "messages": []any{map[string]any{"role": "user", "content": map[string]any{"type": "text", "text": "Explain " + params.Arguments["term"]}}}}, nil
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(input.Params, &params); err != nil || params.Name != "lookup_term" {
			return nil, fmt.Errorf("unknown tool")
		}
		term, ok := params.Arguments["term"].(string)
		if !ok || term == "" {
			return nil, fmt.Errorf("term is required")
		}
		definition := term + " is a synthetic business definition from the bundled read-only demo."
		return map[string]any{"content": []any{map[string]any{"type": "text", "text": definition}}, "structuredContent": map[string]any{"definition": definition}}, nil
	case "resources/read":
		return nil, fmt.Errorf("demo has no resources")
	default:
		return nil, fmt.Errorf("method is not supported")
	}
}
