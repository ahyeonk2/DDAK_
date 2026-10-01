# DDAK GitHub 배포

Google 로그인과 SQLite 저장을 사용하는 Node 24 앱입니다. GitHub Pages는 정적 호스팅이라 전체 앱을 실행할 수 없습니다. GitHub 저장소에 소스를 올린 뒤 Render 서버에 연결하는 구성을 포함했습니다. 아직 실제 저장소 업로드나 배포는 수행하지 않았습니다.

## 1. GitHub에 올리기

GitHub에서 빈 저장소를 만드세요. 프로젝트 폴더에서 아래 명령을 실행합니다. YOUR_NAME을 자신의 GitHub 사용자명으로 바꿉니다.

```sh
git init -b main
git add .
git commit -m "Prepare DDAK for deployment"
git remote add origin https://github.com/YOUR_NAME/DDAK.git
git push -u origin main
```

이미 origin이 있으면 remote add를 반복하지 않습니다. 인증은 GitHub 또는 GitHub Desktop에서 직접 진행하세요. `.env`, 데이터베이스, 로그인 세션, node_modules는 업로드 대상에서 제외되어 있습니다.

## 2. 서버 배포

Render에서 New → Blueprint를 선택하고 GitHub 저장소를 연결합니다. 루트의 `render.yaml`을 읽습니다. 이 구성은 **유료 Starter 웹 서비스와 1GB 영구 디스크**를 생성합니다. 비용을 확인한 뒤 생성하세요.

입력할 환경 변수:

- `GOOGLE_CLIENT_ID`: Google Cloud 웹 애플리케이션 OAuth 클라이언트 ID. 비밀 키는 필요하지 않습니다.
- `APP_ORIGIN`: 실제 배포 주소. 예: `https://ddak-xxxx.onrender.com`. 경로나 마지막 `/`를 붙이지 않습니다. 실제 할당된 주소와 반드시 같아야 합니다.

서비스 생성 후 실제 주소가 다르면 APP_ORIGIN을 수정하고 재배포합니다. Google Cloud의 승인된 JavaScript 원본에도 같은 HTTPS 주소를 등록합니다. 로그인 설정은 GOOGLE-SETUP.md를 참고하세요.

Dockerfile이 테스트와 빌드를 수행하고 서버를 실행합니다. `/app/data`의 SQLite 파일은 영구 디스크에 저장됩니다. 디스크 없는 무료 인스턴스로 바꾸면 재배포 시 사용자와 프로젝트 데이터가 사라질 수 있습니다. SQLite는 한 서버 인스턴스로 운영합니다. 주기적으로 디스크 스냅샷/백업을 관리하세요.

GitHub Actions는 push 및 pull request에서 테스트, 프론트 빌드, Docker 빌드를 검사합니다. Render의 자동 배포 설정은 검사 통과 후 배포하도록 설정하세요.

## 3. 배포 확인

1. HTTPS 주소에서 Google 로그인합니다. 실제 계정으로는 아직 검증하지 않았습니다.
2. 첫 계정에 빈 프로젝트 목록이 표시되는지 확인합니다.
3. 프로젝트를 만들고 목표와 투두를 저장합니다.
4. 다른 Google 계정으로 초대 링크에 참여해 공유와 수정 권한을 확인합니다.
5. 재배포 후 프로젝트가 유지되는지 확인합니다.

현재 로컬의 미리보기 데이터는 서버로 이전되지 않습니다. 운영에서는 미리보기 버튼이 표시되지 않습니다.

공식 문서: [GitHub Pages](https://docs.github.com/en/pages), [Render Blueprint](https://render.com/docs/blueprint-spec), [영구 디스크](https://render.com/docs/disks).
