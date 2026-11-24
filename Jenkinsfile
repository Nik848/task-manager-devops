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

        // ── Stage 5: Packaging ───────────────────────────────────────────────
        stage('Packaging') {
            steps {
                echo "=== [STAGE 5] Packaging Application Artifacts ==="
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
            echo "Pipeline run completed."
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
