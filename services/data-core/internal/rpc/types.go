package rpc

const ProtocolVersion = 1

type Request struct {
	ProtocolVersion int            `json:"protocolVersion"`
	Auth            string         `json:"auth"`
	ID              string         `json:"id"`
	Method          string         `json:"method"`
	Params          map[string]any `json:"params"`
}

type Error struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

type Response struct {
	ProtocolVersion int    `json:"protocolVersion"`
	ID              string `json:"id"`
	OK              bool   `json:"ok"`
	Result          any    `json:"result,omitempty"`
	Error           *Error `json:"error,omitempty"`
}

type ServiceHealth struct {
	Service         string   `json:"service"`
	ProtocolVersion int      `json:"protocolVersion"`
	Status          string   `json:"status"`
	Capabilities    []string `json:"capabilities"`
}
