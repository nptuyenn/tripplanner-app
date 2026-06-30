pipeline {
  agent { label 'Node' }

  options {
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'DOCKER_NAMESPACE',
      defaultValue: 'nptuyenn',
      description: 'Docker Hub namespace that owns the TripPlanner images'
    )
  }

  environment {
    DOCKER_REGISTRY = 'docker.io'
    FRONTEND_IMAGE_NAME = 'tripplanner-frontend'
    AUTH_IMAGE_NAME = 'tripplanner-auth'
    TRIP_IMAGE_NAME = 'tripplanner-trips'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm

        script {
          env.GIT_SHA = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true
          ).trim()

          def baseRevision = env.CHANGE_TARGET
            ? "origin/${env.CHANGE_TARGET}"
            : env.GIT_PREVIOUS_SUCCESSFUL_COMMIT

          def canDiff = baseRevision?.trim() &&
            sh(
              script: "git rev-parse --verify '${baseRevision}^{commit}' >/dev/null 2>&1",
              returnStatus: true
            ) == 0

          def changedPaths = canDiff
            ? sh(
                script: "git diff --name-only '${baseRevision}'...HEAD",
                returnStdout: true
              ).trim().split('\n').findAll { it }
            : []

          def buildEverything = !canDiff || changedPaths.any {
            it == 'Jenkinsfile' ||
            it == '.dockerignore' ||
            it == 'package.json' ||
            it == 'package-lock.json'
          }

          env.BUILD_FRONTEND = (
            buildEverything || changedPaths.any { it.startsWith('frontend/') }
          ).toString()
          env.BUILD_AUTH = (
            buildEverything || changedPaths.any { it.startsWith('backend/auth-service/') }
          ).toString()
          env.BUILD_TRIPS = (
            buildEverything || changedPaths.any { it.startsWith('backend/trip-service/') }
          ).toString()

          env.FRONTEND_IMAGE =
            "${params.DOCKER_NAMESPACE}/${env.FRONTEND_IMAGE_NAME}:${env.GIT_SHA}"
          env.AUTH_IMAGE =
            "${params.DOCKER_NAMESPACE}/${env.AUTH_IMAGE_NAME}:${env.GIT_SHA}"
          env.TRIP_IMAGE =
            "${params.DOCKER_NAMESPACE}/${env.TRIP_IMAGE_NAME}:${env.GIT_SHA}"

          currentBuild.description =
            "${env.GIT_SHA} | frontend=${env.BUILD_FRONTEND}, auth=${env.BUILD_AUTH}, trips=${env.BUILD_TRIPS}"
        }
      }
    }

    stage('Install dependencies') {
      when {
        expression {
          env.BUILD_FRONTEND == 'true' ||
          env.BUILD_AUTH == 'true' ||
          env.BUILD_TRIPS == 'true'
        }
      }
      steps {
        sh 'npm ci'
      }
    }

    stage('Quality checks') {
      parallel {
        stage('Frontend') {
          when {
            expression { env.BUILD_FRONTEND == 'true' }
          }
          steps {
            sh 'npm run check -w @tripplanner/frontend'
            sh 'npm run build -w @tripplanner/frontend'
          }
        }

        stage('Auth service') {
          when {
            expression { env.BUILD_AUTH == 'true' }
          }
          steps {
            sh 'npm run check -w @tripplanner/auth-service'
            sh 'npm run test:coverage -w @tripplanner/auth-service'
          }
        }

        stage('Trip service') {
          when {
            expression { env.BUILD_TRIPS == 'true' }
          }
          steps {
            sh 'npm run check -w @tripplanner/trip-service'
            sh 'npm run test:coverage -w @tripplanner/trip-service'
          }
        }
      }
    }

    stage('Filesystem and dependency scan') {
      parallel {
        stage('Scan frontend') {
          when {
            expression { env.BUILD_FRONTEND == 'true' }
          }
          steps {
            sh 'trivy fs --exit-code 1 --severity HIGH,CRITICAL --no-progress frontend'
            sh 'npm audit --workspace @tripplanner/frontend --omit=dev --audit-level=high'
          }
        }

        stage('Scan auth service') {
          when {
            expression { env.BUILD_AUTH == 'true' }
          }
          steps {
            sh 'trivy fs --exit-code 1 --severity HIGH,CRITICAL --no-progress backend/auth-service'
            sh 'npm audit --workspace @tripplanner/auth-service --omit=dev --audit-level=high'
          }
        }

        stage('Scan trip service') {
          when {
            expression { env.BUILD_TRIPS == 'true' }
          }
          steps {
            sh 'trivy fs --exit-code 1 --severity HIGH,CRITICAL --no-progress backend/trip-service'
            sh 'npm audit --workspace @tripplanner/trip-service --omit=dev --audit-level=high'
          }
        }
      }
    }

    stage('SonarQube analysis') {
      when {
        expression {
          env.BUILD_FRONTEND == 'true' ||
          env.BUILD_AUTH == 'true' ||
          env.BUILD_TRIPS == 'true'
        }
      }
      steps {
        script {
          def scannerHome = tool 'sonar-scanner'
          def analyses = []

          if (env.BUILD_FRONTEND == 'true') {
            analyses << [
              key: 'tripplanner-frontend',
              name: 'TripPlanner Frontend',
              sources: 'frontend/src',
              tests: '',
              coverage: ''
            ]
          }

          if (env.BUILD_AUTH == 'true') {
            analyses << [
              key: 'tripplanner-auth',
              name: 'TripPlanner Auth Service',
              sources: 'backend/auth-service/src',
              tests: 'backend/auth-service/tests',
              coverage: 'backend/auth-service/coverage/lcov.info'
            ]
          }

          if (env.BUILD_TRIPS == 'true') {
            analyses << [
              key: 'tripplanner-trips',
              name: 'TripPlanner Trip Service',
              sources: 'backend/trip-service/src',
              tests: 'backend/trip-service/tests',
              coverage: 'backend/trip-service/coverage/lcov.info'
            ]
          }

          analyses.each { analysis ->
            def optionalProperties = ''

            if (analysis.tests) {
              optionalProperties += " -Dsonar.tests=${analysis.tests}"
            }
            if (analysis.coverage) {
              optionalProperties +=
                " -Dsonar.javascript.lcov.reportPaths=${analysis.coverage}"
            }

            withSonarQubeEnv('sonar-server') {
              sh """
                ${scannerHome}/bin/sonar-scanner \
                  -Dsonar.projectKey=${analysis.key} \
                  -Dsonar.projectName='${analysis.name}' \
                  -Dsonar.sources=${analysis.sources} \
                  -Dsonar.sourceEncoding=UTF-8 \
                  -Dsonar.exclusions='**/node_modules/**,**/coverage/**,**/dist/**' \
                  ${optionalProperties}
              """
            }

            timeout(time: 10, unit: 'MINUTES') {
              waitForQualityGate abortPipeline: true
            }
          }
        }
      }
    }

    stage('Validate Compose') {
      steps {
        sh 'docker compose config --quiet'
      }
    }

    stage('Build images') {
      parallel {
        stage('Build frontend image') {
          when {
            expression { env.BUILD_FRONTEND == 'true' }
          }
          steps {
            sh 'docker build --pull --tag "$FRONTEND_IMAGE" frontend'
          }
        }

        stage('Build auth image') {
          when {
            expression { env.BUILD_AUTH == 'true' }
          }
          steps {
            sh 'docker build --pull --file backend/auth-service/Dockerfile --tag "$AUTH_IMAGE" .'
          }
        }

        stage('Build trip image') {
          when {
            expression { env.BUILD_TRIPS == 'true' }
          }
          steps {
            sh 'docker build --pull --file backend/trip-service/Dockerfile --tag "$TRIP_IMAGE" .'
          }
        }
      }
    }

    stage('Scan images') {
      parallel {
        stage('Scan frontend image') {
          when {
            expression { env.BUILD_FRONTEND == 'true' }
          }
          steps {
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress "$FRONTEND_IMAGE"'
          }
        }

        stage('Scan auth image') {
          when {
            expression { env.BUILD_AUTH == 'true' }
          }
          steps {
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress "$AUTH_IMAGE"'
          }
        }

        stage('Scan trip image') {
          when {
            expression { env.BUILD_TRIPS == 'true' }
          }
          steps {
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress "$TRIP_IMAGE"'
          }
        }
      }
    }

    stage('Push images') {
      when {
        allOf {
          branch 'main'
          expression {
            env.BUILD_FRONTEND == 'true' ||
            env.BUILD_AUTH == 'true' ||
            env.BUILD_TRIPS == 'true'
          }
        }
      }
      steps {
        withCredentials([
          usernamePassword(
            credentialsId: 'docker-cred',
            usernameVariable: 'DOCKERHUB_USERNAME',
            passwordVariable: 'DOCKERHUB_TOKEN'
          )
        ]) {
          sh 'echo "$DOCKERHUB_TOKEN" | docker login "$DOCKER_REGISTRY" --username "$DOCKERHUB_USERNAME" --password-stdin'

          script {
            if (env.BUILD_FRONTEND == 'true') {
              sh 'docker push "$FRONTEND_IMAGE"'
            }
            if (env.BUILD_AUTH == 'true') {
              sh 'docker push "$AUTH_IMAGE"'
            }
            if (env.BUILD_TRIPS == 'true') {
              sh 'docker push "$TRIP_IMAGE"'
            }
          }
        }
      }

      post {
        always {
          sh 'docker logout "$DOCKER_REGISTRY" || true'
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts(
        artifacts: 'backend/*/coverage/**',
        allowEmptyArchive: true,
        fingerprint: false
      )
    }
  }
}
