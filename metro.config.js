// Metro(앱 코드를 묶는 도구) 설정 (2026-11-10, Sentry)
// Sentry 버전: 묶은 코드에 표시(Debug ID)를 달아, 오류가 원래 코드 몇째 줄인지 Sentry에서 보이게 한다
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = config;
