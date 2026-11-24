# ==============================================================================
# Outputs for Reusable Docker Container Module
# ==============================================================================

output "container_id" {
  description = "Unique ID of the created container"
  value       = docker_container.this.id
}

output "container_name" {
  description = "Name of the container"
  value       = docker_container.this.name
}

output "image" {
  description = "Docker image assigned to the container"
  value       = docker_container.this.image
}

output "published_port" {
  description = "External port published to host"
  value       = var.external_port
}

output "internal_port" {
  description = "Internal port exposed by container"
  value       = var.internal_port
}
