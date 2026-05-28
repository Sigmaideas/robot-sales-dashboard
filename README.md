# 로봇 판매 대시보드

월별 로봇 판매량을 드래그 앤 드롭으로 시각화하는 정적 대시보드입니다.
아이콘 1개 = 로봇 1대 판매로 표현되며, 12개월 칸에 쌓아 한눈에 비교할 수 있습니다.

## 사용법

### 판매 추가
- 우측 **로봇 팔레트**에서 모델 아이콘을 잡고, 좌측의 원하는 월(月) 칸에 끌어다 놓으면 1대가 추가됩니다.
- 팔레트 아이콘은 무한 드래그 소스이므로 여러 번 끌어 써도 사라지지 않습니다.

### 판매 이동
- 이미 쌓여 있는 아이콘을 잡고 다른 월의 칸에 떨어뜨리면 해당 월에서 빠지고 새 월로 옮겨갑니다.

### 판매 삭제
- 이미 쌓여 있는 아이콘을 잡고 우측 **로봇 팔레트** 영역에 떨어뜨리면 삭제됩니다.

### 연도 변경
- 헤더 오른쪽의 드롭다운에서 연도를 선택하면 해당 연도의 데이터가 즉시 표시됩니다.
- 연도별 데이터는 독립적으로 저장됩니다.

### 초기화
- 헤더의 **초기화** 버튼을 누르면 확인 모달이 뜨고, 확인 시 *현재 선택된 연도*의 데이터만 모두 지웁니다.

### 자동 저장
- 모든 추가/이동/삭제/초기화는 즉시 브라우저 `localStorage`에 저장됩니다.
- 키 형식: `salesData.<연도>` (예: `salesData.2026`)
- 값 형식: `{ "1": { "baris": 3, "storagy": 2, "deux": 1 }, "2": {...}, ... }`

## 새 로봇 모델 추가하기

1. `icons/` 폴더에 새 모델의 아이콘 파일을 추가합니다 (예: `icons/newbot.svg`).
2. `script.js` 상단의 `ROBOTS` 배열에 항목을 추가합니다.

```js
const ROBOTS = [
  { id: 'baris',   name: '바리스',   icon: 'icons/baris.svg',   color: '#3b82f6' },
  { id: 'storagy', name: '스토리지', icon: 'icons/storagy.svg', color: '#10b981' },
  { id: 'deux',    name: '듀스',     icon: 'icons/deux.svg',    color: '#f97316' },
  // 새 모델 추가 예시:
  { id: 'newbot',  name: '뉴봇',     icon: 'icons/newbot.svg',  color: '#a855f7' },
];
```

- `id`: localStorage 저장 키로 쓰이는 영문 식별자 (한 번 정하면 변경 시 기존 데이터 호환이 깨지므로 신중히).
- `name`: 화면에 표시되는 한국어(또는 다국어) 이름.
- `icon`: `index.html` 기준 상대 경로의 아이콘 파일.
- `color`: 하단 요약 영역 배지의 컬러 스와치.

저장은 그대로 두고 코드만 수정하면 기존 모델의 누적값은 유지됩니다.

## 로컬 미리보기

`file://` 로 직접 열어도 동작하지만, 일부 브라우저는 로컬 파일 보안 정책으로 SVG/이미지 로딩을 막을 수 있어 정적 서버를 띄우는 것이 안정적입니다.

```bash
# 작업 디렉토리에서
cd /Users/mrmute/Documents/robot-sales-dashboard

# 옵션 1: Python 내장 서버
python3 -m http.server 8000

# 옵션 2: Node 사용 (npx 필요)
npx serve .
```

브라우저에서 `http://localhost:8000` 으로 접속하세요.

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 만들고 푸시합니다.
   ```bash
   cd /Users/mrmute/Documents/robot-sales-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-id>/<repo-name>.git
   git push -u origin main
   ```
2. GitHub 저장소 페이지로 가서 **Settings → Pages** 메뉴로 이동합니다.
3. **Build and deployment** 항목에서 Source 를 **Deploy from a branch** 로 두고, Branch 를 `main`, 폴더를 `/ (root)` 로 선택한 뒤 Save.
4. 잠시 후 표시되는 `https://<your-id>.github.io/<repo-name>/` 주소로 접속하면 배포가 완료됩니다.

> 별도 빌드 단계가 없는 정적 사이트(HTML/CSS/JS만)이므로 추가 설정은 필요 없습니다.

## 파일 구조

```
robot-sales-dashboard/
├── index.html       # 페이지 마크업
├── style.css        # 다크 톤 스타일
├── script.js        # 드래그/드롭, 저장, 렌더링 로직
├── icons/
│   ├── baris.svg
│   ├── storagy.svg
│   └── deux.svg
└── README.md
```

## 메모

- 외부 라이브러리는 사용하지 않으며, HTML5 Drag and Drop API 만 씁니다.
- 모바일/터치 환경은 현재 미지원입니다 (HTML5 DnD 가 모바일에서 동작하지 않음). 필요하면 [Pointer Events 기반 폴리필](https://github.com/Bernardo-Castilho/dragdroptouch) 등을 적용할 수 있습니다.
- 2026년 1~4월에는 시각 확인용 샘플 데이터가 자동 입력되어 있습니다 (이미 데이터가 있으면 덮어쓰지 않음).
