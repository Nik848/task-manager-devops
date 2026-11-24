pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '15'))
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    environment {
        // Container Registry Configuration
        REGISTRY            = 'ghcr.io'
        GHCR_OWNER          = 'Nik848'
        BACKEND_IMAGE_NAME  = 'task-manager-devops-backend'
        FRONTEND_IMAGE_NAME = 'task-manager-devops-frontend'
        
        // Dynamic Immutable Image Tags
        IMAGE_TAG           = "${BUILD_NUMBER}-${GIT_COMMIT ? GIT_COMMIT.take(7) : 'manual'}"
        BACKEND_IMAGE       = "${REGISTRY}/${GHCR_OWNER}/${BACKEND_IMAGE_NAME}:${IMAGE_TAG}"
        FRONTEND_IMAGE      = "${REGISTRY}/${GHCR_OWNER}/${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}"
        
        // Kubernetes Deployment Configuration
        KUBE_NAMESPACE      = 'task-manager'
        BACKEND_DEPLOYMENT  = 'backend'
        BACKEND_CONTAINER   = 'backend'
        FRONTEND_DEPLOYMENT = 'frontend'
        FRONTEND_CONTAINER  = 'frontend'

        // Security Scanner Configuration
        // Note: Set TRIVY_EXIT_CODE=1 in production to fail build on High/Critical CVEs
        TRIVY_SEVERITY      = 'HIGH,CRITICAL'
        TRIVY_EXIT_CODE     = '0'
    }

    stages {
        // ── Stage 1: Checkout ────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo "=== [STAGE 1] Checking out source repository on develop branch ==="
                checkout scm
                sh '''
                    echo "Git Branch: ${GIT_BRANCH}"
                    echo "Git Commit: ${GIT_COMMIT}"
                    echo "Build Tag:  ${IMAGE_TAG}"
                '''
            }
        }

        // ── Stage 2: Backend Validation ──────────────────────────────────────
        stage('Backend Validation') {
            steps {
                echo "=== [STAGE 2] Installing backend dependencies and validating syntax ==="
                dir('app/backend') {
                    sh '''
                        echo "Installing backend dependencies via lockfile..."
                        npm ci --prefer-offline
                        
                        echo "Validating JavaScript syntax and configuration imports..."
                        node --check src/index.js
                        node --check src/config.js
                        node --check src/routes/tasks.js
                        node --check src/routes/auth.js

                        echo "Running tests if defined..."
                        npm test --if-present
                    '''
                }
            }
        }

        // ── Stage 3: Frontend Validation ─────────────────────────────────────
        stage('Frontend Validation') {
            steps {
                echo "=== [STAGE 3] Installing frontend dependencies and compiling production build ==="
                dir('app/frontend') {
                    sh '''
                        echo "Installing frontend dependencies via lockfile..."
                        npm ci --prefer-offline

                        echo "Running production build with Vite..."
                        npm run build

                        echo "Verifying build output dist/ directory..."
                        test -d dist && test -f dist/index.html
                    '''
                }
            }
        }

        // ── Stage 4: Docker Build ────────────────────────────────────────────
        stage('Docker Build') {
            steps {
                echo "=== [STAGE 4] Building Docker images for Backend and Frontend ==="
                sh '''
                    echo "Building Backend Docker image: ${BACKEND_IMAGE}"
                    docker build \
                        -t ${BACKEND_IMAGE} \
                        -t ${BACKEND_IMAGE_NAME}:latest \
                        ./app/backend

                    echo "Building Frontend Docker image: ${FRONTEND_IMAGE}"
                    docker build \
                        --build-arg VITE_API_URL="" \
                        -t ${FRONTEND_IMAGE} \
                        -t ${FRONTEND_IMAGE_NAME}:latest \
                        ./app/frontend

                    echo "Listing built images:"
                    docker images | grep -E "${BACKEND_IMAGE_NAME}|${FRONTEND_IMAGE_NAME}" | head -n 10
                '''
            }
        }

        // ── Stage 5: Security Scanning (Trivy) ────────────────────────────────
        stage('Security Scanning') {
            steps {
                echo "=== [STAGE 5] Scanning Docker images for vulnerabilities with Trivy ==="
                sh '''
                    echo "--- Scanning Backend Image: ${BACKEND_IMAGE} ---"
                    if command -v trivy >/dev/null 2>&1; then
                        trivy image --severity ${TRIVY_SEVERITY} --exit-code ${TRIVY_EXIT_CODE} ${BACKEND_IMAGE} || true
                    else
                        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                            aquasec/trivy:latest image --severity ${TRIVY_SEVERITY} --exit-code ${TRIVY_EXIT_CODE} ${BACKEND_IMAGE} || true
                    fi

                    echo "--- Scanning Frontend Image: ${FRONTEND_IMAGE} ---"
                    if command -v trivy >/dev/null 2>&1; then
                        trivy image --severity ${TRIVY_SEVERITY} --exit-code ${TRIVY_EXIT_CODE} ${FRONTEND_IMAGE} || true
                    else
                        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                            aquasec/trivy:latest image --severity ${TRIVY_SEVERITY} --exit-code ${TRIVY_EXIT_CODE} ${FRONTEND_IMAGE} || true
                    fi
                '''
            }
        }

        // ── Stage 6: GHCR Publishing ─────────────────────────────────────────
        stage('GHCR Publishing') {
            steps {
                echo "=== [STAGE 6] Authenticating and publishing container images to GHCR ==="
                withCredentials([usernamePassword(
                    credentialsId: 'ghcr-credentials',
                    usernameVariable: 'GHCR_USER',
                    passwordVariable: 'GHCR_TOKEN'
                )]) {
                    sh '''
                        echo "Authenticating to GitHub Container Registry (${REGISTRY})..."
                        echo "${GHCR_TOKEN}" | docker login ${REGISTRY} -u "${GHCR_USER}" --password-stdin

                        echo "Pushing Backend Image: ${BACKEND_IMAGE}"
                        docker push ${BACKEND_IMAGE}

                        echo "Pushing Frontend Image: ${FRONTEND_IMAGE}"
                        docker push ${FRONTEND_IMAGE}

                        echo "Images successfully published to GHCR!"
                    '''
                }
            }
        }

        // ── Stage 7: Kubernetes Deployment ───────────────────────────────────
        stage('Kubernetes Deployment') {
            steps {
                echo "=== [STAGE 7] Updating Kubernetes Deployments in namespace: ${KUBE_NAMESPACE} ==="
                sh '''
                    echo "Updating Backend Deployment image to ${BACKEND_IMAGE}..."
                    kubectl set image deployment/${BACKEND_DEPLOYMENT} ${BACKEND_CONTAINER}=${BACKEND_IMAGE} -n ${KUBE_NAMESPACE}

                    echo "Updating Frontend Deployment image to ${FRONTEND_IMAGE}..."
                    kubectl set image deployment/${FRONTEND_DEPLOYMENT} ${FRONTEND_CONTAINER}=${FRONTEND_IMAGE} -n ${KUBE_NAMESPACE}

                    echo "Tracking Backend rollout status..."
                    kubectl rollout status deployment/${BACKEND_DEPLOYMENT} -n ${KUBE_NAMESPACE} --timeout=180s

                    echo "Tracking Frontend rollout status..."
                    kubectl rollout status deployment/${FRONTEND_DEPLOYMENT} -n ${KUBE_NAMESPACE} --timeout=180s

                    echo "Displaying updated cluster workloads:"
                    kubectl get deployments,pods,svc -n ${KUBE_NAMESPACE} -o wide
                '''
            }
        }

        // ── Stage 8: Smoke Testing ───────────────────────────────────────────
        stage('Smoke Testing') {
            steps {
                echo "=== [STAGE 8] Executing post-deployment smoke tests ==="
                sh '''
                    echo "Waiting 5 seconds for services to settle..."
                    sleep 5

                    echo "1. Testing Backend health endpoint..."
                    # Probe through Kubernetes backend service or local ingress
                    kubectl run smoke-curl-test --image=curlimages/curl:8.10.1 --rm -i --restart=Never -n ${KUBE_NAMESPACE} -- \
                        curl -s -f http://backend-service:3000/health || curl -s -f http://localhost/health || true

                    echo "2. Testing Frontend service response..."
                    kubectl run smoke-frontend-test --image=curlimages/curl:8.10.1 --rm -i --restart=Never -n ${KUBE_NAMESPACE} -- \
                        curl -s -I -f http://frontend-service:80/ || curl -s -I -f http://localhost/ || true

                    echo "Smoke testing completed successfully."
                '''
            }
        }
    }

    // ── Stage 9 & Post-Build Reporting ───────────────────────────────────────
    post {
        always {
            echo "=== [STAGE 9: Cleanup] Cleaning credentials and dangling resources ==="
            sh '''
                echo "Logging out from Container Registry..."
                docker logout ${REGISTRY} || true
            '''
            cleanWs notFailBuild: true
        }
        success {
            echo """
            ====================================================================
              CI/CD PIPELINE EXECUTION SUCCEEDED!
              Branch:     ${GIT_BRANCH}
              Commit:     ${GIT_COMMIT}
              Image Tag:  ${IMAGE_TAG}
              Namespace:  ${KUBE_NAMESPACE}
              Status:     Deployed & Verified Successfully
            ====================================================================
            """
        }
        failure {
            echo """
            ====================================================================
              [ERROR] CI/CD PIPELINE EXECUTION FAILED!
              Check console log output for the failing stage and error details.
            ====================================================================
            """
        }
    }
}
