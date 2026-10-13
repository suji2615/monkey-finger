# Monkey Motion Study

웹캠에서 검지 끝의 움직임을 읽어 여섯 개의 원숭이 영상을 제어하는 Vite 웹 앱입니다. 영상은 프로젝트의 `videos/monkey01.mp4`부터 `videos/monkey06.mp4`까지에서 불러오며, 현재 영상과 다음 영상만 로딩합니다. MediaPipe WASM 파일은 설치된 `@mediapipe/tasks-vision` 패키지에서 개발 서버 및 프로덕션 빌드 전에 복사하여 같은 출처에서 제공합니다.

## 설치 및 실행

1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전을 설치합니다. 설치 후 터미널을 새로 엽니다.
2. 터미널에서 프로젝트 폴더로 이동합니다.

   ```bash
   cd ~/Desktop/interactive-web/claude
   ```

3. 필요한 패키지를 설치합니다.

   ```bash
   npm install
   ```

4. 개발 서버를 시작합니다.

   ```bash
   npm run dev
   ```

5. 터미널에 표시된 주소(보통 `http://localhost:5173`)를 Chrome 또는 Safari에서 엽니다.
6. **카메라 시작**을 누르고 브라우저의 카메라 권한 요청을 허용합니다. 손 인식 모델을 처음 불러올 때 인터넷 연결이 필요합니다. WASM 런타임은 설치된 패키지 버전과 일치하는 파일을 로컬에서 사용합니다.

## 조작

- 검지 끝을 아래로 움직이면 영상이 정방향으로 재생됩니다.
- 검지 끝을 위로 움직이면 영상이 역방향으로 되감깁니다.
- 손가락을 멈추면 영상도 멈춥니다.
- 화면 양쪽의 화살표를 눌러 영상을 전환합니다. 첫 영상과 마지막 영상은 순환합니다.
- 카메라는 `localhost` 또는 HTTPS 주소에서만 사용할 수 있습니다.

프로덕션 빌드는 `npm run build`로 만들고, 결과는 `dist/` 폴더에 생성됩니다. 영상 목록과 영상별 손가락 진행 방향·감도는 `src/main.js`의 `filmLibrary` 배열에서 관리합니다.

## NAS Docker 실행

NAS에서 다음 명령으로 정적 앱 이미지를 빌드하고 실행합니다.

```bash
docker compose up -d --build
docker compose ps
```

컨테이너는 NAS의 `127.0.0.1:18080`에서만 HTTP를 받습니다. NAS 안에서는 `curl http://127.0.0.1:18080/`로 확인합니다. 로그는 `docker compose logs --tail=100 web`, 중지는 `docker compose down`, 소스 갱신 후 재배포는 `docker compose up -d --build`를 사용합니다. 컨테이너는 `unless-stopped` 정책으로 재시작됩니다.

### `monkey-finger.com` 연결

1. 가비아 DNS 관리툴에서 `monkey-finger.com`의 `@` A 레코드를 NAS의 **현재** 공인 IP로 설정합니다. 적용 전 `refolio.synology.me`의 주소와 NAS 공인 IP가 일치하는지 확인합니다. 기존 DNS 레코드는 확인하고 변경합니다.
2. 라우터의 공인 TCP 80이 NAS 80으로 전달되고 NAS 방화벽이 허용하는지 확인합니다. Synology DSM의 사용자 지정 도메인 Let's Encrypt 인증서 발급과 자동 갱신에 계속 필요합니다. 443도 NAS로 전달되어야 사이트에 접속할 수 있습니다.
3. DSM **제어판 → 로그인 포털 → 고급 → 역방향 프록시**에서 `HTTPS / monkey-finger.com / 443`을 `HTTP / localhost / 18080`으로 연결합니다. 기존 프록시 항목은 그대로 둡니다.
4. DSM **제어판 → 보안 → 인증서**에서 `monkey-finger.com`용 Let's Encrypt 인증서를 발급하고 새 프록시 항목에 할당합니다. 기존 DSM 기본 인증서는 바꾸지 않습니다.
5. 외부망에서 `https://monkey-finger.com/`을 열고 카메라 권한과 손 추적을 확인합니다. 내부망에서만 접속에 실패하면 라우터의 NAT 루프백 지원 여부를 확인합니다.

공인 IP가 바뀌면 가비아의 `@` A 레코드를 새 IP로 갱신해야 합니다. NAS 또는 라우터 재시작 후, 그리고 월 1회 `monkey-finger.com`과 `refolio.synology.me`의 주소를 비교합니다. 첫 모델 다운로드에는 브라우저의 인터넷 연결이 필요합니다. HTTP로 접속하면 카메라가 차단될 수 있으므로 HTTPS 주소를 사용합니다.
