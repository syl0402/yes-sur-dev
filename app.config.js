// app.json 설정에 빌드할 때만 정해지는 값을 더한다 (2026-11-10, 푸시 알림)
// google-services.json(Firebase)은 키가 들어 있어 커밋하지 않는다.
// - EAS 빌드: EAS 비공개 파일 GOOGLE_SERVICES_JSON(서버에 올려 둔 파일 경로)
// - 내 컴퓨터에서 빌드할 때: 프로젝트 폴더의 google-services.json (.gitignore에 있음)
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
