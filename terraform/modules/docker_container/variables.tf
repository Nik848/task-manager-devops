# ==============================================================================
# Variables for Reusable Docker Container Module
# ==============================================================================

variable "container_name" {
  description = "Name of the Docker container"
  type        = string
}

variable "image_name" {
  description = "Docker image name or tag to use for the container"
  type        = string
}

variable "restart_policy" {
  description = "Container restart policy (e.g. unless-stopped, always, no)"
  type        = string
  default     = "unless-stopped"
}

variable "network_mode" {
  description = "Network mode for the container (default: bridge)"
  type        = string
  default     = "bridge"
}

variable "network_name" {
  description = "Name of the custom Docker network to connect to"
  type        = string
  default     = null
}

variable "network_aliases" {
  description = "List of network aliases for the container within the custom network"
  type        = list(string)
  default     = []
}

variable "internal_port" {
  description = "Internal port exposed by the container"
  type        = number
  default     = null
}

variable "external_port" {
  description = "Host port mapped to the container internal port"
  type        = number
  default     = null
}

variable "port_protocol" {
  description = "Port mapping protocol (tcp or udp)"
  type        = string
  default     = "tcp"
}

variable "env_vars" {
  description = "List of environment variables in KEY=VALUE format"
  type        = list(string)
  default     = []
}

variable "volumes" {
  description = "List of volume mounts for the container"
  type = list(object({
    volume_name    = optional(string)
    host_path      = optional(string)
    container_path = string
    read_only      = optional(bool, false)
  }))
  default = []
}

variable "healthcheck_test" {
  description = "Command array for the container healthcheck"
  type        = list(string)
  default     = []
}

variable "healthcheck_interval" {
  description = "Interval between healthchecks"
  type        = string
  default     = "15s"
}

variable "healthcheck_timeout" {
  description = "Timeout for healthcheck completion"
  type        = string
  default     = "5s"
}

variable "healthcheck_retries" {
  description = "Consecutive failures needed to report unhealthy"
  type        = number
  default     = 3
}

variable "healthcheck_start_period" {
  description = "Start period for container initialization before counting failures"
  type        = string
  default     = "10s"
}

variable "wait_for_healthy" {
  description = "Whether to wait for the container to become healthy before completing apply"
  type        = bool
  default     = false
}
