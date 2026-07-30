package rpc

func validGroupCadence(value string) bool {
	switch value {
	case "one-off", "daily", "weekly", "monthly", "dataset-version":
		return true
	default:
		return false
	}
}
