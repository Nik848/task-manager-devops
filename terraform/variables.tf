# ==============================================================================
# Terraform Root Variables: Task Management System (Phase 6)
# ==============================================================================

variable "docker_host" {
  description = "Docker daemon connection URL (e.g. unix:///var/run/docker.sock on Linux/WSL2, npipe:////./pipe/docker_engine on Windows)"
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "environment_prefix" {
  description = "Prefix applied to Terraform-managed container and resource names"
  type        = string
  default     = "taskmanager-tf"
}

variable "network_name" {
  description = "Name of the custom Docker bridge network"
  type        = string
  default     = "taskmanager-tf-network"
}

variable "volume_name" {
  description = "Name of the Docker persistent volume for application logs"
  type        = string
  default     = "taskmanager-tf-logs"
}

variable "backend_image" {
  description = "Docker image tag for the backend service"
  type        = string
  default     = "taskmanager-backend:latest"
}

variable "frontend_image" {
  description = "Docker image tag for the frontend service"
  type        = string
  default     = "taskmanager-frontend:latest"
}

variable "backend_host_port" {
  description = "Host port mapped to backend service (avoids collision with Compose on 3000)"
  type        = number
  default     = 3001
}

variable "backend_internal_port" {
  description = "Container port the backend listens on"
  type        = number
  default     = 3000
}

variable "frontend_host_port" {
  description = "Host port mapped to frontend service (avoids collision with Compose on 8080, K8s on 80, Jenkins on 8085)"
  type        = number
  default     = 8088
}

variable "frontend_internal_port" {
  description = "Container port the frontend listens on (Nginx)"
  type        = number
  default     = 80
}

variable "app_node_env" {
  description = "Node.js environment mode"
  type        = string
  default     = "production"
}

variable "app_log_level" {
  description = "Application log verbosity level"
  type        = string
  default     = "info"
}

variable "cors_origin" {
  description = "Allowed origins for CORS requests"
  type        = string
  default     = "http://localhost:8088,http://localhost:8080,http://localhost:3000,http://localhost"
}

variable "admin_name" {
  description = "Default admin display name"
  type        = string
  default     = "Admin"
}

variable "database_url" {
  description = "PostgreSQL database connection URL (Supabase)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "Secret key used for signing JWT authentication tokens (leave empty or supply explicitly; never hardcoded)"
  type        = string
  sensitive   = true
  default     = ""
}
