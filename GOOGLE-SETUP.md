# DDAK Google 로그인 연결

준비할 것은 **웹 애플리케이션 OAuth 2.0 클라이언트 ID**입니다. 클라이언트 비밀 키는 필요하지 않습니다.

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택하거나 만듭니다.
2. Google Auth Platform에서 앱 이름을 **DDAK**으로 설정하고 동의 화면의 기본 정보와 사용 대상을 설정합니다. 테스트 모드라면 로그인에 사용할 Google 계정을 테스트 사용자로 추가합니다.
3. Clients에서 OAuth 클라이언트를 만들고 유형을 **웹 애플리케이션**으로 선택합니다.
4. 승인된 JavaScript 원본에 아래 두 주소를 등록합니다. 경로나 끝의 `/`는 넣지 않습니다.
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
5. `.env.example`을 `.env`로 복사하고 받은 클라이언트 ID를 넣습니다.

```dotenv
GOOGLE_CLIENT_ID=발급받은_ID.apps.googleusercontent.com
APP_ORIGIN=http://localhost:5173
PORT=5173
HOST=127.0.0.1
DATABASE_PATH=data/deoreonae.sqlite
```

6. 실행 중인 서버를 `Ctrl+C`로 종료하고 `start.command`를 다시 실행합니다.
7. `http://localhost:5173/`에서 공식 Google 로그인 버튼으로 로그인합니다. 처음 가입하면 Google 이름이 적용되고 팀프로젝트가 없는 첫 화면이 나옵니다.

이 앱은 Google Identity Services의 JavaScript callback으로 ID 토큰을 서버에 전달합니다. 서버가 Google Auth Library로 토큰을 검증한 후 자체 세션 쿠키를 만듭니다. 비밀 키를 브라우저에 넣지 않습니다. client ID 설정이 없는 상태를 성공한 Google 로그인처럼 흉내 내지 않습니다.

배포할 때는 HTTPS 사이트 주소를 승인된 JavaScript 원본에 추가하고 `APP_ORIGIN`과 `NODE_ENV=production`을 설정하세요. 동일한 서버와 DB에 접속한 팀원끼리 데이터가 공유됩니다. localhost 주소는 다른 사람의 컴퓨터에서 같은 방으로 연결되지 않습니다.

공식 자료:
- [Google 로그인 설정](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [공식 로그인 버튼 표시](https://developers.google.com/identity/gsi/web/guides/display-button)
- [서버에서 ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
