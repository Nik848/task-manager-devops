# ==============================================================================
# Outputs: Task Management System Terraform Infrastructure (Phase 6)
# ==============================================================================

output "network_id" {
  description = "ID of the custom Docker bridge network"
  value       = docker_network.app_network.id
}

output "network_name" {
  description = "Name of the custom Docker bridge network"
  value       = docker_network.app_network.name
}

output "log_volume_name" {
  description = "Name of the Docker persistent volume for application logs"
  value       = docker_volume.app_logs.name
}

output "backend_container_id" {
  description = "ID of the running backend container"
  value       = module.backend.container_id
}

output "backend_container_name" {
  description = "Name of the running backend container"
  value       = module.backend.container_name
}

output "backend_endpoint" {
  description = "URL endpoint to access the backend API on the host"
  value       = "http://localhost:${var.backend_host_port}"
}

output "frontend_container_id" {
  description = "ID of the running frontend container"
  value       = module.frontend.container_id
}

output "frontend_container_name" {
  description = "Name of the running frontend container"
  value       = module.frontend.container_name
}

output "frontend_url" {
  description = "URL to access the frontend application on the host"
  value       = "http://localhost:${var.frontend_host_port}"
}

output "environment_prefix" {
  description = "Prefix applied to managed resources"
  value       = var.environment_prefix
}
