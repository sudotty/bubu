package data

type WorkflowTarget struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

type WorkflowTrigger struct {
	Kind         string `json:"kind"`
	EveryMinutes int    `json:"everyMinutes,omitempty"`
}

type WorkflowStepDefinition struct {
	ID              string              `json:"id"`
	Kind            string              `json:"kind"`
	Plan            *SafeQueryPlan      `json:"plan,omitempty"`
	GroupPlan       *SafeGroupQueryPlan `json:"groupPlan,omitempty"`
	MaximumAttempts int                 `json:"maxAttempts"`
}

type WorkflowDefinitionInput struct {
	ID        string                   `json:"id,omitempty"`
	Name      string                   `json:"name"`
	Target    WorkflowTarget           `json:"target"`
	Trigger   WorkflowTrigger          `json:"trigger"`
	TimeoutMS int                      `json:"timeoutMs"`
	Steps     []WorkflowStepDefinition `json:"steps"`
}

type WorkflowDefinition struct {
	ID        string                   `json:"id"`
	Name      string                   `json:"name"`
	Target    WorkflowTarget           `json:"target"`
	Trigger   WorkflowTrigger          `json:"trigger"`
	TimeoutMS int                      `json:"timeoutMs"`
	Steps     []WorkflowStepDefinition `json:"steps"`
	Version   int                      `json:"version"`
	CreatedAt string                   `json:"createdAt"`
	UpdatedAt string                   `json:"updatedAt"`
	NextDueAt *string                  `json:"nextDueAt"`
}

type WorkflowTriggerEvent struct {
	ID                string         `json:"id"`
	WorkflowID        string         `json:"workflowId"`
	DefinitionVersion int            `json:"definitionVersion"`
	OperationID       string         `json:"operationId"`
	Target            WorkflowTarget `json:"target"`
	TriggerKind       string         `json:"triggerKind"`
	DueAt             string         `json:"dueAt"`
	Status            string         `json:"status"`
	RunID             *string        `json:"runId"`
	Error             *string        `json:"error"`
	CreatedAt         string         `json:"createdAt"`
	FinishedAt        *string        `json:"finishedAt"`
}

type WorkflowTriggerFinishInput struct {
	ID     string  `json:"id"`
	Status string  `json:"status"`
	RunID  *string `json:"runId"`
	Error  *string `json:"error"`
}

type WorkflowStepResult struct {
	Kind  string `json:"kind"`
	Value any    `json:"value"`
}

type WorkflowStepRun struct {
	ID         string              `json:"id"`
	StepID     string              `json:"stepId"`
	Ordinal    int                 `json:"ordinal"`
	Kind       string              `json:"kind"`
	Status     string              `json:"status"`
	Attempt    int                 `json:"attempt"`
	StartedAt  string              `json:"startedAt"`
	FinishedAt *string             `json:"finishedAt"`
	Error      *string             `json:"error"`
	Result     *WorkflowStepResult `json:"result"`
}

type WorkflowRun struct {
	ID                string            `json:"id"`
	WorkflowID        string            `json:"workflowId"`
	DefinitionVersion int               `json:"definitionVersion"`
	IdempotencyKey    string            `json:"idempotencyKey"`
	Status            string            `json:"status"`
	StartedAt         string            `json:"startedAt"`
	FinishedAt        *string           `json:"finishedAt"`
	Error             *string           `json:"error"`
	Steps             []WorkflowStepRun `json:"steps"`
}
