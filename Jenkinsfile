pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'myteam/app'
        APP_NAME     = 'team-web-app'
        DEPLOY_PORT  = '3000'
        SECRETS_CRED = credentials('app-prod-secrets') // เรียกใช้จาก Jenkins Credentials Manager
    }

    stages {
        stage('Checkout & Security Scan') {
            steps {
                checkout scm
                // สแกนหารหัสผ่านหลุดในขั้นตอน CI
                sh 'docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v'
            }
        }

        stage('Build & Test') {
            steps {
                script {
                    // Build Image สำหรับทดสอบ
                    sh "docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} ."
                    
                    // รัน Unit Test / Integration Test อัตโนมัติ
                    sh "docker run --rm ${DOCKER_IMAGE}:${BUILD_NUMBER} npm test"
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // หยุด Container เก่า (ถ้ามี)
                    sh "docker stop ${APP_NAME} || true"
                    sh "docker rm ${APP_NAME} || true"
                    
                    // รัน Container ใหม่โดยส่ง Environment Variables เข้าไป
                    sh """
                        docker run -d \
                          --name ${APP_NAME} \
                          -p ${DEPLOY_PORT}:3000 \
                          --env-file ${SECRETS_CRED} \
                          --restart unless-stopped \
                          ${DOCKER_IMAGE}:${BUILD_NUMBER}
                    """
                }
            }
        }

        stage('Automated Post-Deploy Verification') {
            steps {
                script {
                    echo "Waiting for service to spin up..."
                    sleep time: 10, unit: 'SECONDS'
                    
                    // ยืนยันผลหลัง Deploy ด้วย HTTP Smoke Test
                    def response = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:${DEPLOY_PORT}/health",
                        returnStdout: true
                    ).trim()

                    if (response != '200') {
                        error("Post-deploy verification failed! HTTP Status: ${response}")
                    } else {
                        echo "Post-deploy health check passed successfully (HTTP 200)."
                    }
                }
            }
        }
    }

    post {
        failure {
            script {
                // Rollback อัตโนมัติหากการยืนยันผลล้มเหลว
                echo "Rollback trigger: Cleaning up failed container..."
                sh "docker stop ${APP_NAME} || true"
            }
        }
        always {
            // ทำความสะอาด Image ที่ไม่ได้ใช้เพื่อประหยัดพื้นที่
            sh 'docker image prune -f'
        }
    }
}