# ==============================================================================
# Reusable Docker Container Module: main.tf
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = ">= 3.0.2"
    }
  }
}

resource "docker_container" "this" {
  name    = var.container_name
  image   = var.image_name
  restart = var.restart_policy
  wait    = var.wait_for_healthy

  dynamic "networks_advanced" {
    for_each = var.network_name != null ? [var.network_name] : []
    content {
      name    = networks_advanced.value
      aliases = var.network_aliases
    }
  }

  dynamic "ports" {
    for_each = var.external_port != null && var.internal_port != null ? [1] : []
    content {
      internal = var.internal_port
      external = var.external_port
      protocol = var.port_protocol
    }
  }

  env = var.env_vars

  dynamic "volumes" {
    for_each = var.volumes
    content {
      volume_name    = volumes.value.volume_name
      host_path      = volumes.value.host_path
      container_path = volumes.value.container_path
      read_only      = volumes.value.read_only
    }
  }

  dynamic "healthcheck" {
    for_each = length(var.healthcheck_test) > 0 ? [1] : []
    content {
      test         = var.healthcheck_test
      interval     = var.healthcheck_interval
      timeout      = var.healthcheck_timeout
      retries      = var.healthcheck_retries
      start_period = var.healthcheck_start_period
    }
  }
}
