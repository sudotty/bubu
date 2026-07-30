package data

type WorkflowTarget struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

type WorkflowTrigger struct {
	Kind         string `json:"kind"`
	EveryMinutes int    `json:"everyMinutes,omitempty"`
	Cadence      string `json:"cadence,omitempty"`
	TimeZone     string `json:"timeZone,omitempty"`
	Hour         int    `json:"hour,omitempty"`
	Minute       int    `json:"minute,omitempty"`
	Weekday      *int   `json:"weekday,omitempty"`
	DayOfMonth   *int   `json:"dayOfMonth,omitempty"`
}

type WorkflowStepDefinition struct {
	ID                  string              `json:"id"`
	Kind                string              `json:"kind"`
	Plan                *SafeQueryPlan      `json:"plan,omitempty"`
	GroupPlan           *SafeGroupQueryPlan `json:"groupPlan,omitempty"`
	MaximumAttempts     int                 `json:"maxAttempts"`
	Title               string              `json:"title,omitempty"`
	Action              string              `json:"action,omitempty"`
	Risk                string              `json:"risk,omitempty"`
	ExpiresAfterMinutes int                 `json:"expiresAfterMinutes,omitempty"`
}

type WorkflowApprovalRequest struct {
	SchemaVersion     int            `json:"schemaVersion"`
	ID                string         `json:"id"`
	WorkflowID        string         `json:"workflowId"`
	DefinitionVersion int            `json:"definitionVersion"`
	RunID             string         `json:"runId"`
	StepID            string         `json:"stepId"`
	Ordinal           int            `json:"ordinal"`
	Target            WorkflowTarget `json:"target"`
	Title             string         `json:"title"`
	Action            string         `json:"action"`
	Risk              string         `json:"risk"`
	Status            string         `json:"status"`
	RequestedAt       string         `json:"requestedAt"`
	ExpiresAt         string         `json:"expiresAt"`
	DecidedAt         *string        `json:"decidedAt"`
	DecisionNote      *string        `json:"decisionNote"`
}

type WorkflowApprovalDecisionInput struct {
	ApprovalID string  `json:"approvalId"`
	Decision   string  `json:"decision"`
	Note       *string `json:"note,omitempty"`
}

type WorkflowDefinitionInput struct {
	ID        string                   `json:"id,omitempty"`
	Name      string                   `json:"name"`
	Target    WorkflowTarget           `json:"target"`
	ThreadID  string                   `json:"threadId"`
	Trigger   WorkflowTrigger          `json:"trigger"`
	TimeoutMS int                      `json:"timeoutMs"`
	Steps     []WorkflowStepDefinition `json:"steps"`
}

type WorkflowDefinition struct {
	ID        string                   `json:"id"`
	Name      string                   `json:"name"`
	Target    WorkflowTarget           `json:"target"`
	ThreadID  string                   `json:"threadId"`
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
