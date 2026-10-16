pipeline {
    agent any

    stages {
        stage('1. ดึงโค้ดล่าสุด') {
            steps {
                checkout scm
            }
        }

        stage('2. สตาร์ต Web และ MySQL') {
            steps {
                // รัน Docker Compose เพื่อ Build Node.js และเปิด MySQL
                sh 'docker compose down --remove-orphans || true'
                sh 'docker compose up -d --build'
            }
        }

        stage('3. ตรวจสอบการทำงาน (Post-Deploy Verification)') {
            steps {
                script {
                    echo "รอให้ระบบสตาร์ต 10 วินาที..."
                    sleep 10

                    // เรียกเช็ก Endpoint /health เพื่อยืนยันว่า Node.js และ MySQL ทำงานปกติ
                    def status = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://host.docker.internal:3000/health || curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health",
                        returnStdout: true
                    ).trim()

                    if (status != '200') {
                        error("ระบบมีปัญหา! HTTP Status: ${status}")
                    } else {
                        echo "ตรวจสอบสำเร็จ: Web และ MySQL ทำงานปกติ (HTTP 200)"
                    }
                }
            }
        }
    }

    post {
        failure {
            echo "Deployment ล้มเหลว ทำการตรวจสอบ Log"
            sh 'docker compose logs'
        }
        always {
            // เคลียร์ Image เก่าที่ไม่ใช้เพื่อประหยัดดิสก์
            sh 'docker image prune -f'
        }
    }
}