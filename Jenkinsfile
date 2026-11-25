pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    triggers {
        // Poll GitHub every minute for new commits on develop branch
        pollSCM('* * * * *')
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
                '''
            }
        }

        // ── Stage 2: Dependency Installation ──────────────────────────────────
        stage('Dependency Installation') {
            steps {
                echo "=== [STAGE 2] Installing backend and frontend dependencies ==="
                sh '''
                    echo "--- Installing Backend Dependencies ---"
                    cd app/backend
                    npm ci --prefer-offline

                    echo "--- Installing Frontend Dependencies ---"
                    cd ../frontend
                    npm ci --prefer-offline
                '''
            }
        }

        // ── Stage 3: Build ───────────────────────────────────────────────────
        stage('Build') {
            steps {
                echo "=== [STAGE 3] Building Application ==="
                sh '''
                    echo "--- Building Frontend (Vite Production Assets) ---"
                    cd app/frontend
                    npm run build

                    echo "Verifying compiled production assets in dist/:"
                    ls -la dist/
                '''
            }
        }

        // ── Stage 4: Automated Testing ───────────────────────────────────────
        stage('Automated Testing') {
            steps {
                echo "=== [STAGE 4] Executing Automated Tests & Integrity Checks ==="
                sh '''
                    echo "--- Running Backend Syntax & Route Integrity Checks ---"
                    node --check app/backend/src/index.js
                    node --check app/backend/src/config.js
                    node --check app/backend/src/routes/tasks.js
                    node --check app/backend/src/routes/auth.js
                    node --check app/backend/src/routes/health.js
                    node --check app/backend/src/routes/users.js
                    echo "Backend syntax verification: PASSED"

                    echo "--- Checking for npm test scripts ---"
                    cd app/backend
                    npm test --if-present

                    cd ../frontend
                    npm test --if-present
                    echo "Automated testing completed."
                '''
            }
        }

        // ── Stage 5: SonarQube Static Analysis ───────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                echo "=== [STAGE 5] Running SonarQube Code Quality & Security Analysis ==="
                withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        npx --yes @sonar/scan \
                            -Dsonar.host.url=http://host.docker.internal:9000 \
                            -Dsonar.token="${SONAR_TOKEN}" \
                            -Dsonar.javascript.node.maxspace=512
                    '''
                }
            }
        }

        // ── Stage 6: Build Docker Images ─────────────────────────────────────
        stage('Docker Build') {
            steps {
                echo "=== [STAGE 6] Building Hardened Docker Images ==="
                sh '''
                    docker build -t taskmanager-backend:${BUILD_NUMBER} ./app/backend
                    docker build -t taskmanager-frontend:${BUILD_NUMBER} ./app/frontend
                '''
            }
        }

        // ── Stage 7: Trivy Backend Image Scan ────────────────────────────────
        stage('Trivy Backend Scan') {
            steps {
                echo "=== [STAGE 7] Scanning Backend Image for HIGH/CRITICAL Vulnerabilities ==="
                sh '''
                    trivy image --exit-code 1 --scanners vuln --severity HIGH,CRITICAL --no-progress taskmanager-backend:${BUILD_NUMBER}
                '''
            }
        }

        // ── Stage 8: Trivy Frontend Image Scan ───────────────────────────────
        stage('Trivy Frontend Scan') {
            steps {
                echo "=== [STAGE 8] Scanning Frontend Image for HIGH/CRITICAL Vulnerabilities ==="
                sh '''
                    trivy image --exit-code 1 --scanners vuln --severity HIGH,CRITICAL --no-progress taskmanager-frontend:${BUILD_NUMBER}
                '''
            }
        }

        // ── Stage 9: Packaging ───────────────────────────────────────────────
        stage('Packaging') {
            steps {
                echo "=== [STAGE 9] Packaging Application Artifacts ==="
                sh '''
                    echo "--- Packaging Frontend Artifacts ---"
                    mkdir -p release
                    tar -czf release/taskmanager-frontend.tar.gz -C app/frontend/dist .

                    echo "--- Packaging Backend Artifacts ---"
                    tar -czf release/taskmanager-backend.tar.gz -C app/backend package.json package-lock.json src

                    echo "Packaged artifacts generated:"
                    ls -lh release/
                '''
                archiveArtifacts artifacts: 'release/*.tar.gz', fingerprint: true
            }
        }
    }

    post {
        always {
            echo "Pipeline run completed. Cleaning up temporary build images and workspace."
            sh '''
                docker rmi -f taskmanager-backend:${BUILD_NUMBER} taskmanager-frontend:${BUILD_NUMBER} >/dev/null 2>&1 || true
            '''
            cleanWs notFailBuild: true
        }
        success {
            echo """
            ====================================================================
              PHASE 2: JENKINS CONTINUOUS INTEGRATION SUCCESSFUL!
              Branch:    ${GIT_BRANCH}
              Commit:    ${GIT_COMMIT}
              Artifacts: release/taskmanager-frontend.tar.gz
                         release/taskmanager-backend.tar.gz
            ====================================================================
            """
        }
        failure {
            echo """
            ====================================================================
              [ERROR] Jenkins CI Pipeline Execution Failed!
            ====================================================================
            """
        }
    }
}
