# ==============================================================================
# Terraform Root Configuration: Task Management System (Phase 6)
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.2"
    }
  }
}

provider "docker" {
  host = var.docker_host
}

# ------------------------------------------------------------------------------
# 1. Custom Docker Bridge Network
# ------------------------------------------------------------------------------
resource "docker_network" "app_network" {
  name   = var.network_name
  driver = "bridge"
}

# ------------------------------------------------------------------------------
# 2. Persistent Volume for Application Logs
# ------------------------------------------------------------------------------
resource "docker_volume" "app_logs" {
  name = var.volume_name
}

# ------------------------------------------------------------------------------
# 3. Backend Service Container (Reusable Module)
# ------------------------------------------------------------------------------
module "backend" {
  source = "./modules/docker_container"

  container_name  = "${var.environment_prefix}-backend"
  image_name      = var.backend_image
  internal_port   = var.backend_internal_port
  external_port   = var.backend_host_port
  network_name    = docker_network.app_network.name
  network_aliases = ["backend", "backend-service"]

  env_vars = compact([
    "NODE_ENV=${var.app_node_env}",
    "PORT=${var.backend_internal_port}",
    "LOG_LEVEL=${var.app_log_level}",
    "LOG_DIR=/app/logs",
    "CORS_ORIGIN=${var.cors_origin}",
    "ADMIN_NAME=${var.admin_name}",
    var.database_url != "" ? "DATABASE_URL=${var.database_url}" : null,
    var.jwt_secret != "" ? "JWT_SECRET=${var.jwt_secret}" : null
  ])

  volumes = [
    {
      volume_name    = docker_volume.app_logs.name
      container_path = "/app/logs"
      read_only      = false
    }
  ]

  healthcheck_test         = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${var.backend_internal_port}/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\""]
  healthcheck_interval     = "15s"
  healthcheck_timeout      = "5s"
  healthcheck_retries      = 3
  healthcheck_start_period = "10s"
}

# ------------------------------------------------------------------------------
# 4. Frontend Service Container (Reusable Module)
# ------------------------------------------------------------------------------
module "frontend" {
  source = "./modules/docker_container"

  container_name  = "${var.environment_prefix}-frontend"
  image_name      = var.frontend_image
  internal_port   = var.frontend_internal_port
  external_port   = var.frontend_host_port
  network_name    = docker_network.app_network.name
  network_aliases = ["frontend"]

  env_vars = []

  healthcheck_test         = ["CMD-SHELL", "wget --spider -q http://127.0.0.1/ || exit 1"]
  healthcheck_interval     = "15s"
  healthcheck_timeout      = "5s"
  healthcheck_retries      = 3
  healthcheck_start_period = "5s"

  depends_on = [module.backend]
}
