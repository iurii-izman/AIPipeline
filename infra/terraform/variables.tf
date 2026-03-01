variable "environment" {
  description = "Target environment name"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "deploy_webhook_url" {
  description = "Deploy webhook endpoint for selected environment"
  type        = string
  sensitive   = true
}

variable "deploy_webhook_token" {
  description = "Deploy webhook bearer token for selected environment"
  type        = string
  sensitive   = true
}

variable "status_auth_token" {
  description = "Bearer token for /status endpoint"
  type        = string
  sensitive   = true
}

variable "model_classifier_mode" {
  description = "WF-3 classifier mode"
  type        = string
  default     = "full_primary"
}

variable "model_kill_switch" {
  description = "WF-3 kill switch"
  type        = bool
  default     = false
}
