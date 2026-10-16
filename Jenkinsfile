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
                // เก็บข้อมูลใน MySQL volume ไว้ระหว่าง deploy ปกติ
                sh 'docker compose down -v --remove-orphans || true'
                sh 'docker compose up -d --build'
            }
        }

        stage('3. ตรวจสอบการทำงาน (Post-Deploy Verification)') {
            steps {
                script {
                    sh '''
                        echo "รอให้ MySQL พร้อมรับ connection..."
                        for attempt in $(seq 1 30); do
                            if docker compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -prootpassword --silent; then
                                break
                            fi
                            if [ "$attempt" -eq 30 ]; then
                                echo "MySQL ไม่พร้อมภายใน 60 วินาที"
                                docker compose logs db
                                exit 1
                            fi
                            sleep 2
                        done

                        echo "ตรวจสอบตารางและข้อมูลเริ่มต้น..."
                        table_count=$(docker compose exec -T db mysql -uroot -prootpassword -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'mydb' AND table_name IN ('users', 'appointments', 'billing_invoices')")
                        if [ "$table_count" != "3" ]; then
                            echo "ตาราง DB ไม่ครบ (พบ $table_count จาก 3 ตารางที่ต้องมี)"
                            docker compose exec -T db mysql -uroot -prootpassword mydb -e "SHOW TABLES"
                            exit 1
                        fi

                        admin_count=$(docker compose exec -T db mysql -uroot -prootpassword mydb -Nse "SELECT COUNT(*) FROM users WHERE email = 'admin@petclinic.com'")
                        if [ "$admin_count" != "1" ]; then
                            echo "ไม่พบข้อมูล admin seed ในฐานข้อมูล"
                            exit 1
                        fi
                    '''

                    // เช็กว่าแอป Node.js ตอบสนองหลังตรวจ DB แล้ว
                    def status = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://host.docker.internal:3000/health || curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health",
                        returnStdout: true
                    ).trim()

                    if (status != '200') {
                        error("ระบบมีปัญหา! HTTP Status: ${status}")
                    } else {
                        echo "ตรวจสอบสำเร็จ: Web ตอบ HTTP 200 และ MySQL มี schema/data ที่ต้องใช้"
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